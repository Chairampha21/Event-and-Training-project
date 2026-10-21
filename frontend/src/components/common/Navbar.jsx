import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useEvents } from '../../hooks/useEvents';
import { ROLE_LABEL } from '../../utils/constants';
import './Navbar.css';
import { initials } from '../../utils/initials';
import ConfirmDialog from '../ui/ConfirmDialog';
import { fullNameTh } from '../../utils/personName';

// Staff menus come in groups under a heading ({ section }); the headings
// hide on narrow screens, where only the icons show.
const EVENT_TABS = [
  { section: 'กิจกรรม' },
  { to: '/home', icon: 'ti-home-2', label: 'กิจกรรม' },
  { to: '/create-event', icon: 'ti-square-rounded-plus', label: 'สร้างกิจกรรม' },
  { to: '/events', icon: 'ti-calendar', label: 'กิจกรรมทั้งหมด' },
  { to: '/admin/sar', icon: 'ti-photo', label: 'คลังโปสเตอร์กิจกรรม' },
];
const RESULT_TABS = [
  { section: 'ผลและรายงาน' },
  { to: '/report', icon: 'ti-report-analytics', label: 'รายงาน' },
];
const NAV_TABS = {
  admin: [
    { section: 'ภาพรวม' },
    { to: '/admin/dashboard', icon: 'ti-chart-pie', label: 'แดชบอร์ดกิจกรรม' },
    ...EVENT_TABS,
    ...RESULT_TABS,
    { section: 'ผู้ใช้' },
    { to: '/admin/users', icon: 'ti-users-group', label: 'ผู้ใช้งาน' },
    { to: '/admin/blacklist', icon: 'ti-user-off', label: 'Blacklist' },
    { section: 'ระบบ' },
    { to: '/admin/certificate', icon: 'ti-certificate', label: 'ตั้งค่าเกียรติบัตร' },
    { to: '/admin/activity-log', icon: 'ti-history', label: 'Log ระบบ' },
  ],
  organizer: [
    { section: 'ภาพรวม' },
    { to: '/admin/dashboard', icon: 'ti-chart-pie', label: 'แดชบอร์ดกิจกรรม' },
    ...EVENT_TABS,
    ...RESULT_TABS,
    { section: 'ผู้ใช้' },
    { to: '/admin/blacklist', icon: 'ti-user-off', label: 'Blacklist' },
  ],
  student: [
    { section: 'เข้าร่วมกิจกรรม' },
    { to: '/home', icon: 'ti-grid-dots', label: 'กิจกรรมทั้งหมด' },
    { to: '/my-registrations', icon: 'ti-history', label: 'ประวัติของฉัน' },
    { to: '/certificates', icon: 'ti-certificate', label: 'เกียรติบัตร' },
  ],
};
// A teacher takes part like a student, and also follows the events they coordinate.
NAV_TABS.teacher = [
  ...NAV_TABS.student,
  { section: 'ผู้ประสานงาน' },
  { to: '/coordinated', icon: 'ti-briefcase', label: 'กิจกรรมที่รับผิดชอบ' },
  { to: '/report', icon: 'ti-report-analytics', label: 'รายงานกิจกรรม' },
];

// Lines of a summary notification shown before "ดูอีก n รายการ".
const NOTIF_ITEMS_SHOWN = 4;

// A summary's lines by their group, in order of first appearance, or null
// when the lines carry no group (they are then listed as they are).
function groupsOf(items) {
  if (!items.every((it) => it.group)) return null;
  const map = new Map();
  items.forEach((it) => map.set(it.group, [...(map.get(it.group) || []), it]));
  return [...map.entries()];
}

