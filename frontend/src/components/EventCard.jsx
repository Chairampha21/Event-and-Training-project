import React from 'react';
import { STATUS_META } from '../utils/constants';
import CycleProgress from './CycleProgress';
import './EventCard.css';

const STRIP_TONE = { '': 'strip-1', alt: 'strip-2', dark: 'strip-3' };

function ApplyButton({ event, status, onApply }) {
  if (status === 'registered') return <button className="btn-apply disabled" disabled><i className="ti ti-check" /> ลงทะเบียนแล้ว</button>;
  if (status === 'attended' || status === 'certified') return <button className="btn-apply disabled" disabled><i className="ti ti-circle-check" /> เข้าร่วมแล้ว</button>;
  if (event.status === 'open') return <button className="btn-apply" onClick={() => onApply(event.id)}><i className="ti ti-user-plus" /> สมัคร</button>;
  if (event.status === 'soon') return <button className="btn-apply disabled" disabled><i className="ti ti-clock" /> เร็ว ๆ นี้</button>;
  if (event.status === 'full') return <button className="btn-apply disabled" disabled><i className="ti ti-users" /> เต็มแล้ว</button>;
  if (event.status === 'closed') return <button className="btn-apply disabled" disabled><i className="ti ti-lock" /> ปิดรับสมัคร</button>;
  return <button className="btn-apply" onClick={() => onApply(event.id)}><i className="ti ti-eye" /> ดูรายละเอียด</button>;
}

export default function EventCard({ event, isStudent, myStatus, onApply, onManage }) {
  const sm = STATUS_META[event.status];
  const pct = Math.round((event.reg / event.cap) * 100);

  return (
    <article className="card">
      {event.poster ? (
        <div className="card-poster">
          <img src={event.poster} alt="" />
          <span className={`badge ${sm.badge}`}><i className={`ti ${sm.ico}`} /> {sm.label}</span>
        </div>
      ) : (
        <div className={`card-strip ${STRIP_TONE[event.tone] || 'strip-1'}`} />
      )}
      <div className="card-body">
        <div className="card-top">
          {event.poster
            ? <div className={`icon-box sm ${event.tone}`}><i className={`ti ${event.icon}`} /></div>
            : (
              <>
                <div className={`icon-box ${event.tone}`}><i className={`ti ${event.icon}`} /></div>
                <span className={`badge ${sm.badge}`}><i className={`ti ${sm.ico}`} /> {sm.label}</span>
              </>
            )}
        </div>
        <div className="card-cat">{event.cat}</div>
        <h3 className="card-title">{event.title}</h3>
        {!isStudent && <CycleProgress stage={event.stage} />}
        <div className="meta">
          <div className="row"><i className="ti ti-calendar-event" /> {event.date}</div>
          <div className="row"><i className="ti ti-clock" /> {event.time}</div>
          <div className="row"><i className="ti ti-map-pin" /> {event.place}</div>
        </div>
        <div className="card-footer">
          <div className="seats">
            <span><strong style={{ color: 'var(--c4)' }}>{event.reg}</strong> / {event.cap} ที่นั่ง</span>
            <div className="seats-bar"><div className={`seats-fill ${pct >= 100 ? 'full' : ''}`} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
          </div>
          {isStudent
            ? <ApplyButton event={event} status={myStatus} onApply={onApply} />
            : <button className="btn-apply manage" onClick={() => onManage(event.id)}><i className="ti ti-settings" /> จัดการ</button>}
        </div>
      </div>
    </article>
  );
}
