import React, { useEffect, useState } from 'react';
import { useEvents } from '../hooks/useEvents';
import { ROLE_LABEL } from '../utils/constants';
import { initials } from '../utils/initials';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useLocation } from 'react-router-dom';
import NameFields from '../components/common/NameFields';
import StudentDeptFields from '../components/common/StudentDeptFields';
import { GENDER_LABEL } from '../utils/profileAnswers';
import { fullNameTh, fullNameEn, joinThai, joinEnglish, needsNames, hasThai } from '../utils/personName';

// Optional personal details, kept as one object keyed by the API field names.
const PERSONAL = [
  { key: 'nickname', label: 'ชื่อเล่น' },
  { key: 'gender', label: 'เพศ' },
  { key: 'phone', label: 'เบอร์โทรศัพท์' },
  { key: 'blood_type', label: 'กรุ๊ปเลือด' },
  { key: 'food_allergy', label: 'อาหารที่แพ้' },
  { key: 'medical_note', label: 'โรคประจำตัว / ยาที่แพ้' },
  { key: 'emergency_contact', label: 'ผู้ติดต่อกรณีฉุกเฉิน' },
];
const BLOOD_TYPES = ['A', 'B', 'AB', 'O'];
const shown = (key, v) => (key === 'gender' ? GENDER_LABEL[v] || v : v);
const personalOf = (s) => Object.fromEntries(PERSONAL.map((f) => [f.key, s?.[f.key] || '']));

