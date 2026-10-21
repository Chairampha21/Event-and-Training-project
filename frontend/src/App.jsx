import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { useEvents } from './hooks/useEvents';
import { ROLE_LANDING, PARTICIPANT_ROLES } from './utils/constants';
import AppLayout from './layouts/AppLayout';
import NotFound from './components/common/NotFound';
import ProtectedRoute from './components/common/ProtectedRoute';

import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import HomePage from './pages/student/HomePage';
import MyRegistrationsPage from './pages/student/MyRegistrationsPage';
import EvaluationFormPage from './pages/student/EvaluationFormPage';
import CertificatesPage from './pages/student/CertificatesPage';
import SelfCheckinPage from './pages/student/SelfCheckinPage';
import CreateEventPage from './pages/organizer/CreateEventPage';
import EventsTablePage from './pages/organizer/EventsTablePage';
import ReportPage from './pages/organizer/ReportPage';
import CoordinatedEventsPage from './pages/teacher/CoordinatedEventsPage';
import DashboardPage from './pages/admin/DashboardPage';
import ActivityLogPage from './pages/admin/ActivityLogPage';
import BlacklistPage from './pages/admin/BlacklistPage';
import SarReportPage from './pages/admin/SarReportPage';
import EvaluationsPage from './pages/admin/EvaluationsPage';
import UsersPage from './pages/admin/UsersPage';
import CertificateSettingsPage from './pages/admin/CertificateSettingsPage';

import './App.css';

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
        <Route element={<ProtectedRoute roles={[...PARTICIPANT_ROLES, 'organizer', 'admin']} />}>
          <Route path="/home" element={<HomePage />} />
        </Route>
        <Route element={<ProtectedRoute roles={PARTICIPANT_ROLES} />}>
          <Route path="/my-registrations" element={<MyRegistrationsPage />} />
          <Route path="/certificates" element={<CertificatesPage />} />
          <Route path="/evaluate/:eventId" element={<EvaluationFormPage />} />
          <Route path="/checkin/:eventId" element={<SelfCheckinPage />} />
        </Route>
        <Route element={<ProtectedRoute roles={['organizer', 'admin']} />}>
          <Route path="/create-event" element={<CreateEventPage />} />
          <Route path="/events" element={<EventsTablePage />} />
          <Route path="/admin/dashboard" element={<DashboardPage />} />
          <Route path="/admin/blacklist" element={<BlacklistPage />} />
        </Route>
        <Route element={<ProtectedRoute roles={['organizer', 'admin']} />}>
          <Route path="/admin/evaluations" element={<EvaluationsPage />} />
          <Route path="/admin/sar" element={<SarReportPage />} />
        </Route>
        {/* A teacher reads the reports of the events they coordinate. */}
        <Route element={<ProtectedRoute roles={['organizer', 'admin', 'teacher']} />}>
          <Route path="/report" element={<ReportPage />} />
        </Route>
        <Route element={<ProtectedRoute roles={['teacher']} />}>
          <Route path="/coordinated" element={<CoordinatedEventsPage />} />
        </Route>
        <Route element={<ProtectedRoute roles={['admin']} />}>
          <Route path="/admin/users" element={<UsersPage />} />
          <Route path="/admin/activity-log" element={<ActivityLogPage />} />
          <Route path="/admin/certificate" element={<CertificateSettingsPage />} />
        </Route>
        <Route element={<ProtectedRoute roles={[...PARTICIPANT_ROLES, 'organizer', 'admin']} />}>
          <Route path="/profile" element={<ProfilePage />} />
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
