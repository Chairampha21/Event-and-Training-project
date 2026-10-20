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

/** A 100% bar split by category, with a 2px gap between parts. */
function ShareBar({ groups, field, total, label }) {
  return (
    <div className="mix-share">
      <div className="mix-share-label"><span>{label}</span><strong>{fmt(total)}</strong></div>
      <div className="mix-bar" role="img" aria-label={`${label}: ${groups.map((g) => `${g.key} ${pct(g[field], total)}%`).join(', ')}`}>
        {groups.filter((g) => g[field] > 0).map((g) => (
          <span key={g.key} style={{ flexGrow: g[field], background: g.color }} title={`${g.key}: ${fmt(g[field])} (${pct(g[field], total)}%)`} />
        ))}
      </div>
    </div>
  );
}

/**
 * Which kinds of event the year was made of, by number of events and by
 * people who came — side by side, so a kind that draws more (or fewer)
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
          <ShareBar groups={groups} field="events" total={events} label="จำนวนกิจกรรม" />
          <ShareBar groups={groups} field="people" total={people} label="ผู้เข้าร่วม" />

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
