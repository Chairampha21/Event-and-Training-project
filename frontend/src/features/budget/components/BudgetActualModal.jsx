import React, { useEffect, useState } from 'react';
import Modal, { ModalHead } from '../../../components/ui/Modal';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { formatBaht, parseMoney } from '../../../utils/money';

/**
 * Records what an event actually cost, after it has finished. `event` needs
 * {id, title, budgetPlanned, budgetActual}; onSave(amount|null) does the write
 * and resolves truthy on success.
 */
export default function BudgetActualModal({ open, event, onSave, onClose }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  // 'save' | 'clear' while the "are you sure?" step is showing, else null.
  const [confirming, setConfirming] = useState(null);

  useEffect(() => {
    if (open) {
      setText(event?.budgetActual != null ? String(event.budgetActual) : '');
      setError('');
      setConfirming(null);
    }
  }, [open, event?.id, event?.budgetActual]);

  if (!open || !event) return null;

  const amount = parseMoney(text);
  const planned = event.budgetPlanned;
  const hasPlan = planned != null;
  const valid = amount !== null && !Number.isNaN(amount);
  const diff = hasPlan && valid ? planned - amount : null;

  function submit(e) {
    e.preventDefault();
    if (amount === null) { setError('กรุณากรอกงบประมาณที่ใช้จริง'); return; }
    if (Number.isNaN(amount)) { setError('กรอกเป็นตัวเลข ไม่ติดลบ และทศนิยมไม่เกิน 2 ตำแหน่ง'); return; }
    setConfirming('save');
  }

  async function confirmed() {
    setSaving(true);
    const ok = await onSave(confirming === 'clear' ? null : amount);
    setSaving(false);
    if (ok) onClose();
    else setConfirming(null);
  }

  if (confirming) {
    const clearing = confirming === 'clear';
    return (
      <ConfirmDialog
        open
        eyebrow={clearing ? 'ยืนยันการล้างค่า' : 'ยืนยันการบันทึก'}
        icon={clearing ? 'ti-eraser' : 'ti-device-floppy'}
        title={clearing ? 'ล้างงบประมาณที่ใช้จริง?' : 'บันทึกงบประมาณที่ใช้จริง?'}
        confirmLabel={clearing ? 'ยืนยันล้างค่า' : 'ยืนยันบันทึก'}
        confirmIcon={clearing ? 'ti-eraser' : 'ti-device-floppy'}
        busy={saving}
        onConfirm={confirmed}
        onCancel={() => setConfirming(null)}
      >
        <p style={{ fontSize: 13.5, color: 'var(--c4-70)', lineHeight: 1.7 }}>
          <strong style={{ color: 'var(--c4)' }}>{event.title}</strong><br />
          งบประมาณ: {hasPlan ? formatBaht(planned) : 'ยังไม่ได้ตั้งงบประมาณ'}<br />
          {clearing ? (
            <>งบประมาณที่ใช้จริงที่บันทึกไว้ <strong style={{ color: 'var(--c4)' }}>{formatBaht(event.budgetActual)}</strong> จะถูกลบออก</>
          ) : (
            <>งบประมาณที่ใช้จริง: <strong style={{ color: 'var(--c4)' }}>{formatBaht(amount)}</strong></>
          )}
        </p>
        {!clearing && diff !== null && (
          <span className={`budget-diff ${diff < 0 ? 'over' : 'under'}`}>
            <i className={`ti ${diff < 0 ? 'ti-alert-triangle' : 'ti-circle-check'}`} />
            {diff < 0 ? `เกินงบประมาณ ${formatBaht(-diff)}` : diff === 0 ? 'ใช้พอดีงบประมาณ' : `ต่ำกว่างบประมาณ ${formatBaht(diff)}`}
          </span>
        )}
      </ConfirmDialog>
    );
  }

  return (
    <Modal open={open} onClose={onClose} size="sm">
      <ModalHead eyebrow="งบประมาณ" icon="ti-receipt-2" title="บันทึกงบประมาณที่ใช้จริง" onClose={onClose} />
      <form onSubmit={submit}>
        <div className="modal-body">
          <p style={{ fontSize: 13.5, color: 'var(--c4-70)', lineHeight: 1.6, marginBottom: 14 }}>
            <strong style={{ color: 'var(--c4)' }}>{event.title}</strong><br />
            งบประมาณ: {hasPlan ? formatBaht(planned) : 'ยังไม่ได้ตั้งงบประมาณ'}
          </p>
          <div className="field">
            <label htmlFor="budget-actual-input">งบประมาณที่ใช้จริง (บาท) <span className="req">*</span></label>
            <div className="with-icon">
              <i className="ti ti-currency-baht" />
              <input
                id="budget-actual-input"
                type="text"
                inputMode="decimal"
                autoFocus
                value={text}
                onChange={(e) => { setText(e.target.value); setError(''); }}
                placeholder="เช่น 12500"
                aria-invalid={!!error}
              />
            </div>
            {error && <span className="helper" role="alert" style={{ color: '#b91c1c', fontWeight: 600 }}>{error}</span>}
            {!error && diff !== null && (
              <span className={`budget-diff ${diff < 0 ? 'over' : 'under'}`}>
                <i className={`ti ${diff < 0 ? 'ti-alert-triangle' : 'ti-circle-check'}`} />
                {diff < 0 ? `เกินงบประมาณ ${formatBaht(-diff)}` : diff === 0 ? 'ใช้พอดีงบประมาณ' : `ต่ำกว่างบประมาณ ${formatBaht(diff)}`}
              </span>
            )}
          </div>
        </div>
        <div className="modal-foot">
          {event.budgetActual != null && (
            <button type="button" className="btn btn-ghost" style={{ marginRight: 'auto' }} onClick={() => setConfirming('clear')}><i className="ti ti-eraser" /> ล้างค่า</button>
          )}
          <button type="button" className="btn btn-outline" onClick={onClose}>ยกเลิก</button>
          <button type="submit" className="btn btn-primary"><i className="ti ti-device-floppy" /> บันทึก</button>
        </div>
      </form>
    </Modal>
  );
}
