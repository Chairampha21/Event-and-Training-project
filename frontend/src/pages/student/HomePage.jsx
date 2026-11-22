import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useEvents } from '../../hooks/useEvents';
import { fiscalYearOf, todayIso } from '../../utils/dateFormat';
import { EVENT_CATEGORIES as BASE_CATEGORIES, EVENT_CATEGORY_ICONS as CATEGORY_ICONS, isParticipant } from '../../utils/constants';
import EventCard from '../../features/events/components/EventCard';
import { studentProgram, studentYearKey } from '../../components/common/StudentDeptFields';
import { overdueEvaluations } from '../../utils/evaluationDue';
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

// The base categories always have a pill; a category added in the create-event
// form ("+ เพิ่มประเภทใหม่...") gets one too once an event the viewer can see uses it.
function categoryPills(events) {
  const extra = [...new Set(events.map(topCat).filter((c) => c && !BASE_CATEGORIES.includes(c)))].sort((a, b) => a.localeCompare(b, 'th'));
  return [
    { key: 'all', label: 'ทั้งหมด', icon: 'ti-grid-dots' },
    ...[...BASE_CATEGORIES, ...extra].map((c) => ({ key: c.toLowerCase(), label: c, icon: CATEGORY_ICONS[c] || 'ti-sparkles' })),
  ];
}

const SORT_OPTIONS = [
  { key: 'default', label: 'เปิดรับสมัครก่อน' },
  { key: 'closing', label: 'ใกล้ปิดรับสมัครก่อน' },
  { key: 'upcoming', label: 'วันจัดใกล้ถึงก่อน' },
  { key: 'newest', label: 'เพิ่มใหม่ล่าสุด' },
  { key: 'oldest', label: 'เพิ่มไว้นานที่สุด' },
];

// The last day to apply: the registration end date, or the event's first day
// when the organizer didn't set one.
function closesOn(e) {
  return (e.regEnd || e.dateStart || '').slice(0, 10);
}

