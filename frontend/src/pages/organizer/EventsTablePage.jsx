import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useEvents } from '../../hooks/useEvents';
import { STATUS_META } from '../../utils/constants';
import CycleProgress from '../../features/events/components/CycleProgress';
import ApplicantsModal from '../../features/events/components/ApplicantsModal';
import BudgetActualModal from '../../features/budget/components/BudgetActualModal';
import ManageEventModal from '../../features/events/components/ManageEventModal';
import { downloadCsv } from '../../utils/csvExport';
import { REFUND_METHODS } from '../../features/events/components/PaymentBox';

const PAGE_SIZE = 6;

export default function EventsTablePage() {
  const { events, saveBudgetActual } = useEvents();
  const [applicantsId, setApplicantsId] = useState(null);
  const [applicantsMode, setApplicantsMode] = useState('list');
  const openApplicants = (id, mode) => { setApplicantsMode(mode); setApplicantsId(id); };
  const [budgetId, setBudgetId] = useState(null);
  const [manageId, setManageId] = useState(null); // the full action menu, same as on the event card

  // A notification links here as /events?applicants=<id>, /events?slips=<id>
  // (the list window on its slip-checking tab) or /events?budget=<id>:
  // open that event's window straight away, then drop the parameter so closing
  // the window (or reloading) does not bring it back.
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    const applicants = Number(params.get('applicants'));
    const slips = Number(params.get('slips'));
    const budget = Number(params.get('budget'));
    if (!applicants && !slips && !budget) return;
    if (slips) { setApplicantsMode('slips'); setApplicantsId(slips); }
    else if (applicants) { setApplicantsMode('list'); setApplicantsId(applicants); }
    else setBudgetId(budget);
    setParams({}, { replace: true });
  }, [params, setParams]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  const list = useMemo(() => events.filter((e) => e.listed), [events]);
  // Deleted events whose payers are not all refunded yet (the server only sends these to their managers).
  const owing = useMemo(() => events.filter((e) => !e.listed && e.payerCount > 0), [events]);
  const budgetEv = list.find((e) => e.id === budgetId);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((e) => {
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (q && !e.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [list, query, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const totalParticipants = list.reduce((sum, e) => sum + e.reg, 0);
  const certsIssued = list.filter((e) => e.stage >= 3).reduce((sum, e) => sum + e.reg, 0);
  const openCount = list.filter((e) => e.status === 'open').length;

  function handleSearch(v) {
    setQuery(v);
    setPage(1);
  }

  function handleStatusFilter(v) {
    setStatusFilter(v);
    setPage(1);
  }

  function exportCsv() {
    downloadCsv('cpsu-etms-events', list, [
      { label: 'ชื่อกิจกรรม', value: 'title' },
      { label: 'วันที่', value: 'date' },
      { label: 'สถานะ', value: (e) => STATUS_META[e.status].label },
      { label: 'ผู้สมัคร', value: 'reg' },
      { label: 'ที่นั่งทั้งหมด', value: 'cap' },
    ]);
  }

  return (
    <div>
      <div className="page-header">
        <div className="ph-inner">
          <div>
            <h1>รายการกิจกรรมทั้งหมด</h1>
            <p>เปิด/ปิดรับสมัคร ตรวจรายชื่อผู้สมัคร เช็คอิน และออกเกียรติบัตร ในที่เดียว</p>
          </div>
          <div className="ph-actions">
            <button className="btn glass" onClick={exportCsv}><i className="ti ti-download" /> ส่งออก CSV</button>
          </div>
        </div>
      </div>

      <div className="wrap tight">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="sc-top"><div className="sc-icon"><i className="ti ti-calendar-stats" /></div></div>
            <div className="sc-label">กิจกรรมทั้งหมด</div>
            <div className="sc-value">{list.length} <small>กิจกรรม</small></div>
          </div>
          <div className="stat-card">
            <div className="sc-top"><div className="sc-icon"><i className="ti ti-users" /></div></div>
            <div className="sc-label">ผู้เข้าร่วมสะสม</div>
            <div className="sc-value">{totalParticipants.toLocaleString('en-US')} <small>คน</small></div>
          </div>
          <div className="stat-card">
            <div className="sc-top"><div className="sc-icon"><i className="ti ti-certificate" /></div></div>
            <div className="sc-label">เกียรติบัตรที่ออกแล้ว</div>
            <div className="sc-value">{certsIssued.toLocaleString('en-US')} <small>ใบ</small></div>
          </div>
          <div className="stat-card accent">
            <div className="sc-top"><div className="sc-icon"><i className="ti ti-calendar-check" /></div><span className="trend"><i className="ti ti-circle-dot" /> Live</span></div>
            <div className="sc-label">กำลังเปิดรับสมัคร</div>
            <div className="sc-value">{openCount} <small>กิจกรรม</small></div>
          </div>
        </div>

        {owing.length > 0 && (
          <div className="refund-due">
            <div className="rd-head"><i className="ti ti-receipt-refund" /> กิจกรรมที่ยกเลิกแล้ว · รอคืนเงิน <span className="count">{owing.length}</span></div>
            {owing.map((e) => (
              <div className="rd-row" key={e.id}>
                <div className="rd-info">
                  <strong>{e.title}</strong>
                  <span>{e.date} · ต้องคืนเงินอีก {e.payerCount} คน · {REFUND_METHODS[e.refundMethod]?.label}</span>
                </div>
                <button type="button" className="btn btn-primary" onClick={() => { setApplicantsMode('slips'); setApplicantsId(e.id); }}><i className="ti ti-receipt-refund" /> คืนเงิน</button>
              </div>
            ))}
          </div>
        )}

        <div className="table-card">
          <div className="table-toolbar">
            <h3><i className="ti ti-table" /> รายการกิจกรรม</h3>
            <div className="tools">
              <div className="input-search"><i className="ti ti-search" /><input type="text" placeholder="ค้นหากิจกรรม..." value={query} onChange={(e) => handleSearch(e.target.value)} /></div>
              <label className="facet-select"><i className="ti ti-circle-dot" />
                <select value={statusFilter} onChange={(e) => handleStatusFilter(e.target.value)}>
                  <option value="all">ทุกสถานะ</option>
                  <option value="open">เปิดรับสมัคร</option>
                  <option value="full">เต็มแล้ว</option>
                  <option value="done">สิ้นสุดแล้ว</option>
                </select>
              </label>
              <span className="filter-chip active"><i className="ti ti-list" /> ทั้งหมด {filtered.length}</span>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>ชื่อกิจกรรม</th>
                  <th>วันที่</th>
                  <th>สถานะ</th>
                  <th>Cycle Stage</th>
                  <th className="right">การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--c4-60)', padding: 24 }}>ไม่พบกิจกรรมที่ตรงกับคำค้นหา</td></tr>
                )}
                {pageItems.map((ev) => {
                  const sm = STATUS_META[ev.status];
                  return (
                    <tr key={ev.id}>
                      <td>
                        <div className="ev-cell">
                          <div className={`ev-thumb ${ev.tone}`}><i className={`ti ${ev.icon}`} /></div>
                          <div><div className="ev-title">{ev.title.slice(0, 34)}</div><div className="ev-sub">{ev.cat} · {ev.reg}/{ev.cap} ที่นั่ง</div></div>
                        </div>
                      </td>
                      <td><div className="ev-title" style={{ fontSize: 13.5 }}>{ev.date}</div><div className="ev-sub">{ev.time}</div></td>
                      <td><span className={`pill-status ${sm.pill}`}><i className="ti ti-circle-filled" /> {sm.label}</span></td>
                      <td><CycleProgress stage={ev.stage} compact /></td>
                      <td className="right">
                        {/* Everything (edit, applicants, check-in, slips, budget,
                            certificates, delete) is in the same "จัดการ" menu as on the event card. */}
                        <div className="row-actions">
                          <button className="btn btn-outline row-manage" onClick={() => setManageId(ev.id)} aria-label={`จัดการ ${ev.title}`}><i className="ti ti-settings" /> จัดการ</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="table-foot">
            <span>แสดง {pageItems.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–{(safePage - 1) * PAGE_SIZE + pageItems.length} จาก {filtered.length} รายการ</span>
            {totalPages > 1 && (
              <div className="pagination">
                <button disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}><i className="ti ti-chevron-left" /></button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <button key={n} className={n === safePage ? 'active' : ''} onClick={() => setPage(n)}>{n}</button>
                ))}
                <button disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}><i className="ti ti-chevron-right" /></button>
              </div>
            )}
          </div>
        </div>
      </div>

      <ApplicantsModal eventId={applicantsId} mode={applicantsMode} open={!!applicantsId} onClose={() => setApplicantsId(null)} />
      {budgetEv && (
        <BudgetActualModal open event={{ ...budgetEv, budgetPlanned: budgetEv.budgetTotal }} onSave={(amount) => saveBudgetActual(budgetEv.id, amount)} onClose={() => setBudgetId(null)} />
      )}

      <ManageEventModal eventId={manageId} open={!!manageId} onClose={() => setManageId(null)} onOpenApplicants={(id, mode) => openApplicants(id, mode || 'list')} />
    </div>
  );
}
