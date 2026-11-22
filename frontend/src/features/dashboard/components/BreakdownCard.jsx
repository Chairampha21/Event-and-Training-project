import React from 'react';

/**
 * Registered (light bar) and attended (dark bar) per group — a programme or a
 * year of study. rows: [{ key, label, reg, in }]; `note` replaces the subtitle.
 */
export default function BreakdownCard({ icon, title, rows, total, note }) {
  const max = Math.max(1, ...rows.map((r) => r.reg));
  return (
    <div className="chart-card">
      <h3><i className={`ti ${icon}`} /> {title}</h3>
      <div className="ch-sub">{note || `ผู้สมัคร (อ่อน) กับผู้เข้าร่วมจริง (เข้ม) · จากผู้สมัคร ${total} คน`}</div>
      {rows.length === 0 && <div className="bd-empty">ยังไม่มีข้อมูล</div>}
      <div className="bd-rows">
        {rows.map((r) => (
          <div className="bd-row" key={r.key || 'none'}>
            <div className="bd-label">{r.label}</div>
            <div className="bd-bar" title={`สมัคร ${r.reg} · เข้าร่วม ${r.in}`}>
              <div className="bd-reg" style={{ width: `${(r.reg / max) * 100}%` }} />
              <div className="bd-in" style={{ width: `${(r.in / max) * 100}%` }} />
            </div>
            <div className="bd-val"><strong>{r.in}</strong> / {r.reg}<small>{r.reg ? ` · ${Math.round((r.in / r.reg) * 100)}%` : ''}</small></div>
          </div>
        ))}
      </div>
    </div>
  );
}
