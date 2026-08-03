import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AppProvider, useEvents } from './hooks/useEvents';
import { ROLE_LANDING } from './utils/constants';
import Navbar from './components/Navbar';
import Toast from './components/Toast';
import NotFound from './components/NotFound';
import ProtectedRoute from './components/ProtectedRoute';

import LoginPage from './pages/LoginPage';
import HomePage from './pages/student/HomePage';
import MyRegistrationsPage from './pages/student/MyRegistrationsPage';
import EvaluationFormPage from './pages/student/EvaluationFormPage';
import CertificatesPage from './pages/student/CertificatesPage';
import CreateEventPage from './pages/organizer/CreateEventPage';
import EventsTablePage from './pages/organizer/EventsTablePage';
import ReportPage from './pages/organizer/ReportPage';
import DashboardPage from './pages/admin/DashboardPage';
import BlacklistPage from './pages/admin/BlacklistPage';
import SarReportPage from './pages/admin/SarReportPage';
import EvaluationsPage from './pages/admin/EvaluationsPage';
import UsersPage from './pages/admin/UsersPage';

import './App.css';

function AppLayout() {
  return (
    <>
      <Navbar />
      <div className="page">
        <Outlet />
      </div>
      <Toast />
    </>
  );
}

function RootRedirect() {
  const { session } = useEvents();
  return <Navigate to={session ? ROLE_LANDING[session.role] : '/login'} replace />;
}

function Routed() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RootRedirect />} />

      <Route element={<AppLayout />}>
        <Route element={<ProtectedRoute roles={['student', 'organizer']} />}>
          <Route path="/home" element={<HomePage />} />
        </Route>
        <Route element={<ProtectedRoute roles={['student']} />}>
          <Route path="/my-registrations" element={<MyRegistrationsPage />} />
          <Route path="/certificates" element={<CertificatesPage />} />
          <Route path="/evaluate/:eventId" element={<EvaluationFormPage />} />
        </Route>
        <Route element={<ProtectedRoute roles={['organizer', 'admin']} />}>
          <Route path="/create-event" element={<CreateEventPage />} />
          <Route path="/events" element={<EventsTablePage />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/admin/dashboard" element={<DashboardPage />} />
          <Route path="/admin/blacklist" element={<BlacklistPage />} />
        </Route>
        <Route element={<ProtectedRoute roles={['organizer']} />}>
          <Route path="/admin/evaluations" element={<EvaluationsPage />} />
          <Route path="/admin/sar" element={<SarReportPage />} />
        </Route>
        <Route element={<ProtectedRoute roles={['admin']} />}>
          <Route path="/admin/users" element={<UsersPage />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Routed />
      </AppProvider>
    </BrowserRouter>
  );
}
