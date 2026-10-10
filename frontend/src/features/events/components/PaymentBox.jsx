import React, { useRef, useState } from 'react';
import { useEvents } from '../../../hooks/useEvents';
import { formatBaht, parseMoney } from '../../../utils/money';
import { formatThaiDateTime, todayIso } from '../../../utils/dateFormat';
import { fileToDataUrl } from '../../../utils/fileToDataUrl';
import TimeInput from '../../../components/ui/TimeInput';
import ImageViewer from '../../../components/ui/ImageViewer';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';

// How each payment state reads, for both the payer and the organizer's roster.
export const PAYMENT_STATUS = {
  pending: { label: 'รอชำระเงิน', icon: 'ti-clock', cls: 'pending' },
  submitted: { label: 'ส่งสลิปแล้ว · รอตรวจสอบ', icon: 'ti-receipt', cls: 'submitted' },
  rejected: { label: 'สลิปไม่ผ่าน · รอส่งใหม่', icon: 'ti-alert-triangle', cls: 'rejected' },
  paid: { label: 'ชำระแล้ว', icon: 'ti-circle-check-filled', cls: 'paid' },
};

const SLIP_MAX_BYTES = 2 * 1024 * 1024;
const SLIP_TYPES = ['image/jpeg', 'image/png'];

/**
 * "I have paid" form: the transfer slip plus when and how much was
 * transferred, which is what the organizer checks the slip against.
 */
function SlipForm({ regId, fee, resend, onCancel }) {
  const { submitSlip } = useEvents();
  const inputRef = useRef(null);
  const [slip, setSlip] = useState(null);
  const [date, setDate] = useState(todayIso());
  const [time, setTime] = useState('');
  const [amountText, setAmountText] = useState(String(fee));
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const amount = parseMoney(amountText);

  async function pick(file) {
    if (!file) return;
    if (!SLIP_TYPES.includes(file.type)) { setError('สลิปต้องเป็นรูป JPG หรือ PNG'); return; }
    if (file.size > SLIP_MAX_BYTES) { setError(`ไฟล์มีขนาด ${(file.size / 1024 / 1024).toFixed(1)} MB · เกินขนาดสูงสุด 2 MB`); return; }
    setError('');
    setSlip(await fileToDataUrl(file));
  }

  function send(e) {
    e.preventDefault();
    if (!slip) { setError('กรุณาแนบรูปสลิปการโอนเงิน'); return; }
    if (!date || !time) { setError('กรุณาระบุวันที่และเวลาที่โอนตามสลิป'); return; }
    if (!(amount > 0)) { setError('กรุณาระบุจำนวนเงินที่โอน'); return; }
    setError('');
    setConfirmOpen(true);
  }

  async function confirmSend() {
    setSending(true);
    const ok = await submitSlip(regId, { slip, transferredAt: `${date}T${time}`, amount });
    setSending(false);
    setConfirmOpen(false);
    if (ok && onCancel) onCancel();
  }

  return (
    <form className="slip-form" onSubmit={send}>
      <div className="slip-form-title">{resend ? 'ส่งหลักฐานการชำระเงินใหม่' : 'แจ้งชำระเงิน'}</div>
      <input ref={inputRef} type="file" accept={SLIP_TYPES.join(',')} hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      <div className="slip-file">
        {slip ? (
          <>
            <button type="button" className="slip-thumb" onClick={() => setViewerOpen(true)} aria-label="ดูสลิปเต็มจอ"><img src={slip} alt="สลิปที่เลือก" /></button>
            <button type="button" className="btn btn-outline" onClick={() => inputRef.current?.click()}><i className="ti ti-replace" /> เปลี่ยนรูป</button>
          </>
        ) : (
          <button type="button" className="slip-pick" onClick={() => inputRef.current?.click()}>
            <i className="ti ti-photo-up" /> แนบรูปสลิปการโอนเงิน <small>JPG หรือ PNG · สูงสุด 2 MB</small>
          </button>
        )}
      </div>
      <div className="slip-fields">
        <label>วันที่โอน
          <input type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} />
        </label>
        <div className="slip-field">เวลาที่โอน
          <TimeInput compact value={time} onChange={setTime} placeholder="เลือกเวลา" aria-label="เวลาที่โอน" />
        </div>
        <label>จำนวนเงิน (บาท)
          <input type="text" inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value)} aria-invalid={Number.isNaN(amount)} />
        </label>
      </div>
      {error && <div className="slip-error" role="alert"><i className="ti ti-alert-circle" /> {error}</div>}
      <div className="slip-actions">
        {onCancel && <button type="button" className="btn btn-outline" onClick={onCancel} disabled={sending}>ยกเลิก</button>}
        <button type="submit" className="btn btn-primary" disabled={sending}><i className="ti ti-send" /> {sending ? 'กำลังส่ง...' : 'ส่งหลักฐานให้ผู้จัดตรวจสอบ'}</button>
      </div>
      <p className="slip-privacy"><i className="ti ti-lock" /> สลิปเห็นเฉพาะคุณและผู้จัดกิจกรรมนี้ · กรอกวันเวลาและยอดเงินให้ตรงกับสลิป</p>
      <ImageViewer open={viewerOpen} src={slip} title="สลิปการโอนเงิน" paper onClose={() => setViewerOpen(false)} />
      <ConfirmDialog
        open={confirmOpen}
        eyebrow="ยืนยันการส่งหลักฐาน"
        icon="ti-send"
        title="ส่งหลักฐานการชำระเงิน?"
        confirmLabel="ยืนยันส่ง"
        confirmIcon="ti-send"
        busy={sending}
        onConfirm={confirmSend}
        onCancel={() => setConfirmOpen(false)}
      >
        <p style={{ fontSize: 13.5, color: 'var(--c4-70)', lineHeight: 1.7 }}>
          ตรวจสอบให้ตรงกับสลิปก่อนส่ง<br />
          วันเวลาที่โอน: <strong style={{ color: 'var(--c4)' }}>{formatThaiDateTime(`${date}T${time}`)}</strong><br />
          จำนวนเงิน: <strong style={{ color: 'var(--c4)' }}>{formatBaht(amount)}</strong>
        </p>
      </ConfirmDialog>
    </form>
  );
}

