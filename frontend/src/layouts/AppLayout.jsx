import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import Navbar from '../components/common/Navbar';
import Toast from '../components/ui/Toast';
import { useEvents } from '../hooks/useEvents';
import { needsNames } from '../utils/personName';

// Frame shared by every signed-in page: navigation, the page itself, and toasts.
export default function AppLayout() {
  const { session } = useEvents();
  const { pathname } = useLocation();
  // Certificates and rosters print the title + Thai name: remind accounts
  // that lack them (e.g. made through Google) without blocking their work.
  const remind = session && session.title_th !== undefined && needsNames(session) && pathname !== '/profile';
  return (
    <div className="app-shell">
      <Navbar />
      <div className="page">
        {remind && (
          <div className="names-remind" role="status">
            <i className="ti ti-id-badge-2" />
            <span><strong>ยังไม่ได้กรอกคำนำหน้าและชื่อภาษาไทย</strong> · ใช้พิมพ์บนเกียรติบัตรและรายชื่อผู้เข้าร่วม</span>
            <Link to="/profile" className="btn btn-sm btn-primary">กรอกข้อมูล</Link>
          </div>
        )}
        <Outlet />
      </div>
      <Toast />
    </div>
  );
}
