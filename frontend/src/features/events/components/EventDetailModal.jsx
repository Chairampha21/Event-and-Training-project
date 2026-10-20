import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEvents } from '../../../hooks/useEvents';
import { STATUS_META, isParticipant } from '../../../utils/constants';
import Modal, { ModalHead } from '../../../components/ui/Modal';
import ImageViewer from '../../../components/ui/ImageViewer';
import CycleProgress from './CycleProgress';
import OnlineJoinLink from './OnlineJoinLink';
import PaymentBox from './PaymentBox';
import CancelRegistrationButton, { cancelInfo } from './CancelRegistrationButton';
import { formatBaht } from '../../../utils/money';
import { formatThaiDate } from '../../../utils/dateFormat';
import { needsNames } from '../../../utils/personName';
import DietaryQuestions, { EMPTY_DIETARY, dietaryComplete, dietaryPayload } from './DietaryQuestions';

// Event details for whoever opened it; students register from here (with the
// confirmation step and the optional notebook-loan request).
//
// With `preview` (an event-shaped object built from the create-event form) it
// shows exactly what a student will see before the event exists — the same
// screens, walked through the same way, but nothing is submitted.
export default function EventDetailModal({ eventId, open, onClose, preview }) {
  const { evById, myStatus, registerForEvent, session, regs } = useEvents();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [borrowLaptop, setBorrowLaptop] = useState(false);
  const [attendVia, setAttendVia] = useState(''); // hybrid events: 'onsite' | 'online', chosen while registering
  const [dietary, setDietary] = useState(EMPTY_DIETARY);
  const [posterOpen, setPosterOpen] = useState(false);

  useEffect(() => {
    if (!open) { setConfirmOpen(false); setPosterOpen(false); }
    setBorrowLaptop(false);
    setAttendVia('');
    setDietary(EMPTY_DIETARY);
  }, [open, eventId]);

  if (!open || (!preview && !eventId)) return null;
  const ev = preview || evById(eventId);
  if (!ev) return null;
  const sm = STATUS_META[ev.status];
  const st = preview ? null : myStatus(ev.id);
  // Only students register; an organizer or admin opening the details just reads them.
  const canReg = preview ? true : ev.status === 'open' && !st && isParticipant(session?.role);
  const myReg = preview ? null : regs.find((r) => r.eid === ev.id);
  const studentView = preview || isParticipant(session?.role);
  // Teachers don't pay the fee: they register only so the organizer knows the seats they take.
  const isTeacher = !preview && session?.role === 'teacher';
  const namesMissing = !preview && !!session && session.title_th !== undefined && needsNames(session);
  const teacherFree = isTeacher && ev.fee > 0 && (
    <div className="prep-box teacher-free"><i className="ti ti-school" /> อาจารย์ไม่ต้องชำระค่าลงทะเบียน · การลงทะเบียนใช้เพื่อให้ผู้จัดทราบจำนวนที่นั่ง</div>
  );
  const prepNote = (ev.attendeeNote || ev.loanQty > 0) && (
    <div className="prep-box">
      <div className="prep-title"><i className="ti ti-backpack" /> สิ่งที่ต้องเตรียม</div>
      {ev.attendeeNote && <p>{ev.attendeeNote}</p>}
      {ev.loanQty > 0 && (
        <div className="prep-loan">
          <i className="ti ti-device-laptop" /> มีโน้ตบุ๊กให้ยืม {ev.loanQty} เครื่อง ·{' '}
          {ev.loanLeft > 0 ? `เหลือ ${ev.loanLeft} เครื่อง` : 'ถูกขอยืมครบแล้ว'}
        </div>
      )}
    </div>
  );

  // An event held both ways has separate seats for each; the person picks one.
  // Lending a notebook and asking about food only concern people in the room.
  const hybrid = ev.attendMode === 'hybrid';
  const seats = {
    onsite: { cap: Number(ev.capOnsite) || 0, taken: ev.regOnsite || 0, label: 'เข้าร่วมที่สถานที่จัด (Onsite)', icon: 'ti-building', note: ev.placeRaw || '' },
    online: { cap: Number(ev.capOnline) || 0, taken: ev.regOnline || 0, label: 'เข้าร่วมออนไลน์ (Online)', icon: 'ti-broadcast', note: 'ลิงก์เข้าร่วมแสดงหลังสมัคร · เช็คชื่อด้วยลิงก์ที่ผู้จัดแจ้งในวันจัด' },
  };
  const inRoom = hybrid ? attendVia === 'onsite' : ev.attendMode !== 'online';
  const askFood = ev.askDietary && inRoom;
  const viaMissing = hybrid && !attendVia;

  function closeAll() {
    setConfirmOpen(false);
    onClose();
  }

  if (confirmOpen) {
    return (
      <Modal open={open} onClose={closeAll} size="sm">
        <ModalHead eyebrow={preview ? 'ตัวอย่าง · ขั้นยืนยันการสมัคร' : 'ยืนยันการสมัคร'} icon="ti-user-plus" title="สมัครกิจกรรมนี้เลยหรือไม่?" onClose={closeAll} />
        <div className="modal-body">
          <p style={{ fontSize: 14, color: 'var(--c4-70)', lineHeight: 1.6 }}>
            ยืนยันการสมัครเข้าร่วม <strong>{ev.title}</strong> อีกครั้ง · {ev.date} · {ev.time}
          </p>
          {hybrid && (
            <div className="via-pick" role="radiogroup" aria-label="รูปแบบการเข้าร่วม">
              <div className="via-pick-title">เลือกรูปแบบการเข้าร่วม <span className="req">*</span></div>
              {Object.entries(seats).map(([key, s]) => {
                const left = Math.max(0, s.cap - s.taken);
                const full = left === 0;
                return (
                  <label key={key} className={`borrow-opt${full ? ' disabled' : ''}`}>
                    <input type="radio" name="attend-via" checked={attendVia === key} disabled={full} onChange={() => { setAttendVia(key); if (key === 'online') setBorrowLaptop(false); }} />
                    <span>
                      <strong><i className={`ti ${s.icon}`} /> {s.label}</strong>
                      <small>{full ? `เต็มแล้ว (${s.cap} ที่)` : `เหลือ ${left} จาก ${s.cap} ที่`}{s.note ? ` · ${s.note}` : ''}</small>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
          {prepNote}
          {ev.loanQty > 0 && inRoom && (
            <label className={`borrow-opt${ev.loanLeft === 0 ? ' disabled' : ''}`}>
              <input type="checkbox" checked={borrowLaptop} disabled={ev.loanLeft === 0} onChange={(e) => setBorrowLaptop(e.target.checked)} />
              <span>
                <strong>ประสงค์จะยืมโน้ตบุ๊ก 1 เครื่อง</strong>
                <small>
                  {ev.loanLeft > 0
                    ? `เหลือให้ยืม ${ev.loanLeft} จาก ${ev.loanQty} เครื่อง · ระบบจองเครื่องไว้ให้ทันทีเมื่อยืนยันสมัคร · ไม่เลือกหากนำโน้ตบุ๊กส่วนตัวมาเอง`
                    : `โน้ตบุ๊กให้ยืมทั้ง ${ev.loanQty} เครื่องถูกจองครบแล้ว เลือกยืมไม่ได้ · ยังสมัครได้โดยนำโน้ตบุ๊กส่วนตัวมาเอง`}
                </small>
              </span>
            </label>
          )}
          {askFood && <DietaryQuestions value={dietary} onChange={setDietary} />}
          {ev.fee > 0 && (isTeacher ? teacherFree : <PaymentBox fee={ev.fee} info={ev.paymentInfo} refundMethod={ev.refundMethod} refundNote={ev.refundNote} />)}
        </div>
        <div className="modal-foot">
          {!preview && namesMissing && (
            <span className="diet-need" role="status"><i className="ti ti-info-circle" /> <span>กรอกคำนำหน้าและชื่อภาษาไทยใน <a href="/profile" onClick={(e) => { e.preventDefault(); closeAll(); navigate('/profile'); }}>โปรไฟล์</a> ก่อนสมัคร</span></span>
          )}
          {!preview && !namesMissing && viaMissing && (
            <span className="diet-need" role="status"><i className="ti ti-info-circle" /> เลือกรูปแบบการเข้าร่วมก่อนยืนยัน</span>
          )}
          {!preview && !namesMissing && !viaMissing && askFood && !dietaryComplete(dietary) && (
            <span className="diet-need" role="status"><i className="ti ti-info-circle" /> {dietary.hasAllergy ? 'ระบุอาหารที่แพ้ก่อนยืนยัน' : 'ตอบคำถามเรื่องแพ้อาหารก่อนยืนยัน'}</span>
          )}
          <button className="btn btn-outline" onClick={() => setConfirmOpen(false)}>ย้อนกลับ</button>
          {preview ? (
            <button className="btn btn-primary" disabled title="นี่คือตัวอย่าง ยังไม่มีการสมัครจริง"><i className="ti ti-eye" /> ตัวอย่าง · ยังไม่ส่งจริง</button>
          ) : (
            <button
              className="btn btn-primary"
              disabled={namesMissing || viaMissing || (askFood && !dietaryComplete(dietary))}
              onClick={() => { registerForEvent(ev.id, { attendVia, borrowLaptop: inRoom && borrowLaptop, ...(askFood ? dietaryPayload(dietary) : {}) }); closeAll(); }}
            ><i className="ti ti-user-plus" /> ยืนยันสมัคร</button>
          )}
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <ModalHead eyebrow={preview ? 'ตัวอย่าง · สิ่งที่นักศึกษาจะเห็น' : 'รายละเอียดกิจกรรม'} icon={preview ? 'ti-eye' : 'ti-calendar-event'} onClose={onClose} />
      <div className="modal-body md-body">
        <div className={`md-top${ev.poster ? ' has-poster' : ''}`}>
          {ev.poster && (
            <button type="button" className="md-poster" onClick={() => setPosterOpen(true)} aria-label="ดูโปสเตอร์เต็มและซูม">
              <img src={ev.poster} alt={`โปสเตอร์ ${ev.title}`} />
              <span className="md-poster-zoom"><i className="ti ti-zoom-in" /> ดูภาพเต็ม</span>
            </button>
          )}
          <div className="md-hero">
            <div className="mdh-cat">{ev.cat}</div>
            <div className="mdh-title">{ev.title}</div>
            <ul className="mdh-meta">
              <li><i className="ti ti-calendar-event" /> {ev.date}</li>
              <li><i className="ti ti-clock" /> {ev.time}</li>
              <li><i className="ti ti-map-pin" /> {ev.place}</li>
              {ev.regPeriod && <li><i className="ti ti-user-plus" /> รับสมัคร {ev.regPeriod}</li>}
            </ul>
          </div>
        </div>
        <ImageViewer open={posterOpen} src={ev.poster} title={ev.title} onClose={() => setPosterOpen(false)} />
        {st && (
          <div className="md-section">
            <div className="pill-status ps-open" style={{ fontSize: 13 }}><i className="ti ti-circle-check-filled" /> คุณลงทะเบียนกิจกรรมนี้แล้ว{myReg?.hybrid ? (myReg.via === 'online' ? ' · เข้าร่วมออนไลน์' : ' · เข้าร่วมที่สถานที่จัด') : ''}{myReg?.wantsLaptop ? ' · จองโน้ตบุ๊กให้ยืมไว้ 1 เครื่อง' : ''}</div>
            {myReg && (myReg.foodAllergy || myReg.dietaryPref) && (
              <div className="my-diet"><i className="ti ti-tools-kitchen-2" /> {[myReg.foodAllergy && `แพ้: ${myReg.foodAllergy}`, myReg.dietaryPref].filter(Boolean).join(' · ')}</div>
            )}
            {cancelInfo(myReg, ev).ok && (
              <div className="md-cancel">
                <span><i className="ti ti-info-circle" /> ยกเลิกได้ภายในช่วงเปิดรับสมัคร{cancelInfo(myReg, ev).regEnd ? ` (ถึง ${formatThaiDate(cancelInfo(myReg, ev).regEnd)})` : ''}</span>
                <CancelRegistrationButton reg={myReg} className="btn btn-outline md-cancel-btn" />
              </div>
            )}
          </div>
        )}
        {ev.fee > 0 && <div className="md-section">{isTeacher ? teacherFree : <PaymentBox fee={ev.fee} info={ev.paymentInfo} reg={myReg} refundMethod={ev.refundMethod} refundNote={ev.refundNote} />}</div>}
        {ev.attendMode !== 'onsite' && ev.hasOnlineLink && (
          <div className="md-section"><OnlineJoinLink url={ev.onlineLink} locked={!ev.onlineLink} /></div>
        )}
        {prepNote && <div className="md-section">{prepNote}</div>}
        {ev.schedule.length > 0 && (
          <div className="md-section">
            <h4>กำหนดการแต่ละวัน</h4>
            <div className="day-schedule">
              {ev.schedule.map((d) => (
                <div className="ds-row" key={d.date}><span className="ds-date"><i className="ti ti-calendar-event" /> {d.label}</span><span className="ds-time"><i className="ti ti-clock" /> {d.time}</span></div>
              ))}
            </div>
          </div>
        )}
        <div className="md-section"><h4>รายละเอียด</h4><p>{ev.desc || 'ไม่มีรายละเอียดเพิ่มเติม'}</p></div>
        {!studentView && (
          <div className="md-section"><h4>ขั้นตอนของกิจกรรม</h4><CycleProgress stage={ev.stage} /></div>
        )}
        <div className="info-grid">
          <div className="ig"><div className="igl">สถานะรับสมัคร</div><div className="igv">{sm.label}</div></div>
          <div className="ig"><div className="igl">ที่นั่ง</div><div className="igv">{hybrid ? `Onsite ${ev.regOnsite || 0} / ${ev.capOnsite || 0} · Online ${ev.regOnline || 0} / ${ev.capOnline || 0}` : `${ev.reg} / ${ev.cap}`}</div></div>
          <div className="ig"><div className="igl">ผู้รับผิดชอบ</div><div className="igv">{ev.org}</div></div>
          <div className="ig"><div className="igl">รหัสกิจกรรม</div><div className="igv">{preview ? 'ออกให้เมื่อเผยแพร่' : `SU-CS-25-${String(ev.id).padStart(3, '0')}`}</div></div>
          <div className="ig"><div className="igl">ค่าลงทะเบียน</div><div className="igv">{ev.fee > 0 ? (isTeacher ? `${formatBaht(ev.fee)} · อาจารย์ไม่ต้องชำระ` : formatBaht(ev.fee)) : 'ไม่มีค่าใช้จ่าย'}</div></div>
        </div>
      </div>
      <div className="modal-foot">
        {canReg ? (
          <>
            <button className="btn btn-outline" onClick={onClose}>ปิด</button>
            <button className="btn btn-primary" onClick={() => setConfirmOpen(true)}><i className="ti ti-user-plus" /> {preview ? 'ลงทะเบียน (ดูขั้นถัดไป)' : 'ลงทะเบียน'}</button>
          </>
        ) : (
          <button className="btn btn-primary" onClick={onClose}>ปิด</button>
        )}
      </div>
    </Modal>
  );
}
