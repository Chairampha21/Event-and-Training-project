import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEvents } from '../../hooks/useEvents';
import { STATUS_META, CYCLE, EVENT_CATEGORIES as BASE_CATEGORIES, EVENT_CATEGORY_ICONS as CATEGORY_ICONS } from '../../utils/constants';
import EventCard from '../../components/EventCard';
import SearchBar, { HeroSearch } from '../../components/SearchBar';
import CycleProgress from '../../components/CycleProgress';
import Modal, { ModalHead } from '../../components/Modal';
import ApplicantsModal from '../../components/ApplicantsModal';

function topCat(e) {
  return (e.cat || '').split('·')[0].trim();
}

function matchFilter(e, f) {
  return topCat(e).toLowerCase() === f;
}

// Filter pills are fixed to the current base categories only — an event tagged
// with something else (e.g. a one-off custom category from the create-event form)
// still shows up under "ทั้งหมด" but never spawns its own stray pill here.
const CATEGORY_PILLS = [
  { key: 'all', label: 'ทั้งหมด', icon: 'ti-grid-dots' },
  ...BASE_CATEGORIES.map((c) => ({ key: c.toLowerCase(), label: c, icon: CATEGORY_ICONS[c] })),
];

function EventDetailModal({ eventId, open, onClose }) {
  const { evById, myStatus, registerForEvent, session } = useEvents();
  if (!open || !eventId) return null;
  const ev = evById(eventId);
  if (!ev) return null;
  const sm = STATUS_META[ev.status];
  const st = myStatus(ev.id);
  const canReg = ev.status === 'open' && !st;

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <ModalHead eyebrow="รายละเอียดกิจกรรม" icon="ti-calendar-event" onClose={onClose} />
      <div className="modal-body">
        {ev.poster && <img src={ev.poster} alt="" style={{ width: '100%', borderRadius: 12, marginBottom: 14, display: 'block' }} />}
        <div className="md-hero">
          <div className="mdh-cat">{ev.cat}</div>
          <div className="mdh-title">{ev.title}</div>
          <div className="mdh-meta">
            <span><i className="ti ti-calendar-event" /> {ev.date}</span>
            <span><i className="ti ti-clock" /> {ev.time}</span>
            <span><i className="ti ti-map-pin" /> {ev.place}</span>
          </div>
        </div>
        {st && (
          <div className="md-section">
            <div className="pill-status ps-open" style={{ fontSize: 13 }}><i className="ti ti-circle-check-filled" /> คุณลงทะเบียนกิจกรรมนี้แล้ว</div>
          </div>
        )}
        <div className="md-section"><h4>รายละเอียด</h4><p>{ev.desc || 'ไม่มีรายละเอียดเพิ่มเติม'}</p></div>
        {session?.role !== 'student' && (
          <div className="md-section"><h4>ขั้นตอนของกิจกรรม</h4><CycleProgress stage={ev.stage} /></div>
        )}
        <div className="info-grid">
          <div className="ig"><div className="igl">สถานะรับสมัคร</div><div className="igv">{sm.label}</div></div>
          <div className="ig"><div className="igl">ที่นั่ง</div><div className="igv">{ev.reg} / {ev.cap}</div></div>
          <div className="ig"><div className="igl">ผู้รับผิดชอบ</div><div className="igv">{ev.org}</div></div>
          <div className="ig"><div className="igl">รหัสกิจกรรม</div><div className="igv">SU-CS-25-{String(ev.id).padStart(3, '0')}</div></div>
        </div>
      </div>
      <div className="modal-foot">
        {canReg ? (
          <>
            <button className="btn btn-outline" onClick={onClose}>ปิด</button>
            <button className="btn btn-primary" onClick={() => { registerForEvent(ev.id); onClose(); }}><i className="ti ti-user-plus" /> ยืนยันลงทะเบียน</button>
          </>
        ) : (
          <button className="btn btn-primary" onClick={onClose}>ปิด</button>
        )}
      </div>
    </Modal>
  );
}

