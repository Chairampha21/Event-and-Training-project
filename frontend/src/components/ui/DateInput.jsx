import React, { useEffect, useRef, useState } from 'react';
import { THAI_MONTHS_FULL, toBuddhistYear, todayIso } from '../../utils/dateFormat';
import './TimeInput.css';
import './MultiDatePicker.css';

const WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

function iso(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// "2026-10-19" -> "19/10/2569": day first, Buddhist-era year.
export function formatDmy(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return '';
  return `${value.slice(8, 10)}/${value.slice(5, 7)}/${toBuddhistYear(Number(value.slice(0, 4)))}`;
}

/**
 * Date picker that always reads dd/mm/yyyy (พ.ศ.): press it and pick a day
 * from a calendar. The browser's own date input orders the day and month by
 * the device language (mm/dd/yyyy on an English machine), which a page
 * cannot change.
 *
 * `value` / `onChange` use ISO "yyyy-mm-dd" ('' when empty), like the native
 * input it replaces. Days outside `min` / `max` (ISO) cannot be picked.
 */
export default function DateInput({ value, onChange, min, max, placeholder = 'วว/ดด/ปปปป', icon = 'ti-calendar-event', id, 'aria-label': ariaLabel }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const anchor = value || (min && min > todayIso() ? min : todayIso());
  const [view, setView] = useState({ y: Number(anchor.slice(0, 4)), m: Number(anchor.slice(5, 7)) - 1 });
  const today = todayIso();

  // Open on the month of the chosen day.
  useEffect(() => {
    if (open) setView({ y: Number(anchor.slice(0, 4)), m: Number(anchor.slice(5, 7)) - 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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

  const firstWeekday = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  function shiftMonth(delta) {
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }

  function pick(day) {
    onChange(day);
    setOpen(false);
  }

  const shown = formatDmy(value);
  return (
    <div className="tp dp" ref={rootRef}>
      <button
        type="button"
        id={id}
        className={`tp-trigger${shown ? '' : ' empty'}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel ? `${ariaLabel} ${shown || 'ยังไม่ได้เลือก'}` : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <i className={`ti ${icon}`} />
        <span>{shown || placeholder}</span>
        <i className="ti ti-chevron-down tp-caret" />
      </button>

      {open && (
        <div className="tp-pop dp-pop" role="dialog" aria-label="เลือกวันที่">
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
              const out = (!!min && day < min) || (!!max && day > max);
              return (
                <button
                  type="button"
                  key={day}
                  className={`mdp-day${day === value ? ' selected' : ''}${day === today ? ' today' : ''}`}
                  aria-pressed={day === value}
                  disabled={out}
                  onClick={() => pick(day)}
                >
                  {d}
                </button>
              );
            })}
          </div>
          <div className="tp-foot">
            <button type="button" className="tp-clear" onClick={() => { onChange(''); setOpen(false); }} disabled={!value}>ล้าง</button>
            <button type="button" className="tp-clear" onClick={() => pick(today)} disabled={(!!min && today < min) || (!!max && today > max)}>วันนี้</button>
          </div>
        </div>
      )}
    </div>
  );
}