/**
 * Registration fee and how to pay it. Payment is made outside the system
 * (transfer / PromptPay). Pass `reg` (the viewer's own registration) to show
 * their payment state and let them send or re-send a slip.
 */
export default function PaymentBox({ fee, info, reg }) {
  const [formOpen, setFormOpen] = useState(false);
  if (!(fee > 0)) return null;
  const status = reg?.paymentStatus && reg.paymentStatus !== 'none' ? reg.paymentStatus : null;
  const meta = status ? PAYMENT_STATUS[status] : null;
  const needsSlip = status === 'pending' || status === 'rejected';
  const showForm = reg && (needsSlip || formOpen) && status !== 'paid';

  return (
    <div className={`pay-box${status ? ` ${status}` : ''}`}>
      <div className="pay-head">
        <span className="pay-title"><i className="ti ti-cash" /> ค่าลงทะเบียน</span>
        <strong className="pay-amount">{formatBaht(fee)}</strong>
      </div>
      {meta && <div className={`pay-status ${meta.cls}`}><i className={`ti ${meta.icon}`} /> {status === 'paid' ? 'ผู้จัดยืนยันการชำระเงินของคุณแล้ว' : meta.label}</div>}
      {status === 'rejected' && reg.rejectReason && <div className="pay-reject">เหตุผลจากผู้จัด: {reg.rejectReason}</div>}
      {status === 'submitted' && (
        <div className="pay-declared">
          แจ้งโอน {formatBaht(reg.slipAmount)} เมื่อ {formatThaiDateTime(reg.slipTransferredAt)}
          {!formOpen && <button type="button" className="pay-link" onClick={() => setFormOpen(true)}>ส่งสลิปใหม่</button>}
        </div>
      )}
      {info && status !== 'paid' && (
        <>
          <div className="pay-sub">วิธีชำระเงิน</div>
          <p className="pay-info">{info}</p>
        </>
      )}
      {showForm && <SlipForm key={status} regId={reg.regId} fee={fee} resend={status !== 'pending'} onCancel={status === 'submitted' ? () => setFormOpen(false) : undefined} />}
    </div>
  );
}
