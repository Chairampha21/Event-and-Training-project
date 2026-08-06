import React, { useEffect, useState } from 'react';
import Modal, { ModalHead } from './Modal';
import { useEvents } from '../hooks/useEvents';
import { ROLE_LABEL } from '../utils/constants';

export default function ProfileModal({ open, onClose }) {
  const { session, updateProfile } = useEvents();
  const [name, setName] = useState('');
  const [yearLevel, setYearLevel] = useState('');
  const [major, setMajor] = useState('');
  const [dept, setDept] = useState('');
  const [studentId, setStudentId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && session) {
      setName(session.name || '');
      setStudentId(session.student_id || '');
      const [y, ...rest] = (session.dept || '').split('·').map((s) => s.trim());
      setYearLevel(y || '');
      setMajor(rest.join(' · '));
      setDept(session.dept || '');
    }
  }, [open, session]);

  if (!open || !session) return null;

  const isStudent = session.role === 'student';

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    const deptValue = isStudent ? [yearLevel.trim(), major.trim()].filter(Boolean).join(' · ') : dept.trim();
    const ok = await updateProfile({ name: name.trim(), dept: deptValue, student_id: studentId.trim() });
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <Modal open={open} onClose={onClose} size="sm">
      <ModalHead eyebrow="บัญชีของฉัน" icon="ti-user-circle" title="โปรไฟล์" onClose={onClose} />
      <div className="modal-body">
        <div className="form-row full">
          <div className="field"><label>อีเมล</label><div className="sar-readout">{session.email}</div></div>
        </div>
        <div className="form-row full">
          <div className="field"><label>บทบาท</label><div className="sar-readout">{ROLE_LABEL[session.role]}</div></div>
        </div>
        <div className="form-row full">
          <div className="field">
            <label>ชื่อ–นามสกุล <span className="req">*</span></label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </div>
        {isStudent && (
          <div className="form-row full">
            <div className="field">
              <label>รหัสนักศึกษา</label>
              <input type="text" value={studentId} onChange={(e) => setStudentId(e.target.value)} />
            </div>
          </div>
        )}
        {isStudent ? (
          <div className="form-row">
            <div className="field">
              <label>ชั้นปี</label>
              <input type="text" value={yearLevel} onChange={(e) => setYearLevel(e.target.value)} placeholder="เช่น นักศึกษาชั้นปีที่ 3" />
            </div>
            <div className="field">
              <label>สาขา</label>
              <input type="text" value={major} onChange={(e) => setMajor(e.target.value)} placeholder="เช่น วท.บ. คอมพิวเตอร์" />
            </div>
          </div>
        ) : (
          <div className="form-row full">
            <div className="field">
              <label>สังกัด/ตำแหน่ง</label>
              <input type="text" value={dept} onChange={(e) => setDept(e.target.value)} />
            </div>
          </div>
        )}
      </div>
      <div className="modal-foot">
        <button className="btn btn-outline" onClick={onClose}>ยกเลิก</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving || !name.trim()}>
          <i className="ti ti-device-floppy" /> {saving ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
      </div>
    </Modal>
  );
}
