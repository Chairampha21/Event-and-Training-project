import React from 'react';
import { useEvents } from '../hooks/useEvents';
import './Toast.css';

export default function Toast() {
  const { toasts } = useEvents();
  return (
    <div id="toast-wrap">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>
          <div className="t-icon">
            <i className={`ti ${t.type === 'warn' ? 'ti-alert-triangle' : 'ti-circle-check'}`} />
          </div>
          <div className="t-body">
            <strong>{t.title}</strong>
            {t.msg ? <span>{t.msg}</span> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
