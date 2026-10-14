import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEvents } from '../../../hooks/useEvents';
import { STATUS_META, CYCLE } from '../../../utils/constants';
import Modal, { ModalHead } from '../../../components/ui/Modal';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import BudgetActualModal from '../../budget/components/BudgetActualModal';
import { CertIssueReview } from '../../certificates/components/CertIssuePreview';
import { formatBaht } from '../../../utils/money';

// Organizer/admin action menu for one event: edit, roster & check-in, record
// actual spend, issue certificates, open/close registration, delete.
export default function ManageEventModal({ eventId, open, onClose, onOpenApplicants }) {
  const { evById, rosters, toggleEventStatus, deleteEvent, issueCertificate, saveBudgetActual } = useEvents();
  const [budgetOpen, setBudgetOpen] = useState(false);
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirming, setConfirming] = useState(null); // 'cert' | 'toggle'
  useEffect(() => {
    setConfirming(null);
    if (!open) setBudgetOpen(false);
  }, [open, eventId]);
  if (!open || !eventId) return null;
  const ev = evById(eventId);
  if (!ev) return null;
  if (budgetOpen) {
    return <BudgetActualModal open event={{ ...ev, budgetPlanned: ev.budgetTotal }} onSave={(amount) => saveBudgetActual(ev.id, amount)} onClose={() => setBudgetOpen(false)} />;
  }
  const sm = STATUS_META[ev.status];
  const isOpen = ev.status === 'open';
  const canToggle = ev.status === 'open' || ev.status === 'closed';
  const certIssued = ev.stage === 4; // certificates already opened to attendees

  if (confirmDelete) {
    const paidCount = (rosters[ev.id] || []).filter((p) => p.paymentStatus === 'paid').length;
    return (
      <Modal open={open} onClose={onClose} size="sm">
        <ModalHead eyebrow="ยืนยันการลบ" icon="ti-alert-triangle" title="ลบกิจกรรมนี้?" onClose={onClose} />
        <div className="modal-body">
          <p style={{ fontSize: 14, color: 'var(--c4-70)', lineHeight: 1.6 }}>
            คุณกำลังจะลบ <strong>{ev.title}</strong> กิจกรรมจะถูกนำออกจากระบบ{ev.reg > 0 ? ` และผู้สมัคร ${ev.reg} คนจะได้รับแจ้งว่ากิจกรรมถูกยกเลิก` : ''} · ผู้ดูแลระบบจะได้รับแจ้งเตือน · ย้อนกลับไม่ได้
          </p>
          {paidCount > 0 && (
            <p role="alert" style={{ fontSize: 13.5, color: '#b42318', lineHeight: 1.6, marginTop: 10 }}>
              <i className="ti ti-alert-triangle" /> มีผู้ชำระค่าลงทะเบียนแล้ว {paidCount} คน ต้องดำเนินการคืนเงินให้ผู้สมัครเหล่านี้เอง ระบบไม่ได้คืนเงินให้อัตโนมัติ
            </p>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn btn-outline" onClick={() => setConfirmDelete(false)}>ยกเลิก</button>
          <button className="btn btn-dark" onClick={() => { deleteEvent(ev.id); onClose(); }}><i className="ti ti-trash" /> ลบกิจกรรม</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <ModalHead eyebrow="จัดการกิจกรรม" icon="ti-settings" title={ev.title.slice(0, 46)} onClose={onClose} />
      <div className="modal-body">
        <div className="me-meta">
          <span><i className="ti ti-calendar-event" /> {ev.date}</span>
          <span><i className="ti ti-users" /> {ev.reg} / {ev.cap} ที่นั่ง</span>
          {ev.regPeriod && <span><i className="ti ti-user-plus" /> รับสมัคร {ev.regPeriod}</span>}
          <span><i className="ti ti-route" /> {CYCLE[ev.stage]}</span>
          {ev.loanQty > 0 && <span><i className="ti ti-device-laptop" /> ขอยืมโน้ตบุ๊ก {ev.loanTaken} / {ev.loanQty} เครื่อง</span>}
        </div>
        <div className="me-list">
          <button className="me-action" onClick={() => { onClose(); navigate('/create-event', { state: { editId: ev.id } }); }}>
            <div className="me-ic accent"><i className="ti ti-edit" /></div>
            <div className="me-tx"><strong>แก้ไขข้อมูลกิจกรรม</strong><span>ชื่อ วันเวลา สถานที่ จำนวนรับ และรายละเอียด</span></div>
            <i className="ti ti-chevron-right me-go" />
          </button>
          <button className="me-action" onClick={() => { onClose(); onOpenApplicants(ev.id, 'list'); }}>
            <div className="me-ic"><i className="ti ti-users" /></div>
            <div className="me-tx"><strong>รายชื่อผู้สมัคร</strong><span>ดูผู้สมัคร การชำระเงิน ข้อมูลยืมโน้ตบุ๊กและแพ้อาหาร ดาวน์โหลดรายชื่อ</span></div>
            <i className="ti ti-chevron-right me-go" />
          </button>
          {ev.fee > 0 && (
            <button className="me-action" onClick={() => { onClose(); onOpenApplicants(ev.id, 'slips'); }}>
              <div className="me-ic"><i className="ti ti-receipt" /></div>
              <div className="me-tx"><strong>ตรวจสอบสลิป</strong><span>ตรวจหลักฐานการชำระเงิน · ดูว่าใครรอตรวจ ตรวจแล้ว หรือยังไม่ส่งสลิป</span></div>
              <i className="ti ti-chevron-right me-go" />
            </button>
          )}
          <button className="me-action" onClick={() => { onClose(); onOpenApplicants(ev.id, 'checkin'); }}>
            <div className="me-ic"><i className="ti ti-checkbox" /></div>
            <div className="me-tx"><strong>เช็คอินผู้เข้าร่วม</strong><span>เช็คชื่อผู้ที่มาเข้าร่วมในวันจัดกิจกรรม</span></div>
            <i className="ti ti-chevron-right me-go" />
          </button>
          <button className="me-action" onClick={() => setBudgetOpen(true)} disabled={!ev.ended}>
            <div className="me-ic"><i className="ti ti-receipt-2" /></div>
            <div className="me-tx">
              <strong>บันทึกงบประมาณที่ใช้จริง</strong>
              <span>
                งบประมาณรวม {ev.budgetTotal != null ? formatBaht(ev.budgetTotal) : 'ยังไม่ได้ตั้ง'}
                {' · '}
                {ev.budgetActual != null ? `งบประมาณที่ใช้จริง ${formatBaht(ev.budgetActual)}` : ev.ended ? 'ยังไม่ได้บันทึกงบประมาณที่ใช้จริง' : 'บันทึกได้เมื่อกิจกรรมจบ'}
              </span>
            </div>
            <i className="ti ti-chevron-right me-go" />
          </button>
          {/* Issuing closes the event for good, so it waits for the last day (the server checks too). */}
          <button className="me-action" onClick={() => setConfirming('cert')} disabled={!certIssued && !ev.ended}>
            <div className="me-ic"><i className={`ti ${certIssued ? 'ti-circle-check' : 'ti-certificate'}`} /></div>
            <div className="me-tx">
              <strong>{certIssued ? 'ออกเกียรติบัตรแล้ว' : 'ออกเกียรติบัตร'}</strong>
              <span>{certIssued ? 'เปิดสิทธิ์แล้ว · กดเพื่อแจ้งเตือนผู้ที่เช็คอินเพิ่มหลังจากนั้น' : ev.ended ? 'เปิดสิทธิ์ให้ผู้เข้าร่วมที่เช็คอินแล้ว' : 'ออกได้เมื่อถึงวันสุดท้ายของกิจกรรม'}</span>
            </div>
            <i className="ti ti-chevron-right me-go" />
          </button>
          {canToggle && (
            <button className="me-action" onClick={() => setConfirming('toggle')}>
              <div className="me-ic"><i className={`ti ti-${isOpen ? 'lock-open' : 'lock'}`} /></div>
              <div className="me-tx"><strong>{isOpen ? 'ปิดรับสมัคร' : 'เปิดรับสมัคร'}</strong><span>สถานะปัจจุบัน: {sm.label}</span></div>
              <i className="ti ti-chevron-right me-go" />
            </button>
          )}
          <button className="me-action danger" onClick={() => setConfirmDelete(true)}>
            <div className="me-ic dark"><i className="ti ti-trash" /></div>
            <div className="me-tx"><strong>ลบกิจกรรม</strong><span>นำกิจกรรมออกจากระบบ (ย้อนกลับไม่ได้)</span></div>
            <i className="ti ti-chevron-right me-go" />
          </button>
        </div>
      </div>
      <div className="modal-foot"><button className="btn btn-outline" onClick={onClose}>ปิด</button></div>
      <ConfirmDialog
        open={confirming === 'cert'}
        eyebrow={certIssued ? 'ออกเกียรติบัตรแล้ว' : 'ยืนยันการออกเกียรติบัตร'}
        icon="ti-certificate"
        title={certIssued ? 'แจ้งเตือนผู้ที่เช็คอินเพิ่ม?' : 'ออกเกียรติบัตรกิจกรรมนี้?'}
        confirmLabel={certIssued ? 'แจ้งเตือนผู้ที่เช็คอินเพิ่ม' : 'ยืนยันออกเกียรติบัตร'}
        confirmIcon={certIssued ? 'ti-bell' : 'ti-certificate'}
        size=""
        onConfirm={() => { issueCertificate(ev.id); onClose(); }}
        onCancel={() => setConfirming(null)}
      >
        <p style={{ fontSize: 13.5, color: 'var(--c4-70)', lineHeight: 1.7 }}><strong style={{ color: 'var(--c4)' }}>{ev.title}</strong><br />{certIssued ? 'กิจกรรมนี้ออกเกียรติบัตรไปแล้ว · ยืนยันอีกครั้งจะแจ้งเตือนเฉพาะผู้ที่เช็คอินเพิ่มหลังจากนั้น ผู้ที่เคยได้รับแจ้งเตือนแล้วจะไม่ได้รับซ้ำ และไม่มีการออกเกียรติบัตรใบที่สอง' : 'ผู้เข้าร่วมที่เช็คอินแล้วจะได้รับสิทธิ์รับเกียรติบัตรและได้รับการแจ้งเตือน · ตรวจตัวอย่างด้านล่างก่อนยืนยัน'}</p>
        <CertIssueReview ev={ev} onEdit={() => { onClose(); navigate('/create-event', { state: { editId: ev.id, section: 'cert' } }); }} />
      </ConfirmDialog>
      <ConfirmDialog
        open={confirming === 'toggle'}
        eyebrow="ยืนยันการเปลี่ยนสถานะ"
        icon={isOpen ? 'ti-lock' : 'ti-lock-open'}
        title={isOpen ? 'ปิดรับสมัครกิจกรรมนี้?' : 'เปิดรับสมัครกิจกรรมนี้?'}
        confirmLabel={isOpen ? 'ยืนยันปิดรับสมัคร' : 'ยืนยันเปิดรับสมัคร'}
        confirmIcon={isOpen ? 'ti-lock' : 'ti-lock-open'}
        onConfirm={() => { toggleEventStatus(ev.id); setConfirming(null); }}
        onCancel={() => setConfirming(null)}
      >
        <p style={{ fontSize: 13.5, color: 'var(--c4-70)', lineHeight: 1.7 }}><strong style={{ color: 'var(--c4)' }}>{ev.title}</strong><br />{isOpen ? 'นักศึกษาจะสมัครกิจกรรมนี้ไม่ได้จนกว่าจะเปิดรับสมัครอีกครั้ง' : 'นักศึกษาจะสมัครกิจกรรมนี้ได้ทันที'}</p>
      </ConfirmDialog>
    </Modal>
  );
}
