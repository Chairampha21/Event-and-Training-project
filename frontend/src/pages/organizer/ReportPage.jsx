import React, { useEffect, useMemo, useState } from 'react';
import { useEvents } from '../../hooks/useEvents';
import { downloadCsv } from '../../utils/csvExport';
import { THAI_MONTHS, toBuddhistYear } from '../../utils/dateFormat';
import EvalResultChart from '../../components/EvalResultChart';

export default function ReportPage() {
  const { events, rosters, pushToast, getEvaluationResults } = useEvents();
  const listed = useMemo(() => events.filter((e) => e.listed), [events]);
  const [eventId, setEventId] = useState(listed[0]?.id);
  const ev = listed.find((e) => e.id === Number(eventId)) || listed[0];
  const roster = (ev && rosters[ev.id]) || [];
  const attended = roster.filter((p) => p.in).length;
  const attendRate = roster.length ? ((attended / roster.length) * 100) : 0;

  // ปี/เดือน ที่จัด — คำนวณจาก dateStart (ISO) ของแต่ละกิจกรรม
  const years = useMemo(() => {
    const set = new Set(listed.filter((e) => e.dateStart).map((e) => e.dateStart.slice(0, 4)));
    return [...set].sort((a, b) => b - a);
  }, [listed]);

  const [query, setQuery] = useState(listed[0]?.title || '');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [yearFilter, setYearFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');

  const qq = query.trim().toLowerCase();
  const filteredEvents = listed.filter((e) => {
    if (qq && !e.title.toLowerCase().includes(qq)) return false;
    if (yearFilter && e.dateStart?.slice(0, 4) !== yearFilter) return false;
    if (monthFilter && e.dateStart?.slice(5, 7) !== monthFilter) return false;
    return true;
  });

  function pickEvent(e) {
    setEventId(e.id);
    setQuery(e.title);
    setPickerOpen(false);
  }

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
  const evalOverall = evalData.length ? evalData.reduce((a, r) => a + r.avg, 0) / evalData.length : 0;

  const recent = useMemo(() => listed.slice(0, 6), [listed]);
  const maxV = Math.max(10, ...recent.map((e) => e.reg));

  function exportReport() {
    if (!ev) return;
    pushToast('กำลังส่งออกรายงาน', ev.title.slice(0, 30));
    downloadCsv(`report-${ev.id}`, roster, [
      { label: 'ชื่อ–นามสกุล', value: 'name' },
      { label: 'รหัสนักศึกษา', value: 'sid' },
      { label: 'เช็คอิน', value: (r) => (r.in ? 'เข้าร่วม' : 'ไม่เข้าร่วม') },
    ]);
  }

  if (!ev) {
    return <div className="wrap tight"><div className="empty-state">ยังไม่มีกิจกรรมสำหรับออกรายงาน</div></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div className="ph-inner">
          <div>
            <h1>รายงานสรุปกิจกรรม</h1>
            <p>สรุปผลกิจกรรมรายรายการ · จำนวนผู้สมัครและผู้เข้าร่วม · อัตราเข้าร่วม · เกียรติบัตรที่ออก</p>
          </div>
          <div className="ph-actions">
            {tab === 'summary' && <button className="btn btn-accent" onClick={exportReport} disabled title="เร็วๆ นี้"><i className="ti ti-file-export" /> ส่งออก CSV</button>}
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
                onChange={(e) => { setQuery(e.target.value); setPickerOpen(true); }}
                onFocus={() => setPickerOpen(true)}
                onBlur={() => setTimeout(() => setPickerOpen(false), 150)}
                placeholder="พิมพ์ชื่อกิจกรรมเพื่อค้นหา หรือเลือกจากรายการ..."
                autoComplete="off"
              />
            </div>
            {pickerOpen && (
              <div className="rf-suggest">
                {filteredEvents.length === 0 && <div className="rf-suggest-empty">ไม่พบกิจกรรมที่ตรงเงื่อนไข</div>}
                {filteredEvents.map((e) => (
                  <div
                    key={e.id}
                    className={`rf-suggest-item${ev?.id === e.id ? ' active' : ''}`}
                    onMouseDown={() => pickEvent(e)}
                  >
                    <span className="rf-title">{e.title}</span>
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
          </div>
        </div>

        {tab === 'summary' && (
        <>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="sc-top"><div className="sc-icon"><i className="ti ti-user-plus" /></div></div>
            <div className="sc-label">ผู้สมัครทั้งหมด</div>
            <div className="sc-value">{ev.reg} <small>คน</small></div>
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
                  const inCount = (rosters[e.id] || []).filter((p) => p.in).length;
                  return (
                    <div className="bar-col" key={e.id}>
                      <div className="bar-pair">
                        <div className="bar" style={{ height: `${Math.round((e.reg / maxV) * 100)}%`, background: 'var(--c2-40)' }} title={e.reg} />
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
