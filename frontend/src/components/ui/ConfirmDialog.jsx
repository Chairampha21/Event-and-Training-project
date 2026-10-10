import React from 'react';
import { createPortal } from 'react-dom';
import Modal, { ModalHead } from './Modal';

/**
 * "Are you sure?" step before a save or publish. `children` is the body —
 * ideally what is about to change, so the user confirms something specific.
 * Rendered at <body>, so it can be opened from inside another modal or a form.
 */
export default function ConfirmDialog({ open, eyebrow = 'ยืนยัน', icon = 'ti-help-circle', title, confirmLabel = 'ยืนยัน', confirmIcon = 'ti-check', busy, size = 'sm', onConfirm, onCancel, children }) {
  if (!open) return null;
  return createPortal(
    <Modal open onClose={onCancel} size={size}>
      <ModalHead eyebrow={eyebrow} icon={icon} title={title} onClose={onCancel} />
      <div className="modal-body">{children}</div>
      <div className="modal-foot">
        <button type="button" className="btn btn-outline" onClick={onCancel} disabled={busy}>ยกเลิก</button>
        <button type="button" className="btn btn-primary" onClick={onConfirm} disabled={busy} autoFocus>
          <i className={`ti ${confirmIcon}`} /> {busy ? 'กำลังบันทึก...' : confirmLabel}
        </button>
      </div>
    </Modal>,
    document.body,
  );
}
