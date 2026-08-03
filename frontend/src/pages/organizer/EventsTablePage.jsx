import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEvents } from '../../hooks/useEvents';
import { STATUS_META } from '../../utils/constants';
import CycleProgress from '../../components/CycleProgress';
import Modal, { ModalHead } from '../../components/Modal';
import ApplicantsModal from '../../components/ApplicantsModal';
import { downloadCsv } from '../../utils/csvExport';

const PAGE_SIZE = 6;

export default function EventsTablePage() {
  const { events, toggleEventStatus, deleteEvent } = useEvents();
  const navigate = useNavigate();
  const [applicantsId, setApplicantsId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const list = useMemo(() => events.filter((e) => e.listed), [events]);
  const deleteEv = list.find((e) => e.id === deleteId);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((e) => e.title.toLowerCase().includes(q));
  }, [list, query]);

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
            <div className="crumbs"><i className="ti ti-calendar" /> จัดการกิจกรรม</div>
            <h1>รายการกิจกรรมทั้งหมด</h1>
            <p>เปิด/ปิดรับสมัคร ตรวจรายชื่อผู้สมัคร เช็คอิน และออกเกียรติบัตร ในที่เดียว</p>
          </div>
          <div className="ph-actions">
            <button className="btn glass" onClick={exportCsv}><i className="ti ti-download" /> ส่งออก CSV</button>
            <button className="btn btn-accent" onClick={() => navigate('/create-event')}><i className="ti ti-plus" /> กิจกรรมใหม่</button>
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

        <div className="table-card">
          <div className="table-toolbar">
            <h3><i className="ti ti-table" /> รายการกิจกรรม</h3>
            <div className="tools">
              <div className="input-search"><i className="ti ti-search" /><input type="text" placeholder="ค้นหากิจกรรม..." value={query} onChange={(e) => handleSearch(e.target.value)} /></div>
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
                  const canReg = ev.status === 'open' || ev.status === 'closed';
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
                        <div className="row-actions">
                          {canReg && (
                            <button className="icon-btn" title={ev.status === 'open' ? 'ปิดรับสมัคร' : 'เปิดรับสมัคร'} onClick={() => toggleEventStatus(ev.id)}>
                              <i className={`ti ${ev.status === 'open' ? 'ti-lock' : 'ti-lock-open'}`} />
                            </button>
                          )}
                          <button className="icon-btn" title="แก้ไข" onClick={() => navigate('/create-event', { state: { editId: ev.id } })}><i className="ti ti-edit" /></button>
                          <button className="icon-btn" title="รายชื่อผู้สมัคร / เช็คอิน" onClick={() => setApplicantsId(ev.id)}><i className="ti ti-users" /></button>
                          <button className="icon-btn danger" title="ลบ" onClick={() => setDeleteId(ev.id)}><i className="ti ti-trash" /></button>
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

      <ApplicantsModal eventId={applicantsId} open={!!applicantsId} onClose={() => setApplicantsId(null)} />

      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} size="sm">
        <ModalHead eyebrow="ยืนยันการลบ" icon="ti-alert-triangle" title="ลบกิจกรรมนี้?" onClose={() => setDeleteId(null)} />
        <div className="modal-body"><p style={{ fontSize: 14, color: 'var(--c4-70)', lineHeight: 1.6 }}>คุณกำลังจะลบ <strong>{deleteEv?.title}</strong> การกระทำนี้ไม่สามารถย้อนกลับได้</p></div>
        <div className="modal-foot">
          <button className="btn btn-outline" onClick={() => setDeleteId(null)}>ยกเลิก</button>
          <button className="btn btn-dark" onClick={() => { deleteEvent(deleteId); setDeleteId(null); }}><i className="ti ti-trash" /> ลบกิจกรรม</button>
        </div>
      </Modal>
    </div>
  );
}