function ManageEventModal({ eventId, open, onClose, onOpenApplicants }) {
  const { evById, toggleEventStatus, deleteEvent, issueCertificate } = useEvents();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!open || !eventId) return null;
  const ev = evById(eventId);
  if (!ev) return null;
  const sm = STATUS_META[ev.status];
  const isOpen = ev.status === 'open';
  const canToggle = ev.status === 'open' || ev.status === 'closed';

  if (confirmDelete) {
    return (
      <Modal open={open} onClose={onClose} size="sm">
        <ModalHead eyebrow="ยืนยันการลบ" icon="ti-alert-triangle" title="ลบกิจกรรมนี้?" onClose={onClose} />
        <div className="modal-body"><p style={{ fontSize: 14, color: 'var(--c4-70)', lineHeight: 1.6 }}>คุณกำลังจะลบ <strong>{ev.title}</strong> การกระทำนี้ไม่สามารถย้อนกลับได้</p></div>
        <div className="modal-foot">
          <button className="btn btn-outline" onClick={() => setConfirmDelete(false)}>ยกเลิก</button>
          <button className="btn btn-dark" onClick={() => { deleteEvent(ev.id); onClose(); }}><i className="ti ti-trash" /> ลบกิจกรรม</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <ModalHead eyebrow="จัดการกิจกรรม" icon="ti-settings" title={ev.title.slice(0, 46)} onClose={onClose} />
      <div className="modal-body">
        <div className="me-meta">
          <span><i className="ti ti-calendar-event" /> {ev.date}</span>
          <span><i className="ti ti-users" /> {ev.reg} / {ev.cap} ที่นั่ง</span>
          <span><i className="ti ti-route" /> {CYCLE[ev.stage]}</span>
        </div>
        <div className="me-list">
          <button className="me-action" onClick={() => { onClose(); navigate('/create-event', { state: { editId: ev.id } }); }}>
            <div className="me-ic accent"><i className="ti ti-edit" /></div>
            <div className="me-tx"><strong>แก้ไขข้อมูลกิจกรรม</strong><span>ชื่อ วันเวลา สถานที่ จำนวนรับ และรายละเอียด</span></div>
            <i className="ti ti-chevron-right me-go" />
          </button>
          <button className="me-action" onClick={() => { onClose(); onOpenApplicants(ev.id); }}>
            <div className="me-ic"><i className="ti ti-users" /></div>
            <div className="me-tx"><strong>รายชื่อผู้สมัคร &amp; เช็คอิน</strong><span>ตรวจสอบผู้สมัครและเช็คอินเข้าร่วม</span></div>
            <i className="ti ti-chevron-right me-go" />
          </button>
          <button className="me-action" onClick={() => { issueCertificate(ev.id); onClose(); }}>
            <div className="me-ic"><i className="ti ti-certificate" /></div>
            <div className="me-tx"><strong>ออกเกียรติบัตร</strong><span>เปิดสิทธิ์ให้ผู้เข้าร่วมที่เช็คอินแล้ว</span></div>
            <i className="ti ti-chevron-right me-go" />
          </button>
          {canToggle && (
            <button className="me-action" onClick={() => toggleEventStatus(ev.id)}>
              <div className="me-ic"><i className={`ti ti-${isOpen ? 'lock-open' : 'lock'}`} /></div>
              <div className="me-tx"><strong>{isOpen ? 'ปิดรับสมัคร' : 'เปิดรับสมัคร'}</strong><span>สถานะปัจจุบัน: {sm.label}</span></div>
              <i className="ti ti-chevron-right me-go" />
            </button>
          )}
          <button className="me-action danger" onClick={() => setConfirmDelete(true)}>
            <div className="me-ic dark"><i className="ti ti-trash" /></div>
            <div className="me-tx"><strong>ลบกิจกรรม</strong><span>นำกิจกรรมออกจากระบบ (ย้อนกลับไม่ได้)</span></div>
            <i className="ti ti-chevron-right me-go" />
          </button>
        </div>
      </div>
      <div className="modal-foot"><button className="btn btn-outline" onClick={onClose}>ปิด</button></div>
    </Modal>
  );
}

