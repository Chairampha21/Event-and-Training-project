import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useEvents } from '../../hooks/useEvents';
import { fiscalYearOf, todayIso } from '../../utils/dateFormat';
import { EVENT_CATEGORIES as BASE_CATEGORIES, EVENT_CATEGORY_ICONS as CATEGORY_ICONS } from '../../utils/constants';
import EventCard from '../../features/events/components/EventCard';
import SearchBar, { HeroSearch } from '../../features/events/components/SearchBar';
import ApplicantsModal from '../../features/events/components/ApplicantsModal';
import EventDetailModal from '../../features/events/components/EventDetailModal';
import ManageEventModal from '../../features/events/components/ManageEventModal';

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

export default function HomePage() {
  const { events, session, myStatus, getDashboardSummary } = useEvents();
  const isStudent = session?.role === 'student';

  const [summary, setSummary] = useState(null);
  useEffect(() => { getDashboardSummary().then(setSummary); }, [getDashboardSummary]);

  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [pillFilter, setPillFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [detailId, setDetailId] = useState(null);
  const [manageId, setManageId] = useState(null);
  const [applicantsId, setApplicantsId] = useState(null);
  const [applicantsMode, setApplicantsMode] = useState('list');

  // A notification links here as /home?event=<id>: open that event's details,
  // then drop the parameter so closing the window does not bring it back.
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    const eventId = Number(params.get('event'));
    if (!eventId) return;
    setDetailId(eventId);
    setParams({}, { replace: true });
  }, [params, setParams]);

  // The page opens on the current fiscal year (October - September). Whoever
  // manages events can step back to earlier years; students only ever see what
  // is open for registration, so nothing is held back from them by year.
  const currentFy = fiscalYearOf(todayIso());
  const [fy, setFy] = useState(currentFy);
  const fiscalYears = useMemo(() => {
    const years = new Set([currentFy]);
    events.forEach((e) => { if (e.listed && e.dateStart) years.add(fiscalYearOf(e.dateStart)); });
    return [...years].sort((a, b) => b - a);
  }, [events, currentFy]);

  const statusRank = { open: 0, soon: 1, full: 2, closed: 3, done: 4 };

  const list = useMemo(() => {
    let l = events.filter((e) => {
      if (!e.listed) return false;
      if (isStudent && e.status !== 'open') return false;
      if (!isStudent && fy !== 'all' && fiscalYearOf(e.dateStart) !== fy) return false;
      if (pillFilter !== 'all' && !matchFilter(e, pillFilter)) return false;
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (appliedQuery) {
        const hay = `${e.title} ${e.cat} ${e.desc} ${e.org}`.toLowerCase();
        if (!hay.includes(appliedQuery)) return false;
      }
      return true;
    });
    l = [...l].sort((a, b) => (statusRank[a.status] - statusRank[b.status]) || (a.id - b.id));
    return l;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, isStudent, pillFilter, statusFilter, appliedQuery, fy]);

  const filtered = pillFilter !== 'all' || statusFilter !== 'all' || !!appliedQuery;

  function resetSearch() {
    setQuery(''); setAppliedQuery(''); setStatusFilter('all'); setPillFilter('all');
  }

  return (
    <div>
      <div className="hero">
        <div className="hero-inner">
          <h1>ค้นหา · สมัคร · รับเกียรติบัตร<br /><span className="hero-line">ระบบกิจกรรมครบวงจรของภาควิชาคอมพิวเตอร์</span></h1>
          <HeroSearch query={query} onQueryChange={setQuery} onSearch={() => setAppliedQuery(query.trim().toLowerCase())} />
          <div className="hero-stats">
            <div className="hero-stat"><span className="v">{summary ? summary.events_this_year : '—'}</span><span className="l">กิจกรรมในปีงบประมาณนี้</span></div>
            <div className="hero-stat"><span className="v">{summary ? summary.participants_total.toLocaleString('en-US') : '—'}</span><span className="l">ผู้เข้าร่วมสะสม</span></div>
            <div className="hero-stat"><span className="v">{summary ? summary.certificates_issued.toLocaleString('en-US') : '—'}</span><span className="l">เกียรติบัตรที่ออก</span></div>
            <div className="hero-stat"><span className="v">{summary ? summary.open_now : events.filter((e) => e.listed && e.status === 'open').length}</span><span className="l">กำลังเปิดรับ</span></div>
          </div>
        </div>
      </div>

      <SearchBar
        pills={CATEGORY_PILLS}
        pillFilter={pillFilter} onPillChange={setPillFilter}
        statusFilter={statusFilter} onStatusChange={setStatusFilter} hideStatus={isStudent}
      />

      <div className="wrap" style={{ paddingTop: 46 }}>
        <div className="section-head">
          <div>
            <div className="sh-title">กิจกรรมและการอบรม{!isStudent && fy !== 'all' ? ` ปีงบประมาณ พ.ศ. ${fy}` : ''} <span className="count">{list.length} รายการ</span></div>
            <div className="sh-sub">ค้นหากิจกรรมและการอบรมที่เปิดรับสมัคร ดูรายละเอียดและลงทะเบียนเข้าร่วมได้ในหน้าเดียว</div>
          </div>
          {!isStudent && (
            <label className="fy-pick">
              <span>ปีงบประมาณ</span>
              <select className="role-select" value={fy} onChange={(e) => setFy(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
                {fiscalYears.map((y) => <option key={y} value={y}>พ.ศ. {y}{y === currentFy ? ' (ปีปัจจุบัน)' : ''}</option>)}
                <option value="all">ทุกปีงบประมาณ</option>
              </select>
            </label>
          )}
          {filtered && (
            <a href="#reset" className="see-all" onClick={(e) => { e.preventDefault(); resetSearch(); }}>ดูทั้งหมด <i className="ti ti-arrow-right" /></a>
          )}
        </div>

        {list.length === 0 ? (
          <div className="home-empty">
            <i className="ti ti-calendar-search" />
            <div className="he-title">ไม่พบกิจกรรมที่ตรงกับการค้นหา</div>
            <div className="he-sub">{!isStudent && !filtered && fy !== 'all' ? `ยังไม่มีกิจกรรมในปีงบประมาณ พ.ศ. ${fy} · เลือกปีงบประมาณอื่นได้ด้านบน` : 'ลองปรับคำค้นหา หมวดหมู่ หรือสถานะ'}</div>
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
      <ManageEventModal eventId={manageId} open={!!manageId} onClose={() => setManageId(null)} onOpenApplicants={(id, mode) => { setApplicantsMode(mode || 'list'); setApplicantsId(id); }} />
      <ApplicantsModal eventId={applicantsId} mode={applicantsMode} open={!!applicantsId} onClose={() => setApplicantsId(null)} />
    </div>
  );
}
