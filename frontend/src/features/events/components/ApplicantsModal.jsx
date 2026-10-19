import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal, { ModalHead } from '../../../components/ui/Modal';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { useEvents } from '../../../hooks/useEvents';
import { downloadXlsx } from '../../../utils/xlsxExport';
import { buildSignInSheets, buildAttendanceSheet } from '../utils/signInSheet';
import { formatThaiDate, formatThaiDateTime, todayIso } from '../../../utils/dateFormat';
import { formatBaht } from '../../../utils/money';
import SlipReviewModal from './SlipReviewModal';
import { CertIssueReview } from '../../certificates/components/CertIssuePreview';
import { PAYMENT_STATUS, REFUND_METHODS, formatPromptPay } from './PaymentBox';
import { initials } from '../../../utils/initials';

// How a registrant attends. Only an event held both ways ("hybrid") has people
// of both kinds, and only then are the two shown and checked apart.
const VIA = {
  onsite: { label: 'Onsite', long: 'ที่สถานที่จัด', icon: 'ti-building' },
  online: { label: 'Online', long: 'ออนไลน์', icon: 'ti-broadcast' },
};

// What the applicant list can be narrowed to: how people attend (hybrid events
// only) and the things an organizer has to prepare for (machines to lend, food
// to keep apart).
const FILTERS = {
  onsite: { label: 'Onsite', what: 'เข้าร่วมที่สถานที่จัด', icon: VIA.onsite.icon, hybridOnly: true, match: (p) => p.via === 'onsite' },
  online: { label: 'Online', what: 'เข้าร่วมออนไลน์', icon: VIA.online.icon, hybridOnly: true, match: (p) => p.via === 'online' },
  laptop: { label: 'ขอยืมโน้ตบุ๊ก', what: 'ขอยืมโน้ตบุ๊ก', icon: 'ti-device-laptop', match: (p) => p.wantsLaptop },
  allergy: { label: 'แพ้อาหาร', what: 'แพ้อาหาร', icon: 'ti-alert-triangle', match: (p) => !!p.foodAllergy },
  // No longer asked at registration; offered only where older registrations still carry one.
  diet: { label: 'มีข้อจำกัดด้านอาหาร', what: 'มีข้อจำกัดด้านอาหาร', icon: 'ti-tools-kitchen-2', legacy: true, match: (p) => !!p.dietaryPref },
  // Teachers take seats in the room but don't pay and aren't counted in reports; offered when any registered.
  teacher: { label: 'อาจารย์', what: 'เป็นอาจารย์', icon: 'ti-school', legacy: true, match: (p) => p.isTeacher },
};

// The slip-checking tab sorts a paid event's registrants into three piles, in
// the order of what needs doing.
const SLIP_GROUPS = [
  { key: 'waiting', label: 'รอตรวจสลิป', icon: 'ti-receipt', match: (p) => p.paymentStatus === 'submitted' },
  { key: 'checked', label: 'ตรวจแล้ว', icon: 'ti-circle-check', match: (p) => p.paymentStatus === 'paid' || p.paymentStatus === 'rejected' },
  { key: 'unsent', label: 'ยังไม่ส่งสลิป', icon: 'ti-clock', match: (p) => p.paymentStatus === 'pending' },
  // Only for events that give money back (or were cancelled): who to refund, who has been.
  { key: 'refund', label: 'คืนเงิน', icon: 'ti-receipt-refund', refunds: true, match: (p) => ['paid', 'submitted', 'refunded'].includes(p.paymentStatus) },
];
const held = (p) => p.paymentStatus === 'paid' || p.paymentStatus === 'submitted';

