import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEvents } from '../../hooks/useEvents';
import { REG_STATUS_META, CYCLE } from '../../utils/constants';
import { CertPreviewModal } from '../../features/certificates/components/CertificateCard';
import OnlineJoinLink from '../../features/events/components/OnlineJoinLink';
import PaymentBox from '../../features/events/components/PaymentBox';
import CancelRegistrationButton from '../../features/events/components/CancelRegistrationButton';
import { buddhistYearOf } from '../../utils/dateFormat';
import { fullNameTh } from '../../utils/personName';

// The order the status filter is offered in: what still needs doing first.
const STATUS_ORDER = ['registered', 'attended', 'certified', 'evaluated', 'absent', 'cancelled'];

// A registration whose event the organizer deleted before it took place reads
// as cancelled — not "registered", with nothing left to pay, join or withdraw from.
const CANCELLED_META = { label: 'กิจกรรมถูกยกเลิก', cls: 'ps-fail', ico: 'ti-calendar-off' };
// An event that gives no certificates never reaches "certified": once its
// evaluation is in, the registration is simply done.
const EVALUATED_META = { label: 'เข้าร่วมแล้ว · ทำแบบประเมินแล้ว', cls: REG_STATUS_META.certified.cls, ico: 'ti-circle-check' };
const statusOf = (r) => {
  if (r.cancelled && r.status === 'registered') return 'cancelled';
  if (r.status === 'attended' && r.evaluated) return 'evaluated';
  return r.status;
};
const metaOf = (st) => (st === 'cancelled' ? CANCELLED_META : st === 'evaluated' ? EVALUATED_META : REG_STATUS_META[st]);