export default function HomePage() {
  const { events, session, myStatus } = useEvents();
  const isStudent = session?.role === 'student';

  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [pillFilter, setPillFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('soon');
  const [detailId, setDetailId] = useState(null);
  const [manageId, setManageId] = useState(null);
  const [applicantsId, setApplicantsId] = useState(null);

  const statusRank = { open: 0, soon: 1, full: 2, closed: 3, done: 4 };

  const list = useMemo(() => {
    let l = events.filter((e) => {
      if (!e.listed) return false;
      if (isStudent && e.status !== 'open') return false;
      if (pillFilter !== 'all' && !matchFilter(e, pillFilter)) return false;
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (appliedQuery) {
        const hay = `${e.title} ${e.cat} ${e.desc} ${e.org}`.toLowerCase();
        if (!hay.includes(appliedQuery)) return false;
      }
      return true;
    });
    l = [...l].sort((a, b) => {
      if (sortBy === 'name') return a.title.localeCompare(b.title, 'th');
      if (sortBy === 'seats') return (b.cap - b.reg) - (a.cap - a.reg);
      return (statusRank[a.status] - statusRank[b.status]) || (a.id - b.id);
    });
    return l;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, isStudent, pillFilter, statusFilter, appliedQuery, sortBy]);

  const filtered = pillFilter !== 'all' || statusFilter !== 'all' || !!appliedQuery;

  function resetSearch() {
    setQuery(''); setAppliedQuery(''); setStatusFilter('all'); setSortBy('soon'); setPillFilter('all');
  }

  return (
    <div>
      <div className="hero">
        <div className="hero-inner">
          <h1>ค้นหา · สมัคร · รับเกียรติบัตร<br />ระบบกิจกรรมครบวงจรของภาควิชาคอมพิวเตอร์</h1>
          <p>ติดตามทุกกิจกรรมและการอบรมของคณะฯ ผ่าน 4 ขั้น Cycle ที่โปร่งใส ตั้งแต่ประกาศกิจกรรม การรับสมัคร การเข้าร่วม (เช็คอินด้วย QR) จนถึงการรับเกียรติบัตรอิเล็กทรอนิกส์</p>
          <HeroSearch query={query} onQueryChange={setQuery} onSearch={() => setAppliedQuery(query.trim().toLowerCase())} />
          <div className="hero-stats">
            <div className="hero-stat"><span className="v">42<small>+</small></span><span className="l">กิจกรรมในปีนี้</span></div>
            <div className="hero-stat"><span className="v">3,184</span><span className="l">ผู้เข้าร่วมสะสม</span></div>
            <div className="hero-stat"><span className="v">2,690</span><span className="l">เกียรติบัตรที่ออก</span></div>
            <div className="hero-stat"><span className="v">{events.filter((e) => e.listed && e.status === 'open').length}</span><span className="l">กำลังเปิดรับ</span></div>
          </div>
        </div>
      </div>

      <SearchBar
        pills={CATEGORY_PILLS}
        pillFilter={pillFilter} onPillChange={setPillFilter}
        statusFilter={statusFilter} onStatusChange={setStatusFilter} hideStatus={isStudent}
        sortBy={sortBy} onSortChange={setSortBy}
      />

      <div className="wrap" style={{ paddingTop: 46 }}>
        <div className="section-head">
          <div>
            <div className="sh-title">กิจกรรมและการอบรม <span className="count">{list.length} รายการ</span></div>
            <div className="sh-sub">ค้นหากิจกรรมและการอบรมที่เปิดรับสมัคร ดูรายละเอียดและลงทะเบียนเข้าร่วมได้ในหน้าเดียว</div>
          </div>
          {filtered && (
            <a href="#reset" className="see-all" onClick={(e) => { e.preventDefault(); resetSearch(); }}>ดูทั้งหมด <i className="ti ti-arrow-right" /></a>
          )}
        </div>

        {list.length === 0 ? (
          <div className="home-empty">
            <i className="ti ti-calendar-search" />
            <div className="he-title">ไม่พบกิจกรรมที่ตรงกับการค้นหา</div>
            <div className="he-sub">ลองปรับคำค้นหา หมวดหมู่ หรือสถานะ</div>
            <button className="btn btn-outline" onClick={resetSearch}><i className="ti ti-rotate" /> ล้างตัวกรอง</button>
          </div>
        ) : (
          <div className="event-grid">
            {list.map((ev) => (
              <EventCard
                key={ev.id}
                event={ev}
                isStudent={isStudent}
                myStatus={myStatus(ev.id)}
                onApply={setDetailId}
                onManage={setManageId}
              />
            ))}
          </div>
        )}
      </div>

      <EventDetailModal eventId={detailId} open={!!detailId} onClose={() => setDetailId(null)} />
      <ManageEventModal eventId={manageId} open={!!manageId} onClose={() => setManageId(null)} onOpenApplicants={setApplicantsId} />
      <ApplicantsModal eventId={applicantsId} open={!!applicantsId} onClose={() => setApplicantsId(null)} />
    </div>
  );
}
