import React from 'react';
import { THAI_MONTHS } from '../../../utils/dateFormat';
import './AttendanceCard.css';

// A fiscal year runs October -> September.
const FISCAL_MONTHS = [10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9];

const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/**
 * How many of the people who registered actually came, and how many of those
 * went on to earn a certificate — the two conversions an event dashboard is
 * usually read for — plus when in the fiscal year the events were held.
 * `rows` are the fiscal year's finished events (from /dashboard/budget).
 */
export default function AttendanceCard({ rows, certificates, year }) {
  const registered = rows.reduce((a, r) => a + r.registered_count, 0);
  const attended = rows.reduce((a, r) => a + r.attended_count, 0);
  const steps = [
    { key: 'reg', label: 'ลงทะเบียน', value: registered, share: registered > 0 ? 100 : 0, note: null },
    { key: 'att', label: 'เข้าร่วม (เช็คอิน)', value: attended, share: pct(attended, registered), note: registered > 0 ? `${pct(attended, registered)}% ของผู้ลงทะเบียน` : null },
    { key: 'cert', label: 'ได้รับเกียรติบัตร', value: certificates, share: pct(certificates, registered), note: attended > 0 ? `${pct(certificates, attended)}% ของผู้เข้าร่วม` : null },
  ];
  const noShow = Math.max(0, registered - attended);

  const perMonth = FISCAL_MONTHS.map((m) => rows.filter((r) => Number((r.date_start || '').slice(5, 7)) === m));
  const maxMonth = Math.max(1, ...perMonth.map((list) => list.length));

  return (
    <div className="chart-card att">
      <h3><i className="ti ti-users-group" /> การเข้าร่วมกิจกรรม</h3>
      <div className="ch-sub">ปีงบประมาณ {year} · จากผู้ลงทะเบียนถึงผู้ได้รับเกียรติบัตร</div>

      {registered === 0 ? (
        <div className="att-empty"><i className="ti ti-user-off" /> ยังไม่มีผู้ลงทะเบียนในกิจกรรมที่จัดเสร็จสิ้นของปีงบประมาณนี้</div>
      ) : (
        <div className="att-funnel">
          {steps.map((s) => (
            <div className="att-step" key={s.key} title={`${s.label}: ${s.value.toLocaleString('en-US')} คน${s.note ? ` · ${s.note}` : ''}`}>
              <div className="att-step-head"><span>{s.label}</span><strong>{s.value.toLocaleString('en-US')} <small>คน</small></strong></div>
              <div className="att-track"><div className="att-bar" style={{ width: `${Math.max(s.share, s.value > 0 ? 2 : 0)}%` }} /></div>
              {s.note && <div className="att-note">{s.note}</div>}
            </div>
          ))}
          <div className="att-noshow"><i className="ti ti-user-x" /> ลงทะเบียนแต่ไม่ได้เข้าร่วม {noShow.toLocaleString('en-US')} คน ({pct(noShow, registered)}%)</div>
        </div>
      )}

      <div className="att-months-title">กิจกรรมที่จัดในแต่ละเดือน</div>
      <div className="att-months" role="img" aria-label={`จำนวนกิจกรรมรายเดือน ปีงบประมาณ ${year}: ${perMonth.map((list, i) => `${THAI_MONTHS[FISCAL_MONTHS[i] - 1]} ${list.length}`).join(', ')}`}>
        {perMonth.map((list, i) => {
          const name = THAI_MONTHS[FISCAL_MONTHS[i] - 1];
          return (
            <div className="att-month" key={name} title={`${name}: ${list.length} กิจกรรม${list.length ? ` · ${list.map((r) => r.title).join(', ')}` : ''}`}>
              <span className="att-month-n">{list.length || ''}</span>
              <div className="att-month-track"><div className="att-month-bar" style={{ height: `${(list.length / maxMonth) * 100}%` }} /></div>
              <span className="att-month-l">{name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
