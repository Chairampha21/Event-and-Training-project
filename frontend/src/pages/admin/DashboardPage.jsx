import React, { useEffect, useMemo, useState } from 'react';
import { useEvents } from '../../hooks/useEvents';
import { downloadXlsx, tableSheet } from '../../utils/xlsxExport';
import BudgetSection, { budgetSheet } from '../../features/budget/components/BudgetSection';
import CategoryMixCard from '../../features/dashboard/components/CategoryMixCard';
import AttendanceCard from '../../features/dashboard/components/AttendanceCard';
import BreakdownCard from '../../features/dashboard/components/BreakdownCard';
import { STUDENT_YEARS } from '../../utils/constants';

const PROGRAMS = [{ key: 'cs', label: 'วิทยาการคอมพิวเตอร์ (CS)' }, { key: 'it', label: 'เทคโนโลยีสารสนเทศ (IT)' }];

// Audience rows (one per programme × year) summed into one group per programme
// or per year, plus "ไม่ระบุ" for people who left it out of their profile.
function sumBy(audience, field, groups, none) {
  const pick = (k) => audience.filter((r) => r[field] === k);
  const total = (list) => ({ reg: list.reduce((a, r) => a + r.registered, 0), in: list.reduce((a, r) => a + r.attended, 0), cert: list.reduce((a, r) => a + r.certified, 0) });
  const rows = groups.map((g) => ({ key: g.key, label: g.label, ...total(pick(g.key)) }));
  const unknown = total(pick(none));
  if (unknown.reg) rows.push({ key: '', label: 'ไม่ระบุ', ...unknown });
  return rows;
}


// "1 ตุลาคม 2568 – 30 กันยายน 2569" for ปีงบประมาณ 2569 (the year is named after its end).
function fiscalYearRange(fy) {
  return `1 ตุลาคม ${fy - 1} – 30 กันยายน ${fy}`;
}

function fmt(n) { return (n || 0).toLocaleString('en-US'); }

// "77%" of a whole, or nothing when there is no whole.
function pct(part, whole) { return whole ? `${Math.round((part / whole) * 100)}%` : ''; }

// A score out of 5 with a short bar; "ยังไม่มีผลประเมิน" when nobody rated.
function Satisfaction({ value }) {
  if (!value) return <span className="cell-muted">ยังไม่มีผลประเมิน</span>;
  return (
    <span className="satis">
      <strong>{value.toFixed(1)}</strong>
      <span className="satis-bar"><span style={{ width: `${(value / 5) * 100}%` }} /></span>
    </span>
  );
}

