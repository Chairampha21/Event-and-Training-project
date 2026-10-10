import React, { useMemo, useState } from 'react';
import { downloadCsv } from '../../../utils/csvExport';
import { formatThaiDate } from '../../../utils/dateFormat';
import { formatBaht } from '../../../utils/money';
import BudgetActualModal from './BudgetActualModal';
import './BudgetSection.css';

// Per-event budget state. "over" needs both numbers; an event that has ended
// with a budget but no recorded spend is the one that needs chasing.
function budgetState(r) {
  const hasPlan = r.budget_total != null;
  const hasActual = r.budget_actual != null;
  if (hasPlan && hasActual) return r.budget_actual > r.budget_total ? 'over' : 'within';
  if (hasActual) return 'unplanned';
  if (hasPlan) return r.ended ? 'pending' : 'upcoming';
  return 'none';
}

const STATE_META = {
  within: { label: 'อยู่ในงบประมาณ', icon: 'ti-circle-check', cls: 'good' },
  over: { label: 'เกินงบประมาณ', icon: 'ti-alert-triangle', cls: 'bad' },
  pending: { label: 'รอบันทึกงบประมาณที่ใช้จริง', icon: 'ti-clock', cls: 'wait' },
  upcoming: { label: 'ยังไม่ถึงวันจัด', icon: 'ti-calendar-time', cls: 'muted' },
  unplanned: { label: 'ไม่ได้ตั้งงบประมาณ', icon: 'ti-receipt-2', cls: 'muted' },
  none: { label: 'ไม่ได้ตั้งงบประมาณ', icon: 'ti-minus', cls: 'muted' },
};

const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

// Actual spend per person who checked in; null until the event has both.
const perAttendee = (r) => (r.budget_actual != null && r.attended_count > 0 ? Math.round(r.budget_actual / r.attended_count) : null);

/** Downloads one fiscal year's per-event budget table as a CSV file. */
export function exportBudgetCsv(rows, year) {
  downloadCsv(`งบประมาณ-ปีงบประมาณ-${year}`, rows, [
    { label: 'กิจกรรม', value: 'title' },
    { label: 'ประเภท', value: 'category' },
    { label: 'วันที่จัด', value: (r) => formatThaiDate(r.date_start) },
    { label: 'งบประมาณเงินรายได้ (บาท)', value: (r) => r.budget_planned ?? '' },
    { label: 'งบประมาณแหล่งอื่น (บาท)', value: (r) => r.budget_other ?? '' },
    { label: 'รวม (บาท)', value: (r) => r.budget_total ?? '' },
    { label: 'งบประมาณที่ใช้จริง (บาท)', value: (r) => r.budget_actual ?? '' },
    { label: 'ส่วนต่าง (บาท)', value: (r) => (r.budget_total != null && r.budget_actual != null ? r.budget_total - r.budget_actual : '') },
    { label: 'ใช้ไป (%)', value: (r) => (r.budget_total > 0 && r.budget_actual != null ? pct(r.budget_actual, r.budget_total) : '') },
    { label: 'ผู้เข้าร่วม (เช็คอิน)', value: 'attended_count' },
    { label: 'งบประมาณที่ใช้ต่อผู้เข้าร่วม (บาท)', value: (r) => perAttendee(r) ?? '' },
    { label: 'สถานะ', value: (r) => STATE_META[budgetState(r)].label },
  ]);
}

/**
 * Budget part of the yearly dashboard: what was planned against what was
 * actually spent. `rows` are the year's events from /dashboard/budget.
 * Summary first, then the breakdown by category, then every event — so a
 * total can always be traced down to the events behind it.
 */
