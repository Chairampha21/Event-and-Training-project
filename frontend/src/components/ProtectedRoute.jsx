import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useEvents } from '../hooks/useEvents';
import { ROLE_LANDING } from '../utils/constants';

/**
 * Guards a route subtree: requires a logged-in session, and optionally
 * restricts to a set of roles (redirecting elsewhere if the role doesn't match).
 */
export default function ProtectedRoute({ roles }) {
  const { session } = useEvents();

  if (!session) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(session.role)) return <Navigate to={ROLE_LANDING[session.role]} replace />;

  return <Outlet />;
}