export default function MyRegistrationsPage() {
  const { regs, session } = useEvents();
  const navigate = useNavigate();
  const [certId, setCertId] = useState(null);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('');
  const [catFilter, setCatFilter] = useState('');

  const certified = regs.filter((r) => r.status === 'certified').length;
  const attendedMin = regs.filter((r) => r.status === 'attended' || r.status === 'certified').length;

  const years = useMemo(() => [...new Set(regs.map((r) => buddhistYearOf(r.dateStart)).filter(Boolean))].sort((a, b) => b - a), [regs]);
  const categories = useMemo(() => [...new Set(regs.map((r) => r.cat).filter(Boolean))], [regs]);

  // Search, year and category narrow the list first; the status chips then
  // count what is left in each status, so a chip never promises rows that the
  // other filters would hide.
  const q = query.trim().toLowerCase();
  const narrowed = regs.filter((r) => {
    if (q && !`${r.title} ${r.cat} ${r.place}`.toLowerCase().includes(q)) return false;
    if (yearFilter && buddhistYearOf(r.dateStart) !== Number(yearFilter)) return false;
    if (catFilter && r.cat !== catFilter) return false;
    return true;
  });
  const shown = statusFilter === 'all' ? narrowed : narrowed.filter((r) => statusOf(r) === statusFilter);
  const filtering = !!q || !!yearFilter || !!catFilter || statusFilter !== 'all';

  function clearFilters() {
    setQuery(''); setStatusFilter('all'); setYearFilter(''); setCatFilter('');
  }

  return (
    <div>
      <div className="page-header dark" style={{ padding: '46px 32px 90px' }}>
        <div className="ph-inner" style={{ display: 'block' }}>
          <div className="ph-top">
            <div className="avatar">{(session?.name || '').slice(0, 1)}</div>
            <div className="ph-info">
              <span className="ph-role"><i className="ti ti-school" /> {session?.role === 'teacher' ? 'อาจารย์' : 'นักศึกษาปัจจุบัน'}</span>
              <div className="ph-name">{fullNameTh(session)}</div>
              <div className="ph-id">
                {session?.role === 'teacher'
                  ? session?.dept && <span><i className="ti ti-briefcase" /> {session.dept}</span>
                  : <span><i className="ti ti-id" /> {session?.student_id}</span>}
                <span><i className="ti ti-mail" /> {session?.email}</span>
              </div>
            </div>
          </div>
          <div className="ph-stats">
            <div className="ph-stat"><div className="pi"><i className="ti ti-calendar-check" /></div><div><div className="pv">{regs.filter((r) => statusOf(r) !== 'cancelled').length} <small>รายการ</small></div><div className="pl">ลงทะเบียนปีการศึกษานี้</div></div></div>
            <div className="ph-stat"><div className="pi"><i className="ti ti-certificate" /></div><div><div className="pv">{certified} <small>ใบ</small></div><div className="pl">เกียรติบัตรที่ได้รับ</div></div></div>
            <div className="ph-stat"><div className="pi"><i className="ti ti-clock-hour-4" /></div><div><div className="pv">{attendedMin} <small>ครั้ง</small></div><div className="pl">เข้าร่วมกิจกรรมสะสม</div></div></div>
            <div className="ph-stat"><div className="pi"><i className="ti ti-clipboard-check" /></div><div><div className="pv">{regs.filter((r) => statusOf(r) === 'attended').length} <small>รายการ</small></div><div className="pl">รอทำแบบประเมิน</div></div></div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1240, margin: '-58px auto 0', padding: '0 32px 56px', position: 'relative', zIndex: 2 }}>
        <div className="hist-tools">
          <div className="hist-tools-head">
            <div className="sh-title">ประวัติการลงทะเบียน <span className="count">{filtering ? `${shown.length} จาก ${regs.length}` : regs.length} รายการ</span></div>
            {filtering && <button type="button" className="btn btn-ghost" onClick={clearFilters}><i className="ti ti-rotate" /> ล้างตัวกรอง</button>}
          </div>
          <div className="hist-tools-row">
            <div className="input-search" style={{ marginBottom: 0 }}>
              <i className="ti ti-search" />
              <input type="text" placeholder="ค้นหาชื่อกิจกรรม ประเภท หรือสถานที่..." value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <select className="role-select" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} aria-label="กรองตามปีที่จัด">
              <option value="">ทุกปี</option>
              {years.map((y) => <option key={y} value={y}>พ.ศ. {y}</option>)}
            </select>
            <select className="role-select" value={catFilter} onChange={(e) => setCatFilter(e.target.value)} aria-label="กรองตามประเภทกิจกรรม">
              <option value="">ทุกประเภท</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="ci-filters" role="group" aria-label="กรองตามสถานะ" style={{ marginBottom: 0 }}>
            <button type="button" className={`filter-chip${statusFilter === 'all' ? ' active' : ''}`} aria-pressed={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
              <i className="ti ti-list" /> ทั้งหมด <b>{narrowed.length}</b>
            </button>
            {STATUS_ORDER.filter((st) => metaOf(st) && ((st !== 'cancelled' && st !== 'evaluated') || regs.some((r) => statusOf(r) === st))).map((st) => (
              <button type="button" key={st} className={`filter-chip${statusFilter === st ? ' active' : ''}`} aria-pressed={statusFilter === st} onClick={() => setStatusFilter(st)}>
                <i className={`ti ${metaOf(st).ico}`} /> {metaOf(st).label} <b>{narrowed.filter((r) => statusOf(r) === st).length}</b>
              </button>
            ))}
          </div>
        </div>

        <div className="history-list">
          {regs.length === 0 && <div className="empty-state">ยังไม่มีประวัติการลงทะเบียน</div>}
          {regs.length > 0 && shown.length === 0 && (
            <div className="empty-state">
              ไม่พบรายการที่ตรงกับ{q ? `คำค้น "${query.trim()}"` : 'ตัวกรองที่เลือก'}
              <div style={{ marginTop: 10 }}><button type="button" className="btn btn-outline" onClick={clearFilters}><i className="ti ti-rotate" /> ล้างตัวกรอง</button></div>
            </div>
          )}
          {shown.map((r) => {
            const s = metaOf(statusOf(r));
            if (statusOf(r) === 'cancelled') {
              return (
                <div className="hist-item" key={r.eid}>
                  <div className={`hi-icon ${r.tone}`}><i className={`ti ${r.icon}`} /></div>
                  <div className="hi-info">
                    <div className="hi-cat">{r.cat}</div>
                    <div className="hi-title">{r.title}</div>
                    <div className="hi-meta">
                      <span><i className="ti ti-calendar-event" /> {r.date}</span>
                      <span><i className="ti ti-map-pin" /> {r.place}</span>
                    </div>
                    <div className="hi-note"><i className="ti ti-calendar-off" /> ผู้จัดยกเลิกกิจกรรมนี้แล้ว · ไม่ต้องเข้าร่วม{['pending', 'rejected'].includes(r.paymentStatus) ? ' และไม่ต้องชำระเงิน' : ''}</div>
                    {['paid', 'submitted', 'refunded'].includes(r.paymentStatus) && (
                      <div style={{ marginTop: 9 }}><PaymentBox fee={r.fee} info={r.paymentInfo} reg={r} refundMethod={r.refundMethod} refundNote={r.refundNote} cancelled /></div>
                    )}
                  </div>
                  <div className="hi-actions">
                    <span className={`pill-status ${s.cls}`}><i className={`ti ${s.ico}`} /> {s.label}</span>
                  </div>
                </div>
              );
            }
            return (
              <div className="hist-item" key={r.eid}>
                <div className={`hi-icon ${r.tone}`}><i className={`ti ${r.icon}`} /></div>
                <div className="hi-info">
                  <div className="hi-cat">{r.cat}</div>
                  <div className="hi-title">{r.title}</div>
                  <div className="hi-meta">
                    <span><i className="ti ti-calendar-event" /> {r.date}</span>
                    <span><i className="ti ti-map-pin" /> {r.place}</span>
                    <span><i className="ti ti-route" /> Cycle: {CYCLE[r.stage]}</span>
                  </div>
                  {['pending', 'submitted', 'rejected'].includes(r.paymentStatus) && (
                    <div style={{ marginTop: 9 }}><PaymentBox fee={r.fee} info={r.paymentInfo} reg={r} refundMethod={r.refundMethod} refundNote={r.refundNote} cancelled={r.cancelled} /></div>
                  )}
                  {r.paymentStatus === 'paid' && r.refundMethod === 'none' && (
                    <div className="hi-note info"><i className="ti ti-circle-check-filled" /> ชำระค่าลงทะเบียนแล้ว</div>
                  )}
                  {r.paymentStatus === 'paid' && r.refundMethod !== 'none' && (
                    <div style={{ marginTop: 9 }}><PaymentBox fee={r.fee} info={r.paymentInfo} reg={r} refundMethod={r.refundMethod} refundNote={r.refundNote} /></div>
                  )}
                  {r.paymentStatus === 'refunded' && (
                    <div className="hi-note info"><i className="ti ti-receipt-refund" /> ได้รับเงินคืนแล้ว</div>
                  )}
                  {r.onlineLink && (r.status === 'registered' || r.status === 'attended') && (
                    <div style={{ marginTop: 9 }}><OnlineJoinLink url={r.onlineLink} /></div>
                  )}
                  {r.status === 'registered' && r.attendeeNote && (
                    <div className="hi-note"><i className="ti ti-backpack" /> {r.attendeeNote}</div>
                  )}
                  {r.hybrid && r.status === 'registered' && (
                    <div className="hi-note info">
                      <i className={`ti ${r.via === 'online' ? 'ti-broadcast' : 'ti-building'}`} />{' '}
                      {r.via === 'online' ? 'เข้าร่วมออนไลน์ · เช็คชื่อด้วยลิงก์ที่ผู้จัดแจ้งในวันจัดกิจกรรม' : 'เข้าร่วมที่สถานที่จัด · ลงชื่อกับผู้จัดหน้างาน'}
                    </div>
                  )}
                  {r.wantsLaptop && r.status === 'registered' && (
                    <div className="hi-note info"><i className="ti ti-device-laptop" /> จองโน้ตบุ๊กให้ยืมไว้ 1 เครื่อง</div>
                  )}
                  {(r.foodAllergy || r.dietaryPref) && r.status === 'registered' && (
                    <div className="hi-note info"><i className="ti ti-tools-kitchen-2" /> {[r.foodAllergy && `แพ้: ${r.foodAllergy}`, r.dietaryPref].filter(Boolean).join(' · ')}</div>
                  )}
                  {r.daysTotal > 1 && r.daysAttended > 0 && r.daysAttended < r.daysTotal && (
                    <div className="hi-note info"><i className="ti ti-calendar-check" /> เช็คอินแล้ว {r.daysAttended} จาก {r.daysTotal} วัน · {r.issueCert ? 'ต้องเข้าร่วมครบทุกวันจึงจะได้รับเกียรติบัตร' : 'ต้องเข้าร่วมครบทุกวันจึงจะนับว่าเข้าร่วมกิจกรรม'}</div>
                  )}
                  {r.status === 'attended' && !r.evaluated && (
                    <div className="hi-note"><i className="ti ti-alert-circle" /> {r.issueCert ? 'ต้องทำแบบประเมินกิจกรรมให้เสร็จก่อนจึงจะรับเกียรติบัตรได้' : 'กรุณาทำแบบประเมินกิจกรรม · กิจกรรมนี้ไม่มีเกียรติบัตร'}</div>
                  )}
                </div>
                <div className="hi-actions">
                  <span className={`pill-status ${s.cls}`}><i className={`ti ${s.ico}`} /> {s.label}</span>
                  {r.status === 'certified' && (
                    <button className="btn-download" onClick={() => setCertId(r.eid)}><i className="ti ti-download" /> เกียรติบัตร</button>
                  )}
                  <CancelRegistrationButton reg={r} className="btn-download cancel" />
                  {r.status === 'attended' && !r.evaluated && (
                    <button className="btn-download eval" onClick={() => navigate(`/evaluate/${r.eid}`)}><i className="ti ti-clipboard-check" /> ทำแบบประเมิน</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <CertPreviewModal eventId={certId} open={!!certId} onClose={() => setCertId(null)} />
    </div>
  );
}
