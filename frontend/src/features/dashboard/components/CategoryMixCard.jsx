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
  const groups = EVENT_CATEGORIES.map((cat, i) => ({ key: cat, color: CATEGORY_COLORS[i], events: 0, people: 0 }));
  const other = { ...OTHER, events: 0, people: 0 };
  rows.forEach((r) => {
    const g = groups.find((x) => x.key === r.category) || other;
    g.events += r.event_count;
    g.people += r.participant_count;
  });
  return [...groups, other].filter((g) => g.events > 0);
}

/**
 * Ring of the categories' shares of the year's events, total in the middle,
 * 2px surface gaps between parts; each part names itself on hover.
 */
function Donut({ groups, total }) {
  const size = 152;
  const stroke = 22;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gap = groups.length > 1 ? 2 : 0;
  let offset = 0;
  return (
    <div className="mix-donut">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img"
        aria-label={`สัดส่วนกิจกรรมตามประเภท: ${groups.map((g) => `${g.key} ${pct(g.events, total)}%`).join(', ')}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--c2-08)" strokeWidth={stroke} />
        {groups.map((g) => {
          const len = (g.events / total) * c;
          const seg = (
            <circle key={g.key} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={g.color} strokeWidth={stroke}
              strokeDasharray={`${Math.max(len - gap, 0.5)} ${c}`} strokeDashoffset={-offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}>
              <title>{`${g.key}: ${g.events} กิจกรรม (${pct(g.events, total)}%)`}</title>
            </circle>
          );
          offset += len;
          return seg;
        })}
      </svg>
      <div className="mix-donut-center"><strong>{total}</strong><small>กิจกรรม</small></div>
    </div>
  );
}

/**
 * Which kinds of event the year was made of: a ring by number of events with
 * its legend (count and share), then how many people each kind drew — in all
 * and per event — and the kind that draws the most people per event.
 * `rows` are the year's per-category rows from /dashboard/yearly.
 */
export default function CategoryMixCard({ rows, year }) {
  const groups = groupRows(rows);
  const events = groups.reduce((a, g) => a + g.events, 0);
  const people = groups.reduce((a, g) => a + g.people, 0);
  const maxPeople = Math.max(1, ...groups.map((g) => g.people));
  const top = groups.length > 1 ? [...groups].sort((a, b) => b.people / b.events - a.people / a.events)[0] : null;

  return (
    <div className="chart-card mix">
      <h3><i className="ti ti-chart-pie" /> สัดส่วนประเภทกิจกรรม</h3>
      <div className="ch-sub">ปีงบประมาณ {year} · {events} กิจกรรม</div>

      {events === 0 ? (
        <div className="att-empty"><i className="ti ti-calendar-off" /> ยังไม่มีกิจกรรมที่จัดเสร็จสิ้นในปีงบประมาณนี้</div>
      ) : (
        <>
          <div className="mix-top">
            <Donut groups={groups} total={events} />
            <div className="mix-legend">
              {groups.map((g) => (
                <div className="mix-legend-row" key={g.key}>
                  <span className="mix-legend-name"><span className="mix-chip" style={{ background: g.color }} /> {g.key}</span>
                  <span className="mix-legend-val">{g.events} <small>{pct(g.events, events)}%</small></span>
                </div>
              ))}
            </div>
          </div>

          <div className="mix-people">
            <div className="mix-people-head"><span>ผู้เข้าร่วมแยกตามประเภท</span><strong>{fmt(people)} <small>คน</small></strong></div>
            {groups.map((g) => (
              <div className="mix-people-row" key={g.key} title={`${g.key}: ${fmt(g.people)} คน (${pct(g.people, people)}%) · เฉลี่ย ${Math.round(g.people / g.events)} คนต่อกิจกรรม`}>
                <div className="mix-people-label">
                  <span><span className="mix-chip" style={{ background: g.color }} /> {g.key}</span>
                  <span className="mix-people-num"><strong>{fmt(g.people)}</strong> คน · เฉลี่ย {Math.round(g.people / g.events)} คน/กิจกรรม</span>
                </div>
                <div className="mix-people-track"><div style={{ width: `${(g.people / maxPeople) * 100}%`, background: g.color }} /></div>
              </div>
            ))}
          </div>

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
