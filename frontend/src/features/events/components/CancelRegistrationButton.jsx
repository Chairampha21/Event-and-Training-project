import React, { useState } from 'react';
import { useEvents } from '../../../hooks/useEvents';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { formatThaiDate, todayIso } from '../../../utils/dateFormat';

/**
 * Whether the student may still withdraw: the server says so with each
 * registration; if it did not (an older backend), the same rule is worked out
 * here from the event — registered, not checked in on any day, and
 * registration still open (up to its closing day, or before the event starts).
 * Returns { ok, regEnd }.
 */
export function cancelInfo(reg, ev) {
  const regEnd = (reg?.regEnd || ev?.regEnd || '').slice(0, 10);
  if (!reg) return { ok: false, regEnd };
  if (reg.canCancel !== null && reg.canCancel !== undefined) return { ok: reg.canCancel, regEnd };
  const today = todayIso();
  const open = regEnd ? today <= regEnd : !!reg.dateStart && today < reg.dateStart;
  return { ok: reg.status === 'registered' && !reg.daysAttended && open, regEnd };
}

/**
 * "Cancel my registration" for one of the student's own registrations (as
 * adapted in AppContext). Shown only while the server says it is allowed —
 * registration still open and not checked in — and always asked twice.
 */
export default function CancelRegistrationButton({ reg, className = 'btn btn-outline', onDone }) {
  const { cancelRegistration, evById } = useEvents();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const { ok, regEnd } = cancelInfo(reg, evById(reg?.eid));
  if (!ok) return null;

  async function confirm() {
    setBusy(true);
    const ok = await cancelRegistration(reg.regId, reg.title);
    setBusy(false);
    setAsking(false);
    if (ok && onDone) onDone();
  }

  return (
    <>
      <button type="button" className={className} onClick={() => setAsking(true)}>
        <i className="ti ti-user-x" /> ยกเลิกการสมัคร
      </button>
      <ConfirmDialog
        open={asking}
        eyebrow="ยืนยันการยกเลิก"
        icon="ti-user-x"
        title="ยกเลิกการสมัครกิจกรรมนี้?"
        confirmLabel="ยืนยันยกเลิกการสมัคร"
        confirmIcon="ti-user-x"
        busy={busy}
        onConfirm={confirm}
        onCancel={() => setAsking(false)}
      >
        <p style={{ fontSize: 13.5, color: 'var(--c4-70)', lineHeight: 1.7 }}>
          <strong style={{ color: 'var(--c4)' }}>{reg.title}</strong><br />
          ที่นั่งของคุณจะถูกคืนให้ผู้อื่น{reg.wantsLaptop ? ' และโน้ตบุ๊กที่จองไว้จะถูกคืนด้วย' : ''}
          {regEnd ? ` · สมัครใหม่ได้ถ้ายังไม่เต็มและยังอยู่ในช่วงรับสมัคร (ถึง ${formatThaiDate(regEnd)})` : ''}
          {reg.paymentStatus === 'paid' || reg.paymentStatus === 'submitted' ? ' · ค่าลงทะเบียนที่โอนแล้ว ติดต่อผู้จัดกิจกรรมเรื่องการคืนเงิน' : ''}
        </p>
      </ConfirmDialog>
    </>
  );
}
