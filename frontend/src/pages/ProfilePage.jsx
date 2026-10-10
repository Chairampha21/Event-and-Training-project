import React, { useEffect, useState } from 'react';
import { useEvents } from '../hooks/useEvents';
import { ROLE_LABEL } from '../utils/constants';
import { initials } from '../utils/initials';
import ConfirmDialog from '../components/ui/ConfirmDialog';

// "My profile" — one page for every role. Email and role are fixed (accounts
// are tied to the university address; roles are set by an admin); the rest is
// the user's own to edit.
export default function ProfilePage() {
  const { session, updateProfile } = useEvents();
  const [name, setName] = useState('');
  const [yearLevel, setYearLevel] = useState('');
  const [major, setMajor] = useState('');
  const [dept, setDept] = useState('');
  const [studentId, setStudentId] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Students keep "year · major" in the one dept field; split it for editing.
  function load() {
    if (!session) return;
    setName(session.name || '');
    setStudentId(session.student_id || '');
    const [y, ...rest] = (session.dept || '').split('·').map((s) => s.trim());
    setYearLevel(y || '');
    setMajor(rest.join(' · '));
    setDept(session.dept || '');
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [session?.id, session?.name, session?.dept, session?.student_id]);

  if (!session) return null;
  const isStudent = session.role === 'student';
  const deptValue = isStudent ? [yearLevel.trim(), major.trim()].filter(Boolean).join(' · ') : dept.trim();
  const dirty = name.trim() !== (session.name || '')
    || deptValue !== (session.dept || '')
    || (isStudent && studentId.trim() !== (session.student_id || ''));

  // What would change, shown in the confirmation so the user approves the
  // actual edit rather than a generic "are you sure?".
  const changes = [
    { label: 'ชื่อ–นามสกุล', from: session.name || '', to: name.trim() },
    ...(isStudent ? [{ label: 'รหัสนักศึกษา', from: session.student_id || '', to: studentId.trim() }] : []),
    { label: isStudent ? 'ชั้นปี · สาขา' : 'สังกัด/ตำแหน่ง', from: session.dept || '', to: deptValue },
  ].filter((c) => c.from !== c.to);

  // Pressing "save" only asks; the write happens on confirm.
  function handleSave(e) {
    e.preventDefault();
    if (!name.trim() || !dirty) return;
    setConfirmOpen(true);
  }

  async function confirmSave() {
    setSaving(true);
    const ok = await updateProfile({ name: name.trim(), dept: deptValue, student_id: studentId.trim() });
    setSaving(false);
    if (ok) setConfirmOpen(false);
  }

  return (
    <div>
      <div className="page-header">
        <div className="ph-inner">
          <div>
            <h1>โปรไฟล์ของฉัน</h1>
            <p>ข้อมูลบัญชีที่ใช้แสดงในระบบ รายชื่อผู้สมัคร และเกียรติบัตร</p>
          </div>
        </div>
      </div>

      <div className="wrap tight">
        <div className="pf-layout">
          <aside className="pf-card pf-summary">
            {/* Picture made from the name: initials on the role's colour, the same mark the sidebar shows. */}
            <div className={`pf-avatar ${session.role}`} aria-hidden="true">{initials(name || session.name) || <i className="ti ti-user" />}</div>
            <div className="pf-name">{name || session.name}</div>
            <span className={`role-tag ${session.role}`}>{ROLE_LABEL[session.role]}</span>
            <dl className="pf-facts">
              <div><dt><i className="ti ti-mail" /> อีเมล</dt><dd>{session.email}</dd></div>
              {isStudent && <div><dt><i className="ti ti-id" /> รหัสนักศึกษา</dt><dd>{session.student_id || '–'}</dd></div>}
              <div><dt><i className="ti ti-building" /> {isStudent ? 'ชั้นปี · สาขา' : 'สังกัด/ตำแหน่ง'}</dt><dd>{session.dept || '–'}</dd></div>
            </dl>
          </aside>

          <form className="pf-card" onSubmit={handleSave}>
            <h2 className="pf-title"><i className="ti ti-edit" /> แก้ไขข้อมูล</h2>
            <div className="form-row full">
              <div className="field">
                <label htmlFor="pf-name">ชื่อ–นามสกุล <span className="req">*</span></label>
                <input id="pf-name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
                <span className="helper">ชื่อนี้จะปรากฏบนเกียรติบัตร กรุณาสะกดให้ถูกต้องพร้อมคำนำหน้า</span>
              </div>
            </div>
            {isStudent && (
              <div className="form-row full">
                <div className="field">
                  <label htmlFor="pf-sid">รหัสนักศึกษา</label>
                  <input id="pf-sid" type="text" inputMode="numeric" value={studentId} onChange={(e) => setStudentId(e.target.value)} />
                </div>
              </div>
            )}
            {isStudent ? (
              <div className="form-row">
                <div className="field">
                  <label htmlFor="pf-year">ชั้นปี</label>
                  <input id="pf-year" type="text" value={yearLevel} onChange={(e) => setYearLevel(e.target.value)} placeholder="เช่น นักศึกษาชั้นปีที่ 3" />
                </div>
                <div className="field">
                  <label htmlFor="pf-major">สาขา</label>
                  <input id="pf-major" type="text" value={major} onChange={(e) => setMajor(e.target.value)} placeholder="เช่น วท.บ. คอมพิวเตอร์" />
                </div>
              </div>
            ) : (
              <div className="form-row full">
                <div className="field">
                  <label htmlFor="pf-dept">สังกัด/ตำแหน่ง</label>
                  <input id="pf-dept" type="text" value={dept} onChange={(e) => setDept(e.target.value)} />
                </div>
              </div>
            )}
            <div className="form-row">
              <div className="field"><label>อีเมล</label><div className="pf-readonly"><i className="ti ti-lock" /> {session.email}</div></div>
              <div className="field"><label>บทบาท</label><div className="pf-readonly"><i className="ti ti-lock" /> {ROLE_LABEL[session.role]}</div></div>
            </div>
            <span className="helper budget-hint"><i className="ti ti-info-circle" /> อีเมลและบทบาทแก้ไขเองไม่ได้ · หากไม่ถูกต้องกรุณาติดต่อผู้ดูแลระบบ</span>
            <div className="pf-actions">
              <button type="button" className="btn btn-outline" onClick={load} disabled={!dirty || saving}>คืนค่าเดิม</button>
              <button type="submit" className="btn btn-primary" disabled={saving || !name.trim() || !dirty}>
                <i className="ti ti-device-floppy" /> {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        eyebrow="ยืนยันการบันทึก"
        icon="ti-device-floppy"
        title="บันทึกการแก้ไขโปรไฟล์?"
        confirmLabel="ยืนยันบันทึก"
        confirmIcon="ti-device-floppy"
        busy={saving}
        onConfirm={confirmSave}
        onCancel={() => setConfirmOpen(false)}
      >
        <p style={{ fontSize: 14, color: 'var(--c4-70)', lineHeight: 1.6, marginBottom: 12 }}>ตรวจสอบข้อมูลที่จะเปลี่ยนก่อนยืนยัน</p>
        <dl className="pf-changes">
          {changes.map((c) => (
            <div key={c.label}>
              <dt>{c.label}</dt>
              <dd><span className="pf-old">{c.from || '(ว่าง)'}</span><i className="ti ti-arrow-right" /><strong>{c.to || '(ว่าง)'}</strong></dd>
            </div>
          ))}
        </dl>
      </ConfirmDialog>
    </div>
  );
}
