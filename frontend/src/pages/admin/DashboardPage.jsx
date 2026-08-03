import React, { useEffect, useMemo, useState } from 'react';
import { useEvents } from '../../hooks/useEvents';
import { downloadCsv } from '../../utils/csvExport';
import { ROLE_LABEL } from '../../utils/constants';

const DASH_COLORS = ['var(--c2)', 'var(--c1)', 'var(--c3)', 'var(--c4)', 'var(--c2-15)'];

function fmt(n) { return (n || 0).toLocaleString('en-US'); }

export default function DashboardPage() {
  const { activityLog, session, getDashboardYearly } = useEvents();
  const [rows, setRows] = useState([]);
  const [year, setYear] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboardYearly().then((data) => {
      setRows(data);
      if (data.length) setYear((y) => y ?? data[0].report_year);
      setLoading(false);
    });
  }, [getDashboardYearly]);

  const years = useMemo(() => [...new Set(rows.map((r) => r.report_year))].sort((a, b) => b - a), [rows]);
  const yearRows = useMemo(() => rows.filter((r) => r.report_year === year), [rows, year]);

  const totals = useMemo(() => yearRows.reduce((acc, r) => ({
    events: acc.events + r.event_count,
    participants: acc.participants + r.participant_count,
    certs: acc.certs + r.certificate_count,
  }), { events: 0, participants: 0, certs: 0 }), [yearRows]);

  const avgSatisfaction = yearRows.length
    ? (yearRows.reduce((a, r) => a + (r.avg_satisfaction || 0), 0) / yearRows.length).toFixed(1)
    : '0.0';

  const pieStops = useMemo(() => {
    if (!totals.events) return '';
    let acc = 0;
    return yearRows.map((r, i) => {
      const pct = (r.event_count / totals.events) * 100;
      const stop = `${DASH_COLORS[i % DASH_COLORS.length]} ${acc}% ${acc + pct}%`;
      acc += pct;
      return stop;
    }).join(',');
  }, [yearRows, totals.events]);

  function exportDash() {
    downloadCsv(`dashboard-${year}`, yearRows.map((r) => ({
      cat: r.category, events: r.event_count, participants: r.participant_count, certs: r.certificate_count, satis: r.avg_satisfaction,
    })), [
      { label: 'หมวดหมู่', value: 'cat' },
      { label: 'กิจกรรม', value: 'events' },
      { label: 'ผู้เข้าร่วม', value: 'participants' },
      { label: 'เกียรติบัตร', value: 'certs' },
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
            <p>สรุปภาพรวมกิจกรรม ผู้เข้าร่วม เกียรติบัตรที่ออก และความพึงพอใจ ของปีที่เลือก (เฉพาะกิจกรรมที่จัดเสร็จสิ้นแล้ว)</p>
          </div>
        </div>
      </div>

      <div className="wrap tight">
        {!loading && years.length === 0 ? (
          <div className="empty-state">ยังไม่มีกิจกรรมที่จัดเสร็จสิ้นสำหรับสรุปผลรายปี</div>
        ) : (
          <>
            <div className="section-head">
              <div>
                <div className="sh-title">แดชบอร์ดรายปี {year ? `· ${year}` : ''}</div>
                <div className="sh-sub">สรุปภาพรวมของปีที่เลือก</div>
              </div>
              <div className="dash-controls">
                <div className="dash-pick">
                  <label>ปีที่ดู</label>
                  <select className="role-select" value={year || ''} onChange={(e) => setYear(Number(e.target.value))}>
                    {years.map((y) => <option key={y} value={y}>ปี {y}</option>)}
                  </select>
                </div>
                <button className="btn btn-outline" onClick={exportDash}><i className="ti ti-download" /> Export</button>
              </div>
            </div>

            <div className="compare-row">
              <div className="cmp-card"><div className="cm-lbl">กิจกรรมทั้งหมด</div><div className="cm-vals"><span className="cm-now">{fmt(totals.events)}</span></div></div>
              <div className="cmp-card"><div className="cm-lbl">ผู้เข้าร่วมสะสม</div><div className="cm-vals"><span className="cm-now">{fmt(totals.participants)}</span></div></div>
              <div className="cmp-card"><div className="cm-lbl">เกียรติบัตรที่ออก</div><div className="cm-vals"><span className="cm-now">{fmt(totals.certs)}</span></div></div>
              <div className="cmp-card"><div className="cm-lbl">ความพึงพอใจเฉลี่ย</div><div className="cm-vals"><span className="cm-now">{avgSatisfaction} / 5</span></div></div>
            </div>

            <div className="chart-row">
              <div className="chart-card">
                <h3><i className="ti ti-chart-pie" /> สัดส่วนประเภทกิจกรรม</h3>
                <div className="ch-sub">รวมปี {year} · {totals.events} กิจกรรม</div>
                <div className="pie-wrap">
                  <div style={{ position: 'relative', width: 160, height: 160 }}>
                    <div className="pie" style={{ background: pieStops ? `conic-gradient(${pieStops})` : 'var(--c2-10)' }} />
                    <div className="pie-center">{totals.events}<small>กิจกรรม</small></div>
                  </div>
                  <div className="pie-legend">
                    {yearRows.map((r, i) => (
                      <div className="pl-row" key={r.category}>
                        <span className="lbl"><span className="dot" style={{ background: DASH_COLORS[i % DASH_COLORS.length] }} /> {r.category}</span>
                        <span className="val">{r.event_count}</span>
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
                    <tr><th>หมวดหมู่</th><th className="center">กิจกรรม</th><th className="center">ผู้เข้าร่วม</th><th className="center">เกียรติบัตร</th><th className="center">ความพึงพอใจ</th></tr>
                  </thead>
                  <tbody>
                    {yearRows.map((r) => (
                      <tr key={r.category}>
                        <td><strong>{r.category}</strong></td>
                        <td className="center">{r.event_count}</td>
                        <td className="center">{fmt(r.participant_count)}</td>
                        <td className="center">{fmt(r.certificate_count)}</td>
                        <td className="center">{(r.avg_satisfaction || 0).toFixed(1)}</td>
                      </tr>
                    ))}
                    <tr style={{ background: 'var(--c2-08)', fontWeight: 700 }}>
                      <td><strong style={{ color: 'var(--c4)' }}>รวมทั้งปี</strong></td>
                      <td className="center"><strong>{totals.events}</strong></td>
                      <td className="center"><strong>{fmt(totals.participants)}</strong></td>
                      <td className="center"><strong>{fmt(totals.certs)}</strong></td>
                      <td className="center"><strong>{avgSatisfaction}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

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