export default function HomePage() {
  const { events, regs, session, myStatus, getDashboardSummary } = useEvents();
  const isStudent = isParticipant(session?.role);


  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [pillFilter, setPillFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('default');
  // 'any' = no filter; 'cs' / 'it' = events for that programme only; 'all' = open to every programme.
  const [programFilter, setProgramFilter] = useState('any');
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

  // The page opens on the current fiscal year (October - September), for
  // everyone: students see that year's events whatever their state (open ones
  // first; closed and finished ones to look back on) and can pick earlier years.
  const currentFy = fiscalYearOf(todayIso());
  const [fy, setFy] = useState(currentFy);

  // The figures in the hero are all-time totals, whichever fiscal year is picked below.
  const [summary, setSummary] = useState(null);
  useEffect(() => { getDashboardSummary('all').then(setSummary); }, [getDashboardSummary]);
  const fiscalYears = useMemo(() => {
    const years = new Set([currentFy]);
    events.forEach((e) => { if (e.listed && e.dateStart) years.add(fiscalYearOf(e.dateStart)); });
    return [...years].sort((a, b) => b - a);
  }, [events, currentFy]);

  const statusRank = { open: 0, soon: 1, full: 2, closed: 3, done: 4 };

  // A student doesn't see events for the other programme (CS-only events are
  // hidden from IT students and vice versa), except ones they are already
  // registered for. Without a major in the profile, they see everything.
  // The same goes for events limited to some years of study.
  const myProgram = session?.role === 'student' ? studentProgram(session?.dept) : '';
  const myYear = session?.role === 'student' ? studentYearKey(session?.dept) : '';
  const forMe = (e) => (!myProgram || !e.program || e.program === 'all' || e.program === myProgram)
    && (!myYear || !e.years?.length || e.years.includes(myYear));
  const visible = (e) => e.listed && (forMe(e) || !!myStatus(e.id));

  const pills = useMemo(
    () => categoryPills(events.filter((e) => visible(e) && (fy === 'all' || fiscalYearOf(e.dateStart) === fy))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, fy, myProgram, myYear, regs],
  );
  // A custom category's pill goes away when the year changes to one without it.
  useEffect(() => {
    if (!pills.some((p) => p.key === pillFilter)) setPillFilter('all');
  }, [pills, pillFilter]);

  const list = useMemo(() => {
    const l = events.filter((e) => {
      if (!visible(e)) return false;
      if (fy !== 'all' && fiscalYearOf(e.dateStart) !== fy) return false;
      if (pillFilter !== 'all' && !matchFilter(e, pillFilter)) return false;
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (programFilter !== 'any' && (e.program || 'all') !== programFilter) return false;
      if (appliedQuery) {
        const hay = `${e.title} ${e.cat} ${e.desc} ${e.org}`.toLowerCase();
        if (!hay.includes(appliedQuery)) return false;
      }
      return true;
    });
    // Open first, then not yet open, full, closed and finished; within each,
    // the soonest first, finished ones the most recent first.
    const byDefault = (a, b) => (statusRank[a.status] - statusRank[b.status])
      || (a.status === 'done' ? (b.dateStart || '').localeCompare(a.dateStart || '') : (a.dateStart || '').localeCompare(b.dateStart || ''))
      || (a.id - b.id);
    const today = todayIso();
    let cmp = byDefault;
    if (sortBy === 'closing') {
      // Events still open to apply, the one closing soonest first; the rest after, as usual.
      const stillOpen = (e) => e.status === 'open' && closesOn(e) >= today;
      cmp = (a, b) => (stillOpen(b) - stillOpen(a))
        || (stillOpen(a) ? closesOn(a).localeCompare(closesOn(b)) : 0)
        || byDefault(a, b);
    } else if (sortBy === 'upcoming') {
      // Events that haven't started yet, the nearest first; past ones after, the most recent first.
      const ahead = (e) => (e.dateStart || '') >= today;
      cmp = (a, b) => (ahead(b) - ahead(a))
        || (ahead(a) ? (a.dateStart || '').localeCompare(b.dateStart || '') : (b.dateStart || '').localeCompare(a.dateStart || ''))
        || (a.id - b.id);
    } else if (sortBy === 'newest') {
      cmp = (a, b) => (b.createdAt || '').localeCompare(a.createdAt || '') || (b.id - a.id);
    } else if (sortBy === 'oldest') {
      cmp = (a, b) => (a.createdAt || '').localeCompare(b.createdAt || '') || (a.id - b.id);
    }
    return [...l].sort(cmp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, isStudent, pillFilter, statusFilter, appliedQuery, fy, sortBy, myProgram, myYear, regs, programFilter]);

  // "CS 160 · IT 56" under a hero figure; events also show how many are open to both programmes.
  function programSplit(key, withAll) {
    const s = summary?.by_program?.[key];
    if (!s) return null;
    const fmt = (n) => (n || 0).toLocaleString('en-US');
    return <span className="hs-split">CS {fmt(s.cs)} · IT {fmt(s.it)}{withAll ? ` · ทุกสาขา ${fmt(s.all)}` : ''}</span>;
  }

  const navigate = useNavigate();
  const overdue = session?.role === 'student' ? overdueEvaluations(regs) : [];

  const filtered = pillFilter !== 'all' || statusFilter !== 'all' || programFilter !== 'any' || !!appliedQuery;

  function resetSearch() {
    setQuery(''); setAppliedQuery(''); setStatusFilter('all'); setPillFilter('all'); setSortBy('default'); setProgramFilter('any');
  }

  return (
    <div>
      <div className="hero">
        <div className="hero-inner">
          <h1>ค้นหา · สมัคร · รับเกียรติบัตร<br /><span className="hero-line">ระบบกิจกรรมครบวงจรของภาควิชาคอมพิวเตอร์</span></h1>
          <HeroSearch query={query} onQueryChange={setQuery} onSearch={() => setAppliedQuery(query.trim().toLowerCase())} />
          <div className="hero-stats">
            {/* Registered and actually attended are shown apart (registered → checked in, as event dashboards do),
                with the share that turned up under the attended count. */}
            <div className="hero-stat"><span className="v">{summary ? summary.events_this_year : '—'}</span><span className="l">กิจกรรมทั้งหมด{programSplit('events_this_year', true)}</span></div>
            <div className="hero-stat"><span className="v">{summary ? summary.participants_total.toLocaleString('en-US') : '—'}</span><span className="l">ลงทะเบียนสะสม{programSplit('participants_total')}</span></div>
            <div className="hero-stat">
              <span className="v">{summary ? (summary.attended_total ?? 0).toLocaleString('en-US') : '—'}</span>
              <span className="l">เข้าร่วมจริงสะสม{summary?.participants_total > 0 ? <em>{Math.round(((summary.attended_total || 0) / summary.participants_total) * 100)}% ของผู้ลงทะเบียน</em> : null}{programSplit('attended_total')}</span>
            </div>
            <div className="hero-stat"><span className="v">{summary ? summary.certificates_issued.toLocaleString('en-US') : '—'}</span><span className="l">เกียรติบัตรที่ออก{programSplit('certificates_issued')}</span></div>
            <div className="hero-stat"><span className="v">{summary ? summary.open_now : events.filter((e) => e.listed && e.status === 'open').length}</span><span className="l">กำลังเปิดรับสมัคร{programSplit('open_now', true)}</span></div>
          </div>
        </div>
      </div>

      <SearchBar
        pills={pills}
        pillFilter={pillFilter} onPillChange={setPillFilter}
        statusFilter={statusFilter} onStatusChange={setStatusFilter}
        sortBy={sortBy} onSortChange={setSortBy} sortOptions={SORT_OPTIONS}
        // A student with a major already sees only their programme's events, so the filter is for everyone else.
        programFilter={programFilter} onProgramChange={myProgram ? undefined : setProgramFilter}
      />

      <div className="wrap" style={{ paddingTop: 46 }}>
        {overdue.length > 0 && (
          <div className="eval-due-banner" role="status">
            <i className="ti ti-clipboard-check" />
            <div>
              <strong>มีแบบประเมินค้าง {overdue.length} รายการ · ยังสมัครกิจกรรมใหม่ไม่ได้</strong>
              <span>{overdue.map((r) => r.title).join(' · ')}</span>
            </div>
            <button className="btn btn-primary" onClick={() => navigate('/my-registrations')}>ไปทำแบบประเมิน</button>
          </div>
        )}
        <div className="section-head">
          <div>
            <div className="sh-title">กิจกรรมและการอบรม{fy !== 'all' ? ` ปีงบประมาณ พ.ศ. ${fy}` : ''} <span className="count">{list.length} รายการ</span></div>
            <div className="sh-sub">{sortBy !== 'default'
              ? `เรียงตาม: ${SORT_OPTIONS.find((o) => o.key === sortBy).label}`
              : isStudent
              ? 'กิจกรรมที่เปิดรับสมัครแสดงก่อน · กิจกรรมที่ปิดรับหรือจบแล้วเปิดดูรายละเอียดย้อนหลังได้'
              : 'ค้นหากิจกรรมและการอบรมที่เปิดรับสมัคร ดูรายละเอียดและลงทะเบียนเข้าร่วมได้ในหน้าเดียว'}</div>
          </div>
          <label className="fy-pick">
            <span>ปีงบประมาณ</span>
            <select className="role-select" value={fy} onChange={(e) => setFy(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
              {fiscalYears.map((y) => <option key={y} value={y}>พ.ศ. {y}{y === currentFy ? ' (ปีปัจจุบัน)' : ''}</option>)}
              <option value="all">ทุกปีงบประมาณ</option>
            </select>
          </label>
          {filtered && (
            <a href="#reset" className="see-all" onClick={(e) => { e.preventDefault(); resetSearch(); }}>ดูทั้งหมด <i className="ti ti-arrow-right" /></a>
          )}
        </div>

        {list.length === 0 ? (
          <div className="home-empty">
            <i className="ti ti-calendar-search" />
            <div className="he-title">ไม่พบกิจกรรมที่ตรงกับการค้นหา</div>
            <div className="he-sub">{!filtered && fy !== 'all' ? `ยังไม่มีกิจกรรมในปีงบประมาณ พ.ศ. ${fy} · เลือกปีงบประมาณอื่นได้ด้านบน` : 'ลองปรับคำค้นหา หมวดหมู่ สาขา หรือสถานะ'}</div>
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
                myPayment={regs.find((r) => r.eid === ev.id)?.paymentStatus}
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
