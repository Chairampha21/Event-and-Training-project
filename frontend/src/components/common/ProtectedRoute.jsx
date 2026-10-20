import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useEvents } from '../../hooks/useEvents';
import { ROLE_LANDING } from '../../utils/constants';
import { needsNames } from '../../utils/personName';

/**
 * Guards a route subtree: requires a logged-in session, and optionally
 * restricts to a set of roles (redirecting elsewhere if the role doesn't match).
 */
export default function ProtectedRoute({ roles }) {
  const { session } = useEvents();
  const location = useLocation();

  // Remember where the person was going (e.g. a check-in link opened while
  // signed out) so signing in takes them there instead of to the home page.
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (roles && !roles.includes(session.role)) return <Navigate to={ROLE_LANDING[session.role]} replace />;
  // Certificates need the title and Thai name: until the account has them
  // (e.g. made through Google, with an English name), the profile comes first.
  if (session.title_th !== undefined && needsNames(session) && location.pathname !== '/profile') return <Navigate to="/profile" replace state={{ needNames: true }} />;

  return <Outlet />;
}