export default function BudgetSection({ rows, year, onSaveActual }) {
  const [editing, setEditing] = useState(null);

  const stats = useMemo(() => {
    const s = { income: 0, other: 0, planned: 0, actual: 0, plannedCount: 0, actualCount: 0, cmpPlanned: 0, cmpActual: 0, cmpCount: 0, costBase: 0, attendees: 0, states: {} };
    rows.forEach((r) => {
      const st = budgetState(r);
      s.states[st] = (s.states[st] || 0) + 1;
      s.income += r.budget_planned || 0;
      s.other += r.budget_other || 0;
      if (r.budget_total != null) { s.planned += r.budget_total; s.plannedCount += 1; }
      if (r.budget_actual != null) {
        s.actual += r.budget_actual; s.actualCount += 1;
        if (r.attended_count > 0) { s.costBase += r.budget_actual; s.attendees += r.attended_count; }
      }
      // Variance is only meaningful over events that have both figures.
      if (r.budget_total != null && r.budget_actual != null) { s.cmpPlanned += r.budget_total; s.cmpActual += r.budget_actual; s.cmpCount += 1; }
    });
    return s;
  }, [rows]);

  const byCategory = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      if (r.budget_total == null && r.budget_actual == null) return;
      const c = map.get(r.category) || { category: r.category, planned: 0, actual: 0, hasActual: false };
      c.planned += r.budget_total || 0;
      if (r.budget_actual != null) { c.actual += r.budget_actual; c.hasActual = true; }
      map.set(r.category, c);
    });
    return [...map.values()].sort((a, b) => b.planned - a.planned);
  }, [rows]);

  const scaleMax = Math.max(1, ...byCategory.map((c) => Math.max(c.planned, c.actual)));
  const variance = stats.cmpPlanned - stats.cmpActual; // + = under budget
  const hasAnyBudget = stats.plannedCount > 0 || stats.actualCount > 0;

  return (
    <section className="bud">
      <div className="section-head">
        <div>
          <div className="sh-title"><i className="ti ti-coin" style={{ color: 'var(--c2)' }} /> ผลการใช้จ่ายงบประมาณ · ปีงบประมาณ พ.ศ. {year}</div>
          <div className="sh-sub">งบประมาณเทียบกับงบประมาณที่ใช้จริง (เงินรายได้ + แหล่งอื่น) ของทุกกิจกรรมที่จัดในปีงบประมาณนี้ ({rows.length} กิจกรรม)</div>
        </div>
      </div>

      {!hasAnyBudget ? (
        <div className="empty-state">ยังไม่มีกิจกรรมในปีงบประมาณนี้ที่ตั้งงบประมาณไว้ · ตั้งงบประมาณได้ในฟอร์มสร้างหรือแก้ไขกิจกรรม</div>
      ) : (
        <>
          <div className="compare-row">
            <div className="cmp-card">
              <div className="cm-lbl">งบประมาณรวม</div>
              <div className="cm-vals"><span className="cm-now">{formatBaht(stats.planned)}</span></div>
              <div className="bud-note">เงินรายได้ {formatBaht(stats.income)} · แหล่งอื่น {formatBaht(stats.other)}</div>
              <div className="bud-note">จาก {stats.plannedCount} กิจกรรม</div>
            </div>
            <div className="cmp-card">
              <div className="cm-lbl">งบประมาณที่ใช้จริง</div>
              <div className="cm-vals"><span className="cm-now">{formatBaht(stats.actual)}</span></div>
              <div className="bud-meter" role="img" aria-label={`ใช้ไป ${pct(stats.actual, stats.planned)}% ของงบประมาณ`}>
                <div className={`bud-meter-fill${stats.actual > stats.planned ? ' over' : ''}`} style={{ width: `${Math.min(100, pct(stats.actual, stats.planned))}%` }} />
              </div>
              <div className="bud-note">{stats.planned > 0 ? `${pct(stats.actual, stats.planned)}% ของงบประมาณ · ` : ''}บันทึกแล้ว {stats.actualCount} กิจกรรม</div>
            </div>
            <div className="cmp-card">
              <div className="cm-lbl">ส่วนต่างจากงบประมาณ</div>
              {stats.cmpCount === 0 ? (
                <>
                  <div className="cm-vals"><span className="cm-now">–</span></div>
                  <div className="bud-note">ยังไม่มีกิจกรรมที่บันทึกงบประมาณที่ใช้จริง</div>
                </>
              ) : (
                <>
                  <div className="cm-vals"><span className="cm-now">{formatBaht(Math.abs(variance))}</span></div>
                  <div className={`bud-flag ${variance < 0 ? 'bad' : 'good'}`}>
                    <i className={`ti ${variance < 0 ? 'ti-alert-triangle' : 'ti-circle-check'}`} />
                    {variance < 0 ? 'เกินงบประมาณ' : variance === 0 ? 'ใช้พอดีงบประมาณ' : 'ต่ำกว่างบประมาณ'}
                    {stats.cmpPlanned > 0 && variance !== 0 ? ` ${Math.abs(pct(variance, stats.cmpPlanned))}%` : ''}
                  </div>
                  <div className="bud-note">เทียบเฉพาะ {stats.cmpCount} กิจกรรมที่มีทั้งงบประมาณและงบประมาณที่ใช้จริง</div>
                </>
              )}
            </div>
            <div className="cmp-card">
              <div className="cm-lbl">งบประมาณที่ใช้ต่อผู้เข้าร่วม</div>
              <div className="cm-vals"><span className="cm-now">{stats.attendees > 0 ? formatBaht(Math.round(stats.costBase / stats.attendees)) : '–'}</span></div>
              <div className="bud-note">{stats.attendees > 0 ? `ต่อคน · จากผู้เช็คอิน ${stats.attendees.toLocaleString('en-US')} คน` : 'ยังไม่มีกิจกรรมที่มีทั้งงบประมาณที่ใช้จริงและผู้เช็คอิน'}</div>
            </div>
          </div>

          <div className="chart-row">
            <div className="chart-card">
              <h3><i className="ti ti-chart-bar" /> งบประมาณเทียบกับงบประมาณที่ใช้จริง แยกตามประเภทกิจกรรม</h3>
              <div className="ch-sub">หน่วย: บาท · ปีงบประมาณ {year}</div>
              <div className="bud-legend">
                <span><span className="bud-swatch planned" /> งบประมาณ</span>
                <span><span className="bud-swatch actual" /> งบประมาณที่ใช้จริง</span>
              </div>
              <div className="bud-bars">
                {byCategory.map((c) => (
                  <div className="bud-group" key={c.category}>
                    <div className="bud-group-name">{c.category}</div>
                    <div className="bud-bar-line" title={`${c.category} · งบประมาณ ${formatBaht(c.planned)}`}>
                      <div className="bud-track"><div className="bud-bar planned" style={{ width: `${(c.planned / scaleMax) * 100}%` }} /></div>
                      <span className="bud-val">{formatBaht(c.planned)}</span>
                    </div>
                    <div className="bud-bar-line" title={`${c.category} · งบประมาณที่ใช้จริง ${c.hasActual ? formatBaht(c.actual) : 'ยังไม่บันทึก'}`}>
                      <div className="bud-track"><div className="bud-bar actual" style={{ width: `${(c.actual / scaleMax) * 100}%` }} /></div>
                      <span className="bud-val">{c.hasActual ? formatBaht(c.actual) : 'ยังไม่บันทึก'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="chart-card">
              <h3><i className="ti ti-list-check" /> สถานะการใช้งบประมาณ</h3>
              <div className="ch-sub">จำนวนกิจกรรมในแต่ละสถานะ</div>
              <div className="bud-states">
                {['within', 'over', 'pending', 'upcoming'].map((k) => (
                  <div className="bud-state" key={k}>
                    <span className={`bud-flag ${STATE_META[k].cls}`}><i className={`ti ${STATE_META[k].icon}`} /> {STATE_META[k].label}</span>
                    <strong>{stats.states[k] || 0}</strong>
                  </div>
                ))}
                <div className="bud-state">
                  <span className="bud-flag muted"><i className="ti ti-minus" /> ไม่ได้ตั้งงบประมาณ</span>
                  <strong>{(stats.states.none || 0) + (stats.states.unplanned || 0)}</strong>
                </div>
              </div>
              {(stats.states.pending || 0) > 0 && (
                <div className="bud-callout"><i className="ti ti-info-circle" /> มี {stats.states.pending} กิจกรรมที่จบแล้วแต่ยังไม่ได้บันทึกงบประมาณที่ใช้จริง · บันทึกได้จากตารางด้านล่าง</div>
              )}
            </div>
          </div>
        </>
      )}

      <div className="table-card">
        <div className="table-toolbar">
          <h3><i className="ti ti-receipt-2" /> งบประมาณรายกิจกรรม · ปีงบประมาณ {year}</h3>
          <button className="btn btn-outline" style={{ padding: '7px 12px', fontSize: 13 }} onClick={() => exportBudgetCsv(rows, year)}><i className="ti ti-download" /> ส่งออก CSV</button>
        </div>
        <div className="bud-table-wrap">
          {/* Few, short columns: each money column shows one figure, with what
              it is made of (or measured against) on a smaller second line. */}
          <table className="bud-table">
            {/* Fixed widths, so the columns line up the same in every year
                whatever the figures are; the event name takes what is left. */}
            <colgroup><col /><col style={{ width: 140 }} /><col style={{ width: 124 }} /><col style={{ width: 116 }} /><col style={{ width: 108 }} /><col style={{ width: 150 }} /><col style={{ width: 150 }} /></colgroup>
            <thead>
              <tr><th>กิจกรรม</th><th className="right">งบประมาณ</th><th className="right">ใช้จริง</th><th className="right">ส่วนต่าง</th><th className="right">ต่อผู้เข้าร่วม</th><th>สถานะ</th><th className="center">จัดการ</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const st = budgetState(r);
                const meta = STATE_META[st];
                const both = r.budget_total != null && r.budget_actual != null;
                const diff = both ? r.budget_total - r.budget_actual : null;
                const used = both && r.budget_total > 0 ? pct(r.budget_actual, r.budget_total) : null;
                const perHead = perAttendee(r);
                const hasActual = r.budget_actual != null;
                return (
                  <tr key={r.event_id}>
                    <td className="bud-ev"><div className="ev-title">{r.title}</div><div className="ev-sub">{r.category} · {formatThaiDate(r.date_start)}</div></td>
                    <td className="right bud-num">
                      {r.budget_total == null ? '–' : (
                        <>
                          <strong>{formatBaht(r.budget_total)}</strong>
                          {r.budget_other ? (
                            <div className="bud-sub"><span>รายได้ {formatBaht(r.budget_planned || 0)}</span><span>แหล่งอื่น {formatBaht(r.budget_other)}</span></div>
                          ) : <div className="bud-sub">เงินรายได้</div>}
                        </>
                      )}
                    </td>
                    <td className="right bud-num">
                      {!hasActual ? '–' : (
                        <>
                          {formatBaht(r.budget_actual)}
                          {used !== null && (
                            <div className="bud-used">
                              <div className="bud-meter" role="img" aria-label={`ใช้ไป ${used}% ของงบประมาณ`}><div className={`bud-meter-fill${used > 100 ? ' over' : ''}`} style={{ width: `${Math.min(100, used)}%` }} /></div>
                              <span>{used}%</span>
                            </div>
                          )}
                        </>
                      )}
                    </td>
                    <td className="right bud-num">
                      {diff === null ? '–' : (
                        <span className={`bud-diff ${diff < 0 ? 'bad' : 'good'}`}>{diff < 0 ? `เกิน ${formatBaht(-diff)}` : diff === 0 ? 'พอดี' : `เหลือ ${formatBaht(diff)}`}</span>
                      )}
                    </td>
                    <td className="right bud-num">
                      {perHead === null ? '–' : (
                        <>{formatBaht(perHead)}<div className="bud-sub">{r.attended_count.toLocaleString('en-US')} คน</div></>
                      )}
                    </td>
                    <td><span className={`bud-flag multi ${meta.cls}`}><i className={`ti ${meta.icon}`} /> {meta.label}</span></td>
                    <td className="center">
                      {r.can_edit && r.ended ? (
                        <button type="button" className="btn btn-outline bud-edit" onClick={() => setEditing(r)} title={hasActual ? 'แก้ไขงบประมาณที่ใช้จริง' : 'บันทึกงบประมาณที่ใช้จริง'} aria-label={`${hasActual ? 'แก้ไข' : 'บันทึก'}งบประมาณที่ใช้จริง ${r.title}`}>
                          <i className={`ti ${hasActual ? 'ti-edit' : 'ti-plus'}`} />
                          <span>{hasActual ? 'แก้ไขงบ' : 'บันทึกงบ'}<br />ที่ใช้จริง</span>
                        </button>
                      ) : <span className="bud-muted">{r.ended ? '–' : 'หลังจบกิจกรรม'}</span>}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={7} className="center" style={{ color: 'var(--c4-60)' }}>ยังไม่มีกิจกรรมในปีงบประมาณนี้</td></tr>}
              {rows.length > 0 && (
                <tr className="bud-total">
                  <td><strong style={{ color: 'var(--c4)' }}>รวม</strong></td>
                  <td className="right bud-num">
                    <strong>{formatBaht(stats.planned)}</strong>
                    <div className="bud-sub"><span>รายได้ {formatBaht(stats.income)}</span><span>แหล่งอื่น {formatBaht(stats.other)}</span></div>
                  </td>
                  <td className="right bud-num"><strong>{formatBaht(stats.actual)}</strong></td>
                  <td />
                  <td className="right bud-num">
                    {stats.attendees > 0 ? (
                      <><strong>{formatBaht(Math.round(stats.costBase / stats.attendees))}</strong><div className="bud-sub">เฉลี่ย · {stats.attendees.toLocaleString('en-US')} คน</div></>
                    ) : '–'}
                  </td>
                  <td colSpan={2} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <BudgetActualModal
        open={!!editing}
        event={editing ? { id: editing.event_id, title: editing.title, budgetPlanned: editing.budget_total, budgetActual: editing.budget_actual } : null}
        onSave={(amount) => onSaveActual(editing.event_id, amount)}
        onClose={() => setEditing(null)}
      />
    </section>
  );
}
