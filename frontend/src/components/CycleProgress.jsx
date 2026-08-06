import React from 'react';
import { CYCLE } from '../utils/constants';

/** 5-stage cycle tracker: ประกาศ → รับสมัคร → จัดกิจกรรม → เกียรติบัตร → ปิดกิจกรรม */
export default function CycleProgress({ stage, compact }) {
  if (compact) {
    return (
      <span className="mini-cycle">
        {CYCLE.map((label, i) => (
          <span key={label} className={`md ${i < stage ? 'done' : i === stage ? 'current' : ''}`} />
        ))}
        <span className="ml">{CYCLE[stage]}</span>
      </span>
    );
  }
  return (
    <div className="cycle">
      {CYCLE.map((label, i) => {
        const cls = i < stage ? 'done' : i === stage ? 'current' : '';
        return (
          <div key={label} className={`cycle-step ${cls}`}>
            <div className="cd" />
            <div className="cl">{label}</div>
          </div>
        );
      })}
    </div>
  );
}
