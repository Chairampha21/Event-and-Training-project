import React, { useEffect } from 'react';

/**
 * Generic modal shell used by ApplicantsModal and inline page modals
 * (event detail, manage-event panel, evaluation, delete confirms, ...).
 */
export default function Modal({ open, onClose, size, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay open"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`modal ${size || ''}`}>{children}</div>
    </div>
  );
}

export function ModalHead({ eyebrow, icon, title, onClose }) {
  return (
    <div className="modal-head">
      <div>
        {eyebrow ? <div className="mh-eyebrow"><i className={`ti ${icon}`} /> {eyebrow}</div> : null}
        {title ? <h3>{title}</h3> : null}
      </div>
      <button className="mh-close" onClick={onClose}><i className="ti ti-x" /></button>
    </div>
  );
}
