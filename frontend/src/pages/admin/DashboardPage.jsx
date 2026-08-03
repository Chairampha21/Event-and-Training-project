import React, { useMemo, useState } from 'react';
import { useEvents } from '../../hooks/useEvents';
import { downloadCsv } from '../../utils/csvExport';
import { ROLE_LABEL } from '../../utils/constants';

const DASH_TYPES = [
  { k: 'Workshop', color: 'var(--c2)' },
  { k: 'สัมมนา', color: 'var(--c1)' },
  { k: 'การแข่งขัน', color: 'var(--c3)' },
  { k: 'Bootcamp', color: 'var(--c4)' },
  { k: 'อื่น ๆ', color: 'var(--c2-15)' },
];

const YEARLY = {
  2568: {
    events: 42, participants: 3184, certs: 2690, attend: 84.5, satis: 4.6,
    months: [3, 5, 7, 4, 8, 6, 9, 10, 5, 3, 2, 1],
    types: [38, 24, 20, 12, 6],
    table: [
      ['Workshop · Programming', 12, 896, 812, 90.6, 4.7],
      ['Workshop · Data & AI', 8, 624, 548, 87.8, 4.6],
      ['สัมมนา · Industry', 10, 982, 894, 91.0, 4.5],
      ['การแข่งขัน · Hackathon', 5, 312, 280, 89.7, 4.8],
      ['Cybersecurity', 4, 218, 186, 85.3, 4.4],
      ['อื่น ๆ', 3, 152, 128, 84.2, 4.3],
    ],
  },
  2567: {
    events: 37, participants: 2564, certs: 2280, attend: 79.1, satis: 4.4,
    months: [2, 4, 5, 3, 6, 7, 8, 6, 4, 5, 3, 2],
    types: [40, 22, 18, 14, 6],
    table: [
      ['Workshop · Programming', 11, 742, 648, 87.3, 4.5],
      ['Workshop · Data & AI', 6, 438, 372, 84.9, 4.3],
      ['สัมมนา · Industry', 9, 876, 792, 90.4, 4.4],
      ['การแข่งขัน · Hackathon', 4, 250, 214, 85.6, 4.6],
      ['Cybersecurity', 4, 158, 142, 83.0, 4.2],
      ['อื่น ๆ', 3, 100, 82, 82.0, 4.1],
    ],
  },
  2566: {
    events: 31, participants: 2105, certs: 1820, attend: 76.8, satis: 4.2,
    months: [2, 3, 4, 3, 5, 5, 7, 5, 3, 4, 2, 1],
    types: [42, 20, 16, 14, 8],
    table: [
      ['Workshop · Programming', 9, 612, 520, 84.9, 4.3],
      ['Workshop · Data & AI', 5, 356, 296, 83.1, 4.1],
      ['สัมมนา · Industry', 8, 742, 668, 90.0, 4.3],
      ['การแข่งขัน · Hackathon', 3, 196, 162, 82.7, 4.4],
      ['Cybersecurity', 3, 118, 98, 83.1, 4.0],
      ['อื่น ๆ', 3, 81, 76, 93.8, 4.0],
    ],
  },
};
const YEARS = Object.keys(YEARLY);
const MONTH_LABELS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

function fmt(n) { return n.toLocaleString('en-US'); }

