import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useEvents } from '../hooks/useEvents';
import { ROLE_LABEL } from '../utils/constants';
import './Navbar.css';

const NAV_TABS = {
  admin: [
    { to: '/admin/dashboard', icon: 'ti-layout-dashboard', label: 'ภาพรวม' },
    { to: '/events', icon: 'ti-calendar', label: 'จัดการกิจกรรม' },
    { to: '/create-event', icon: 'ti-square-rounded-plus', label: 'สร้างกิจกรรม' },
    { to: '/admin/users', icon: 'ti-users-group', label: 'ผู้ใช้งาน' },
    { to: '/admin/blacklist', icon: 'ti-user-off', label: 'Blacklist' },
    { to: '/report', icon: 'ti-report-analytics', label: 'รายงาน' },
  ],
  organizer: [
    { to: '/home', icon: 'ti-home-2', label: 'กิจกรรม' },
    { to: '/create-event', icon: 'ti-square-rounded-plus', label: 'สร้างกิจกรรม' },
    { to: '/events', icon: 'ti-users', label: 'ผู้เข้าร่วม' },
    { to: '/admin/blacklist', icon: 'ti-user-off', label: 'Blacklist' },
    { to: '/admin/evaluations', icon: 'ti-chart-bar', label: 'แบบประเมิน' },
    { to: '/admin/sar', icon: 'ti-clipboard-text', label: 'SAR' },
    { to: '/admin/dashboard', icon: 'ti-chart-pie', label: 'Dashboard รายปี' },
    { to: '/report', icon: 'ti-report-analytics', label: 'รายงาน' },
  ],
  student: [
    { to: '/home', icon: 'ti-grid-dots', label: 'กิจกรรมทั้งหมด' },
    { to: '/my-registrations', icon: 'ti-history', label: 'ประวัติของฉัน' },
    { to: '/certificates', icon: 'ti-certificate', label: 'เกียรติบัตร' },
  ],
};

function initials(name) {
  const p = (name || '')
    .replace(/^(นาย|น\.ส\.|นางสาว|นาง|ผศ\.ดร\.|อ\.ดร\.|อ\.|ศ\.ดร\.)\s*/, '')
    .trim()
    .split(' ');
  return (p[0] || '').slice(0, 1) + (p[1] || '').slice(0, 1);
}

export default function Navbar() {
  const { session, notifs, markAllRead, clearAllNotif, logout } = useEvents();
  const [notifOpen, setNotifOpen] = useState(false);
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

  function handleLogout() {
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
            <button className="notif-trigger" onClick={(e) => { e.stopPropagation(); setNotifOpen((o) => !o); }}>
              <i className="ti ti-bell" /> การแจ้งเตือน · <span>{unread}</span>
              {unread > 0 && <span className="dot" />}
            </button>
            <div className={`notif-panel${notifOpen ? ' open' : ''}`}>
              <div className="notif-head">
                <h4><i className="ti ti-bell-ringing" /> การแจ้งเตือน <span className="count-badge">{unread} ใหม่</span></h4>
                <div className="actions">
                  <button onClick={markAllRead}>อ่านทั้งหมด</button>
                  <button onClick={clearAllNotif}>ล้าง</button>
                </div>
              </div>
              <div className="notif-list">
                {notifs.length === 0 ? (
                  <div className="notif-empty">
                    <i className="ti ti-bell-off" style={{ fontSize: 26, display: 'block', marginBottom: 8, opacity: .5 }} />
                    ไม่มีการแจ้งเตือน
                  </div>
                ) : notifs.map((n) => (
                  <div key={n.id} className={`notif-item${n.unread ? ' unread' : ''}`}>
                    <div className={`notif-icon ${n.tone || ''}`}><i className={`ti ${n.icon}`} /></div>
                    <div className="notif-body">
                      <div className="notif-title">{n.title}</div>
                      <div className="notif-msg">{n.msg}</div>
                      <div className="notif-time"><i className="ti ti-clock" /> {n.time}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="notif-foot" onClick={() => setNotifOpen(false)}>ปิด</div>
            </div>
          </div>
        </div>
      </div>

      <nav className="navbar">
        <div className="nav-left">
          <NavLink className="logo" to={session.role === 'admin' ? '/admin/dashboard' : '/home'}>
            <div className="logo-mark">CS</div>
            <div className="logo-text">
              <span className="lt1">CPSU ETMS</span>
              <span className="lt2">ระบบจัดการกิจกรรม &amp; การอบรม · คณะวิทยาศาสตร์</span>
            </div>
          </NavLink>
          <div className="nav-tabs">
            {tabs.map((t) => (
              <NavLink key={t.to} to={t.to} className={({ isActive }) => `nav-tab${isActive ? ' active' : ''}`}>
                <i className={`ti ${t.icon}`} /> {t.label}
              </NavLink>
            ))}
          </div>
        </div>
        <div className="nav-right">
          <div className="user-pill">
            <div className={`up-av ${session.role}`}>{initials(session.name)}</div>
            <div className="up-info">
              <span className="up-name">{session.name}</span>
              <span className="up-role"><span className={`role-tag ${session.role}`}>{ROLE_LABEL[session.role]}</span></span>
            </div>
          </div>
          <button className="btn-logout" title="ออกจากระบบ" onClick={handleLogout}><i className="ti ti-logout" /></button>
        </div>
      </nav>
    </>
  );
}
