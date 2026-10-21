import React, { useState } from 'react';
import { useEvents } from '../../hooks/useEvents';
import { ROLE_LABEL } from '../../utils/constants';
import Modal, { ModalHead } from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { initials } from '../../utils/initials';
import NameFields from '../../components/common/NameFields';
import StudentDeptFields from '../../components/common/StudentDeptFields';
import { fullNameTh, joinThai, joinEnglish, hasThai } from '../../utils/personName';

const ROLES = ['admin', 'organizer', 'teacher', 'student'];
const EMPTY = { title_th: '', name: '', title_en: '', name_en: '', email: '', role: 'student', dept: '' };

export default function UsersPage() {
  const { users, upsertUser, toggleUserActive, deleteUser } = useEvents();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [deleteId, setDeleteId] = useState(null);
  // Changes made straight from the table wait here for a confirmation.
  const [roleAsk, setRoleAsk] = useState(null); // { u, role }
  const [activeAsk, setActiveAsk] = useState(null); // the user to suspend or reactivate
  const [confirmOpen, setConfirmOpen] = useState(false);

  const admins = users.filter((u) => u.role === 'admin').length;
  const organizers = users.filter((u) => u.role === 'organizer').length;
  const students = users.filter((u) => u.role === 'student').length;
  const teachers = users.filter((u) => u.role === 'teacher').length;

  function openNew() { setEditingId(null); setForm(EMPTY); setFormOpen(true); }
  function openEdit(u) {
    setEditingId(u.id);
    setForm({ title_th: u.title_th || '', name: u.name, title_en: u.title_en || '', name_en: u.name_en || '', email: u.email, role: u.role, dept: u.dept || '' });
    setFormOpen(true);
  }
  const setField = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  function save() {
    if (!form.name.trim() || !form.email.trim() || (form.name_en.trim() && hasThai(form.name_en))) return;
    setConfirmOpen(true);
  }

  function confirmSave() {
    upsertUser(form, editingId);
    setConfirmOpen(false);
    setFormOpen(false);
  }

  const deleteUserObj = users.find((u) => u.id === deleteId);

  return (
    <div>
      <div className="page-header">
        <div className="ph-inner">
          <div>
            <h1>จัดการผู้ใช้งาน &amp; สิทธิ์การเข้าถึง</h1>
            <p>เพิ่ม แก้ไข ลบบัญชีผู้ใช้ และกำหนดบทบาท (ผู้ดูแลระบบ / ผู้จัดกิจกรรม / อาจารย์ / นักศึกษา) ให้ผู้ใช้แต่ละคน</p>
          </div>
        </div>
      </div>

      <div className="wrap tight">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="sc-top"><div className="sc-icon"><i className="ti ti-shield-check" /></div></div>
            <div className="sc-label">ผู้ดูแลระบบ</div>
            <div className="sc-value">{admins} <small>บัญชี</small></div>
          </div>
          <div className="stat-card accent">
            <div className="sc-top"><div className="sc-icon"><i className="ti ti-user-cog" /></div></div>
            <div className="sc-label">ผู้จัดกิจกรรม</div>
            <div className="sc-value">{organizers} <small>บัญชี</small></div>
          </div>
          <div className="stat-card dark">
            <div className="sc-top"><div className="sc-icon"><i className="ti ti-users" /></div></div>
            <div className="sc-label">นักศึกษา / ผู้เข้าร่วม</div>
            <div className="sc-value">{students} <small>บัญชี</small></div>
          </div>
          <div className="stat-card">
            <div className="sc-top"><div className="sc-icon"><i className="ti ti-school" /></div></div>
            <div className="sc-label">อาจารย์</div>
            <div className="sc-value">{teachers} <small>บัญชี</small></div>
          </div>
        </div>

        <div className="table-card">
          <div className="table-toolbar">
            <h3><i className="ti ti-users-group" /> รายชื่อผู้ใช้งาน <span className="count">{users.length}</span></h3>
            <div className="tools"><button className="btn btn-primary" style={{ padding: '7px 12px' }} onClick={openNew}><i className="ti ti-plus" /> เพิ่ม</button></div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>ผู้ใช้งาน</th><th>สังกัด / ตำแหน่ง</th><th>บทบาท</th><th className="center">สถานะ</th><th className="right">การจัดการ</th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="ev-cell">
                        <div className={`ev-thumb ${u.role === 'organizer' ? 'alt' : u.role === 'student' || u.role === 'teacher' ? 'dark' : ''}`}>{initials(u.name)}</div>
                        <div><div className="ev-title">{fullNameTh(u)}</div><div className="ev-sub">{u.email}</div></div>
                      </div>
                    </td>
                    <td><div className="ev-sub" style={{ fontSize: 13, color: 'var(--c4-70)' }}>{u.dept}</div></td>
                    <td>
                      <select className="role-select" value={u.role} onChange={(e) => setRoleAsk({ u, role: e.target.value })}>
                        {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                      </select>
                    </td>
                    <td className="center">
                      {u.active
                        ? <span className="pill-status ps-pass"><i className="ti ti-circle-check-filled" /> เปิดใช้งาน</span>
                        : <span className="pill-status ps-fail"><i className="ti ti-circle-x" /> ระงับ</span>}
                    </td>
                    <td className="right">
                      <div className="row-actions">
                        <button className="icon-btn" title="แก้ไข" onClick={() => openEdit(u)}><i className="ti ti-edit" /></button>
                        <button className="icon-btn" title={u.active ? 'ระงับ' : 'เปิดใช้งาน'} onClick={() => setActiveAsk(u)}><i className={`ti ${u.active ? 'ti-lock' : 'ti-lock-open'}`} /></button>
                        <button className="icon-btn danger" title="ลบ" onClick={() => setDeleteId(u.id)}><i className="ti ti-trash" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-foot"><span>แสดงผู้ใช้งานในระบบทั้งหมด · เปลี่ยนบทบาทได้ทันทีจากคอลัมน์ "บทบาท"</span></div>
        </div>
      </div>

      <Modal open={formOpen && !confirmOpen} onClose={() => setFormOpen(false)} size="sm">
        <ModalHead eyebrow={editingId ? 'แก้ไขผู้ใช้งาน' : 'เพิ่มผู้ใช้งาน'} icon="ti-user-plus" title={editingId ? joinThai(form.title_th, form.name) : 'เพิ่มผู้ใช้งานใหม่'} onClose={() => setFormOpen(false)} />
        <div className="modal-body">
          <NameFields
            key={editingId || 'new'} idPrefix="um" student={form.role === 'student'}
            titleTh={form.title_th} setTitleTh={setField('title_th')} name={form.name} setName={setField('name')}
            titleEn={form.title_en} setTitleEn={setField('title_en')} nameEn={form.name_en} setNameEn={setField('name_en')}
          />
          <div className="form-row full"><div className="field"><label>อีเมล @silpakorn.edu <span className="req">*</span></label><input type="text" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div></div>
          <div className={form.role === 'student' ? 'form-row full' : 'form-row'}>
            <div className="field"><label>บทบาท</label><select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></div>
            {form.role !== 'student' && <div className="field"><label>สังกัด / หน่วยงาน</label><input type="text" value={form.dept} onChange={(e) => setForm((f) => ({ ...f, dept: e.target.value }))} /></div>}
          </div>
          {form.role === 'student' && <StudentDeptFields key={editingId || 'new'} idPrefix="um" value={form.dept} onChange={setField('dept')} />}
        </div>
        <div className="modal-foot">
          <button className="btn btn-outline" onClick={() => setFormOpen(false)}>ยกเลิก</button>
          <button className="btn btn-primary" onClick={save}><i className="ti ti-device-floppy" /> บันทึก</button>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        eyebrow="ยืนยันการบันทึก"
        icon="ti-device-floppy"
        title={editingId ? 'บันทึกการแก้ไขผู้ใช้งาน?' : 'เพิ่มผู้ใช้งานใหม่?'}
        confirmLabel="ยืนยันบันทึก"
        confirmIcon="ti-device-floppy"
        onConfirm={confirmSave}
        onCancel={() => setConfirmOpen(false)}
      >
        <p style={{ fontSize: 13.5, color: 'var(--c4-70)', lineHeight: 1.7 }}>
          <strong style={{ color: 'var(--c4)' }}>{joinThai(form.title_th, form.name)}</strong>{form.name_en ? ` · ${joinEnglish(form.title_en, form.name_en)}` : ''}<br />
          {form.email}<br />
          บทบาท: <strong style={{ color: 'var(--c4)' }}>{ROLE_LABEL[form.role]}</strong>{form.dept ? ` · ${form.dept}` : ''}
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={!!roleAsk}
        eyebrow="ยืนยันการเปลี่ยนบทบาท"
        icon="ti-user-cog"
        title="เปลี่ยนบทบาทผู้ใช้นี้?"
        confirmLabel="เปลี่ยนบทบาท"
        confirmIcon="ti-check"
        onConfirm={() => { upsertUser({ ...roleAsk.u, role: roleAsk.role }, roleAsk.u.id); setRoleAsk(null); }}
        onCancel={() => setRoleAsk(null)}
      >
        {roleAsk && (
          <p style={{ fontSize: 13.5, color: 'var(--c4-70)', lineHeight: 1.7 }}>
            <strong style={{ color: 'var(--c4)' }}>{fullNameTh(roleAsk.u)}</strong> ({roleAsk.u.email})<br />
            จาก <strong style={{ color: 'var(--c4)' }}>{ROLE_LABEL[roleAsk.u.role]}</strong> เป็น <strong style={{ color: 'var(--c4)' }}>{ROLE_LABEL[roleAsk.role]}</strong><br />
            เมนูและสิทธิ์ของผู้ใช้นี้จะเปลี่ยนเมื่อเข้าสู่ระบบครั้งถัดไป
          </p>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={!!activeAsk}
        eyebrow={activeAsk?.active ? 'ยืนยันการระงับบัญชี' : 'ยืนยันการเปิดใช้งาน'}
        icon={activeAsk?.active ? 'ti-lock' : 'ti-lock-open'}
        title={activeAsk?.active ? 'ระงับบัญชีนี้?' : 'เปิดใช้งานบัญชีนี้?'}
        confirmLabel={activeAsk?.active ? 'ระงับบัญชี' : 'เปิดใช้งาน'}
        confirmIcon={activeAsk?.active ? 'ti-lock' : 'ti-lock-open'}
        onConfirm={() => { toggleUserActive(activeAsk.id); setActiveAsk(null); }}
        onCancel={() => setActiveAsk(null)}
      >
        {activeAsk && (
          <p style={{ fontSize: 13.5, color: 'var(--c4-70)', lineHeight: 1.7 }}>
            <strong style={{ color: 'var(--c4)' }}>{activeAsk.name}</strong> ({activeAsk.email})<br />
            {activeAsk.active ? 'ผู้ใช้นี้จะเข้าสู่ระบบไม่ได้จนกว่าจะเปิดใช้งานอีกครั้ง' : 'ผู้ใช้นี้จะกลับมาเข้าสู่ระบบได้ตามปกติ'}
          </p>
        )}
      </ConfirmDialog>

      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} size="sm">
        <ModalHead eyebrow="ยืนยันการลบ" icon="ti-alert-triangle" title="ลบผู้ใช้งานนี้?" onClose={() => setDeleteId(null)} />
        <div className="modal-body">
          <p style={{ fontSize: 14, color: 'var(--c4-70)', lineHeight: 1.6 }}>ลบบัญชี <strong>{deleteUserObj?.name}</strong> ออกจากระบบ?</p>
          <p style={{ fontSize: 12.5, color: 'var(--c4-60)', lineHeight: 1.6, marginTop: 8 }}>
            <i className="ti ti-info-circle" /> ลบได้เฉพาะบัญชีที่ยังไม่มีประวัติกิจกรรม (เช่น สร้างผิด) · บัญชีที่เคยลงทะเบียนหรือจัดกิจกรรมแล้วให้ใช้ "ระงับ" แทน เพื่อให้ข้อมูลย้อนหลังและรายงานรายปีไม่เปลี่ยน
          </p>
        </div>
        <div className="modal-foot">
          <button className="btn btn-outline" onClick={() => setDeleteId(null)}>ยกเลิก</button>
          <button className="btn btn-dark" onClick={() => { deleteUser(deleteId); setDeleteId(null); }}><i className="ti ti-trash" /> ลบ</button>
        </div>
      </Modal>
    </div>
  );
}