// One window, separate jobs kept apart: mode "slips" opens the list window on
// its slip-checking tab (paid events), mode "list" is for looking through who
// applied (how they attend, what they need, whether they paid, the sign-in
// sheet) and mode "checkin" is for ticking off who actually came, day by day.
export default function ApplicantsModal({ eventId, open, onClose, mode = 'list' }) {
  const checkin = mode === 'checkin';
  const [tab, setTab] = useState('list'); // list window only: 'list' | 'slips'
  const [slipGroup, setSlipGroup] = useState('waiting');
  const { evById, rosters, toggleCheckin, setPaymentStatus, issueCertificate, pushToast } = useEvents();
  const navigate = useNavigate();
  const certIssued = evById(eventId)?.stage === 4; // certificates already opened to attendees
  const [query, setQuery] = useState('');
  const [reviewRegId, setReviewRegId] = useState(null); // whose payment is being checked
  const [confirmCert, setConfirmCert] = useState(false);
  const [refundAsk, setRefundAsk] = useState(null); // { p, on } — marking a refund (or taking it back), waiting for confirmation
  const [refundBusy, setRefundBusy] = useState(false);

  const ev = eventId ? evById(eventId) : null;
  const roster = useMemo(() => (eventId ? (rosters[eventId] || []) : []), [eventId, rosters]);
  const hybrid = ev?.attendMode === 'hybrid';
  const onlineOnly = ev?.attendMode === 'online';
  // An event that runs over several days is checked in day by day: `day` is
  // the one being checked now. It opens on today when today is an event day.
  const days = useMemo(
    () => roster[0]?.eventDays || (ev ? (ev.dates.length ? ev.dates : [ev.dateStart]) : []),
    [roster, ev],
  );
  const multiDay = days.length > 1;
  const [day, setDay] = useState('');
  const [need, setNeed] = useState('all'); // 'all' or a key of FILTERS — list mode only
  const [group, setGroup] = useState('onsite'); // which half of a hybrid event is being checked in
  // Checking slips one after another: a verdict on a waiting slip opens the next one by itself.
  const [queue, setQueue] = useState(false);
  const verdictGiven = useRef(false);
  useEffect(() => {
    if (!open) return;
    // A cancelled event is opened to pay people back: start on the refunds.
    const cancelled = evById(eventId)?.listed === false;
    setDay(''); setNeed('all'); setGroup('onsite'); setQueue(false); setRefundAsk(null);
    setTab(mode === 'slips' || cancelled ? 'slips' : 'list'); setSlipGroup(cancelled ? 'refund' : 'waiting');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, eventId, mode]);
  const needMatch = !checkin && FILTERS[need] && (hybrid || !FILTERS[need].hybridOnly) ? FILTERS[need].match : null;
  const activeDay = days.includes(day) ? day : (days.includes(todayIso()) ? todayIso() : days[0]);
  const inDay = (p) => p.days.includes(activeDay);

  // The people the check-in view is about: one half of a hybrid event, or everyone.
  const groupMatch = checkin && hybrid ? FILTERS[group].match : null;
  const shown = useMemo(() => (groupMatch ? roster.filter(groupMatch) : roster), [roster, groupMatch]);
  const inCount = shown.filter(inDay).length;
  const fullCount = shown.filter((p) => p.in).length; // checked in on every day
  const pct = shown.length ? Math.round((inCount / shown.length) * 100) : 0;
  const onsiteCount = roster.filter(FILTERS.onsite.match).length;
  const onlineCount = roster.length - onsiteCount;
  const laptopCount = roster.filter((p) => p.wantsLaptop).length;
  const allergyCount = roster.filter((p) => p.foodAllergy).length;
  const dietCount = roster.filter((p) => p.dietaryPref).length;
  const paidEvent = ev?.fee > 0 || roster.some((p) => p.paymentStatus !== 'none');
  const paidCount = roster.filter((p) => p.paymentStatus === 'paid').length;
  const payable = roster.filter((p) => p.paymentStatus !== 'none').length;
  const toReview = roster.filter((p) => p.paymentStatus === 'submitted').length;
  const slipsTab = !checkin && paidEvent && tab === 'slips';
  // Money goes back on this event: it says so, or it was cancelled with people paid.
  const cancelled = ev?.listed === false;
  const refundsOn = !!ev && (ev.refundMethod !== 'none' || cancelled);
  const refundLeft = roster.filter(held).length;
  const refundDone = roster.filter((p) => p.paymentStatus === 'refunded').length;
  const slipGroups = SLIP_GROUPS.filter((g) => !g.refunds || refundsOn);
  async function confirmRefund() {
    setRefundBusy(true);
    await setPaymentStatus(eventId, refundAsk.p.regId, refundAsk.on ? 'refund' : 'unrefund');
    setRefundBusy(false);
    setRefundAsk(null);
  }
  const slipRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = SLIP_GROUPS.find((g) => g.key === slipGroup).match;
    return roster.filter(match).filter((p) => !q || (p.name + ' ' + p.sid).toLowerCase().includes(q));
  }, [roster, query, slipGroup]);
  const openReview = (p) => { setQueue(p.paymentStatus === 'submitted'); setReviewRegId(p.regId); };
  const reviewing = reviewRegId ? roster.find((p) => p.regId === reviewRegId) : null;
  const showDiet = !!ev?.askDietary || roster.some((p) => p.foodAllergy || p.dietaryPref);

  // Online attendees check themselves in: this is the link for the day being
  // checked, to show in the online room. It only works on that day, for a
  // signed-in registrant who attends online.
  const selfLinkDay = (onlineOnly || (hybrid && group === 'online')) ? activeDay : '';
  const selfKey = selfLinkDay ? roster[0]?.checkinKeys?.[selfLinkDay] : '';
  const selfLink = selfKey ? `${window.location.origin}/checkin/${eventId}?d=${selfLinkDay}&k=${selfKey}` : '';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return roster
      .map((p, i) => ({ ...p, i }))
      .filter((p) => !groupMatch || groupMatch(p))
      .filter((p) => !needMatch || needMatch(p))
      .filter((p) => !q || (p.name + ' ' + p.sid).toLowerCase().includes(q));
  }, [roster, query, needMatch, groupMatch]);

  const allChecked = filtered.length > 0 && filtered.every(inDay);

  function toggleAll() {
    const next = !allChecked;
    filtered.forEach((p) => {
      if (inDay(p) !== next) toggleCheckin(eventId, p.i, activeDay);
    });
  }

  if (!open || !eventId) return null;
  if (reviewing) {
    return (
      <SlipReviewModal
        open
        person={reviewing}
        fee={ev?.fee || 0}
        remaining={queue ? roster.filter((p) => p.paymentStatus === 'submitted' && p.regId !== reviewing.regId).length : 0}
        onAction={async (action, reason) => {
          const ok = await setPaymentStatus(eventId, reviewing.regId, action, reason);
          verdictGiven.current = !!ok;
          return ok;
        }}
        onClose={() => {
          // In the queue, a verdict moves on to the next waiting slip; closing without one leaves the queue.
          const next = queue && verdictGiven.current ? roster.find((p) => p.paymentStatus === 'submitted' && p.regId !== reviewing.regId) : null;
          verdictGiven.current = false;
          if (!next) setQueue(false);
          setReviewRegId(next ? next.regId : null);
        }}
      />
    );
  }

  async function copySelfLink() {
    try {
      await navigator.clipboard.writeText(selfLink);
      pushToast('คัดลอกลิงก์เช็คชื่อแล้ว', `ใช้ได้เฉพาะวันที่ ${formatThaiDate(selfLinkDay)}`);
    } catch {
      pushToast('คัดลอกไม่สำเร็จ', 'เลือกข้อความในช่องลิงก์แล้วคัดลอกเอง', 'warn');
    }
  }

  // Sign-in sheet to print: one Excel sheet per day of the event, the day's
  // date over an empty morning and afternoon box per person. Paper is for the
  // people in the room, so those attending online are left off it, and so are
  // teachers, who are not counted as participants.
  function exportRoster() {
    const people = roster.filter((p) => p.via === 'onsite' && !p.isTeacher).filter((p) => !needMatch || needMatch(p));
    const noteOf = (p) => [
      p.wantsLaptop && 'ยืมโน้ตบุ๊ก',
      p.foodAllergy && `แพ้: ${p.foodAllergy}`,
      p.dietaryPref,
      p.paymentStatus !== 'none' && PAYMENT_STATUS[p.paymentStatus]?.label,
    ].filter(Boolean).join(' · ');
    downloadXlsx(
      `ใบลงชื่อ${needMatch && need !== 'onsite' ? `-${FILTERS[need].label}` : ''}-${(ev?.title || '').slice(0, 30)}`,
      buildSignInSheets({ ev, days, people, noteOf }),
    );
    pushToast('ดาวน์โหลดใบลงชื่อแล้ว', [
      hybrid ? `เฉพาะผู้เข้าร่วมที่สถานที่จัด ${people.length} คน` : `${people.length} คน`,
      needMatch && need !== 'onsite' && `ที่${FILTERS[need].what}`,
      multiDay ? `แยกแผ่นงานวันละแผ่น ${days.length} วัน` : 'มีช่องลงชื่อเช้า/บ่าย',
    ].filter(Boolean).join(' · '));
  }

  // Check-in result: who came on which day, as recorded in the system — laid
  // out like the sign-in sheet, everyone in one table.
  function exportAttendance() {
    const people = roster.filter((p) => !p.isTeacher);
    downloadXlsx(`ผลการเช็คอิน-${(ev?.title || '').slice(0, 30)}`, buildAttendanceSheet({ ev, days, people, showVia: hybrid }));
    pushToast('ดาวน์โหลดผลการเช็คอินแล้ว', `${people.length} คน${hybrid ? ' · รวม Onsite และ Online' : ''}`);
  }

  const chips = Object.entries(FILTERS).filter(([, f]) => (hybrid || !f.hybridOnly) && (!f.legacy || roster.some(f.match)));
  const groupWord = hybrid ? ` ${VIA[group].label}` : '';

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <ModalHead eyebrow={checkin ? 'เช็คอินผู้เข้าร่วม' : slipsTab ? 'ตรวจสอบสลิป' : 'รายชื่อผู้สมัคร'} icon={checkin ? 'ti-checkbox' : slipsTab ? 'ti-receipt' : 'ti-users'} title={(ev?.title || '').slice(0, 40)} onClose={onClose} />
      <div className="modal-body">
        {!checkin && paidEvent && (
          <div className="segmented ci-tabs" role="tablist" aria-label="เลือกงานที่จะทำ">
            <button type="button" role="tab" aria-selected={tab === 'list'} className={`seg-btn${tab === 'list' ? ' active' : ''}`} onClick={() => setTab('list')}>
              <i className="ti ti-users" /> รายชื่อผู้สมัคร
            </button>
            <button type="button" role="tab" aria-selected={tab === 'slips'} className={`seg-btn${tab === 'slips' ? ' active' : ''}`} onClick={() => setTab('slips')}>
              <i className="ti ti-receipt" /> ตรวจสอบสลิป {toReview > 0 && <span className="ci-tab-count" aria-label={`รอตรวจ ${toReview} รายการ`}>{toReview}</span>}
            </button>
          </div>
        )}
        {slipsTab ? (
          <>
            {/* Three piles to pick from; the numbers are the filter. */}
            {cancelled && (
              <p className="ci-refund-banner" role="status">
                <i className="ti ti-calendar-off" /> กิจกรรมนี้ถูกยกเลิกแล้ว · {refundLeft > 0 ? `ต้องคืนเงินอีก ${refundLeft} คน` : 'คืนเงินครบทุกคนแล้ว'} · วิธีคืน: {REFUND_METHODS[ev.refundMethod]?.label}{ev.refundNote ? ` · ${ev.refundNote}` : ''}
              </p>
            )}
            <div className="slip-groups" role="tablist" aria-label="กรองตามสถานะการตรวจสลิป">
              {slipGroups.map((g) => {
                const n = roster.filter(g.match).length;
                const hint = g.key === 'waiting' ? 'ส่งสลิปแล้ว ยังไม่ได้ตรวจ'
                  : g.key === 'checked' ? `ผ่าน ${paidCount} · ไม่ผ่าน ${roster.filter((p) => p.paymentStatus === 'rejected').length}`
                    : g.key === 'refund' ? `คืนแล้ว ${refundDone} · ยังไม่คืน ${refundLeft}`
                      : 'สมัครแล้ว ยังไม่แนบสลิป';
                return (
                  <button type="button" key={g.key} role="tab" aria-selected={slipGroup === g.key} className={`slip-group ${g.key}${slipGroup === g.key ? ' active' : ''}`} onClick={() => setSlipGroup(g.key)}>
                    <span className="sg-top"><i className={`ti ${g.icon}`} /> {g.label}</span>
                    <strong>{n}</strong>
                    <small>{hint}</small>
                  </button>
                );
              })}
            </div>
            <div className="input-search" style={{ marginBottom: 12 }}>
              <i className="ti ti-search" />
              <input type="text" placeholder="ค้นหารหัสนักศึกษา/ชื่อ..." value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            {slipGroup === 'waiting' && slipRows.length > 0 && (
              <p className="ci-hint" style={{ marginBottom: 8 }}><i className="ti ti-info-circle" /> กด "ตรวจสลิป" แล้วตัดสินผ่านหรือไม่ผ่าน ระบบจะเปิดสลิปใบถัดไปให้เองจนหมด</p>
            )}
            <div>
              {slipRows.length === 0 && (
                <div className="empty-state">
                  {query.trim() ? 'ไม่พบรายชื่อที่ตรงกับคำค้นหา'
                    : slipGroup === 'waiting' ? 'ไม่มีสลิปรอตรวจ · ตรวจครบทุกใบที่ส่งมาแล้ว'
                      : slipGroup === 'checked' ? 'ยังไม่มีสลิปที่ตรวจแล้ว'
                        : slipGroup === 'refund' ? 'ยังไม่มีผู้ชำระเงิน' : 'ผู้สมัครทุกคนส่งสลิปแล้ว'}
                </div>
              )}
              {slipRows.map((p) => (
                <div className="ci-row" key={p.regId}>
                  <div className="ci-av">{initials(p.name)}</div>
                  <div className="ci-info">
                    <div className="ci-name">{p.name}</div>
                    <div className="ci-id">{p.isTeacher ? 'อาจารย์ · ไม่ต้องชำระเงิน · ไม่นับในใบลงชื่อและรายงาน' : p.sid}</div>
                    {p.paymentStatus !== 'pending' && (p.slipAmount != null || p.slipTransferredAt) && (
                      <div className="slip-meta"><i className="ti ti-receipt" /> แจ้งโอน {p.slipAmount != null ? formatBaht(p.slipAmount) : ''}{p.slipTransferredAt ? ` · ${formatThaiDateTime(p.slipTransferredAt)}` : ''}</div>
                    )}
                    {p.paymentStatus === 'rejected' && p.rejectReason && <div className="slip-meta bad"><i className="ti ti-alert-triangle" /> เหตุผล: {p.rejectReason}</div>}
                    {slipGroup === 'refund' && ev?.refundMethod === 'transfer' && (
                      <div className={`slip-meta${p.refundPromptPay ? '' : ' bad'}`}><i className="ti ti-device-mobile" /> {p.refundPromptPay ? `พร้อมเพย์รับเงินคืน ${formatPromptPay(p.refundPromptPay)}` : 'ยังไม่ได้ให้พร้อมเพย์สำหรับรับเงินคืน'}</div>
                    )}
                  </div>
                  <div className="ci-right">
                    {slipGroup === 'refund' ? (
                      p.paymentStatus === 'refunded' ? (
                        <>
                          <span className="slip-verdict refunded"><i className="ti ti-receipt-refund" /> คืนเงินแล้ว{p.refundedAt ? ` · ${formatThaiDateTime(p.refundedAt)}` : ''}</span>
                          <button type="button" className="btn btn-outline slip-btn" onClick={() => setRefundAsk({ p, on: false })}>ยกเลิก</button>
                        </>
                      ) : (
                        <button type="button" className="btn btn-primary slip-btn" onClick={() => setRefundAsk({ p, on: true })}><i className="ti ti-receipt-refund" /> คืนเงินแล้ว</button>
                      )
                    ) : p.paymentStatus === 'submitted' && (
                      <button type="button" className="btn btn-primary slip-btn" onClick={() => openReview(p)}><i className="ti ti-receipt" /> ตรวจสลิป</button>
                    )}
                    {slipGroup !== 'refund' && (p.paymentStatus === 'paid' || p.paymentStatus === 'rejected') && (
                      <>
                        <span className={`slip-verdict ${p.paymentStatus}`}><i className={`ti ${p.paymentStatus === 'paid' ? 'ti-circle-check' : 'ti-alert-triangle'}`} /> {p.paymentStatus === 'paid' ? 'ผ่าน · ชำระแล้ว' : 'ไม่ผ่าน · รอส่งใหม่'}</span>
                        <button type="button" className="btn btn-outline slip-btn" onClick={() => openReview(p)}><i className="ti ti-eye" /> ดูสลิป</button>
                      </>
                    )}
                    {slipGroup !== 'refund' && p.paymentStatus === 'pending' && <span className="slip-verdict pending"><i className="ti ti-clock" /> ยังไม่ส่งสลิป</span>}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            {checkin && (hybrid || multiDay) && (
              <div className="ci-pickers">
                {hybrid && (
                  <div className="segmented" role="tablist" aria-label="เลือกรูปแบบการเข้าร่วมที่จะเช็คอิน" style={{ marginBottom: 0 }}>
                    {['onsite', 'online'].map((g) => (
                      <button key={g} type="button" role="tab" aria-selected={g === group} className={`seg-btn${g === group ? ' active' : ''}`} onClick={() => setGroup(g)}>
                        <i className={`ti ${VIA[g].icon}`} /> {VIA[g].label} · {g === 'onsite' ? onsiteCount : onlineCount} คน
                      </button>
                    ))}
                  </div>
                )}
                {multiDay && (
                  <label className="ci-daypick">
                    <i className="ti ti-calendar-event" />
                    <span>วันที่เช็คอิน</span>
                    <select value={activeDay} onChange={(e) => setDay(e.target.value)}>
                      {days.map((d, n) => (
                        <option key={d} value={d}>
                          วันที่ {n + 1} · {formatThaiDate(d)}{d === todayIso() ? ' (วันนี้)' : ''} · มา {shown.filter((p) => p.days.includes(d)).length}/{shown.length} คน
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            )}
            <div className="ci-summary">
              {checkin && (
                <div className="ci-ring-wrap">
                  <div className="ci-ring" style={{ background: `conic-gradient(var(--c1) ${pct}%, var(--c2-10) ${pct}%)` }}>
                    <div className="ci-ring-hole"><b>{pct}%</b></div>
                  </div>
                </div>
              )}
              <div className="ci-sum-nums">
                {checkin && (
                  <>
                    <div className="ci-sum-item"><span className="v" style={{ color: 'var(--c1)' }}>{inCount}</span><span className="l">ตรวจสอบแล้ว</span></div>
                    <div className="ci-sum-item"><span className="v">{shown.length - inCount}</span><span className="l">ยังไม่ตรวจสอบ</span></div>
                  </>
                )}
                <div className="ci-sum-item"><span className="v">{shown.length}</span><span className="l">{checkin && hybrid ? `ผู้สมัคร${groupWord}` : 'ผู้สมัครทั้งหมด'}</span></div>
                {!checkin && hybrid && (
                  <>
                    <div className="ci-sum-item"><span className="v">{onsiteCount}{ev.capOnsite !== '' ? ` / ${ev.capOnsite}` : ''}</span><span className="l">Onsite</span></div>
                    <div className="ci-sum-item"><span className="v">{onlineCount}{ev.capOnline !== '' ? ` / ${ev.capOnline}` : ''}</span><span className="l">Online</span></div>
                  </>
                )}
                {checkin && multiDay && (
                  <div className="ci-sum-item"><span className="v">{fullCount}</span><span className="l">เข้าร่วมครบ {days.length} วัน</span></div>
                )}
                {!checkin && (ev?.loanQty > 0 || laptopCount > 0) && (
                  <div className="ci-sum-item"><span className="v">{laptopCount}{ev?.loanQty > 0 ? ` / ${ev.loanQty}` : ''}</span><span className="l">ขอยืมโน้ตบุ๊ก</span></div>
                )}
                {!checkin && showDiet && (
                  <div className="ci-sum-item"><span className="v">{allergyCount}</span><span className="l">แจ้งแพ้อาหาร</span></div>
                )}
                {!checkin && showDiet && dietCount > 0 && (
                  <div className="ci-sum-item"><span className="v">{dietCount}</span><span className="l">มีข้อจำกัดด้านอาหาร</span></div>
                )}
                {!checkin && paidEvent && (
                  <div className="ci-sum-item"><span className="v">{paidCount} / {payable}</span><span className="l">ชำระเงินแล้ว</span></div>
                )}
                {!checkin && paidEvent && toReview > 0 && (
                  <div className="ci-sum-item"><span className="v" style={{ color: 'var(--c2)' }}>{toReview}</span><span className="l">รอตรวจสลิป</span></div>
                )}
              </div>
            </div>

            {checkin ? (
              <div className="ci-toolrow">
                {selfLinkDay && (
                  <div className="ci-selflink">
                    <div className="ci-selflink-title"><i className="ti ti-link" /> ลิงก์เช็คชื่อออนไลน์ · {multiDay ? `วันที่ ${days.indexOf(selfLinkDay) + 1} · ` : ''}{formatThaiDate(selfLinkDay)}</div>
                    {selfLink ? (
                      <div className="ci-selflink-row">
                        <input type="text" readOnly value={selfLink} onFocus={(e) => e.target.select()} aria-label="ลิงก์เช็คชื่อออนไลน์" />
                        <button type="button" className="btn btn-primary" onClick={copySelfLink}><i className="ti ti-copy" /> คัดลอก</button>
                      </div>
                    ) : (
                      <p className="ci-hint" style={{ marginTop: 6 }}>ลิงก์จะแสดงเมื่อมีผู้สมัครอย่างน้อย 1 คน</p>
                    )}
                    <p className="ci-hint" style={{ marginTop: 8 }}>
                      <i className="ti ti-info-circle" /> ส่งลิงก์นี้ในห้องออนไลน์ระหว่างกิจกรรม ผู้เข้าร่วมเปิดลิงก์แล้วระบบเช็คชื่อให้เอง · ใช้ได้เฉพาะวันที่ {formatThaiDate(selfLinkDay)} ต้องเข้าสู่ระบบ และต้องเป็นผู้ที่ลงทะเบียนแบบออนไลน์ · แต่ละวันใช้ลิงก์ต่างกัน · ยังติ๊กเช็คอินแทนได้จากรายชื่อด้านล่าง
                    </p>
                  </div>
                )}
                <div className="ci-actions">
                  <button className="btn btn-outline" onClick={exportAttendance} disabled={roster.length === 0}>
                    <i className="ti ti-file-spreadsheet" /> ดาวน์โหลดผลการเช็คอิน (Excel)
                  </button>
                </div>
                <p className="ci-hint">
                  <i className="ti ti-info-circle" /> ติ๊กเช็คอินให้ตรงกับผู้ที่มาเข้าร่วมจริงก่อนออกเกียรติบัตร{hybrid ? ' · เช็คอินแยกระหว่าง Onsite กับ Online' : ''}{multiDay ? ` · กิจกรรมนี้จัด ${days.length} วัน เช็คอินแยกทีละวัน ผู้ที่เข้าร่วมครบทุกวันจึงจะได้รับเกียรติบัตร` : ''}
                </p>
              </div>
            ) : (
              <div className="ci-toolrow">
                <div className="ci-actions">
                  <button className="btn btn-outline" onClick={exportRoster} disabled={!ev || days.length === 0 || onlineOnly}>
                    <i className="ti ti-file-spreadsheet" /> ดาวน์โหลดใบลงชื่อ{hybrid ? ' Onsite' : ''} (Excel)
                  </button>
                </div>
                <p className="ci-hint">
                  <i className="ti ti-info-circle" />{' '}
                  {onlineOnly
                    ? 'กิจกรรมนี้จัดออนไลน์ จึงไม่มีใบลงชื่อให้ปริ้น · ผู้เข้าร่วมเช็คชื่อด้วยลิงก์ในเมนู "เช็คอินผู้เข้าร่วม"'
                    : `ใช้ตรวจสอบผู้สมัคร การชำระเงิน และข้อมูลที่ต้องเตรียมหน้างาน · ไฟล์เป็นใบลงชื่อสำหรับปริ้น มีช่องเช้า/บ่ายใต้วันที่จัด${multiDay ? ` และแยกแผ่นงานวันละแผ่น (${days.length} วัน)` : ''}${hybrid ? ' · มีเฉพาะผู้เข้าร่วมที่สถานที่จัด ส่วนผู้เข้าร่วมออนไลน์เช็คชื่อด้วยลิงก์' : ''} · การเช็คอินอยู่ที่เมนู "เช็คอินผู้เข้าร่วม"`}
                </p>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
              <div className="input-search" style={{ marginBottom: 0 }}>
                <i className="ti ti-search" />
                <input type="text" placeholder="ค้นหารหัสนักศึกษา/ชื่อ..." value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              {checkin && (
                <label className="ci-checkall">
                  <span>ตรวจสอบทั้งหมด{groupWord}{multiDay ? ` วันที่ ${days.indexOf(activeDay) + 1}` : ''}{query.trim() ? ' (เฉพาะที่ค้นหา)' : ''}</span>
                  <button type="button" className={`switch sm${allChecked ? ' on' : ''}`} onClick={toggleAll} disabled={filtered.length === 0} />
                </label>
              )}
            </div>
            {!checkin && (
              <div className="ci-filters" role="group" aria-label="กรองรายชื่อ">
                <button type="button" className={`filter-chip${!needMatch ? ' active' : ''}`} aria-pressed={!needMatch} onClick={() => setNeed('all')}>
                  <i className="ti ti-users" /> ทั้งหมด <b>{roster.length}</b>
                </button>
                {chips.map(([key, f]) => (
                  <button type="button" key={key} className={`filter-chip${need === key ? ' active' : ''}`} aria-pressed={need === key} onClick={() => setNeed(key)}>
                    <i className={`ti ${f.icon}`} /> {f.label} <b>{roster.filter(f.match).length}</b>
                  </button>
                ))}
              </div>
            )}

            <div>
              {roster.length === 0 && <div className="empty-state">ยังไม่มีผู้สมัครสำหรับกิจกรรมนี้</div>}
              {roster.length > 0 && filtered.length === 0 && (
                <div className="empty-state">
                  {query.trim() ? 'ไม่พบรายชื่อที่ตรงกับคำค้นหา' : needMatch ? `ไม่มีผู้สมัครที่${FILTERS[need].what}` : `ยังไม่มีผู้สมัครแบบ${VIA[group].long}`}
                </div>
              )}
              {filtered.map((p) => (
                <div className="ci-row" key={p.regId}>
                  <div className="ci-av">{initials(p.name)}</div>
                  <div className="ci-info">
                    <div className="ci-name">
                      {p.name}
                      {!checkin && hybrid && <span className={`ci-via ${p.via}`}><i className={`ti ${VIA[p.via]?.icon}`} /> {VIA[p.via]?.label}</span>}
                      {p.wantsLaptop && <span className="ci-laptop"><i className="ti ti-device-laptop" /> ขอยืมโน้ตบุ๊ก</span>}
                    </div>
                    <div className="ci-id">{p.isTeacher ? 'อาจารย์ · ไม่ต้องชำระเงิน · ไม่นับในใบลงชื่อและรายงาน' : p.sid}</div>
                    {p.foodAllergy && <div className="ci-diet"><i className="ti ti-alert-triangle" /> แพ้: {p.foodAllergy}</div>}
                    {p.dietaryPref && <div className="ci-diet pref"><i className="ti ti-tools-kitchen-2" /> {p.dietaryPref}</div>}
                  </div>
                  <div className="ci-right">
                    {!checkin && p.paymentStatus !== 'none' && (
                      <button
                        type="button"
                        className={`ci-pay ${p.paymentStatus}`}
                        onClick={() => openReview(p)}
                        title="เปิดดูสลิปและตรวจสอบการชำระเงิน"
                      >
                        <i className={`ti ${PAYMENT_STATUS[p.paymentStatus].icon}`} /> {p.paymentStatus === 'submitted' ? 'ตรวจสลิป' : p.paymentStatus === 'pending' ? 'ยังไม่ส่งสลิป' : p.paymentStatus === 'rejected' ? 'ไม่ผ่าน' : p.paymentStatus === 'refunded' ? 'คืนเงินแล้ว' : 'ชำระแล้ว'}
                      </button>
                    )}
                    {checkin && multiDay && (
                      <span className={`ci-daycount${p.in ? ' full' : ''}`} title={days.map((d, n) => `วันที่ ${n + 1}: ${p.days.includes(d) ? 'มา' : 'ยังไม่เช็คอิน'}`).join('\n')}>
                        {days.map((d) => <i key={d} className={`ci-dot${p.days.includes(d) ? ' on' : ''}`} />)}
                        {p.days.length}/{days.length} วัน
                      </span>
                    )}
                    {checkin && ev?.refundMethod === 'department' && (held(p) || p.paymentStatus === 'refunded') && (
                      p.paymentStatus === 'refunded'
                        ? <button type="button" className="ci-pay refunded" onClick={() => setRefundAsk({ p, on: false })} title="กดเพื่อยกเลิกการบันทึกคืนเงิน"><i className="ti ti-receipt-refund" /> คืนเงินแล้ว</button>
                        : <button type="button" className="ci-pay" onClick={() => setRefundAsk({ p, on: true })} title="บันทึกว่าคืนเงินให้คนนี้แล้ว"><i className="ti ti-cash" /> คืนเงิน</button>
                    )}
                    {checkin && (
                      <>
                        <span className={`ci-badge${inDay(p) ? ' in' : ''}`}>
                          <i className={`ti ${inDay(p) ? 'ti-circle-check' : 'ti-clock'}`} /> {inDay(p) ? 'ตรวจสอบแล้ว' : 'ยังไม่ตรวจสอบ'}
                        </span>
                        <button className={`switch sm${inDay(p) ? ' on' : ''}`} onClick={() => toggleCheckin(eventId, p.i, activeDay)} />
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="modal-foot">
        <button className="btn btn-outline" onClick={onClose}>ปิด</button>
        {checkin && (
          <button className="btn btn-primary" onClick={() => setConfirmCert(true)} disabled={!certIssued && !ev?.ended}>
            <i className={`ti ${certIssued ? 'ti-circle-check' : 'ti-certificate'}`} /> {certIssued ? 'ออกเกียรติบัตรแล้ว · แจ้งเตือนผู้ที่เช็คอินเพิ่ม' : ev?.ended ? 'เปิดสิทธิ์เกียรติบัตรให้ผู้เข้าร่วม' : 'ออกเกียรติบัตรได้เมื่อถึงวันสุดท้ายของกิจกรรม'}
          </button>
        )}
      </div>
      <ConfirmDialog
        open={confirmCert}
        eyebrow={certIssued ? 'ออกเกียรติบัตรแล้ว' : 'ยืนยันการออกเกียรติบัตร'}
        icon="ti-certificate"
        title={certIssued ? 'แจ้งเตือนผู้ที่เช็คอินเพิ่ม?' : 'เปิดสิทธิ์เกียรติบัตรให้ผู้เข้าร่วม?'}
        confirmLabel={certIssued ? 'แจ้งเตือนผู้ที่เช็คอินเพิ่ม' : 'ยืนยันออกเกียรติบัตร'}
        confirmIcon={certIssued ? 'ti-bell' : 'ti-certificate'}
        size=""
        onConfirm={() => { setConfirmCert(false); issueCertificate(eventId); onClose(); }}
        onCancel={() => setConfirmCert(false)}
      >
        <p style={{ fontSize: 13.5, color: 'var(--c4-70)', lineHeight: 1.7 }}>
          <strong style={{ color: 'var(--c4)' }}>{ev?.title}</strong><br />
          {multiDay ? `เข้าร่วมครบ ${days.length} วัน` : 'เช็คอินแล้ว'} {roster.filter((p) => p.in).length} จาก {roster.length} คน{hybrid ? ' (รวม Onsite และ Online)' : ''} · {certIssued ? 'กิจกรรมนี้ออกเกียรติบัตรไปแล้ว ยืนยันอีกครั้งจะแจ้งเตือนเฉพาะผู้ที่เช็คอินเพิ่มหลังจากนั้น ผู้ที่เคยได้รับแจ้งเตือนแล้วจะไม่ได้รับซ้ำ' : 'ผู้ที่เช็คอินแล้วจะได้รับสิทธิ์รับเกียรติบัตรและได้รับการแจ้งเตือน · ตรวจตัวอย่างด้านล่างก่อนยืนยัน'}
        </p>
        {ev && <CertIssueReview ev={ev} onEdit={() => { setConfirmCert(false); onClose(); navigate('/create-event', { state: { editId: ev.id, section: 'cert' } }); }} />}
      </ConfirmDialog>
      <ConfirmDialog
        open={!!refundAsk}
        eyebrow={refundAsk?.on ? 'บันทึกการคืนเงิน' : 'ยกเลิกการบันทึกคืนเงิน'}
        icon="ti-receipt-refund"
        title={refundAsk?.on ? 'คืนเงินให้คนนี้แล้ว?' : 'ยกเลิกว่าคืนเงินแล้ว?'}
        confirmLabel={refundAsk?.on ? 'ยืนยันคืนเงินแล้ว' : 'ยืนยันยกเลิก'}
        confirmIcon="ti-receipt-refund"
        busy={refundBusy}
        onConfirm={confirmRefund}
        onCancel={() => setRefundAsk(null)}
      >
        {refundAsk && (
          <p style={{ fontSize: 13.5, color: 'var(--c4-70)', lineHeight: 1.7 }}>
            <strong style={{ color: 'var(--c4)' }}>{refundAsk.p.name}</strong>
            {refundAsk.p.slipAmount != null ? ` · แจ้งโอน ${formatBaht(refundAsk.p.slipAmount)}` : ev?.fee > 0 ? ` · ค่าลงทะเบียน ${formatBaht(ev.fee)}` : ''}<br />
            {refundAsk.on
              ? (ev?.refundMethod === 'transfer' && refundAsk.p.refundPromptPay ? `โอนคืนเข้าพร้อมเพย์ ${formatPromptPay(refundAsk.p.refundPromptPay)} แล้ว · ` : '') + 'ผู้ชำระเงินจะได้รับแจ้งเตือนว่าได้รับเงินคืนแล้ว'
              : 'สถานะจะกลับเป็น "ชำระแล้ว" และผู้ชำระเงินจะได้รับแจ้งเตือน'}
          </p>
        )}
      </ConfirmDialog>
    </Modal>
  );
}
