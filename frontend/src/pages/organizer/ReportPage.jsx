import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useEvents } from '../../hooks/useEvents';
import { downloadCsv } from '../../utils/csvExport';
import { downloadXlsx, STYLE } from '../../utils/xlsxExport';
import { THAI_MONTHS, toBuddhistYear } from '../../utils/dateFormat';
import EvalResultChart from '../../features/evaluations/components/EvalResultChart';
import EventBudgetReport from '../../features/budget/components/EventBudgetReport';

export default function ReportPage() {
  const { session, events, rosters, pushToast, getEvaluationResults } = useEvents();
  // A teacher reads the reports of the events they coordinate (the budget too, read-only).
  const coordinator = session?.role === 'teacher';
  const listed = useMemo(() => events.filter((e) => e.listed && (!coordinator || e.coordinatorId === session.id)), [events, coordinator, session?.id]);
  // /report?event=<id> (from the teacher's list or a notification) opens that event.
  const [params] = useSearchParams();
  const [eventId, setEventId] = useState(() => Number(params.get('event')) || listed[0]?.id);
  const ev = listed.find((e) => e.id === Number(eventId)) || listed[0];
  // Teachers join events but are not counted as participants in reports.
  const roster = ((ev && rosters[ev.id]) || []).filter((p) => !p.isTeacher);
  const attended = roster.filter((p) => p.in).length;
  const attendRate = roster.length ? ((attended / roster.length) * 100) : 0;

  // ปี/เดือน ที่จัด — คำนวณจาก dateStart (ISO) ของแต่ละกิจกรรม
  const years = useMemo(() => {
    const set = new Set(listed.filter((e) => e.dateStart).map((e) => e.dateStart.slice(0, 4)));
    return [...set].sort((a, b) => b - a);
  }, [listed]);

  const [query, setQuery] = useState(listed[0]?.title || '');
  const [pickerOpen, setPickerOpen] = useState(false);
  // The box shows the chosen event's name. Opening the list shows every event;
  // it only narrows once the person actually types something to search for.
  const [searching, setSearching] = useState(false);
  const [yearFilter, setYearFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');

  const qq = searching ? query.trim().toLowerCase() : '';
  const filteredEvents = listed.filter((e) => {
    if (qq && !e.title.toLowerCase().includes(qq)) return false;
    if (yearFilter && e.dateStart?.slice(0, 4) !== yearFilter) return false;
    if (monthFilter && e.dateStart?.slice(5, 7) !== monthFilter) return false;
    return true;
  });

  function pickEvent(e) {
    setEventId(e.id);
    setQuery(e.title);
    setSearching(false);
    setPickerOpen(false);
  }

  function openPicker() {
    setSearching(false);
    setPickerOpen(true);
  }

  // Leaving the box without choosing puts the chosen event's name back.
  function closePicker() {
    setPickerOpen(false);
    setSearching(false);
    setQuery(ev?.title || '');
  }

  // Events arrive after the first render; show the first one's name once they do.
  useEffect(() => {
    if (!pickerOpen) setQuery(ev?.title || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ev?.id, ev?.title]);

  // เมื่อเปลี่ยนตัวกรองปี/เดือนแล้วกิจกรรมที่เลือกอยู่ไม่เข้าเงื่อนไขอีกต่อไป
  // ให้เลื่อนไปเลือกรายการแรกที่ตรงเงื่อนไขให้อัตโนมัติ
  useEffect(() => {
    if (!ev) return;
    const stillMatches =
      (!yearFilter || ev.dateStart?.slice(0, 4) === yearFilter) &&
      (!monthFilter || ev.dateStart?.slice(5, 7) === monthFilter);
    if (stillMatches) return;
    const next = listed.find((e) =>
      (!yearFilter || e.dateStart?.slice(0, 4) === yearFilter) &&
      (!monthFilter || e.dateStart?.slice(5, 7) === monthFilter)
    );
    if (next) { setEventId(next.id); setQuery(next.title); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearFilter, monthFilter]);

  const [tab, setTab] = useState('summary');
  const [evalResults, setEvalResults] = useState([]);
  const [evalLoading, setEvalLoading] = useState(false);

  useEffect(() => {
    if (!ev) { setEvalResults([]); return; }
    let cancelled = false;
    setEvalLoading(true);
    getEvaluationResults(ev.id).then((results) => {
      if (!cancelled) { setEvalResults(results || []); setEvalLoading(false); }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ev?.id]);

  const evalData = evalResults.map((r) => ({ label: r.label, avg: r.avg_score || 0 }));
  const evalResponded = evalResults.reduce((max, r) => Math.max(max, r.response_count || 0), 0);
  // Only questions someone actually answered count — an unanswered one has no
  // score, and counting it as 0 would drag the overall average down.
  const answered = evalResults.filter((r) => r.response_count > 0);
  const evalOverall = answered.length ? answered.reduce((a, r) => a + (r.avg_score || 0), 0) / answered.length : 0;

  const recent = useMemo(() => listed.slice(0, 6), [listed]);
  // Registrations without teachers; falls back to the event's own count while its roster loads.
  const regCount = (e) => (rosters[e.id] ? rosters[e.id].filter((p) => !p.isTeacher).length : e.reg);
  const maxV = Math.max(10, ...recent.map(regCount));

  // One export button for the whole report: the menu says what each file
  // holds, so it does not depend on which tab happens to be open.
  const [exportOpen, setExportOpen] = useState(false);
  const hasEval = evalData.length > 0 && evalResponded > 0;
  const ROSTER_COLS = [
    { label: 'ชื่อ–นามสกุล', value: 'name' },
    { label: 'รหัสนักศึกษา', value: 'sid' },
    { label: 'เช็คอิน', value: (r) => (r.in ? 'เข้าร่วม' : 'ไม่เข้าร่วม') },
  ];
  const EVAL_COLS = [
    { label: 'หัวข้อประเมิน', value: 'label' },
    { label: 'คะแนนเฉลี่ย (เต็ม 5)', value: (r) => (r.response_count ? Number(r.avg_score || 0).toFixed(2) : '') },
    { label: 'จำนวนผู้ตอบ', value: (r) => r.response_count || 0 },
  ];

  function exportReport(kind) {
    setExportOpen(false);
    if (!ev) return;
    pushToast('กำลังส่งออกรายงาน', ev.title.slice(0, 30));
    if (kind === 'roster') { downloadCsv(`รายชื่อและการเข้าร่วม-${ev.id}`, roster, ROSTER_COLS); return; }
    if (kind === 'eval') { downloadCsv(`ผลแบบประเมิน-${ev.id}`, evalResults, EVAL_COLS); return; }
    // Whole report: one workbook, one sheet per part.
    const head = (v) => ({ v, s: STYLE.head });
    const pair = (k, v) => ({ height: 22, cells: [{ v: k, s: STYLE.left }, { v, s: STYLE.left }] });
    const merged = (last) => ({ merges: [`A1:${last}1`, `A2:${last}2`] });
    const top = (t) => [
      { height: 26, cells: [{ v: t, s: STYLE.title }] },
      { height: 36, cells: [{ v: ev.title, s: STYLE.subtitle }] },
      { cells: [] },
    ];
    downloadXlsx(`รายงานสรุปกิจกรรม-${ev.id}`, [
      {
        name: 'สรุปกิจกรรม', cols: [30, 44], ...merged('B'),
        rows: [
          ...top('รายงานสรุปกิจกรรม'),
          pair('วันที่จัด', ev.date),
          pair('ประเภท', ev.cat || '-'),
          pair('ผู้สมัครทั้งหมด (คน)', roster.length),
          pair('เข้าร่วม / เช็คอิน (คน)', attended),
          pair('อัตราเข้าร่วม (%)', Number(attendRate.toFixed(1))),
          pair('คะแนนประเมินเฉลี่ยรวม (เต็ม 5)', hasEval ? Number(evalOverall.toFixed(2)) : '-'),
          pair('ผู้ทำแบบประเมิน (คน)', evalResponded),
        ],
      },
      {
        name: 'รายชื่อและการเข้าร่วม', cols: [7, 16, 34, 16], ...merged('D'),
        rows: [
          ...top('รายชื่อและการเข้าร่วม'),
          { height: 22, cells: [head('ลำดับ'), head('รหัสนักศึกษา'), head('ชื่อ–นามสกุล'), head('เช็คอิน')] },
          ...roster.map((r, i) => ({ height: 22, cells: [{ v: i + 1, s: STYLE.center }, { v: r.sid, s: STYLE.center }, { v: r.name, s: STYLE.left }, { v: r.in ? 'เข้าร่วม' : 'ไม่เข้าร่วม', s: STYLE.center }] })),
        ],
      },
      {
        name: 'ผลแบบประเมิน', cols: [7, 60, 18, 14], ...merged('D'),
        rows: [
          ...top('ผลแบบประเมิน'),
          { height: 22, cells: [head('ลำดับ'), head('หัวข้อประเมิน'), head('คะแนนเฉลี่ย (เต็ม 5)'), head('ผู้ตอบ (คน)')] },
          ...evalResults.map((r, i) => ({ height: 22, cells: [{ v: i + 1, s: STYLE.center }, { v: r.label, s: STYLE.left }, { v: r.response_count ? Number(Number(r.avg_score || 0).toFixed(2)) : '-', s: STYLE.center }, { v: r.response_count || 0, s: STYLE.center }] })),
          ...(evalResults.length === 0 ? [{ height: 22, cells: [{ v: '', s: STYLE.center }, { v: 'กิจกรรมนี้ยังไม่มีคำถามแบบประเมิน', s: STYLE.left }, { v: '', s: STYLE.center }, { v: '', s: STYLE.center }] }] : []),
        ],
      },
    ]);
  }

  if (!ev) {
    return <div className="wrap tight"><div className="empty-state">{coordinator ? 'ยังไม่มีกิจกรรมที่คุณเป็นอาจารย์ผู้ประสานงาน' : 'ยังไม่มีกิจกรรมสำหรับออกรายงาน'}</div></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div className="ph-inner">
          <div>
            <h1>{coordinator ? 'รายงานกิจกรรมที่รับผิดชอบ' : 'รายงานสรุปกิจกรรม'}</h1>
            <p>สรุปผลกิจกรรมรายรายการ · จำนวนผู้สมัครและผู้เข้าร่วม · อัตราเข้าร่วม · เกียรติบัตรที่ออก</p>
          </div>
          <div className="ph-actions">
            <div className="rp-export" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setExportOpen(false); }}>
              <button type="button" className="btn glass" aria-haspopup="menu" aria-expanded={exportOpen} onClick={() => setExportOpen((o) => !o)}>
                <i className="ti ti-download" /> ส่งออกรายงาน <i className={`ti ti-chevron-${exportOpen ? 'up' : 'down'}`} />
              </button>
              {exportOpen && (
                <div className="rp-export-menu" role="menu">
                  <button type="button" role="menuitem" onClick={() => exportReport('all')}>
                    <i className="ti ti-file-spreadsheet" />
                    <span><strong>รายงานทั้งหมด (Excel)</strong><small>สรุปกิจกรรม รายชื่อ และผลแบบประเมิน แยกแผ่นในไฟล์เดียว</small></span>
                  </button>
                  <button type="button" role="menuitem" onClick={() => exportReport('roster')} disabled={roster.length === 0}>
                    <i className="ti ti-users" />
                    <span><strong>รายชื่อและการเข้าร่วม (CSV)</strong><small>{roster.length > 0 ? `${roster.length} คน · เช็คอิน ${attended} คน` : 'ยังไม่มีผู้สมัคร'}</small></span>
                  </button>
                  <button type="button" role="menuitem" onClick={() => exportReport('eval')} disabled={!hasEval}>
                    <i className="ti ti-clipboard-check" />
                    <span><strong>ผลแบบประเมิน (CSV)</strong><small>{hasEval ? `${evalData.length} หัวข้อ · ผู้ตอบ ${evalResponded} คน` : 'ยังไม่มีผู้ทำแบบประเมิน'}</small></span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="wrap tight">
        <div className="report-filter">
          <div className="field rf-search" style={{ position: 'relative' }}>
            <label>กิจกรรม</label>
            <div className="with-icon"><i className="ti ti-search" />
              <input
                type="text"
                value={query}
                role="combobox"
                aria-expanded={pickerOpen}
                aria-controls="report-event-list"
                onChange={(e) => { setQuery(e.target.value); setSearching(true); setPickerOpen(true); }}
                onFocus={(e) => { e.target.select(); openPicker(); }}
                onClick={() => { if (!pickerOpen) openPicker(); }}
                onBlur={() => setTimeout(closePicker, 150)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') e.target.blur();
                  if (e.key === 'Enter' && pickerOpen && filteredEvents.length > 0) { pickEvent(filteredEvents[0]); e.target.blur(); }
                }}
                placeholder="พิมพ์ชื่อกิจกรรมเพื่อค้นหา หรือเลือกจากรายการ..."
                autoComplete="off"
              />
              <i className={`ti ti-chevron-${pickerOpen ? 'up' : 'down'} rf-caret`} aria-hidden="true" />
            </div>
            {pickerOpen && (
              <div className="rf-suggest" id="report-event-list" role="listbox">
                <div className="rf-suggest-head">{qq ? `ผลการค้นหา ${filteredEvents.length} รายการ` : `เลือกกิจกรรม · ทั้งหมด ${filteredEvents.length} รายการ · พิมพ์เพื่อค้นหา`}</div>
                {filteredEvents.length === 0 && <div className="rf-suggest-empty">ไม่พบกิจกรรมที่ตรงเงื่อนไข</div>}
                {filteredEvents.map((e) => (
                  <div
                    key={e.id}
                    className={`rf-suggest-item${ev?.id === e.id ? ' active' : ''}`}
                    role="option"
                    aria-selected={ev?.id === e.id}
                    onMouseDown={() => pickEvent(e)}
                  >
                    <span className="rf-title">{ev?.id === e.id && <i className="ti ti-check" />} {e.title}</span>
                    <span className="rf-meta">{e.date}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="field rf-year">
            <label>ปีที่จัด</label>
            <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
              <option value="">ทุกปี</option>
              {years.map((y) => <option key={y} value={y}>{toBuddhistYear(Number(y))}</option>)}
            </select>
          </div>
          <div className="field rf-month">
            <label>เดือนที่จัด</label>
            <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
              <option value="">ทุกเดือน</option>
              {THAI_MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
            </select>
          </div>
        </div>

        <div className="table-toolbar" style={{ background: 'none', border: 'none', padding: '0 0 16px' }}>
          <div className="tools">
            <button type="button" className={`filter-chip${tab === 'summary' ? ' active' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setTab('summary')}>
              <i className="ti ti-report-analytics" /> สรุปกิจกรรม
            </button>
            <button type="button" className={`filter-chip${tab === 'eval' ? ' active' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setTab('eval')}>
              <i className="ti ti-clipboard-check" /> แบบประเมิน
            </button>
            <button type="button" className={`filter-chip${tab === 'budget' ? ' active' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setTab('budget')}>
              <i className="ti ti-coin" /> งบประมาณกิจกรรม
            </button>
          </div>
        </div>

        {tab === 'summary' && (
        <>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="sc-top"><div className="sc-icon"><i className="ti ti-user-plus" /></div></div>
            <div className="sc-label">ผู้สมัครทั้งหมด</div>
            <div className="sc-value">{regCount(ev)} <small>คน</small></div>
          </div>
          <div className="stat-card">
            <div className="sc-top"><div className="sc-icon"><i className="ti ti-users" /></div></div>
            <div className="sc-label">เข้าร่วม (เช็คอิน)</div>
            <div className="sc-value">{attended} <small>คน</small></div>
          </div>
          <div className="stat-card accent">
            <div className="sc-top"><div className="sc-icon"><i className="ti ti-percentage" /></div></div>
            <div className="sc-label">อัตราเข้าร่วม</div>
            <div className="sc-value">{attendRate.toFixed(1)}% <small>({attended}/{roster.length || 0})</small></div>
          </div>
          <div className="stat-card dark">
            <div className="sc-top"><div className="sc-icon"><i className="ti ti-certificate" /></div></div>
            <div className="sc-label">สถานะกิจกรรม</div>
            <div className="sc-value" style={{ fontSize: 20 }}>{ev.status === 'done' ? 'จัดเสร็จแล้ว' : 'กำลังดำเนินการ'}</div>
          </div>
        </div>

        <div className="chart-row">
          <div className="chart-card">
            <h3><i className="ti ti-chart-bar" /> จำนวนผู้เข้าร่วม {recent.length} กิจกรรมล่าสุด</h3>
            <div className="ch-sub">เปรียบเทียบผู้สมัคร (อ่อน) กับผู้เข้าร่วมจริง (เข้ม)</div>
            <div className="chart-legend">
              <span><span className="dot" style={{ background: 'var(--c2-40)' }} /> ผู้สมัคร</span>
              <span><span className="dot" style={{ background: 'var(--c1)' }} /> เข้าร่วมจริง</span>
            </div>
            <div className="chart-bars-wrap">
              <div className="bar-y-axis"><span>{maxV}</span><span>{Math.round(maxV / 2)}</span><span>0</span></div>
              <div className="bar-chart">
                {recent.map((e) => {
                  const inCount = (rosters[e.id] || []).filter((p) => p.in && !p.isTeacher).length;
                  return (
                    <div className="bar-col" key={e.id}>
                      <div className="bar-pair">
                        <div className="bar" style={{ height: `${Math.round((regCount(e) / maxV) * 100)}%`, background: 'var(--c2-40)' }} title={regCount(e)} />
                        <div className="bar b2" style={{ height: `${Math.round((inCount / maxV) * 100)}%` }} title={inCount} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="chart-x-labels">{recent.map((e) => <span className="bx" key={e.id}>{e.title.split(' ')[0]}</span>)}</div>
          </div>

          <div className="chart-card">
            <h3><i className="ti ti-chart-donut" /> สัดส่วนการเข้าร่วม</h3>
            <div className="ch-sub">จากผู้สมัคร {roster.length} คน ({ev.title.slice(0, 24)})</div>
            <div className="pie-wrap">
              <div style={{ position: 'relative', width: 160, height: 160 }}>
                <div className="pie" style={{ background: `conic-gradient(var(--c1) 0% ${attendRate}%, var(--c2-15) ${attendRate}% 100%)` }} />
                <div className="pie-center">{attendRate.toFixed(1)}%<small>เข้าร่วม</small></div>
              </div>
              <div className="pie-legend">
                <div className="pl-row"><span className="lbl"><span className="dot" style={{ background: 'var(--c1)' }} /> เข้าร่วม</span><span className="val">{attended}</span></div>
                <div className="pl-row"><span className="lbl"><span className="dot" style={{ background: 'var(--c2-15)' }} /> ไม่เข้าร่วม</span><span className="val">{roster.length - attended}</span></div>
              </div>
            </div>
          </div>
        </div>

        <div className="table-card">
          <div className="table-toolbar">
            <h3><i className="ti ti-table" /> รายชื่อผู้เข้าร่วม · {ev.title.slice(0, 30)}</h3>
            <div className="tools">
              <span className="filter-chip active"><i className="ti ti-users" /> ทั้งหมด {roster.length}</span>
              <span className="filter-chip"><i className="ti ti-check" /> เข้าร่วม {attended}</span>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>ลำดับ</th><th>ชื่อ–นามสกุล</th><th>รหัสนักศึกษา</th><th className="center">เช็คอิน</th></tr></thead>
              <tbody>
                {roster.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--c4-60)', padding: 24 }}>ยังไม่มีผู้สมัคร</td></tr>}
                {roster.map((p, i) => (
                  <tr key={p.sid}>
                    <td className="center"><strong>{i + 1}</strong></td>
                    <td>{p.name}</td>
                    <td>{p.sid}</td>
                    <td className="center">{p.in ? <i className="ti ti-check" style={{ color: 'var(--c1)' }} /> : <i className="ti ti-x" style={{ color: 'var(--c4-60)' }} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>
        )}

        {tab === 'budget' && (
          // A teacher's roster carries no payments, so there is no fee income to show them.
          <EventBudgetReport ev={ev} attended={attended} payers={coordinator ? null : roster.filter((p) => p.paymentStatus === 'paid').length} />
        )}

        {tab === 'eval' && (
          <div className="table-card" style={{ padding: 20 }}>
            <div className="table-toolbar" style={{ padding: '0 0 16px' }}>
              <h3><i className="ti ti-clipboard-check" /> ผลแบบประเมิน · {ev.title.slice(0, 30)}</h3>
            </div>
            {evalLoading ? (
              <p style={{ fontSize: 13, color: 'var(--c4-60)' }}>กำลังโหลด...</p>
            ) : evalData.length === 0 ? (
              <div className="empty-state">กิจกรรมนี้ยังไม่มีคำถามแบบประเมิน หรือยังไม่มีผู้ทำแบบประเมิน</div>
            ) : evalResponded === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--c4-60)' }}>ยังไม่มีผู้ทำแบบประเมินสำหรับกิจกรรมนี้</p>
            ) : (
              <>
                <div className="stats-grid" style={{ marginBottom: 24 }}>
                  <div className="stat-card accent">
                    <div className="sc-top"><div className="sc-icon"><i className="ti ti-star-filled" /></div></div>
                    <div className="sc-label">คะแนนเฉลี่ยรวม</div>
                    <div className="sc-value">{evalOverall.toFixed(1)} <small>/ 5</small></div>
                  </div>
                  <div className="stat-card">
                    <div className="sc-top"><div className="sc-icon"><i className="ti ti-users" /></div></div>
                    <div className="sc-label">ผู้ทำแบบประเมิน</div>
                    <div className="sc-value">{evalResponded} <small>คน</small></div>
                  </div>
                </div>
                <EvalResultChart data={evalData} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