export default function DashboardPage() {
  const { activityLog, session } = useEvents();
  const [year, setYear] = useState('2568');
  const b = YEARLY[year];

  const maxV = useMemo(() => Math.max(10, ...b.months), [b]);

  const pieStops = useMemo(() => {
    let acc = 0;
    return b.types.map((p, i) => {
      const stop = `${DASH_TYPES[i].color} ${acc}% ${acc + p}%`;
      acc += p;
      return stop;
    }).join(',');
  }, [b]);

  const totalEvents = b.table.reduce((a, r) => a + r[1], 0);
  const totalParticipants = b.table.reduce((a, r) => a + r[2], 0);
  const totalCerts = b.table.reduce((a, r) => a + r[3], 0);

  function exportDash() {
    downloadCsv(`dashboard-${year}`, b.table.map((r) => ({
      cat: r[0], events: r[1], participants: r[2], certs: r[3], attend: r[4], satis: r[5],
    })), [
      { label: 'หมวดหมู่', value: 'cat' },
      { label: 'กิจกรรม', value: 'events' },
      { label: 'ผู้เข้าร่วม', value: 'participants' },
      { label: 'เกียรติบัตร', value: 'certs' },
      { label: 'อัตราเข้าร่วม (%)', value: 'attend' },
      { label: 'ความพึงพอใจ', value: 'satis' },
    ]);
  }

  return (
    <div>
      <div className="page-header">
        <div className="ph-inner">
          <div>
            <div className="crumbs"><i className="ti ti-layout-dashboard" /> {ROLE_LABEL[session.role]} <i className="ti ti-chevron-right" /> ภาพรวม</div>
            <h1>แดชบอร์ดภาพรวมรายปี</h1>
            <p>สรุปภาพรวมกิจกรรม ผู้เข้าร่วม อัตราการเข้าร่วม และความพึงพอใจของปีที่เลือก</p>
          </div>
        </div>
      </div>

      <div className="wrap tight">
        <div className="section-head">
          <div>
            <div className="sh-title">แดชบอร์ดรายปี · {year}</div>
            <div className="sh-sub">สรุปภาพรวมปี {year}</div>
          </div>
          <div className="dash-controls">
            <div className="dash-pick">
              <label>ปีที่ดู</label>
              <select className="role-select" value={year} onChange={(e) => setYear(e.target.value)}>
                {YEARS.map((y) => <option key={y} value={y}>ปี {y}</option>)}
              </select>
            </div>
            <button className="btn btn-outline" onClick={exportDash}><i className="ti ti-download" /> Export</button>
          </div>
        </div>

        <div className="compare-row">
          <div className="cmp-card"><div className="cm-lbl">กิจกรรมทั้งหมด</div><div className="cm-vals"><span className="cm-now">{fmt(b.events)}</span></div></div>
          <div className="cmp-card"><div className="cm-lbl">ผู้เข้าร่วมสะสม</div><div className="cm-vals"><span className="cm-now">{fmt(b.participants)}</span></div></div>
          <div className="cmp-card"><div className="cm-lbl">เกียรติบัตรที่ออก</div><div className="cm-vals"><span className="cm-now">{fmt(b.certs)}</span></div></div>
          <div className="cmp-card"><div className="cm-lbl">อัตราเข้าร่วมเฉลี่ย</div><div className="cm-vals"><span className="cm-now">{b.attend.toFixed(1)}%</span></div></div>
        </div>

        <div className="chart-row">
          <div className="chart-card">
            <h3><i className="ti ti-chart-bar" /> จำนวนกิจกรรมต่อเดือน</h3>
            <div className="ch-sub">จำนวนกิจกรรมต่อเดือน ปี {year}</div>
            <div className="chart-legend"><span><span className="dot" style={{ background: 'var(--c2)' }} /> {year}</span></div>
            <div className="chart-bars-wrap">
              <div className="bar-y-axis"><span>{maxV}</span><span>{Math.round(maxV / 2)}</span><span>0</span></div>
              <div className="bar-chart">
                {b.months.map((v, i) => (
                  <div className="bar-col" key={i}>
                    <div className="bar-pair"><div className="bar b1" style={{ height: `${Math.round((v / maxV) * 100)}%` }} title={v} /></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="chart-x-labels">{MONTH_LABELS.map((m) => <span className="bx" key={m}>{m}</span>)}</div>
          </div>

          <div className="chart-card">
            <h3><i className="ti ti-chart-pie" /> สัดส่วนประเภทกิจกรรม</h3>
            <div className="ch-sub">รวมปี {year} · {b.events} กิจกรรม</div>
            <div className="pie-wrap">
              <div style={{ position: 'relative', width: 160, height: 160 }}>
                <div className="pie" style={{ background: `conic-gradient(${pieStops})` }} />
                <div className="pie-center">{b.events}<small>กิจกรรม</small></div>
              </div>
              <div className="pie-legend">
                {b.types.map((p, i) => (
                  <div className="pl-row" key={DASH_TYPES[i].k}>
                    <span className="lbl"><span className="dot" style={{ background: DASH_TYPES[i].color }} /> {DASH_TYPES[i].k}</span>
                    <span className="val">{p}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="table-card">
          <div className="table-toolbar">
            <h3><i className="ti ti-table-options" /> สรุปรายปี · {year}</h3>
            <button className="btn btn-outline" style={{ padding: '7px 12px', fontSize: 13 }} onClick={exportDash}><i className="ti ti-download" /> Excel</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr><th>หมวดหมู่</th><th className="center">กิจกรรม</th><th className="center">ผู้เข้าร่วม</th><th className="center">เกียรติบัตร</th><th className="center">อัตราเข้าร่วม</th><th className="center">ความพึงพอใจ</th></tr>
              </thead>
              <tbody>
                {b.table.map((r) => {
                  const rateCls = r[4] >= 87 ? 'ps-pass' : 'ps-wait';
                  return (
                    <tr key={r[0]}>
                      <td><strong>{r[0]}</strong></td>
                      <td className="center">{r[1]}</td>
                      <td className="center">{fmt(r[2])}</td>
                      <td className="center">{fmt(r[3])}</td>
                      <td className="center"><span className={`pill-status ${rateCls}`}>{r[4].toFixed(1)}%</span></td>
                      <td className="center">{r[5].toFixed(1)}</td>
                    </tr>
                  );
                })}
                <tr style={{ background: 'var(--c2-08)', fontWeight: 700 }}>
                  <td><strong style={{ color: 'var(--c4)' }}>รวมทั้งปี</strong></td>
                  <td className="center"><strong>{totalEvents}</strong></td>
                  <td className="center"><strong>{fmt(totalParticipants)}</strong></td>
                  <td className="center"><strong>{fmt(totalCerts)}</strong></td>
                  <td className="center"><strong>{b.attend.toFixed(1)}%</strong></td>
                  <td className="center"><strong>{b.satis.toFixed(1)}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="table-card" style={{ marginTop: 20 }}>
          <div className="table-toolbar"><h3><i className="ti ti-history" /> กิจกรรมล่าสุดในระบบ</h3></div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>เวลา</th><th>ผู้ทำรายการ</th><th>Action</th><th>รายละเอียด</th></tr></thead>
              <tbody>
                {activityLog.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--c4-60)', padding: 24 }}>ยังไม่มีกิจกรรมในระบบ</td></tr>}
                {activityLog.slice(0, 12).map((l, i) => (
                  <tr key={i}>
                    <td><div className="ev-title" style={{ fontSize: 13 }}>{l.ts}</div></td>
                    <td>{l.user}</td>
                    <td><span className="badge" style={{ background: l.actionColor, color: 'var(--c2)' }}>{l.action}</span></td>
                    <td>{l.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
