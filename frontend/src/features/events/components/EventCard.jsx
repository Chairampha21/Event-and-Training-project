import React from 'react';
import { STATUS_META, EVENT_PROGRAMS, yearsText } from '../../../utils/constants';
import CycleProgress from './CycleProgress';
import { formatBaht } from '../../../utils/money';
import { formatThaiDayMonth } from '../../../utils/dateFormat';
import { PAYMENT_STATUS } from './PaymentBox';
import './EventCard.css';

const PROGRAM_TAG = Object.fromEntries(EVENT_PROGRAMS.filter((p) => p.tag).map((p) => [p.key, p.tag]));

const STRIP_TONE = { '': 'strip-1', alt: 'strip-2', dark: 'strip-3' };

// Registered for a paid event and still owing the payment (or a new slip):
// the button leads to the details, where the payment instructions and the
// slip form are, instead of a dead "registered" label.
const PAY_ACTION = {
  pending: { icon: 'ti-cash', label: 'ชำระเงิน' },
  rejected: { icon: 'ti-receipt-refund', label: 'ส่งสลิปใหม่' },
  submitted: { icon: 'ti-receipt', label: 'รอตรวจสลิป' },
};

function ApplyButton({ event, status, payment, onApply }) {
  const pay = status === 'registered' && PAY_ACTION[payment];
  if (pay) return <button className={`btn-apply${payment === 'submitted' ? ' outline' : ''}`} onClick={() => onApply(event.id)}><i className={`ti ${pay.icon}`} /> {pay.label}</button>;
  if (status === 'registered') return <button className="btn-apply disabled" disabled><i className="ti ti-check" /> ลงทะเบียนแล้ว</button>;
  if (status === 'attended' || status === 'certified') return <button className="btn-apply disabled" disabled><i className="ti ti-circle-check" /> เข้าร่วมแล้ว</button>;
  if (event.status === 'open') return <button className="btn-apply" onClick={() => onApply(event.id)}><i className="ti ti-user-plus" /> สมัคร</button>;
  // Announced, registration not open yet: say when it opens.
  if (event.status === 'soon') return <button className="btn-apply disabled" disabled><i className="ti ti-clock" /> {event.regStart ? `เปิดรับ ${formatThaiDayMonth(event.regStart)}` : 'รอเปิดรับสมัคร'}</button>;
  if (event.status === 'full') return <button className="btn-apply disabled" disabled><i className="ti ti-users" /> เต็มแล้ว</button>;
  if (event.status === 'closed') return <button className="btn-apply disabled" disabled><i className="ti ti-lock" /> ปิดรับสมัคร</button>;
  return <button className="btn-apply" onClick={() => onApply(event.id)}><i className="ti ti-eye" /> ดูรายละเอียด</button>;
}

// The whole card opens the event's details: the title is the real button and
// its ::after covers the card (see EventCard.css), so there is one control for
// keyboards and screen readers, and the footer button stays on top of it.
export default function EventCard({ event, isStudent, myStatus, myPayment, onApply, onManage }) {
  const sm = STATUS_META[event.status];
  const pct = Math.round((event.reg / event.cap) * 100);

  return (
    // Registration over (closed or finished): shown muted, so what is still open stands out;
    // it comes back to full colour on hover, and stays readable and openable.
    <article className={`card card-clickable${event.status === 'closed' || event.status === 'done' ? ' is-past' : ''}`}>
      {event.poster ? (
        <div className="card-poster">
          {/* The whole poster, never cropped; a blurred copy fills the frame around it. */}
          <img className="cp-fill" src={event.poster} alt="" aria-hidden="true" />
          <img src={event.poster} alt="" />
          <span className={`badge ${sm.badge}`}><i className={`ti ${sm.ico}`} /> {sm.label}</span>
        </div>
      ) : (
        <div className={`card-strip ${STRIP_TONE[event.tone] || 'strip-1'}`} />
      )}
      <div className="card-body">
        <div className="card-top">
          <div className="card-top-left">
            <div className={`icon-box sm ${event.tone}`}><i className={`ti ${event.icon}`} /></div>
            <span className="card-cat">{event.cat}</span>
            {PROGRAM_TAG[event.program] && <span className="card-program" title={`เฉพาะนักศึกษาสาขา${EVENT_PROGRAMS.find((p) => p.key === event.program).short}`}>{PROGRAM_TAG[event.program]}</span>}
            {event.years?.length > 0 && <span className="card-program" title={`เฉพาะนักศึกษา${yearsText(event.years)}`}>{event.years.length === 1 && event.years[0] !== '5' ? `ปี ${event.years[0]}` : `ปี ${event.years.map((y) => (y === '5' ? '5+' : y)).join(',')}`}</span>}
          </div>
          {!event.poster && <span className={`badge ${sm.badge}`}><i className={`ti ${sm.ico}`} /> {sm.label}</span>}
        </div>
        <h3 className="card-title"><button type="button" className="card-open" onClick={() => onApply(event.id)} aria-label={`ดูรายละเอียด ${event.title}`}>{event.title}</button></h3>
        {!isStudent && <CycleProgress stage={event.stage} status={event.status} dense />}
        <div className="meta">
          <div className="row"><i className="ti ti-calendar-event" /> {event.date}</div>
          <div className="row"><i className="ti ti-clock" /> {event.time}</div>
          <div className="row"><i className="ti ti-map-pin" /> {event.place}</div>
          {event.regPeriod && <div className="row"><i className="ti ti-user-plus" /> รับสมัคร {event.regPeriod}</div>}
          <div className="row">
            <i className="ti ti-cash" /> {event.fee > 0 ? `ค่าลงทะเบียน ${formatBaht(event.fee)}` : 'ไม่มีค่าใช้จ่าย'}
            {isStudent && myStatus && PAYMENT_STATUS[myPayment] && (
              <span className={`card-pay ${PAYMENT_STATUS[myPayment].cls}`}><i className={`ti ${PAYMENT_STATUS[myPayment].icon}`} /> {PAYMENT_STATUS[myPayment].label}</span>
            )}
          </div>
        </div>
        <div className="card-footer">
          <div className="seats">
            <span><strong style={{ color: 'var(--c4)' }}>{event.reg}</strong> / {event.cap} ที่นั่ง</span>
            <div className="seats-bar"><div className={`seats-fill ${pct >= 100 ? 'full' : ''}`} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
          </div>
          {isStudent
            ? <ApplyButton event={event} status={myStatus} payment={myPayment} onApply={onApply} />
            : <button className="btn-apply manage" onClick={() => onManage(event.id)}><i className="ti ti-settings" /> จัดการ</button>}
        </div>
      </div>
    </article>
  );
}
