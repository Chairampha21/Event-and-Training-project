import React, { useRef, useState } from 'react';
import { useEvents } from '../../../hooks/useEvents';
import { formatBaht, parseMoney } from '../../../utils/money';
import { formatThaiDateTime, todayIso } from '../../../utils/dateFormat';
import { fileToDataUrl } from '../../../utils/fileToDataUrl';
import TimeInput from '../../../components/ui/TimeInput';
import DateInput from '../../../components/ui/DateInput';
import ImageViewer from '../../../components/ui/ImageViewer';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';

// How each payment state reads, for both the payer and the organizer's roster.
export const PAYMENT_STATUS = {
  pending: { label: 'รอชำระเงิน', icon: 'ti-clock', cls: 'pending' },
  submitted: { label: 'ส่งสลิปแล้ว · รอตรวจสอบ', icon: 'ti-receipt', cls: 'submitted' },
  rejected: { label: 'สลิปไม่ผ่าน · รอส่งใหม่', icon: 'ti-alert-triangle', cls: 'rejected' },
  paid: { label: 'ชำระแล้ว', icon: 'ti-circle-check-filled', cls: 'paid' },
  refunded: { label: 'คืนเงินแล้ว', icon: 'ti-receipt-refund', cls: 'refunded' },
};

// How paid money is given back — chosen with the fee, editable later.
export const REFUND_METHODS = {
  none: { label: 'ไม่คืนเงิน', icon: 'ti-ban', hint: 'ค่าลงทะเบียนทั่วไป ไม่คืนเมื่อผู้สมัครยกเลิกหรือไม่มาร่วม' },
  department: { label: 'รับคืนที่ภาควิชา', icon: 'ti-building', hint: 'เช่น เงินมัดจำ คืนเป็นเงินสดตอนลงทะเบียนหน้างาน' },
  transfer: { label: 'โอนคืนทางพร้อมเพย์', icon: 'ti-arrows-exchange', hint: 'ผู้สมัครกรอกพร้อมเพย์สำหรับรับเงินคืนตอนส่งสลิป' },
};

// "08x-xxx-xxxx" / "x-xxxx-xxxxx-xx-x" for display; anything else as it is.
export function formatPromptPay(d) {
  if (/^0\d{9}$/.test(d)) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  if (/^\d{13}$/.test(d)) return `${d[0]}-${d.slice(1, 5)}-${d.slice(5, 10)}-${d.slice(10, 12)}-${d[12]}`;
  return d;
}

// A mobile number (10 digits from 0) or a citizen ID (13 digits); spaces and dashes are fine.
export function validPromptPay(s) {
  const d = (s || '').replace(/[\s-]/g, '');
  return /^0\d{9}$/.test(d) || /^\d{13}$/.test(d);
}

const SLIP_MAX_BYTES = 2 * 1024 * 1024;
const SLIP_TYPES = ['image/jpeg', 'image/png'];

/**
 * "I have paid" form: the transfer slip plus when and how much was
 * transferred, which is what the organizer checks the slip against.
 */
/** A blank slip form for a fee of `fee` baht. */
export const emptySlip = (fee, promptPay = '') => ({ slip: null, date: todayIso(), time: '', amountText: String(fee || ''), promptPay });

/** What is still missing from a slip form, or '' when it can be sent. */
export function slipProblem(v, askPromptPay) {
  if (!v.slip) return 'กรุณาแนบรูปสลิปการโอนเงิน';
  if (!v.date || !v.time) return 'กรุณาระบุวันที่และเวลาที่โอนตามสลิป';
  if (!(parseMoney(v.amountText) > 0)) return 'กรุณาระบุจำนวนเงินที่โอน';
  if (askPromptPay && !validPromptPay(v.promptPay)) return 'กรอกพร้อมเพย์สำหรับรับเงินคืน: เบอร์มือถือ 10 หลัก หรือเลขประจำตัวประชาชน 13 หลัก';
  return '';
}

