import React, { useEffect, useState } from 'react';
import { useEvents } from '../../../hooks/useEvents';
import Modal, { ModalHead } from '../../../components/ui/Modal';
import ImageViewer from '../../../components/ui/ImageViewer';
import { formatBaht } from '../../../utils/money';
import { formatThaiDateTime } from '../../../utils/dateFormat';
import { PAYMENT_STATUS } from './PaymentBox';

/**
 * Organizer's check of one registrant's payment: the slip they sent beside
 * the date, time and amount they declared and the fee due — then confirm,
 * reject with a reason (the payer is told and can send another), or undo.
 * `person` is a roster row; `onAction(action, reason)` performs the verdict.
 */
export default function SlipReviewModal({ open, person, fee, onAction, onClose }) {
  const { getSlip } = useEvents();
  const [slip, setSlip] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSlip(null); setRejecting(false); setReason(''); setViewerOpen(false);
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

  async function act(action) {
    if (action === 'reject' && !reason.trim()) return;
    setBusy(true);
    const ok = await onAction(action, reason.trim());
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <ModalHead eyebrow="ตรวจสอบการชำระเงิน" icon="ti-receipt" title={person.name} onClose={onClose} />
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
        <p className="slip-review-note"><i className="ti ti-info-circle" /> เทียบวันเวลาและยอดเงินที่แจ้งกับข้อมูลบนสลิป และตรวจกับรายการเงินเข้าในบัญชีก่อนยืนยัน · ระบบไม่ได้ตรวจสอบกับธนาคารให้</p>

        {rejecting && (
          <div className="field" style={{ marginTop: 14 }}>
            <label htmlFor="slip-reject-reason">เหตุผลที่ไม่ผ่าน <span className="req">*</span></label>
            <input id="slip-reject-reason" type="text" autoFocus maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="เช่น ยอดเงินไม่ครบ / สลิปไม่ชัด / ไม่พบรายการเงินเข้า" />
            <span className="helper">ผู้สมัครจะเห็นเหตุผลนี้ และส่งสลิปใหม่ได้</span>
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
              <button type="button" className="btn btn-ghost" style={{ marginRight: 'auto' }} onClick={() => act('reset')} disabled={busy}><i className="ti ti-arrow-back-up" /> ยกเลิกผลการตรวจ</button>
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
    </Modal>
  );
}