// "My profile" — one page for every role. Email and role are fixed (accounts
// are tied to the university address; roles are set by an admin); the rest is
// the user's own to edit.
export default function ProfilePage() {
  const { session, updateProfile } = useEvents();
  const location = useLocation();
  const [name, setName] = useState('');
  const [titleTh, setTitleTh] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [dept, setDept] = useState('');
  const [studentId, setStudentId] = useState('');
  const [personal, setPersonal] = useState(() => personalOf(null));
  const setP = (key) => (e) => setPersonal((p) => ({ ...p, [key]: e.target.value }));
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function load() {
    if (!session) return;
    setName(hasThai(session.name) ? session.name || '' : '');
    setTitleTh(session.title_th || '');
    setNameEn(session.name_en || '');
    setTitleEn(session.title_en || '');
    setStudentId(session.student_id || '');
    setDept(session.dept || '');
    setPersonal(personalOf(session));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [session?.id, session?.name, session?.dept, session?.student_id, session?.title_th, session?.name_en, session?.title_en, ...PERSONAL.map((f) => session?.[f.key])]);

  if (!session) return null;
  // What still stops saving, with the box to go to: shown beside the button,
  // since the name boxes are at the top and the button at the bottom.
  const blocker = !titleTh.trim() ? { msg: 'ยังไม่ได้เลือกคำนำหน้าชื่อ', field: 'pf-title' }
    : !hasThai(name) ? { msg: 'ยังไม่ได้กรอกชื่อ-นามสกุลภาษาไทย', field: 'pf-name' }
      : (nameEn.trim() && hasThai(nameEn)) ? { msg: 'ชื่อภาษาอังกฤษต้องพิมพ์เป็นภาษาอังกฤษ', field: 'pf-name-en' }
        : !personal.gender ? { msg: 'ยังไม่ได้เลือกเพศ', field: 'pf-gender' }
          : null;
  function goTo(id) {
    const el = document.getElementById(id) || document.querySelector(`[name="${id}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el?.focus({ preventScroll: true });
  }
  const isStudent = session.role === 'student';
  const deptValue = dept.trim();
  const dirty = name.trim() !== (session.name || '')
    || titleTh.trim() !== (session.title_th || '') || nameEn.trim() !== (session.name_en || '') || titleEn.trim() !== (session.title_en || '')
    || deptValue !== (session.dept || '')
    || (isStudent && studentId.trim() !== (session.student_id || ''))
    || PERSONAL.some((f) => personal[f.key].trim() !== (session[f.key] || ''));

  // What would change, shown in the confirmation so the user approves the
  // actual edit rather than a generic "are you sure?".
  const changes = [
    { label: 'ชื่อบนเกียรติบัตร (ไทย)', from: fullNameTh(session), to: joinThai(titleTh, name) },
    { label: 'ชื่อบนเกียรติบัตร (อังกฤษ)', from: fullNameEn(session), to: nameEn.trim() ? joinEnglish(titleEn, nameEn) : '' },
    ...(isStudent ? [{ label: 'รหัสนักศึกษา', from: session.student_id || '', to: studentId.trim() }] : []),
    { label: isStudent ? 'ชั้นปี · สาขา' : 'สังกัด/ตำแหน่ง', from: session.dept || '', to: deptValue },
    ...PERSONAL.map((f) => ({ label: f.label, from: shown(f.key, session[f.key] || ''), to: shown(f.key, personal[f.key].trim()) })),
  ].filter((c) => c.from !== c.to);

  // Pressing "save" only asks; the write happens on confirm.
  function handleSave(e) {
    e.preventDefault();
    if (blocker || !dirty) return;
    setConfirmOpen(true);
  }

  async function confirmSave() {
    setSaving(true);
    const ok = await updateProfile({ name: name.trim(), title_th: titleTh.trim(), name_en: nameEn.trim(), title_en: titleEn.trim(), dept: deptValue, student_id: studentId.trim(),
      ...Object.fromEntries(PERSONAL.map((f) => [f.key, personal[f.key].trim()])) });
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
            <div className="pf-name">{joinThai(titleTh, name) || fullNameTh(session)}</div>
            {nameEn.trim() && <div className="pf-name-en">{joinEnglish(titleEn, nameEn)}</div>}
            <span className={`role-tag ${session.role}`}>{ROLE_LABEL[session.role]}</span>
            <dl className="pf-facts">
              <div><dt><i className="ti ti-mail" /> อีเมล</dt><dd>{session.email}</dd></div>
              {isStudent && <div><dt><i className="ti ti-id" /> รหัสนักศึกษา</dt><dd>{session.student_id || '–'}</dd></div>}
              <div><dt><i className="ti ti-building" /> {isStudent ? 'ชั้นปี · สาขา' : 'สังกัด/ตำแหน่ง'}</dt><dd>{session.dept || '–'}</dd></div>
              {session.nickname && <div><dt><i className="ti ti-mood-smile" /> ชื่อเล่น</dt><dd>{session.nickname}</dd></div>}
              {session.gender && <div><dt><i className="ti ti-gender-bigender" /> เพศ</dt><dd>{GENDER_LABEL[session.gender]}</dd></div>}
              {session.phone && <div><dt><i className="ti ti-phone" /> เบอร์โทรศัพท์</dt><dd>{session.phone}</dd></div>}
              {session.blood_type && <div><dt><i className="ti ti-droplet" /> กรุ๊ปเลือด</dt><dd>{session.blood_type}</dd></div>}
            </dl>
          </aside>

          <form className="pf-card" onSubmit={handleSave}>
            <h2 className="pf-title"><i className="ti ti-edit" /> แก้ไขข้อมูล</h2>
            {(location.state?.needNames || needsNames(session)) && (
              <div className="pf-need" role="status">
                <i className="ti ti-id-badge-2" />
                <span><strong>กรอกคำนำหน้าและชื่อภาษาไทยก่อนใช้งาน</strong> · ใช้พิมพ์บนเกียรติบัตรและรายชื่อผู้เข้าร่วม</span>
              </div>
            )}
            <NameFields
              idPrefix="pf" student={isStudent}
              titleTh={titleTh} setTitleTh={setTitleTh} name={name} setName={setName}
              titleEn={titleEn} setTitleEn={setTitleEn} nameEn={nameEn} setNameEn={setNameEn}
            />
            {isStudent && (
              <div className="form-row full">
                <div className="field">
                  <label htmlFor="pf-sid">รหัสนักศึกษา</label>
                  <input id="pf-sid" type="text" inputMode="numeric" value={studentId} onChange={(e) => setStudentId(e.target.value)} />
                </div>
              </div>
            )}
            {isStudent ? (
              <StudentDeptFields key={session.id} idPrefix="pf" value={dept} onChange={setDept} studentId={studentId} />
            ) : (
              <div className="form-row full">
                <div className="field">
                  <label htmlFor="pf-dept">สังกัด/ตำแหน่ง</label>
                  <input id="pf-dept" type="text" value={dept} onChange={(e) => setDept(e.target.value)} />
                </div>
              </div>
            )}

            <h3 className="pf-subtitle"><i className="ti ti-user-heart" /> ข้อมูลส่วนตัว <span>ต้องระบุเพศ · ช่องอื่นไม่บังคับ</span></h3>
            <div className="form-row">
              <div className="field">
                <label htmlFor="pf-nick">ชื่อเล่น</label>
                <input id="pf-nick" type="text" maxLength={50} value={personal.nickname} onChange={setP('nickname')} />
              </div>
              <div className="field">
                <label htmlFor="pf-gender">เพศ <span className="req">*</span></label>
                <select id="pf-gender" value={personal.gender} onChange={setP('gender')} aria-invalid={!personal.gender}>
                  <option value="" disabled>เลือกเพศ</option>
                  {Object.entries(GENDER_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="pf-phone">เบอร์โทรศัพท์</label>
                <input id="pf-phone" type="tel" inputMode="tel" maxLength={20} placeholder="08x-xxx-xxxx" value={personal.phone} onChange={setP('phone')} />
              </div>
              <div className="field">
                <label htmlFor="pf-blood">กรุ๊ปเลือด</label>
                <select id="pf-blood" value={personal.blood_type} onChange={setP('blood_type')}>
                  <option value="">ไม่ระบุ</option>
                  {BLOOD_TYPES.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="pf-food">อาหารที่แพ้</label>
                <input id="pf-food" type="text" maxLength={255} placeholder="เช่น กุ้ง, ถั่วลิสง, นมวัว" value={personal.food_allergy} onChange={setP('food_allergy')} autoComplete="off" />
                <span className="helper"><i className="ti ti-info-circle" /> ถ้าไม่แพ้อาหารใด ๆ ให้ใส่ -</span>
              </div>
              <div className="field">
                <label htmlFor="pf-med">โรคประจำตัว / ยาที่แพ้</label>
                <input id="pf-med" type="text" maxLength={255} placeholder="เช่น หอบหืด, แพ้เพนิซิลลิน" value={personal.medical_note} onChange={setP('medical_note')} autoComplete="off" />
                <span className="helper"><i className="ti ti-info-circle" /> ถ้าไม่มีโรคประจำตัวและไม่แพ้ยาใด ๆ ให้ใส่ -</span>
              </div>
            </div>
            <div className="form-row full">
              <div className="field">
                <label htmlFor="pf-emer">ผู้ติดต่อกรณีฉุกเฉิน</label>
                <input id="pf-emer" type="text" maxLength={150} placeholder="ชื่อ · ความสัมพันธ์ · เบอร์โทร" value={personal.emergency_contact} onChange={setP('emergency_contact')} />
              </div>
            </div>
            <span className="helper budget-hint"><i className="ti ti-shield-lock" /> ยกเว้นเพศ ช่องอื่นในส่วนนี้ไม่บังคับกรอก · แก้ไขหรือลบออกได้ทุกเมื่อ</span>

            <div className="form-row">
              <div className="field"><label>อีเมล</label><div className="pf-readonly"><i className="ti ti-lock" /> {session.email}</div></div>
              <div className="field"><label>บทบาท</label><div className="pf-readonly"><i className="ti ti-lock" /> {ROLE_LABEL[session.role]}</div></div>
            </div>
            <span className="helper budget-hint"><i className="ti ti-info-circle" /> อีเมลและบทบาทแก้ไขเองไม่ได้ · หากไม่ถูกต้องกรุณาติดต่อผู้ดูแลระบบ</span>
            <div className="pf-actions">
              {blocker && (
                <span className="pf-blocker" role="status">
                  <i className="ti ti-alert-circle" /> บันทึกไม่ได้ · {blocker.msg}
                  <button type="button" onClick={() => goTo(blocker.field)}>ไปที่ช่องนี้</button>
                </span>
              )}
              <button type="button" className="btn btn-outline" onClick={load} disabled={!dirty || saving}>คืนค่าเดิม</button>
              <button type="submit" className="btn btn-primary" disabled={saving || !!blocker || !dirty}>
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
