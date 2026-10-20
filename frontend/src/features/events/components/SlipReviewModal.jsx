import React, { useEffect, useState } from 'react';
import { useEvents } from '../../../hooks/useEvents';
import Modal, { ModalHead } from '../../../components/ui/Modal';
import ImageViewer from '../../../components/ui/ImageViewer';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { formatBaht } from '../../../utils/money';
import { formatThaiDateTime } from '../../../utils/dateFormat';
import { PAYMENT_STATUS } from './PaymentBox';

/**
 * Organizer's check of one registrant's payment: the slip they sent beside
 * the date, time and amount they declared and the fee due — then confirm,
 * reject with a reason (the payer is told and can send another), or undo.
 * `person` is a roster row; `onAction(action, reason)` performs the verdict.
 */
// Reasons a slip is turned down most often — one press fills the box.
const REJECT_REASONS = ['ยอดเงินไม่ตรงกับค่าลงทะเบียน', 'สลิปไม่ชัด อ่านข้อมูลไม่ได้', 'ชื่อบัญชีผู้รับไม่ตรง', 'ไม่พบรายการเงินเข้าในบัญชี', 'สลิปซ้ำกับที่ผู้อื่นส่งมา'];

// One line of the check list: 'good' / 'bad' were checked by the system, 'manual' is for the organizer to look at.
function CheckItem({ state, children }) {
  const icon = state === 'good' ? 'ti-circle-check' : state === 'bad' ? 'ti-alert-triangle' : 'ti-eye';
  return <li className={`slip-check-item ${state}`}><i className={`ti ${icon}`} /><span>{children}</span></li>;
}