export default function DashboardPage() {
  const { getDashboardYearly, getDashboardBudget, saveBudgetActual, getDashboardAudience } = useEvents();
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

  // The year's people split by programme and year of study.
  const [audience, setAudience] = useState([]);
  useEffect(() => {
    if (!year) return undefined;
    let live = true;
    getDashboardAudience(year).then((a) => { if (live) setAudience(a); });
    return () => { live = false; };
  }, [getDashboardAudience, year]);
  const programRows = useMemo(() => sumBy(audience, 'program', PROGRAMS, 'all'), [audience]);
  const studyYearRows = useMemo(() => sumBy(audience, 'year', STUDENT_YEARS, ''), [audience]);
  const audienceTotal = audience.reduce((a, r) => a + r.registered, 0);
  const audienceIn = audience.reduce((a, r) => a + r.attended, 0);
  const audienceCert = audience.reduce((a, r) => a + r.certified, 0);
  // Programme × year: how many registered in each pair.
  const crossCell = (p, y) => audience.filter((r) => r.program === p && r.year === y).reduce((a, r) => a + r.registered, 0);
  // Only the years (and "ไม่ระบุ") someone registered from get a column.
  const crossYears = studyYearRows.filter((r) => r.reg > 0).map((r) => ({ key: r.key, label: r.label }));
  const crossPrograms = programRows.filter((r) => r.reg > 0 || r.key);

  const totals = useMemo(() => yearRows.reduce((acc, r) => ({
    events: acc.events + r.event_count,
    participants: acc.participants + r.participant_count,
    certs: acc.certs + r.certificate_count,
  }), { events: 0, participants: 0, certs: 0 }), [yearRows]);

  // Categories nobody has rated yet (0) are left out of the average, not counted as 0.
  const rated = yearRows.filter((r) => r.avg_satisfaction > 0);
  const avgSatisfaction = rated.length
    ? (rated.reduce((a, r) => a + r.avg_satisfaction, 0) / rated.length).toFixed(1)
    : '–';


  // The activity summary table, laid out as on the page, as a workbook sheet.
  function dashSheet() {
    const certPct = (c, p) => (p ? Math.round((c / p) * 100) : null);
    return tableSheet({
      name: `สรุปกิจกรรม ${year}`,
      title: `สรุปผลการจัดกิจกรรมตามประเภท ปีงบประมาณ ${year}`,
      subtitle: 'นับเฉพาะกิจกรรมที่จัดเสร็จแล้ว · ความพึงพอใจว่างไว้ = ยังไม่มีผลแบบประเมิน',
      columns: [
        { label: 'ประเภทกิจกรรม', value: 'category', width: 30 },
        { label: 'กิจกรรม', value: 'event_count', type: 'int', width: 11 },
        { label: 'ผู้ลงทะเบียน (คน)', value: 'participant_count', type: 'int', width: 14 },
        { label: 'ได้เกียรติบัตร (คน)', value: 'certificate_count', type: 'int', width: 14 },
        { label: 'ได้เกียรติบัตร (%)', value: (r) => certPct(r.certificate_count, r.participant_count), type: 'int', width: 13 },
        { label: 'ความพึงพอใจ (เต็ม 5)', value: (r) => (r.avg_satisfaction > 0 ? Number(r.avg_satisfaction) : null), type: 'dec', width: 14 },
      ],
      rows: yearRows,
      totals: ['รวมทั้งปี', totals.events, totals.participants, totals.certs, certPct(totals.certs, totals.participants), rated.length ? Number(avgSatisfaction) : null],
    });
  }

  // The audience tables (programme × year, and year of study), as on the page.
  function audienceSheets() {
    const share = (part, whole) => (whole ? Math.round((part / whole) * 100) : null);
    const note = `ปีงบประมาณ ${year} (${fiscalYearRange(year)}) · นับเฉพาะกิจกรรมที่จัดเสร็จแล้ว · % คิดจากผู้ลงทะเบียน`;
    const tail = [
      { label: 'ลงทะเบียน (คน)', value: 'reg', type: 'int', width: 13 },
      { label: 'เข้าร่วมจริง (คน)', value: 'in', type: 'int', width: 13 },
      { label: 'เข้าร่วมจริง (%)', value: (r) => share(r.in, r.reg), type: 'int', width: 12 },
      { label: 'ได้เกียรติบัตร (คน)', value: 'cert', type: 'int', width: 14 },
      { label: 'ได้เกียรติบัตร (%)', value: (r) => share(r.cert, r.reg), type: 'int', width: 13 },
    ];
    const tailTotals = [audienceTotal, audienceIn, share(audienceIn, audienceTotal), audienceCert, share(audienceCert, audienceTotal)];
    return [
      tableSheet({
        name: `สาขาและชั้นปี ${year}`,
        title: `ผู้ลงทะเบียนตามสาขาและชั้นปี ปีงบประมาณ ${year}`,
        subtitle: note,
        columns: [
          { label: 'สาขา', value: 'label', width: 30 },
          ...crossYears.map((y) => ({ label: `${y.label} (คน)`, value: (p) => crossCell(p.key || 'all', y.key), type: 'int', width: 10 })),
          ...tail,
        ],
        rows: crossPrograms,
        totals: ['รวม', ...crossYears.map((y) => studyYearRows.find((r) => r.key === y.key)?.reg || 0), ...tailTotals],
      }),
      tableSheet({
        name: `ชั้นปี ${year}`,
        title: `ผู้เข้าร่วมแยกตามชั้นปี ปีงบประมาณ ${year}`,
        subtitle: note,
        columns: [{ label: 'ชั้นปี', value: 'label', width: 18 }, ...tail],
        rows: studyYearRows,
        totals: ['รวม', ...tailTotals],
      }),
    ];
  }

  function exportAudience() {
    downloadXlsx(`ผู้ลงทะเบียนตามสาขาและชั้นปี-ปีงบประมาณ-${year}`, audienceSheets());
  }

  function exportDash() {
    downloadXlsx(`dashboard-ปีงบประมาณ-${year}`, [dashSheet()]);
  }

  // Header button: everything on the page for the chosen fiscal year — the
  // activity summary, the audience tables and the per-event budget table, as
  // sheets of one file.
  function exportAll() {
    downloadXlsx(`รายงาน-ปีงบประมาณ-${year}`, [
      dashSheet(),
      ...(audienceTotal > 0 ? audienceSheets() : []),
      budgetSheet(yearBudgetRows, year),
    ]);
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
              <button className="btn glass" onClick={exportAll} title="ดาวน์โหลดไฟล์ Excel: ผลการจัดกิจกรรม ผู้ลงทะเบียนตามสาขาและชั้นปี และผลการใช้จ่ายงบประมาณ"><i className="ti ti-download" /> ส่งออก Excel</button>
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
              <div className="cmp-card"><div className="cm-lbl">ความพึงพอใจเฉลี่ย</div><div className="cm-vals"><span className="cm-now">{avgSatisfaction}{rated.length ? ' / 5' : ''}</span></div></div>
            </div>

            <div className="chart-row">
              <CategoryMixCard rows={yearRows} year={year} />
              <AttendanceCard rows={yearDoneRows} certificates={totals.certs} year={year} />
            </div>

            <div className="chart-row even">
              <BreakdownCard icon="ti-school" title="ผู้เข้าร่วมแยกตามสาขา" rows={programRows} total={audienceTotal}
                note={`ปีงบประมาณ ${year} · ผู้ลงทะเบียน (อ่อน) กับผู้เข้าร่วมจริง (เข้ม) · ${fmt(audienceTotal)} คน`} />
              <BreakdownCard icon="ti-stairs-up" title="ผู้เข้าร่วมแยกตามชั้นปี" rows={studyYearRows} total={audienceTotal}
                note={`ปีงบประมาณ ${year} · ผู้ลงทะเบียน (อ่อน) กับผู้เข้าร่วมจริง (เข้ม) · ${fmt(audienceTotal)} คน`} />
            </div>

            {audienceTotal > 0 && (
              <div className="table-card dash-table">
                <div className="table-toolbar">
                  <h3><i className="ti ti-table" /> ผู้ลงทะเบียนตามสาขาและชั้นปี · ปีงบประมาณ {year}</h3>
                  <button className="btn btn-outline" style={{ padding: '7px 12px', fontSize: 13 }} onClick={exportAudience}><i className="ti ti-download" /> ส่งออก Excel</button>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <thead>
                      <tr className="th-group">
                        <th rowSpan={2}>สาขา</th>
                        <th className="center" colSpan={crossYears.length}>ผู้ลงทะเบียนแต่ละชั้นปี (คน)</th>
                        <th className="center col-split" colSpan={3}>รวมทั้งสาขา</th>
                      </tr>
                      <tr>
                        {crossYears.map((y) => <th className="center" key={y.key || 'none'}>{y.label}</th>)}
                        <th className="center col-split">ลงทะเบียน</th>
                        <th className="center">เข้าร่วมจริง</th>
                        <th className="center">ได้เกียรติบัตร</th>
                      </tr>
                    </thead>
                    <tbody>
                      {crossPrograms.map((p) => (
                        <tr key={p.key || 'none'}>
                          <td><strong>{p.label}</strong></td>
                          {crossYears.map((y) => {
                            const n = crossCell(p.key || 'all', y.key);
                            return <td className="center" key={y.key || 'none'}>{n ? fmt(n) : <span className="cell-muted">–</span>}</td>;
                          })}
                          <td className="center col-split"><strong>{fmt(p.reg)}</strong></td>
                          <td className="center">{fmt(p.in)}<span className="cell-sub">{pct(p.in, p.reg)}</span></td>
                          <td className="center">{fmt(p.cert)}<span className="cell-sub">{pct(p.cert, p.reg)}</span></td>
                        </tr>
                      ))}
                      <tr className="row-total">
                        <td>รวม</td>
                        {crossYears.map((y) => <td className="center" key={y.key || 'none'}>{fmt(studyYearRows.find((r) => r.key === y.key)?.reg)}</td>)}
                        <td className="center col-split">{fmt(audienceTotal)}</td>
                        <td className="center">{fmt(audienceIn)}<span className="cell-sub">{pct(audienceIn, audienceTotal)}</span></td>
                        <td className="center">{fmt(audienceCert)}<span className="cell-sub">{pct(audienceCert, audienceTotal)}</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="table-card dash-table">
              <div className="table-toolbar">
                <h3><i className="ti ti-table-options" /> สรุปผลการจัดกิจกรรมตามประเภท · ปีงบประมาณ {year}</h3>
                <button className="btn btn-outline" style={{ padding: '7px 12px', fontSize: 13 }} onClick={exportDash}><i className="ti ti-download" /> ส่งออก Excel</button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr><th>ประเภทกิจกรรม</th><th className="center">กิจกรรม</th><th className="center">ผู้ลงทะเบียน (คน)</th><th className="center">ได้เกียรติบัตร (คน)</th><th>ความพึงพอใจ (เต็ม 5)</th></tr>
                  </thead>
                  <tbody>
                    {yearRows.map((r) => (
                      <tr key={r.category}>
                        <td><strong>{r.category}</strong></td>
                        <td className="center">{r.event_count}</td>
                        <td className="center">{fmt(r.participant_count)}</td>
                        <td className="center">{fmt(r.certificate_count)}<span className="cell-sub">{pct(r.certificate_count, r.participant_count)}</span></td>
                        <td><Satisfaction value={r.avg_satisfaction} /></td>
                      </tr>
                    ))}
                    <tr className="row-total">
                      <td>รวมทั้งปี</td>
                      <td className="center">{totals.events}</td>
                      <td className="center">{fmt(totals.participants)}</td>
                      <td className="center">{fmt(totals.certs)}<span className="cell-sub">{pct(totals.certs, totals.participants)}</span></td>
                      <td><Satisfaction value={rated.length ? Number(avgSatisfaction) : 0} /></td>
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
