import React from 'react';
import { EVENT_CATEGORIES } from '../../../utils/constants';
import './CategoryMixCard.css';

// One colour per category, fixed to the category (never to its rank), so a
// category looks the same in every year. Checked with the dataviz validator:
// lightness band, CVD and normal-vision separation, and 3:1 contrast all pass.
// Categories outside the three standard ones fold into a neutral "อื่นๆ".
const CATEGORY_COLORS = ['#5A62C8', '#2E9BC8', '#D2782E'];
const OTHER = { key: 'อื่นๆ', color: '#9A98AE' };

const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const fmt = (n) => (n || 0).toLocaleString('en-US');

function groupRows(rows) {
  const groups = EVENT_CATEGORIES.map((cat, i) => ({ key: cat, color: CATEGORY_COLORS[i], events: 0, people: 0, scoreSum: 0, scored: 0 }));
  const other = { ...OTHER, events: 0, people: 0, scoreSum: 0, scored: 0 };
  rows.forEach((r) => {
    const g = groups.find((x) => x.key === r.category) || other;
    g.events += r.event_count;
    g.people += r.participant_count;
    if (r.avg_satisfaction > 0) { g.scoreSum += r.avg_satisfaction * r.event_count; g.scored += r.event_count; }
  });
  return [...groups, other].filter((g) => g.events > 0);
}

/**
 * Ring of the categories' shares with the total in the middle, 2px surface
 * gaps between parts. Part-to-whole at a glance only — the exact numbers are
 * in the table under it.
 */
function Donut({ groups, field, total, unit, caption }) {
  const size = 132;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const parts = groups.filter((g) => g[field] > 0);
  const gap = parts.length > 1 ? 2 : 0;
  let offset = 0;
  return (
    <figure className="mix-donut">
      <div className="mix-donut-ring">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img"
          aria-label={`${caption}: ${parts.map((g) => `${g.key} ${pct(g[field], total)}%`).join(', ')}`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--c2-08)" strokeWidth={stroke} />
          {parts.map((g) => {
            const len = (g[field] / total) * c;
            const seg = (
              <circle key={g.key} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={g.color} strokeWidth={stroke}
                strokeDasharray={`${Math.max(len - gap, 0.5)} ${c}`} strokeDashoffset={-offset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}>
                <title>{`${g.key}: ${fmt(g[field])} ${unit} (${pct(g[field], total)}%)`}</title>
              </circle>
            );
            offset += len;
            return seg;
          })}
        </svg>
        <div className="mix-donut-center"><strong>{fmt(total)}</strong><small>{unit}</small></div>
      </div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

/**
 * Which kinds of event the year was made of, by number of events and by
 * people who came — two rings side by side, so a kind that draws more (or fewer)
 * people than its share of events stands out — and how each kind did.
 * `rows` are the year's per-category rows from /dashboard/yearly.
 */
export default function CategoryMixCard({ rows, year }) {
  const groups = groupRows(rows);
  const events = groups.reduce((a, g) => a + g.events, 0);
  const people = groups.reduce((a, g) => a + g.people, 0);
  const top = groups.length > 1 ? [...groups].sort((a, b) => b.people / b.events - a.people / a.events)[0] : null;

  return (
    <div className="chart-card mix">
      <h3><i className="ti ti-chart-pie" /> สัดส่วนประเภทกิจกรรม</h3>
      <div className="ch-sub">ปีงบประมาณ {year} · {events} กิจกรรม · ผู้เข้าร่วม {fmt(people)} คน</div>

      {events === 0 ? (
        <div className="att-empty"><i className="ti ti-calendar-off" /> ยังไม่มีกิจกรรมที่จัดเสร็จสิ้นในปีงบประมาณนี้</div>
      ) : (
        <>
          <div className="mix-donuts">
            <Donut groups={groups} field="events" total={events} unit="กิจกรรม" caption="ตามจำนวนกิจกรรม" />
            <Donut groups={groups} field="people" total={people} unit="คน" caption="ตามผู้เข้าร่วม" />
          </div>

          <table className="mix-table">
            <thead>
              <tr><th>ประเภท</th><th>กิจกรรม</th><th>ผู้เข้าร่วม</th><th>เฉลี่ย / กิจกรรม</th><th>ความพึงพอใจ</th></tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.key}>
                  <td><span className="mix-chip" style={{ background: g.color }} /> {g.key}</td>
                  <td>{g.events} <small>{pct(g.events, events)}%</small></td>
                  <td>{fmt(g.people)} <small>{pct(g.people, people)}%</small></td>
                  <td>{Math.round(g.people / g.events)} <small>คน</small></td>
                  <td>{g.scored ? (g.scoreSum / g.scored).toFixed(1) : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {top && (
            <div className="mix-insight">
              <i className="ti ti-bulb" />
              <span><strong>{top.key}</strong> มีผู้เข้าร่วมเฉลี่ยมากที่สุด {Math.round(top.people / top.events)} คนต่อกิจกรรม</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