export default function SlipReviewModal({ open, person, fee, remaining = 0, onAction, onClose }) {
  const { getSlip } = useEvents();
  const [slip, setSlip] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetAsk, setResetAsk] = useState(false); // undoing a verdict waits for a confirmation

  useEffect(() => {
    setSlip(null); setRejecting(false); setReason(''); setViewerOpen(false); setResetAsk(false);
    if (!open || !person?.hasSlip) return undefined;
    let alive = true;
    setLoading(true);
    getSlip(person.regId).then((d) => { if (alive) { setSlip(d); setLoading(false); } });
    return () => { alive = false; };
  }, [open, person?.regId, person?.hasSlip, getSlip]);

  if (!open || !person) return null;
  const meta = PAYMENT_STATUS[person.paymentStatus];
  const amount = slip?.amount ?? person.slipAmount;
  const mismatch = amount != null && fee > 0 && Math.abs(amount - fee) > 0.004;
  // The day of the transfer should fall after registration opened and not after the slip was sent.
  const transferDay = (slip?.transferred_at || person.slipTransferredAt || '').slice(0, 10);
  const sentDay = slip?.submitted_at ? new Date(slip.submitted_at).toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' }) : '';
  const timeOk = !!transferDay && (!slip?.reg_start || transferDay >= slip.reg_start) && (!sentDay || transferDay <= sentDay);
  const dupes = slip?.duplicates; // undefined: the server did not check (older backend)

  async function act(action) {
    if (action === 'reject' && !reason.trim()) return;
    setBusy(true);
    const ok = await onAction(action, reason.trim());
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <ModalHead eyebrow={remaining > 0 ? `ตรวจสอบการชำระเงิน · รอตรวจอีก ${remaining} ใบหลังจากนี้` : 'ตรวจสอบการชำระเงิน'} icon="ti-receipt" title={person.name} onClose={onClose} />
      <div className="modal-body">
        <div className="slip-review">
          <div className="slip-review-img">
            {person.hasSlip ? (
              loading ? <div className="slip-review-empty">กำลังโหลดสลิป...</div>
                : slip?.slip ? (
                  <button type="button" onClick={() => setViewerOpen(true)} aria-label="ดูสลิปเต็มจอและซูม">
                    <img src={slip.slip} alt={`สลิปการโอนเงินของ ${person.name}`} />
                    <span><i className="ti ti-zoom-in" /> คลิกเพื่อดูเต็มจอและซูม</span>
                  </button>
                ) : <div className="slip-review-empty">โหลดสลิปไม่สำเร็จ</div>
            ) : (
              <div className="slip-review-empty"><i className="ti ti-receipt-off" /> ผู้สมัครยังไม่ได้ส่งสลิป</div>
            )}
          </div>
          <dl className="slip-review-info">
            <div><dt>สถานะ</dt><dd><span className={`pay-status ${meta.cls}`} style={{ marginTop: 0 }}><i className={`ti ${meta.icon}`} /> {meta.label}</span></dd></div>
            <div><dt>ผู้สมัคร</dt><dd>{person.name}{person.sid ? ` · ${person.sid}` : ''}</dd></div>
            <div><dt>ค่าลงทะเบียน</dt><dd>{formatBaht(fee)}</dd></div>
            <div>
              <dt>จำนวนเงินที่แจ้งโอน</dt>
              <dd>
                {amount != null ? formatBaht(amount) : '–'}
                {amount != null && (mismatch
                  ? <span className="slip-flag bad"><i className="ti ti-alert-triangle" /> ไม่ตรงกับค่าลงทะเบียน</span>
                  : <span className="slip-flag good"><i className="ti ti-check" /> ตรงกับค่าลงทะเบียน</span>)}
              </dd>
            </div>
            <div><dt>วันและเวลาที่โอน (ตามที่ผู้โอนแจ้ง)</dt><dd>{formatThaiDateTime(slip?.transferred_at || person.slipTransferredAt) || '–'}</dd></div>
            <div><dt>ส่งหลักฐานเมื่อ</dt><dd>{slip?.submitted_at ? formatThaiDateTime(slip.submitted_at) : '–'}</dd></div>
            {person.paymentStatus === 'rejected' && person.rejectReason && <div><dt>เหตุผลที่ไม่ผ่าน</dt><dd>{person.rejectReason}</dd></div>}
          </dl>
        </div>
        {person.hasSlip && slip && (
          <div className="slip-check">
            <div className="slip-check-title"><i className="ti ti-list-check" /> ตรวจก่อนยืนยัน</div>
            <ul>
              <CheckItem state={amount == null ? 'manual' : mismatch ? 'bad' : 'good'}>
                ยอดเงินตรงกับค่าลงทะเบียน {formatBaht(fee)}{amount != null && mismatch ? ` · แจ้งโอน ${formatBaht(amount)}` : ''}
              </CheckItem>
              <CheckItem state={!transferDay ? 'manual' : timeOk ? 'good' : 'bad'}>
                {timeOk || !transferDay ? 'วันที่โอนอยู่ในช่วงหลังเปิดรับสมัครและก่อนส่งหลักฐาน' : 'วันที่โอนอยู่นอกช่วงรับสมัคร หรือหลังวันที่ส่งหลักฐาน'}
              </CheckItem>
              <CheckItem state={!dupes ? 'manual' : dupes.length ? 'bad' : 'good'}>
                {!dupes ? 'ไม่ซ้ำกับสลิปของผู้สมัครคนอื่น' : dupes.length
                  ? `สลิปนี้ซ้ำกับที่ ${dupes.map((d) => `${d.name} (${d.event})`).join(', ')} ส่งมา`
                  : 'ไม่ซ้ำกับสลิปของผู้สมัครคนอื่น'}
              </CheckItem>
              <CheckItem state="manual">
                ชื่อบัญชีผู้รับบนสลิปตรงกับที่ประกาศไว้{slip.payment_info ? <span className="slip-check-ref">ที่ประกาศ: {slip.payment_info}</span> : null}
              </CheckItem>
              <CheckItem state="manual">สแกน QR บนสลิปด้วยแอปธนาคาร หรือดูรายการเงินเข้าในบัญชี เพื่อยืนยันว่าเป็นสลิปจริง</CheckItem>
            </ul>
            <p className="slip-check-legend"><i className="ti ti-circle-check" /> ระบบตรวจให้แล้ว · <i className="ti ti-eye" /> ต้องดูเอง · ระบบไม่ได้เชื่อมกับธนาคาร</p>
          </div>
        )}

        {rejecting && (
          <div className="field" style={{ marginTop: 14 }}>
            <label htmlFor="slip-reject-reason">เหตุผลที่ไม่ผ่าน <span className="req">*</span></label>
            <input id="slip-reject-reason" type="text" autoFocus maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="เช่น ยอดเงินไม่ครบ / สลิปไม่ชัด / ไม่พบรายการเงินเข้า" />
            <div className="reject-presets">
              {REJECT_REASONS.map((r) => (
                <button type="button" key={r} className={`filter-chip${reason === r ? ' active' : ''}`} onClick={() => setReason(r)}>{r}</button>
              ))}
            </div>
            <span className="helper">เลือกเหตุผลที่พบบ่อย หรือพิมพ์เอง · ผู้สมัครจะเห็นเหตุผลนี้ และส่งสลิปใหม่ได้</span>
          </div>
        )}
      </div>
      <div className="modal-foot">
        {rejecting ? (
          <>
            <button type="button" className="btn btn-outline" onClick={() => setRejecting(false)} disabled={busy}>ย้อนกลับ</button>
            <button type="button" className="btn btn-dark" onClick={() => act('reject')} disabled={busy || !reason.trim()}><i className="ti ti-x" /> ยืนยันว่าไม่ผ่าน</button>
          </>
        ) : (
          <>
            {(person.paymentStatus === 'paid' || person.paymentStatus === 'rejected') && (
              <button type="button" className="btn btn-ghost" style={{ marginRight: 'auto' }} onClick={() => setResetAsk(true)} disabled={busy}><i className="ti ti-arrow-back-up" /> ยกเลิกผลการตรวจ</button>
            )}
            <button type="button" className="btn btn-outline" onClick={onClose}>ปิด</button>
            {person.paymentStatus !== 'rejected' && person.paymentStatus !== 'paid' && person.hasSlip && (
              <button type="button" className="btn btn-outline" onClick={() => setRejecting(true)} disabled={busy}><i className="ti ti-x" /> ไม่ผ่าน</button>
            )}
            {person.paymentStatus !== 'paid' && (
              <button type="button" className="btn btn-primary" onClick={() => act('confirm')} disabled={busy}>
                <i className="ti ti-circle-check" /> {person.hasSlip ? 'ยืนยันว่าชำระแล้ว' : 'ยืนยันว่าชำระแล้ว (ไม่มีสลิป)'}
              </button>
            )}
          </>
        )}
      </div>
      <ImageViewer open={viewerOpen} src={slip?.slip} title={`สลิปการโอนเงิน · ${person.name}`} paper onClose={() => setViewerOpen(false)} />
      <ConfirmDialog
        open={resetAsk}
        eyebrow="ยกเลิกผลการตรวจ"
        icon="ti-arrow-back-up"
        title="ยกเลิกผลการตรวจสลิปนี้?"
        confirmLabel="ยกเลิกผลการตรวจ"
        confirmIcon="ti-arrow-back-up"
        busy={busy}
        onConfirm={() => { setResetAsk(false); act('reset'); }}
        onCancel={() => setResetAsk(false)}
      >
        <p style={{ fontSize: 13.5, color: 'var(--c4-70)', lineHeight: 1.7 }}>
          สลิปของ <strong style={{ color: 'var(--c4)' }}>{person.name}</strong> จะกลับเป็น "{person.hasSlip ? 'รอตรวจสอบ' : 'รอชำระเงิน'}"
          ({person.paymentStatus === 'paid' ? 'เดิม: ผ่าน · ชำระแล้ว' : 'เดิม: ไม่ผ่าน'}) และผู้สมัครจะได้รับแจ้งเตือน
        </p>
      </ConfirmDialog>
    </Modal>
  );
}
