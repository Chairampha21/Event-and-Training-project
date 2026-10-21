import React, { useState } from 'react';
import { useEvents } from '../../../hooks/useEvents';
import { formatBaht } from '../../../utils/money';
import BudgetActualModal from './BudgetActualModal';
import './BudgetSection.css';

const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/**
 * One event's budget for the report page: what was set aside (department
 * income + other sources), what was actually spent, what is left or over,
 * and the cost per person who came. `attended` / `payers` count participants
 * only (teachers neither count nor pay). Whoever manages the event can record
 * the actual spend from here once it has ended.
 */
export default function EventBudgetReport({ ev, attended, payers }) {
  const { session, saveBudgetActual } = useEvents();
  const [actualOpen, setActualOpen] = useState(false);
  const planned = ev.budgetTotal;
  const actual = ev.budgetActual;
  const hasPlan = planned != null;
  const hasActual = actual != null;
  const diff = hasPlan && hasActual ? planned - actual : null; // + left over, − over budget
  const used = hasPlan && hasActual ? pct(actual, planned) : null;
  const perHead = hasActual && attended > 0 ? Math.round(actual / attended) : null;
  const feeIncome = ev.fee > 0 && payers != null ? ev.fee * payers : null;
  const canRecord = ev.ended && (session?.role === 'admin' || ev.organizerId === session?.id);

  const status = hasPlan && hasActual ? (actual > planned ? { label: 'เกินงบประมาณ', icon: 'ti-alert-triangle', cls: 'bad' } : { label: 'อยู่ในงบประมาณ', icon: 'ti-circle-check', cls: 'good' })
    : hasActual ? { label: 'ไม่ได้ตั้งงบประมาณ', icon: 'ti-receipt-2', cls: 'muted' }
      : hasPlan ? (ev.ended ? { label: 'รอบันทึกงบประมาณที่ใช้จริง', icon: 'ti-clock', cls: 'wait' } : { label: 'ยังไม่ถึงวันจัด', icon: 'ti-calendar-time', cls: 'muted' })
        : { label: 'ไม่ได้ตั้งงบประมาณ', icon: 'ti-minus', cls: 'muted' };

  return (
    <div className="table-card bud-report" style={{ padding: 20 }}>
      <div className="table-toolbar" style={{ padding: '0 0 16px' }}>
        <h3><i className="ti ti-coin" /> งบประมาณกิจกรรม · {ev.title.slice(0, 30)}</h3>
        <div className="tools">
          <span className={`bud-flag ${status.cls}`}><i className={`ti ${status.icon}`} /> {status.label}</span>
          {!canRecord && session?.role === 'teacher' && <span className="bud-flag muted"><i className="ti ti-eye" /> ดูได้อย่างเดียว</span>}
          {canRecord && (
            <button type="button" className="btn btn-outline" style={{ padding: '7px 12px' }} onClick={() => setActualOpen(true)}>
              <i className="ti ti-pencil" /> {hasActual ? 'แก้ไขงบที่ใช้จริง' : 'บันทึกงบที่ใช้จริง'}
            </button>
          )}
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="sc-top"><div className="sc-icon"><i className="ti ti-wallet" /></div></div>
          <div className="sc-label">งบประมาณที่ตั้งไว้</div>
          <div className="sc-value">{hasPlan ? formatBaht(planned) : '—'}</div>
          {hasPlan && (
            <div className="bud-note">เงินรายได้ {formatBaht(ev.budgetPlanned || 0)} · แหล่งอื่น {formatBaht(ev.budgetOther || 0)}</div>
          )}
        </div>
        <div className="stat-card accent">
          <div className="sc-top"><div className="sc-icon"><i className="ti ti-receipt" /></div></div>
          <div className="sc-label">ใช้จริง</div>
          <div className="sc-value">{hasActual ? formatBaht(actual) : '—'}</div>
          <div className="bud-note">{hasActual ? (used != null ? `${used}% ของงบประมาณ` : 'ไม่ได้ตั้งงบประมาณไว้') : ev.ended ? 'ยังไม่ได้บันทึก' : 'บันทึกได้เมื่อถึงวันสุดท้ายของกิจกรรม'}</div>
        </div>
        <div className={`stat-card${diff != null && diff < 0 ? ' dark' : ''}`}>
          <div className="sc-top"><div className="sc-icon"><i className={`ti ${diff != null && diff < 0 ? 'ti-trending-up' : 'ti-pig-money'}`} /></div></div>
          <div className="sc-label">{diff != null && diff < 0 ? 'ใช้เกินงบ' : 'คงเหลือ'}</div>
          <div className="sc-value">{diff != null ? formatBaht(Math.abs(diff)) : '—'}</div>
        </div>
        <div className="stat-card">
          <div className="sc-top"><div className="sc-icon"><i className="ti ti-user-dollar" /></div></div>
          <div className="sc-label">ค่าใช้จ่ายต่อผู้เข้าร่วม</div>
          <div className="sc-value">{perHead != null ? formatBaht(perHead) : '—'}</div>
          <div className="bud-note">{attended > 0 ? `จากผู้เช็คอิน ${attended} คน` : 'ยังไม่มีผู้เช็คอิน'}</div>
        </div>
      </div>

      {hasPlan && hasActual && (
        <div className="bud-usage">
          <div className="bud-usage-head"><span>การใช้งบประมาณ</span><strong>{used}%</strong></div>
          <div className="bud-usage-bar" role="img" aria-label={`ใช้ไป ${used}% ของงบประมาณ`}>
            <span className={actual > planned ? 'over' : ''} style={{ width: `${Math.min(100, used)}%` }} />
          </div>
        </div>
      )}

      {feeIncome != null && (
        <p className="bud-fee"><i className="ti ti-cash" /> รายรับค่าลงทะเบียน {formatBaht(feeIncome)} · ชำระแล้ว {payers} คน × {formatBaht(ev.fee)} (ไม่นับอาจารย์)</p>
      )}

      <BudgetActualModal
        open={actualOpen}
        event={{ ...ev, budgetPlanned: ev.budgetTotal }}
        onSave={(amount) => saveBudgetActual(ev.id, amount)}
        onClose={() => setActualOpen(false)}
      />
    </div>
  );
}
