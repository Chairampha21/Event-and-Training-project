import React from 'react';

/**
 * Aggregate evaluation results — one horizontal bar per question, 0-5 scale.
 * data: [{ label, avg }]
 */
export default function EvalResultChart({ data }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {data.map((row) => (
        <div key={row.label} className="score-row" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ flex: '0 0 220px', fontSize: 13, color: 'var(--c4-70)', fontWeight: 600 }}>{row.label}</span>
          <div style={{ flex: 1, height: 10, background: 'var(--c2-08)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(row.avg / 5) * 100}%`, background: 'var(--c1)', borderRadius: 99 }} />
          </div>
          <span style={{ width: 44, textAlign: 'right', fontSize: 13, fontWeight: 700, color: 'var(--c4)' }}>
            {row.avg.toFixed(1)} <i className="ti ti-star-filled" style={{ fontSize: 12, color: '#e0a92e' }} />
          </span>
        </div>
      ))}
    </div>
  );
}
