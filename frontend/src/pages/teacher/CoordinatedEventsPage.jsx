import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEvents } from '../../hooks/useEvents';
import { STATUS_META } from '../../utils/constants';
import { fiscalYearOf } from '../../utils/dateFormat';

/**
 * "กิจกรรมที่รับผิดชอบ" — the events this teacher coordinates (อาจารย์ผู้ประสานงาน),
 * with how each one went: registrations, attendance and the evaluation score.
 * Read-only; "ดูรายงาน" opens the event's full report. Teachers who also join
 * events are left out of the counts, as in the organizer's reports.
 */
export default function CoordinatedEventsPage() {
  const { session, events, rosters, getEvaluationResults } = useEvents();
  const navigate = useNavigate();
  const mine = useMemo(
    () => events.filter((e) => e.listed && e.coordinatorId === session?.id)
      .sort((a, b) => (b.dateStart || '').localeCompare(a.dateStart || '')),
    [events, session?.id],
  );

  const years = useMemo(() => [...new Set(mine.map((e) => fiscalYearOf(e.dateStart)).filter(Boolean))].sort((a, b) => b - a), [mine]);
  const [fy, setFy] = useState('');
  const shown = fy ? mine.filter((e) => fiscalYearOf(e.dateStart) === Number(fy)) : mine;

  // Evaluation score per finished event: the average of the questions answered.
  const [scores, setScores] = useState({});
  useEffect(() => {
    let cancelled = false;
    mine.filter((e) => e.status === 'done' && !(e.id in scores)).forEach((e) => {
      getEvaluationResults(e.id).then((results) => {
        const answered = (results || []).filter((r) => r.response_count > 0);
        const avg = answered.length ? answered.reduce((a, r) => a + (r.avg_score || 0), 0) / answered.length : null;
        if (!cancelled) setScores((s) => ({ ...s, [e.id]: avg }));
      });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine]);

  const stats = (e) => {
    const roster = (rosters[e.id] || []).filter((p) => !p.isTeacher);
    const came = roster.filter((p) => p.in).length;
    return { regs: rosters[e.id] ? roster.length : e.reg, came, loaded: !!rosters[e.id] };
  };
  const totals = shown.reduce((t, e) => {
    const s = stats(e);
    t.regs += s.regs;
    if (e.status === 'done') { t.doneRegs += s.regs; t.came += s.came; }
    if (scores[e.id] != null) { t.scoreSum += scores[e.id]; t.scored += 1; }
    return t;
  }, { regs: 0, doneRegs: 0, came: 0, scoreSum: 0, scored: 0 });
  const rate = totals.doneRegs ? Math.round((totals.came / totals.doneRegs) * 100) : null;
  const avgScore = totals.scored ? totals.scoreSum / totals.scored : null;

  return (
    <div>
      <div className="page-header">
        <div className="ph-inner">
          <div>
            <h1>กิจกรรมที่รับผิดชอบ</h1>
            <p>กิจกรรมที่คุณเป็นอาจารย์ผู้ประสานงาน · ผู้สมัคร การเข้าร่วม และผลแบบประเมิน · ดูได้อย่างเดียว</p>
          </div>
        </div>
      </div>

      <div className="wrap tight">
        {mine.length === 0 ? (
          <div className="empty-state">
            <i className="ti ti-briefcase" style={{ fontSize: 32, display: 'block', marginBottom: 8, opacity: 0.5 }} />
            ยังไม่มีกิจกรรมที่คุณเป็นอาจารย์ผู้ประสานงาน · ผู้จัดกิจกรรมเลือกชื่อคุณเป็นผู้ประสานงานตอนสร้างกิจกรรม แล้วกิจกรรมจะขึ้นที่นี่
          </div>
        ) : (
          <>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="sc-top"><div className="sc-icon"><i className="ti ti-calendar-event" /></div></div>
                <div className="sc-label">กิจกรรมที่รับผิดชอบ</div>
                <div className="sc-value">{shown.length} <small>กิจกรรม</small></div>
              </div>
              <div className="stat-card">
                <div className="sc-top"><div className="sc-icon"><i className="ti ti-user-plus" /></div></div>
                <div className="sc-label">ผู้สมัครทั้งหมด</div>
                <div className="sc-value">{totals.regs.toLocaleString('en-US')} <small>คน</small></div>
              </div>
              <div className="stat-card accent">
                <div className="sc-top"><div className="sc-icon"><i className="ti ti-percentage" /></div></div>
                <div className="sc-label">อัตราเข้าร่วม (กิจกรรมที่จบแล้ว)</div>
                <div className="sc-value">{rate == null ? '–' : `${rate}%`} {rate != null && <small>({totals.came}/{totals.doneRegs})</small>}</div>
              </div>
              <div className="stat-card">
                <div className="sc-top"><div className="sc-icon"><i className="ti ti-star" /></div></div>
                <div className="sc-label">ความพึงพอใจเฉลี่ย</div>
                <div className="sc-value">{avgScore == null ? '–' : avgScore.toFixed(1)} <small>/ 5</small></div>
              </div>
            </div>

            <div className="table-card">
              <div className="table-toolbar">
                <h3><i className="ti ti-table" /> รายการกิจกรรม</h3>
                <div className="tools">
                  <label className="facet-select"><i className="ti ti-calendar" />
                    <select value={fy} onChange={(e) => setFy(e.target.value)} aria-label="ปีงบประมาณ">
                      <option value="">ทุกปีงบประมาณ</option>
                      {years.map((y) => <option key={y} value={y}>ปีงบประมาณ {y}</option>)}
                    </select>
                  </label>
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>ชื่อกิจกรรม</th>
                      <th>วันที่</th>
                      <th>สถานะ</th>
                      <th className="right">ผู้สมัคร</th>
                      <th className="right">เข้าร่วม</th>
                      <th className="right">ประเมิน</th>
                      <th className="right"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.length === 0 && (
                      <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--c4-60)', padding: 24 }}>ไม่มีกิจกรรมในปีงบประมาณนี้</td></tr>
                    )}
                    {shown.map((e) => {
                      const sm = STATUS_META[e.status];
                      const s = stats(e);
                      const done = e.status === 'done';
                      return (
                        <tr key={e.id}>
                          <td>
                            <div className="ev-cell">
                              <div className={`ev-thumb ${e.tone}`}><i className={`ti ${e.icon}`} /></div>
                              <div><div className="ev-title">{e.title}</div><div className="ev-sub">{e.cat}</div></div>
                            </div>
                          </td>
                          <td><div className="ev-title" style={{ fontSize: 13.5 }}>{e.date}</div><div className="ev-sub">{e.time}</div></td>
                          <td><span className={`pill-status ${sm.pill}`}><i className="ti ti-circle-filled" /> {sm.label}</span></td>
                          <td className="right">{s.regs}<span className="ev-sub"> / {e.cap}</span></td>
                          <td className="right">{done && s.loaded ? <>{s.came} <span className="ev-sub">({s.regs ? Math.round((s.came / s.regs) * 100) : 0}%)</span></> : <span className="ev-sub">–</span>}</td>
                          <td className="right">{scores[e.id] != null ? <><i className="ti ti-star-filled" style={{ color: '#d6a419' }} /> {scores[e.id].toFixed(1)}</> : <span className="ev-sub">–</span>}</td>
                          <td className="right">
                            <button type="button" className="btn btn-outline" onClick={() => navigate(`/report?event=${e.id}`)}>
                              <i className="ti ti-report-analytics" /> ดูรายงาน
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="table-foot"><span>ข้อมูลการเงินและการแก้ไขกิจกรรมอยู่ที่ผู้จัดกิจกรรม · ติดต่อผู้จัดหากต้องการเปลี่ยนแปลง</span></div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
