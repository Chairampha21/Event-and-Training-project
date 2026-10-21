import React from 'react';
import { CYCLE } from '../../../utils/constants';

// Registration has stopped (full, or closed by hand or by date) but the event
// hasn't started: the รับสมัคร step is done and the event is waiting for its day.
const REG_STOPPED = { closed: 'ปิดรับแล้ว', full: 'เต็มแล้ว' };

/**
 * 5-stage cycle tracker: ประกาศ → รับสมัคร → จัดกิจกรรม → เกียรติบัตร → ปิดกิจกรรม.
 * `status` (the event's) lets the รับสมัคร step say why it is over before the
 * event day, with a small note under the steps.
 */
export default function CycleProgress({ stage, status, compact }) {
  const stopped = stage === 1 && REG_STOPPED[status];
  const at = stopped ? 2 : stage;
  const notes = stopped ? { 1: stopped, 2: 'รอวันจัด' } : {};

  if (compact) {
    return (
      <span className="mini-cycle">
        {CYCLE.map((label, i) => (
          <span key={label} className={`md ${i < at ? 'done' : i === at ? 'current' : ''}`} />
        ))}
        <span className="ml">{stopped ? `${stopped} · รอวันจัด` : CYCLE[at]}</span>
      </span>
    );
  }
  return (
    <div className="cycle">
      {CYCLE.map((label, i) => {
        const cls = i < at ? 'done' : i === at ? 'current' : '';
        return (
          <div key={label} className={`cycle-step ${cls}`}>
            <div className="cd" />
            <div className="cl">{label}</div>
            {notes[i] && <div className="cn">{notes[i]}</div>}
          </div>
        );
      })}
    </div>
  );
}
