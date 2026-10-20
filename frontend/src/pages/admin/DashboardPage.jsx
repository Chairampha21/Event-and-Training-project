import React, { useEffect, useMemo, useState } from 'react';
import { useEvents } from '../../hooks/useEvents';
import { downloadCsv } from '../../utils/csvExport';
import BudgetSection, { exportBudgetCsv } from '../../features/budget/components/BudgetSection';
import CategoryMixCard from '../../features/dashboard/components/CategoryMixCard';
import AttendanceCard from '../../features/dashboard/components/AttendanceCard';


// "1 ตุลาคม 2568 – 30 กันยายน 2569" for ปีงบประมาณ 2569 (the year is named after its end).
function fiscalYearRange(fy) {
  return `1 ตุลาคม ${fy - 1} – 30 กันยายน ${fy}`;
}

function fmt(n) { return (n || 0).toLocaleString('en-US'); }

export default function DashboardPage() {
  const { getDashboardYearly, getDashboardBudget, saveBudgetActual } = useEvents();
  const [rows, setRows] = useState([]);
  const [budgetRows, setBudgetRows] = useState([]);
  const [year, setYear] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDashboardYearly(), getDashboardBudget()]).then(([data, budget]) => {
      setRows(data);
      setBudgetRows(budget);
      // Default to the newest year that has anything to show in either part.
      const newest = Math.max(...data.map((r) => r.report_year), ...budget.map((r) => r.report_year));
      if (Number.isFinite(newest)) setYear((y) => y ?? newest);
      setLoading(false);
    });
  }, [getDashboardYearly, getDashboardBudget]);

  // Budget covers every event of the year (a planned budget matters before the
  // event runs), so its years are offered too — not only years with finished events.
  const years = useMemo(() => [...new Set([...rows, ...budgetRows].map((r) => r.report_year))].sort((a, b) => b - a), [rows, budgetRows]);
  const yearBudgetRows = useMemo(() => budgetRows.filter((r) => r.report_year === year), [budgetRows, year]);
  // Finished events only — the same set the activity figures on this page count.
  const yearDoneRows = useMemo(() => yearBudgetRows.filter((r) => r.status === 'done'), [yearBudgetRows]);

  async function handleSaveActual(eventId, amount) {
    const ok = await saveBudgetActual(eventId, amount);
    if (ok) setBudgetRows(await getDashboardBudget());
    return ok;
  }
  const yearRows = useMemo(() => rows.filter((r) => r.report_year === year), [rows, year]);

  const totals = useMemo(() => yearRows.reduce((acc, r) => ({
    events: acc.events + r.event_count,
    participants: acc.participants + r.participant_count,
    certs: acc.certs + r.certificate_count,
  }), { events: 0, participants: 0, certs: 0 }), [yearRows]);

  const avgSatisfaction = yearRows.length
    ? (yearRows.reduce((a, r) => a + (r.avg_satisfaction || 0), 0) / yearRows.length).toFixed(1)
    : '0.0';


  function exportDash() {
    downloadCsv(`dashboard-ปีงบประมาณ-${year}`, yearRows.map((r) => ({
      cat: r.category, events: r.event_count, participants: r.participant_count, certs: r.certificate_count, satis: r.avg_satisfaction,
    })), [
      { label: 'หมวดหมู่', value: 'cat' },
      { label: 'กิจกรรม', value: 'events' },
      { label: 'ผู้เข้าร่วม', value: 'participants' },
      { label: 'เกียรติบัตร', value: 'certs' },
      { label: 'ความพึงพอใจ', value: 'satis' },
    ]);
  }

  // Header button: everything on the page for the chosen fiscal year — the
  // activity summary and the per-event budget table, as two files.
  function exportAll() {
    exportDash();
    if (yearBudgetRows.length > 0) exportBudgetCsv(yearBudgetRows, year);
  }

  return (
    <div>
      <div className="page-header">
        <div className="ph-inner">
          <div>
            <h1>แดชบอร์ดกิจกรรม ประจำปีงบประมาณ{year ? ` พ.ศ. ${year}` : ''}</h1>
            <p className="ph-lead">ผลการจัดกิจกรรม จำนวนผู้เข้าร่วม เกียรติบัตรที่ออก และความพึงพอใจ พร้อมผลการใช้จ่ายงบประมาณ ของปีงบประมาณที่เลือก</p>
            <p className="ph-note">สถิติกิจกรรมนับเฉพาะกิจกรรมที่จัดเสร็จสิ้นแล้ว · ผลการใช้จ่ายงบประมาณนับทุกกิจกรรมในปีงบประมาณ</p>
          </div>
          {year && (
            <div className="ph-actions">
              <button className="btn glass" onClick={exportAll} title="ดาวน์โหลด 2 ไฟล์: ผลการจัดกิจกรรม และผลการใช้จ่ายงบประมาณ"><i className="ti ti-download" /> ส่งออก CSV</button>
            </div>
          )}
        </div>
      </div>

      <div className="wrap tight">
        {!loading && years.length === 0 ? (
          <div className="empty-state">ยังไม่มีกิจกรรมสำหรับแสดงบนแดชบอร์ด</div>
        ) : (
          <>
            <div className="section-head">
              <div>
                <div className="sh-title">ผลการจัดกิจกรรม</div>
                <div className="sh-sub">{year ? `ปีงบประมาณ พ.ศ. ${year} · ${fiscalYearRange(year)}` : 'เลือกปีงบประมาณที่ต้องการดู'}</div>
              </div>
              <div className="dash-controls">
                <div className="dash-pick">
                  <label>ปีงบประมาณ</label>
                  <select className="role-select" value={year || ''} onChange={(e) => setYear(Number(e.target.value))}>
                    {years.map((y) => <option key={y} value={y}>พ.ศ. {y}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="compare-row">
              <div className="cmp-card"><div className="cm-lbl">กิจกรรมทั้งหมด</div><div className="cm-vals"><span className="cm-now">{fmt(totals.events)}</span></div></div>
              <div className="cmp-card"><div className="cm-lbl">ผู้เข้าร่วมสะสม</div><div className="cm-vals"><span className="cm-now">{fmt(totals.participants)}</span></div></div>
              <div className="cmp-card"><div className="cm-lbl">เกียรติบัตรที่ออก</div><div className="cm-vals"><span className="cm-now">{fmt(totals.certs)}</span></div></div>
              <div className="cmp-card"><div className="cm-lbl">ความพึงพอใจเฉลี่ย</div><div className="cm-vals"><span className="cm-now">{avgSatisfaction} / 5</span></div></div>
            </div>

            <div className="chart-row">
              <CategoryMixCard rows={yearRows} year={year} />
              <AttendanceCard rows={yearDoneRows} certificates={totals.certs} year={year} />
            </div>

            <div className="table-card">
              <div className="table-toolbar">
                <h3><i className="ti ti-table-options" /> สรุปผลการจัดกิจกรรม · ปีงบประมาณ {year}</h3>
                <button className="btn btn-outline" style={{ padding: '7px 12px', fontSize: 13 }} onClick={exportDash}><i className="ti ti-download" /> ส่งออก CSV</button>
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

            <BudgetSection rows={yearBudgetRows} year={year} onSaveActual={handleSaveActual} />
          </>
        )}
      </div>
    </div>
  );
}
