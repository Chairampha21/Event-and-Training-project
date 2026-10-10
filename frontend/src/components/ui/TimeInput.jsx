import React, { useEffect, useRef, useState } from 'react';
import { toThaiTime } from '../../utils/timeFormat';
import './TimeInput.css';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0')); // every 5 minutes

/**
 * 24-hour time picker in the Thai style ("08.30", "16.00"): press it, pick the
 * hour and the minute from two lists — nothing to type and no AM/PM. (The
 * browser's own time input follows the device language and shows AM/PM on
 * many machines, which a page cannot turn off.)
 *
 * `value` / `onChange` use "HH:MM" ('' when empty). `compact` is the smaller
 * size used inside dense rows.
 */
export default function TimeInput({ value, onChange, placeholder = 'เลือกเวลา', compact, id, 'aria-label': ariaLabel }) {
  const [open, setOpen] = useState(false);
  const [pendingMinute, setPendingMinute] = useState(null); // minute picked before any hour
  const rootRef = useRef(null);
  const hourRef = useRef(null);
  const minuteRef = useRef(null);
  const [hour, minute] = value ? value.split(':') : ['', ''];
  const shownMinute = minute || pendingMinute || '';
  // A stored time that isn't on a 5-minute step (typed in an older version) still shows as selected.
  const minutes = shownMinute && !MINUTES.includes(shownMinute) ? [...MINUTES, shownMinute].sort() : MINUTES;

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      // Close just the picker, not a dialog it may be sitting in.
      e.stopPropagation();
      setOpen(false);
      rootRef.current?.querySelector('.tp-trigger')?.focus();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  // On opening, bring the current hour/minute to the middle of its list
  // (or a sensible morning hour when nothing is chosen yet).
  useEffect(() => {
    if (!open) return;
    [[hourRef.current, hour || '08'], [minuteRef.current, shownMinute || '00']].forEach(([list, val]) => {
      const el = list?.querySelector(`[data-v="${val}"]`);
      if (el) list.scrollTop = el.offsetTop - list.clientHeight / 2 + el.clientHeight / 2;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function pickHour(h) {
    onChange(`${h}:${minute || pendingMinute || '00'}`);
    setPendingMinute(null);
  }

  function pickMinute(m) {
    if (hour) {
      onChange(`${hour}:${m}`);
      setOpen(false); // hour then minute is the natural order, so this completes the choice
    } else {
      setPendingMinute(m);
    }
  }

  return (
    <div className={`tp${compact ? ' compact' : ''}`} ref={rootRef}>
      <button
        type="button"
        id={id}
        className={`tp-trigger${value ? '' : ' empty'}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel ? `${ariaLabel}${value ? ` ${toThaiTime(value)} น.` : ' ยังไม่ได้เลือก'}` : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <i className="ti ti-clock" />
        <span>{value ? `${toThaiTime(value)} น.` : placeholder}</span>
        <i className="ti ti-chevron-down tp-caret" />
      </button>

      {open && (
        <div className="tp-pop" role="dialog" aria-label="เลือกเวลา (24 ชั่วโมง)">
          <div className="tp-cols">
            <div className="tp-col">
              <div className="tp-col-head">ชั่วโมง</div>
              <div className="tp-list" ref={hourRef}>
                {HOURS.map((h) => (
                  <button type="button" key={h} data-v={h} className={h === hour ? 'on' : ''} aria-pressed={h === hour} onClick={() => pickHour(h)}>{h}</button>
                ))}
              </div>
            </div>
            <div className="tp-col">
              <div className="tp-col-head">นาที</div>
              <div className="tp-list" ref={minuteRef}>
                {minutes.map((m) => (
                  <button type="button" key={m} data-v={m} className={m === shownMinute ? 'on' : ''} aria-pressed={m === shownMinute} onClick={() => pickMinute(m)}>{m}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="tp-foot">
            <button type="button" className="tp-clear" onClick={() => { onChange(''); setPendingMinute(null); setOpen(false); }} disabled={!value && !pendingMinute}>ล้าง</button>
            <button type="button" className="tp-done" onClick={() => setOpen(false)}>เสร็จ</button>
          </div>
        </div>
      )}
    </div>
  );
}
