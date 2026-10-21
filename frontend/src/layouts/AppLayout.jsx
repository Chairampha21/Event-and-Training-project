import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../components/common/Navbar';
import Toast from '../components/ui/Toast';

// Frame shared by every signed-in page: navigation, the page itself, and toasts.
export default function AppLayout() {
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
