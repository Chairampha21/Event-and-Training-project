import React, { useEffect, useMemo, useState } from 'react';
import Modal, { ModalHead } from '../../../components/ui/Modal';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { useEvents } from '../../../hooks/useEvents';
import { downloadXlsx } from '../../../utils/xlsxExport';
import { buildSignInSheets, buildAttendanceSheet } from '../utils/signInSheet';
import { formatThaiDate, todayIso } from '../../../utils/dateFormat';
import SlipReviewModal from './SlipReviewModal';
import { PAYMENT_STATUS } from './PaymentBox';
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
  diet: { label: 'มีข้อจำกัดด้านอาหาร', what: 'มีข้อจำกัดด้านอาหาร', icon: 'ti-tools-kitchen-2', match: (p) => !!p.dietaryPref },
};

// One window, two jobs kept apart: mode "list" is for looking through who
// applied (how they attend, what they need, whether they paid, the sign-in
// sheet) and mode "checkin" is for ticking off who actually came, day by day.
export default function ApplicantsModal({ eventId, open, onClose, mode = 'list' }) {
  const checkin = mode === 'checkin';
  const { evById, rosters, toggleCheckin, setPaymentStatus, issueCertificate, pushToast } = useEvents();
  const [query, setQuery] = useState('');
  const [reviewRegId, setReviewRegId] = useState(null); // whose payment is being checked
  const [confirmCert, setConfirmCert] = useState(false);

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
  useEffect(() => { if (open) { setDay(''); setNeed('all'); setGroup('onsite'); } }, [open, eventId]);
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
        onAction={(action, reason) => setPaymentStatus(eventId, reviewing.regId, action, reason)}
        onClose={() => setReviewRegId(null)}
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
  // people in the room, so those attending online are left off it.
  function exportRoster() {
    const people = roster.filter((p) => p.via === 'onsite').filter((p) => !needMatch || needMatch(p));
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
    downloadXlsx(`ผลการเช็คอิน-${(ev?.title || '').slice(0, 30)}`, buildAttendanceSheet({ ev, days, people: roster, showVia: hybrid }));
    pushToast('ดาวน์โหลดผลการเช็คอินแล้ว', `${roster.length} คน${hybrid ? ' · รวม Onsite และ Online' : ''}`);
  }

  const chips = Object.entries(FILTERS).filter(([, f]) => hybrid || !f.hybridOnly);
  const groupWord = hybrid ? ` ${VIA[group].label}` : '';

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <ModalHead eyebrow={checkin ? 'เช็คอินผู้เข้าร่วม' : 'รายชื่อผู้สมัคร'} icon={checkin ? 'ti-checkbox' : 'ti-users'} title={(ev?.title || '').slice(0, 40)} onClose={onClose} />
      <div className="modal-body">
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
            {!checkin && showDiet && (
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
                <div className="ci-id">{p.sid}</div>
                {p.foodAllergy && <div className="ci-diet"><i className="ti ti-alert-triangle" /> แพ้: {p.foodAllergy}</div>}
                {p.dietaryPref && <div className="ci-diet pref"><i className="ti ti-tools-kitchen-2" /> {p.dietaryPref}</div>}
              </div>
              <div className="ci-right">
                {!checkin && p.paymentStatus !== 'none' && (
                  <button
                    type="button"
                    className={`ci-pay ${p.paymentStatus}`}
                    onClick={() => setReviewRegId(p.regId)}
                    title="เปิดดูสลิปและตรวจสอบการชำระเงิน"
                  >
                    <i className={`ti ${PAYMENT_STATUS[p.paymentStatus].icon}`} /> {p.paymentStatus === 'submitted' ? 'ตรวจสลิป' : p.paymentStatus === 'pending' ? 'ยังไม่ส่งสลิป' : p.paymentStatus === 'rejected' ? 'ไม่ผ่าน' : 'ชำระแล้ว'}
                  </button>
                )}
                {checkin && multiDay && (
                  <span className={`ci-daycount${p.in ? ' full' : ''}`} title={days.map((d, n) => `วันที่ ${n + 1}: ${p.days.includes(d) ? 'มา' : 'ยังไม่เช็คอิน'}`).join('\n')}>
                    {days.map((d) => <i key={d} className={`ci-dot${p.days.includes(d) ? ' on' : ''}`} />)}
                    {p.days.length}/{days.length} วัน
                  </span>
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
      </div>
      <div className="modal-foot">
        <button className="btn btn-outline" onClick={onClose}>ปิด</button>
        {checkin && (
          <button className="btn btn-primary" onClick={() => setConfirmCert(true)}>
            <i className="ti ti-certificate" /> เปิดสิทธิ์เกียรติบัตรให้ผู้เข้าร่วม
          </button>
        )}
      </div>
      <ConfirmDialog
        open={confirmCert}
        eyebrow="ยืนยันการออกเกียรติบัตร"
        icon="ti-certificate"
        title="เปิดสิทธิ์เกียรติบัตรให้ผู้เข้าร่วม?"
        confirmLabel="ยืนยันออกเกียรติบัตร"
        confirmIcon="ti-certificate"
        onConfirm={() => { setConfirmCert(false); issueCertificate(eventId); onClose(); }}
        onCancel={() => setConfirmCert(false)}
      >
        <p style={{ fontSize: 13.5, color: 'var(--c4-70)', lineHeight: 1.7 }}>
          <strong style={{ color: 'var(--c4)' }}>{ev?.title}</strong><br />
          {multiDay ? `เข้าร่วมครบ ${days.length} วัน` : 'เช็คอินแล้ว'} {roster.filter((p) => p.in).length} จาก {roster.length} คน{hybrid ? ' (รวม Onsite และ Online)' : ''} · ผู้ที่เช็คอินแล้วจะได้รับสิทธิ์รับเกียรติบัตรและได้รับการแจ้งเตือน
        </p>
      </ConfirmDialog>
    </Modal>
  );
}
