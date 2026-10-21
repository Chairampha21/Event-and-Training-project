import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from '../components/common/Navbar';
import Toast from '../components/ui/Toast';

// Frame shared by every signed-in page: navigation, the page itself, and toasts.
export default function AppLayout() {
  // Going to another page starts at its top, not where the last one was scrolled to.
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  return (
    <div className="app-shell">
      <Navbar />
      <div className="page">
        <Outlet />
      </div>
      <Toast />
    </div>
  );
}
