import React, { useState } from 'react';
import { THAI_MONTHS_FULL, formatThaiDate, toBuddhistYear, todayIso } from '../../utils/dateFormat';
import TimeInput from './TimeInput';
import './MultiDatePicker.css';

const WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

function iso(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Calendar that toggles individual days on and off — for events held on
// several days that aren't necessarily consecutive (e.g. the 23rd and 25th).
// `value` is a sorted array of ISO yyyy-mm-dd strings. Each picked day gets
// its own time range, since days can run at different hours (e.g. one in the
// morning, the next in the afternoon): `times` is {[iso]: {start, end}} of
// "HH:MM" strings. Days before `minDate` (ISO) cannot be picked; one that is
// already picked can still be taken off.
export default function MultiDatePicker({ value, onChange, times, onTimesChange, minDate }) {
  const anchor = value[0] || todayIso();
  const [view, setView] = useState({ y: Number(anchor.slice(0, 4)), m: Number(anchor.slice(5, 7)) - 1 });
  const today = todayIso();

  const firstWeekday = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  function shiftMonth(delta) {
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }

  function toggle(day) {
    onChange(value.includes(day) ? value.filter((d) => d !== day) : [...value, day].sort());
  }

  function setTime(day, patch) {
    onTimesChange({ ...times, [day]: { start: '', end: '', ...times[day], ...patch } });
  }

  const first = times[value[0]];
  const canCopyFirst = value.length > 1 && !!(first?.start && first?.end);
  function copyFirstToAll() {
    onTimesChange(Object.fromEntries(value.map((d) => [d, { start: first.start, end: first.end }])));
  }

  return (
    <div className="mdp">
      <div className="mdp-cal">
        <div className="mdp-head">
          <button type="button" className="mdp-nav" onClick={() => shiftMonth(-1)} aria-label="เดือนก่อนหน้า"><i className="ti ti-chevron-left" /></button>
          <span className="mdp-month">{THAI_MONTHS_FULL[view.m]} {toBuddhistYear(view.y)}</span>
          <button type="button" className="mdp-nav" onClick={() => shiftMonth(1)} aria-label="เดือนถัดไป"><i className="ti ti-chevron-right" /></button>
        </div>
        <div className="mdp-grid">
          {WEEKDAYS.map((w) => <span key={w} className="mdp-wd">{w}</span>)}
          {cells.map((d, i) => {
            if (!d) return <span key={`blank${i}`} />;
            const day = iso(view.y, view.m, d);
            const selected = value.includes(day);
            const past = !!minDate && day < minDate && !selected;
            return (
              <button
                type="button"
                key={day}
                className={`mdp-day${selected ? ' selected' : ''}${day === today ? ' today' : ''}`}
                aria-pressed={selected}
                disabled={past}
                title={past ? 'วันที่ผ่านมาแล้ว' : undefined}
                onClick={() => toggle(day)}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mdp-picked">
        <div className="mdp-picked-head">
          <span>วันและเวลาที่จัด · {value.length} วัน <span className="req">*</span></span>
          {value.length > 0 && <button type="button" className="mdp-clear" onClick={() => onChange([])}>ล้างทั้งหมด</button>}
        </div>
        {value.length === 0 ? (
          <div className="mdp-empty"><i className="ti ti-calendar-plus" /> กดเลือกวันที่จัดกิจกรรมจากปฏิทิน เลือกได้หลายวันและไม่จำเป็นต้องติดกัน แล้วกำหนดเวลาของแต่ละวันได้ที่นี่</div>
        ) : (
          <div className="mdp-rows">
            {value.map((day) => {
              const t = times[day] || {};
              const label = formatThaiDate(day);
              return (
                <div key={day} className="mdp-row">
                  <span className="mdp-row-date">{label}</span>
                  <TimeInput compact value={t.start || ''} onChange={(v) => setTime(day, { start: v })} placeholder="เริ่ม" aria-label={`เวลาเริ่ม ${label}`} />
                  <span className="mdp-row-sep">–</span>
                  <TimeInput compact value={t.end || ''} onChange={(v) => setTime(day, { end: v })} placeholder="สิ้นสุด" aria-label={`เวลาสิ้นสุด ${label}`} />
                  <button type="button" className="mdp-row-del" onClick={() => toggle(day)} aria-label={`ลบ ${label}`}><i className="ti ti-x" /></button>
                </div>
              );
            })}
            {canCopyFirst && (
              <button type="button" className="mdp-copy" onClick={copyFirstToAll}><i className="ti ti-copy" /> ใช้เวลาของวันแรกกับทุกวัน</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
