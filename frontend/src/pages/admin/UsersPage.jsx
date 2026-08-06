import React, { useState } from 'react';
import { useEvents } from '../../hooks/useEvents';
import { ROLE_LABEL } from '../../utils/constants';
import Modal, { ModalHead } from '../../components/Modal';

function initials(name) {
  const p = (name || '').replace(/^(นาย|น\.ส\.|นางสาว|นาง|ผศ\.ดร\.|อ\.ดร\.|อ\.|ศ\.ดร\.)\s*/, '').trim().split(' ');
  return (p[0] || '').slice(0, 1) + (p[1] || '').slice(0, 1);
}

const ROLES = ['admin', 'organizer', 'student'];
const EMPTY = { name: '', email: '', role: 'student', dept: '' };

export default function UsersPage() {
  const { users, upsertUser, toggleUserActive, deleteUser } = useEvents();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [deleteId, setDeleteId] = useState(null);

  const admins = users.filter((u) => u.role === 'admin').length;
  const organizers = users.filter((u) => u.role === 'organizer').length;
  const students = users.filter((u) => u.role === 'student').length;

  function openNew() { setEditingId(null); setForm(EMPTY); setFormOpen(true); }
  function openEdit(u) { setEditingId(u.id); setForm({ name: u.name, email: u.email, role: u.role, dept: u.dept }); setFormOpen(true); }

  function save() {
    if (!form.name.trim() || !form.email.trim()) return;
    upsertUser(form, editingId);
    setFormOpen(false);
  }

  const deleteUserObj = users.find((u) => u.id === deleteId);

  return (
    <div>
      <div className="page-header">
        <div className="ph-inner">
          <div>
            <h1>จัดการผู้ใช้งาน &amp; สิทธิ์การเข้าถึง</h1>
            <p>เพิ่ม แก้ไข ลบบัญชีผู้ใช้ และกำหนดบทบาท (ผู้ดูแลระบบ / ผู้จัดกิจกรรม / นักศึกษา) ให้ผู้ใช้แต่ละคน</p>
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
            <div className="sc-top"><div className="sc-icon"><i className="ti ti-mail-check" /></div></div>
            <div className="sc-label">ยืนยันด้วย @silpakorn.edu</div>
            <div className="sc-value">100<small>%</small></div>
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
                        <div className={`ev-thumb ${u.role === 'organizer' ? 'alt' : u.role === 'student' ? 'dark' : ''}`}>{initials(u.name)}</div>
                        <div><div className="ev-title">{u.name}</div><div className="ev-sub">{u.email}</div></div>
                      </div>
                    </td>
                    <td><div className="ev-sub" style={{ fontSize: 13, color: 'var(--c4-70)' }}>{u.dept}</div></td>
                    <td>
                      <select className="role-select" value={u.role} onChange={(e) => upsertUser({ ...u, role: e.target.value }, u.id)}>
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
                        <button className="icon-btn" title={u.active ? 'ระงับ' : 'เปิดใช้งาน'} onClick={() => toggleUserActive(u.id)}><i className={`ti ${u.active ? 'ti-lock' : 'ti-lock-open'}`} /></button>
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

      <Modal open={formOpen} onClose={() => setFormOpen(false)} size="sm">
        <ModalHead eyebrow={editingId ? 'แก้ไขผู้ใช้งาน' : 'เพิ่มผู้ใช้งาน'} icon="ti-user-plus" title={editingId ? form.name : 'เพิ่มผู้ใช้งานใหม่'} onClose={() => setFormOpen(false)} />
        <div className="modal-body">
          <div className="form-row full"><div className="field"><label>ชื่อ–นามสกุล <span className="req">*</span></label><input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div></div>
          <div className="form-row full"><div className="field"><label>อีเมล @silpakorn.edu <span className="req">*</span></label><input type="text" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div></div>
          <div className="form-row">
            <div className="field"><label>บทบาท</label><select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></div>
            <div className="field"><label>สังกัด / หน่วยงาน</label><input type="text" value={form.dept} onChange={(e) => setForm((f) => ({ ...f, dept: e.target.value }))} /></div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-outline" onClick={() => setFormOpen(false)}>ยกเลิก</button>
          <button className="btn btn-primary" onClick={save}><i className="ti ti-device-floppy" /> บันทึก</button>
        </div>
      </Modal>

      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} size="sm">
        <ModalHead eyebrow="ยืนยันการลบ" icon="ti-alert-triangle" title="ลบผู้ใช้งานนี้?" onClose={() => setDeleteId(null)} />
        <div className="modal-body"><p style={{ fontSize: 14, color: 'var(--c4-70)' }}>ลบบัญชี <strong>{deleteUserObj?.name}</strong> ออกจากระบบ?</p></div>
        <div className="modal-foot">
          <button className="btn btn-outline" onClick={() => setDeleteId(null)}>ยกเลิก</button>
          <button className="btn btn-dark" onClick={() => { deleteUser(deleteId); setDeleteId(null); }}><i className="ti ti-trash" /> ลบ</button>
        </div>
      </Modal>
    </div>
  );
}