/** The slip form as submitSlip takes it. */
export const slipPayload = (v, askPromptPay) => ({
  slip: v.slip, transferredAt: `${v.date}T${v.time}`, amount: parseMoney(v.amountText), refundPromptPay: askPromptPay ? v.promptPay : '',
});

/**
 * The slip, when and how much was transferred (and, for refunds by transfer,
 * the payer's PromptPay): used to report a payment later and while registering.
 */
export function SlipFields({ value, onChange, askPromptPay, onError }) {
  const inputRef = useRef(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const set = (patch) => onChange({ ...value, ...patch });
  const amount = parseMoney(value.amountText);

  async function pick(file) {
    if (!file) return;
    if (!SLIP_TYPES.includes(file.type)) { onError?.('สลิปต้องเป็นรูป JPG หรือ PNG'); return; }
    if (file.size > SLIP_MAX_BYTES) { onError?.(`ไฟล์มีขนาด ${(file.size / 1024 / 1024).toFixed(1)} MB · เกินขนาดสูงสุด 2 MB`); return; }
    onError?.('');
    set({ slip: await fileToDataUrl(file) });
  }

  return (
    <>
      <input ref={inputRef} type="file" accept={SLIP_TYPES.join(',')} hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      <div className="slip-file">
        {value.slip ? (
          <>
            <button type="button" className="slip-thumb" onClick={() => setViewerOpen(true)} aria-label="ดูสลิปเต็มจอ"><img src={value.slip} alt="สลิปที่เลือก" /></button>
            <button type="button" className="btn btn-outline" onClick={() => inputRef.current?.click()}><i className="ti ti-replace" /> เปลี่ยนรูป</button>
          </>
        ) : (
          <button type="button" className="slip-pick" onClick={() => inputRef.current?.click()}>
            <i className="ti ti-photo-up" /> แนบรูปสลิปการโอนเงิน <small>JPG หรือ PNG · สูงสุด 2 MB</small>
          </button>
        )}
      </div>
      <div className="slip-fields">
        <div className="slip-field">วันที่โอน
          <DateInput value={value.date} max={todayIso()} onChange={(d) => set({ date: d })} aria-label="วันที่โอน" />
        </div>
        <div className="slip-field">เวลาที่โอน
          <TimeInput compact minuteStep={1} value={value.time} onChange={(t) => set({ time: t })} placeholder="เลือกเวลา" aria-label="เวลาที่โอน" />
        </div>
        <label>จำนวนเงิน (บาท)
          <input type="text" inputMode="decimal" value={value.amountText} onChange={(e) => set({ amountText: e.target.value })} aria-invalid={Number.isNaN(amount)} />
        </label>
        {askPromptPay && (
          <label className="slip-wide">พร้อมเพย์สำหรับรับเงินคืน
            <input type="text" inputMode="numeric" value={value.promptPay} maxLength={17} onChange={(e) => set({ promptPay: e.target.value })} placeholder="เบอร์มือถือ หรือเลขประจำตัวประชาชน" />
          </label>
        )}
      </div>
      <ImageViewer open={viewerOpen} src={value.slip} title="สลิปการโอนเงิน" paper onClose={() => setViewerOpen(false)} />
    </>
  );
}

/** What a slip form says, for a confirmation box. */
export function SlipSummary({ value, askPromptPay }) {
  return (
    <>
      วันเวลาที่โอน: <strong style={{ color: 'var(--c4)' }}>{formatThaiDateTime(`${value.date}T${value.time}`)}</strong><br />
      จำนวนเงิน: <strong style={{ color: 'var(--c4)' }}>{formatBaht(parseMoney(value.amountText))}</strong>
      {askPromptPay && <><br />พร้อมเพย์รับเงินคืน: <strong style={{ color: 'var(--c4)' }}>{formatPromptPay(value.promptPay.replace(/[\s-]/g, ''))}</strong></>}
    </>
  );
}

function SlipForm({ regId, fee, resend, onCancel, askPromptPay, promptPayNow }) {
  const { submitSlip } = useEvents();
  const [form, setForm] = useState(() => emptySlip(fee, promptPayNow || ''));
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function send(e) {
    e.preventDefault();
    const problem = slipProblem(form, askPromptPay);
    setError(problem);
    if (!problem) setConfirmOpen(true);
  }

  async function confirmSend() {
    setSending(true);
    const ok = await submitSlip(regId, slipPayload(form, askPromptPay));
    setSending(false);
    setConfirmOpen(false);
    if (ok && onCancel) onCancel();
  }

  return (
    <form className="slip-form" onSubmit={send}>
      <div className="slip-form-title">{resend ? 'ส่งหลักฐานการชำระเงินใหม่' : 'แจ้งชำระเงิน'}</div>
      <SlipFields value={form} onChange={setForm} askPromptPay={askPromptPay} onError={setError} />
      {error && <div className="slip-error" role="alert"><i className="ti ti-alert-circle" /> {error}</div>}
      <div className="slip-actions">
        {onCancel && <button type="button" className="btn btn-outline" onClick={onCancel} disabled={sending}>ยกเลิก</button>}
        <button type="submit" className="btn btn-primary" disabled={sending}><i className="ti ti-send" /> {sending ? 'กำลังส่ง...' : 'ส่งหลักฐานให้ผู้จัดตรวจสอบ'}</button>
      </div>
      <p className="slip-privacy"><i className="ti ti-lock" /> สลิปเห็นเฉพาะคุณและผู้จัดกิจกรรมนี้ · กรอกวันเวลาและยอดเงินให้ตรงกับสลิป</p>
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
          <SlipSummary value={form} askPromptPay={askPromptPay} />
        </p>
      </ConfirmDialog>
    </form>
  );
}

/**
 * Where a transfer refund should go: shown to the payer with a way to give or
 * correct it (needed when the organizer switched to refunding by transfer
 * after they had paid).
 */
function RefundAccount({ reg }) {
  const { setRefundAccount } = useEvents();
  const [editing, setEditing] = useState(!reg.refundPromptPay);
  const [value, setValue] = useState(reg.refundPromptPay || '');
  const [saving, setSaving] = useState(false);
  const invalid = value.trim() !== '' && !validPromptPay(value);

  async function save(e) {
    e.preventDefault();
    if (!validPromptPay(value)) return;
    setSaving(true);
    const ok = await setRefundAccount(reg.regId, value.replace(/[\s-]/g, ''));
    setSaving(false);
    if (ok) setEditing(false);
  }

  if (!editing) {
    return (
      <div className="pay-refund-acc">
        <i className="ti ti-device-mobile" /> รับเงินคืนทางพร้อมเพย์ <strong>{formatPromptPay(reg.refundPromptPay)}</strong>
        <button type="button" className="pay-link" onClick={() => setEditing(true)}>แก้ไข</button>
      </div>
    );
  }
  return (
    <form className="pay-refund-form" onSubmit={save}>
      <label htmlFor={`refund-pp-${reg.regId}`}>{reg.refundPromptPay ? 'แก้ไขพร้อมเพย์สำหรับรับเงินคืน' : 'กรอกพร้อมเพย์สำหรับรับเงินคืน'}</label>
      <div className="pay-refund-row">
        <input id={`refund-pp-${reg.regId}`} type="text" inputMode="numeric" maxLength={17} value={value} onChange={(e) => setValue(e.target.value)} placeholder="เบอร์มือถือ หรือเลขประจำตัวประชาชน" aria-invalid={invalid} />
        <button type="submit" className="btn btn-primary" disabled={saving || !validPromptPay(value)}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</button>
        {reg.refundPromptPay && <button type="button" className="btn btn-outline" onClick={() => { setValue(reg.refundPromptPay); setEditing(false); }}>ยกเลิก</button>}
      </div>
      {invalid && <span className="slip-error"><i className="ti ti-alert-circle" /> เบอร์มือถือ 10 หลัก หรือเลขประจำตัวประชาชน 13 หลัก</span>}
    </form>
  );
}

/**
 * Registration fee and how to pay it. Payment is made outside the system
 * (transfer / PromptPay). Pass `reg` (the viewer's own registration) to show
 * their payment state and let them send or re-send a slip. `refundMethod` /
 * `refundNote` say how the money comes back; `cancelled` = the event was
 * called off, so whoever paid is refunded whatever the method says.
 */
// children: shown at the bottom of the box (the slip form while registering).
export default function PaymentBox({ fee, info, reg, refundMethod = 'none', refundNote = '', cancelled = false, children }) {
  const [formOpen, setFormOpen] = useState(false);
  if (!(fee > 0)) return null;
  const status = reg?.paymentStatus && reg.paymentStatus !== 'none' ? reg.paymentStatus : null;
  const meta = status ? PAYMENT_STATUS[status] : null;
  const needsSlip = !cancelled && (status === 'pending' || status === 'rejected');
  const showForm = reg && !cancelled && (needsSlip || formOpen) && status !== 'paid' && status !== 'refunded';
  const held = status === 'paid' || status === 'submitted';
  const refund = REFUND_METHODS[refundMethod] || REFUND_METHODS.none;
  const transfer = refundMethod === 'transfer';

  return (
    <div className={`pay-box${status ? ` ${status}` : ''}`}>
      <div className="pay-head">
        <span className="pay-title"><i className="ti ti-cash" /> ค่าลงทะเบียน</span>
        <strong className="pay-amount">{formatBaht(fee)}</strong>
      </div>
      {meta && (
        <div className={`pay-status ${meta.cls}`}>
          <i className={`ti ${meta.icon}`} />{' '}
          {status === 'paid' ? 'ผู้จัดยืนยันการชำระเงินของคุณแล้ว'
            : status === 'refunded' ? `ผู้จัดคืนเงินให้คุณแล้ว${reg.refundedAt ? ` เมื่อ ${formatThaiDateTime(reg.refundedAt)}` : ''}`
              : meta.label}
        </div>
      )}
      {status === 'rejected' && reg.rejectReason && <div className="pay-reject">เหตุผลจากผู้จัด: {reg.rejectReason}</div>}
      {status === 'submitted' && (
        <div className="pay-declared">
          แจ้งโอน {formatBaht(reg.slipAmount)} เมื่อ {formatThaiDateTime(reg.slipTransferredAt)}
          {!formOpen && !cancelled && <button type="button" className="pay-link" onClick={() => setFormOpen(true)}>ส่งสลิปใหม่</button>}
        </div>
      )}
      {(refundMethod !== 'none' || (cancelled && held)) && status !== 'refunded' && (
        <div className={`pay-refund${cancelled && held ? ' due' : ''}`}>
          <i className={`ti ${cancelled && held ? 'ti-receipt-refund' : refund.icon}`} />
          <span>
            <strong>{cancelled && held ? `กิจกรรมถูกยกเลิก · คุณจะได้รับเงินคืน (${refund.label})` : `การคืนเงิน: ${refund.label}`}</strong>
            {refundNote && <small>{refundNote}</small>}
          </span>
        </div>
      )}
      {reg && transfer && held && !showForm && <RefundAccount key={reg.refundPromptPay} reg={reg} />}
      {info && !cancelled && status !== 'paid' && status !== 'refunded' && (
        <>
          <div className="pay-sub">วิธีชำระเงิน</div>
          <p className="pay-info">{info}</p>
        </>
      )}
      {showForm && (
        <SlipForm key={status} regId={reg.regId} fee={fee} resend={status !== 'pending'}
          askPromptPay={transfer} promptPayNow={reg.refundPromptPay}
          onCancel={status === 'submitted' ? () => setFormOpen(false) : undefined} />
      )}
      {children}
    </div>
  );
}