export default function Navbar() {
  const { session, notifs, refreshNotifications, markAllRead, markNotifRead, clearAllNotif, logout } = useEvents();
  const [notifOpen, setNotifOpen] = useState(false);
  const [logoutAsk, setLogoutAsk] = useState(false);
  const [clearAsk, setClearAsk] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set()); // open groups / summaries showing all lines, by key
  const toggleExpanded = (key) => setExpanded((s) => { const x = new Set(s); if (x.has(key)) x.delete(key); else x.add(key); return x; });
  const wrapRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setNotifOpen(false);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  if (!session) return null;
  const tabs = NAV_TABS[session.role] || [];
  const unread = notifs.filter((n) => n.unread).length;

  // Pressing a notification marks it read and, when it points somewhere, goes
  // to the place where what it talks about can be seen or finished.
  function openNotif(n) {
    if (n.unread) markNotifRead(n.id);
    if (!n.link) return;
    setNotifOpen(false);
    navigate(n.link);
  }

  // A line of a summary: it opens its own place, and reading one counts as reading the summary.
  function openItem(n, it) {
    if (n.unread) markNotifRead(n.id);
    setNotifOpen(false);
    navigate(it.link);
  }

  function handleLogout() {
    setLogoutAsk(false);
    logout();
    navigate('/login');
  }

  return (
    <>
      <div className="topbar">
        <div className="tb-left">
          <span><i className="ti ti-school" /> ภาควิชาคอมพิวเตอร์ คณะวิทยาศาสตร์ มหาวิทยาลัยศิลปากร</span>
        </div>
        <div className="tb-right">
          <div className="tb-divider" />
          <div className="notif-wrap" ref={wrapRef}>
            <button className={`notif-trigger${unread > 0 ? ' has-unread' : ''}`} onClick={(e) => { e.stopPropagation(); if (!notifOpen) refreshNotifications(); setNotifOpen((o) => !o); }}>
              <i className="ti ti-bell" /> การแจ้งเตือน
              {unread > 0 && <span className="notif-count" aria-label={`ยังไม่ได้อ่าน ${unread} รายการ`}>{unread > 99 ? '99+' : unread}</span>}
            </button>
            <div className={`notif-panel${notifOpen ? ' open' : ''}`}>
              <div className="notif-head">
                <h4><i className="ti ti-bell-ringing" /> การแจ้งเตือน <span className="count-badge">{unread} ใหม่</span></h4>
                <div className="actions">
                  <button onClick={markAllRead}>อ่านทั้งหมด</button>
                  <button onClick={() => setClearAsk(true)}>ล้าง</button>
                </div>
              </div>
              <div className="notif-list">
                {notifs.length === 0 ? (
                  <div className="notif-empty">
                    <i className="ti ti-bell-off" style={{ fontSize: 26, display: 'block', marginBottom: 8, opacity: .5 }} />
                    ไม่มีการแจ้งเตือน
                  </div>
                ) : notifs.map((n) => {
                  // A summary leads through its lines, not through the whole row.
                  const sub = n.items.length > 0;
                  const open = expanded.has(n.id);
                  const shown = open ? n.items : n.items.slice(0, NOTIF_ITEMS_SHOWN);
                  return (
                    <div key={n.id} className={`notif-item${n.unread ? ' unread' : ''}${n.link && !sub ? ' has-link' : ''}`} onClick={sub ? undefined : () => openNotif(n)}>
                      <div className={`notif-icon ${n.tone || ''}`}><i className={`ti ${n.icon}`} /></div>
                      <div className="notif-body">
                        <div className="notif-title">{n.title}</div>
                        <div className="notif-msg">{n.msg}</div>
                        {sub && groupsOf(n.items) && (
                          // Lines that name their kind of task fold under it, each kind a dropdown.
                          <div className="notif-groups">
                            {groupsOf(n.items).map(([group, list]) => {
                              const key = `${n.id}:${group}`;
                              const isOpen = expanded.has(key);
                              return (
                                <div key={group} className={`notif-group${isOpen ? ' open' : ''}`}>
                                  <button type="button" className="notif-group-head" aria-expanded={isOpen} onClick={() => toggleExpanded(key)}>
                                    <i className="ti ti-chevron-right notif-group-caret" />
                                    <span>{group}</span>
                                    <span className="notif-group-count">{list.length}</span>
                                  </button>
                                  {isOpen && (
                                    <ul className="notif-sub">
                                      {list.map((it, i) => (
                                        <li key={i}>
                                          <button type="button" title={it.label} onClick={() => openItem(n, it)}>
                                            <span>{it.label}</span><i className="ti ti-chevron-right" />
                                          </button>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {sub && !groupsOf(n.items) && (
                          <ul className="notif-sub">
                            {shown.map((it, i) => (
                              <li key={i}>
                                <button type="button" title={it.label} onClick={() => openItem(n, it)}>
                                  <span>{it.label}</span><i className="ti ti-chevron-right" />
                                </button>
                              </li>
                            ))}
                            {n.items.length > NOTIF_ITEMS_SHOWN && (
                              <li>
                                <button type="button" className="notif-sub-more" onClick={() => toggleExpanded(n.id)}>
                                  {open ? 'แสดงน้อยลง' : `ดูอีก ${n.items.length - NOTIF_ITEMS_SHOWN} รายการ`}
                                </button>
                              </li>
                            )}
                          </ul>
                        )}
                        <div className="notif-time"><i className="ti ti-clock" /> {n.time}</div>
                      </div>
                      {n.link && !sub && <i className="ti ti-chevron-right notif-go" />}
                    </div>
                  );
                })}
              </div>
              <div className="notif-foot" onClick={() => setNotifOpen(false)}>ปิด</div>
            </div>
          </div>
        </div>
      </div>

      <nav className="sidebar">
        <NavLink className="logo" to={session.role === 'admin' ? '/admin/dashboard' : '/home'}>
          <div className="logo-mark">CS</div>
          <div className="logo-text">
            <span className="lt1">CPSU ETMS</span>
            <span className="lt2">ระบบจัดการกิจกรรม<br />&amp; การอบรม · คณะวิทยาศาสตร์</span>
          </div>
        </NavLink>
        <div className="nav-tabs">
          {tabs.map((t) => (t.section ? (
            <div key={`s-${t.section}`} className="nav-section">{t.section}</div>
          ) : (
            <NavLink key={t.to} to={t.to} className={({ isActive }) => `nav-tab${isActive ? ' active' : ''}`} title={t.label}>
              <i className={`ti ${t.icon}`} /> <span>{t.label}</span>
            </NavLink>
          )))}
          {tabs.some((t) => t.section) && <div className="nav-section">บัญชี</div>}
          <NavLink to="/profile" className={({ isActive }) => `nav-tab${isActive ? ' active' : ''}`} title="โปรไฟล์ของฉัน">
            <i className="ti ti-user-circle" /> <span>โปรไฟล์ของฉัน</span>
          </NavLink>
        </div>
        <div className="sidebar-foot">
          <button type="button" className="user-pill" title="ดู/แก้ไขโปรไฟล์" onClick={() => navigate('/profile')}>
            <div className={`up-av ${session.role}`}>{initials(session.name)}</div>
            <div className="up-info">
              <span className="up-name" title={fullNameTh(session)}>{session.name}</span>
              <span className="up-role"><span className={`role-tag ${session.role}`}>{ROLE_LABEL[session.role]}</span></span>
            </div>
          </button>
          <button className="btn-logout" title="ออกจากระบบ" onClick={() => setLogoutAsk(true)}><i className="ti ti-logout" /> <span>ออกจากระบบ</span></button>
        </div>
      </nav>
      <ConfirmDialog
        open={clearAsk}
        eyebrow="ล้างการแจ้งเตือน"
        icon="ti-bell-off"
        title="ลบการแจ้งเตือนทั้งหมด?"
        confirmLabel="ลบทั้งหมด"
        confirmIcon="ti-trash"
        onConfirm={() => { setClearAsk(false); clearAllNotif(); }}
        onCancel={() => setClearAsk(false)}
      >
        <p style={{ fontSize: 13.5, color: 'var(--c4-70)', lineHeight: 1.7 }}>
          การแจ้งเตือนทั้ง {notifs.length} รายการจะถูกลบ และกู้คืนไม่ได้ · ถ้าแค่ไม่อยากเห็นตัวเลข ใช้ "อ่านทั้งหมด" แทน
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        open={logoutAsk}
        eyebrow="ออกจากระบบ"
        icon="ti-logout"
        title="ออกจากระบบหรือไม่?"
        confirmLabel="ออกจากระบบ"
        confirmIcon="ti-logout"
        onConfirm={handleLogout}
        onCancel={() => setLogoutAsk(false)}
      >
        <p style={{ fontSize: 13.5, color: 'var(--c4-70)', lineHeight: 1.7 }}>
          คุณกำลังออกจากบัญชี <strong style={{ color: 'var(--c4)' }}>{fullNameTh(session)}</strong> ({session.email})<br />
          ข้อมูลที่ยังไม่ได้บันทึกในหน้านี้จะหายไป
        </p>
      </ConfirmDialog>
    </>
  );
}
