import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEvents } from '../../hooks/useEvents';
import './Toast.css';

// A new bell notification, popping up under the bell. It counts down by
// itself and leaves; the countdown stops while the pointer (or keyboard focus)
// is on it, so a message being read does not vanish. It shows the
// notification's own icon, a close button and the time left, and opens where
// the notification leads. (Results of actions are SweetAlert pop-ups — utils/alert.)
function ToastItem({ t }) {
  const { dismissToast, markNotifRead } = useEvents();
  const navigate = useNavigate();
  const [paused, setPaused] = useState(false);
  const left = useRef(t.duration);
  const startedAt = useRef(0);

  useEffect(() => {
    if (paused) return undefined;
    startedAt.current = Date.now();
    const timer = setTimeout(() => dismissToast(t.id), left.current);
    return () => {
      clearTimeout(timer);
      left.current = Math.max(800, left.current - (Date.now() - startedAt.current));
    };
  }, [paused, t.id, dismissToast]);

  function open() {
    if (t.notifId) markNotifRead(t.notifId);
    dismissToast(t.id);
    if (t.link) navigate(t.link);
  }

  const hold = { onMouseEnter: () => setPaused(true), onMouseLeave: () => setPaused(false), onFocus: () => setPaused(true), onBlur: () => setPaused(false) };
  const icon = t.icon || 'ti-bell';

  return (
    <div className={`toast notif${paused ? ' paused' : ''}`} {...hold}>
      <button type="button" className="t-main" onClick={open} disabled={!t.link && !t.notifId}>
        <div className={`t-icon ${t.tone || ''}`}><i className={`ti ${icon}`} /></div>
        <div className="t-body">
          <em>การแจ้งเตือนใหม่</em>
          <strong>{t.title}</strong>
          {t.msg ? <span>{t.msg}</span> : null}
          {t.link ? <small>กดเพื่อเปิดดู <i className="ti ti-chevron-right" /></small> : null}
        </div>
      </button>
      <button type="button" className="t-close" onClick={() => dismissToast(t.id)} aria-label="ปิดการแจ้งเตือนนี้"><i className="ti ti-x" /></button>
      <div className="t-bar" style={{ animationDuration: `${t.duration}ms` }} />
    </div>
  );
}

export default function Toast() {
  const { toasts } = useEvents();
  return (
    // The region exists before any message does, so screen readers announce what is added.
    <div id="toast-wrap-top" role="status" aria-live="polite">
      {toasts.map((t) => <ToastItem key={t.id} t={t} />)}
    </div>
  );
}
