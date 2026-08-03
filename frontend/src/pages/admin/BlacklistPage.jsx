import React, { useState } from 'react';
import useLocalStorage from '../../hooks/useLocalStorage';
import { useEvents } from '../../hooks/useEvents';
import Modal, { ModalHead } from '../../components/Modal';

const SEED = [
  { id: 'bl1', name: 'ธนวัฒน์ ทองอำนวย', email: 'thanawat_t@silpakorn.edu', sid: '660710004', reason: 'ขาดกิจกรรม 3 ครั้งติดกันโดยไม่แจ้งล่วงหน้า', by: 'ผศ.ดร. ปิยะ', date: '02 ก.ค. 2568' },
  { id: 'bl2', name: 'น.ส. กชกร เจริญสุข', email: 'kotchakon_j@silpakorn.edu', sid: '680710008', reason: 'เช็คอินแทนผู้อื่นในกิจกรรม SQL Bootcamp', by: 'วรันธร สอนสงวน', date: '17 ก.ค. 2568' },
];

export default function BlacklistPage() {
  const { session, pushToast } = useEvents();
  // Bumped to :v2 — earlier cached data used masked "xxxxx" student IDs.
  const [list, setList] = useLocalStorage('cpsu-etms:blacklist:v2', SEED);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', sid: '', reason: '' });
  const [restoreId, setRestoreId] = useState(null);

  function addEntry() {
    if (!form.name.trim() || !form.reason.trim()) return;
    setList((l) => [{ id: 'bl' + Date.now(), ...form, by: session.name, date: new Date().toLocaleDateString('th-TH') }, ...l]);
    pushToast('เพิ่มรายชื่อ Blacklist แล้ว', form.name, 'warn');
    setForm({ name: '', email: '', sid: '', reason: '' });
    setAddOpen(false);
  }

  function restore(id) {
    const u = list.find((x) => x.id === id);
    setList((l) => l.filter((x) => x.id !== id));
    if (u) pushToast('คืนสิทธิ์ผู้ใช้งานแล้ว', u.name);
    setRestoreId(null);
  }

  const restoreUser = list.find((x) => x.id === restoreId);

  return (
    <div>
      <div className="page-header">
        <div className="ph-inner">
          <div>
            <h1>รายชื่อ Blacklist</h1>
            <p>ผู้ที่ถูกระงับสิทธิ์การเข้าร่วมกิจกรรม จะไม่สามารถลงทะเบียนกิจกรรมใหม่ได้จนกว่าจะถอดออกจากรายการ</p>
          </div>
        </div>
      </div>

      <div className="wrap tight">
        <div className="section-head">
          <div><div className="sh-title">รายชื่อ Blacklist <span className="count">{list.length} รายการ</span></div><div className="sh-sub">ผู้ที่ถูกเฝ้าระวังการเข้าร่วมกิจกรรม จะไม่สามารถลงทะเบียนกิจกรรมใหม่ได้จนกว่าจะถอดออก</div></div>
          <button className="btn btn-primary" onClick={() => setAddOpen(true)}><i className="ti ti-plus" /> เพิ่มรายชื่อ</button>
        </div>

        <div className="table-card">
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr><th>ชื่อ–นามสกุล</th><th>รหัสนักศึกษา</th><th>เหตุผล</th><th>วันที่บันทึก</th><th>ผู้บันทึก</th><th className="right">การจัดการ</th></tr>
              </thead>
              <tbody>
                {list.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--c4-60)', padding: 24 }}>ไม่มีรายชื่อ Blacklist</td></tr>}
                {list.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="ev-cell">
                        <div className="ev-thumb dark"><i className="ti ti-user-x" /></div>
                        <div><div className="ev-title">{u.name}</div><div className="ev-sub">{u.email}</div></div>
                      </div>
                    </td>
                    <td><strong>{u.sid}</strong></td>
                    <td style={{ maxWidth: 260 }}>{u.reason}</td>
                    <td>{u.date}</td>
                    <td>{u.by}</td>
                    <td className="right">
                      <div className="row-actions">
                        <button className="icon-btn" title="คืนสิทธิ์" onClick={() => setRestoreId(u.id)}><i className="ti ti-user-check" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-foot"><span>แสดง {list.length} จาก {list.length} รายการ</span></div>
        </div>
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} size="sm">
        <ModalHead eyebrow="เพิ่มรายชื่อ" icon="ti-user-off" title="เพิ่มเข้า Blacklist" onClose={() => setAddOpen(false)} />
        <div className="modal-body">
          <div className="form-row full"><div className="field"><label>ชื่อ–นามสกุล <span className="req">*</span></label><input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div></div>
          <div className="form-row full"><div className="field"><label>อีเมล</label><input type="text" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div></div>
          <div className="form-row full"><div className="field"><label>รหัสนักศึกษา</label><input type="text" value={form.sid} onChange={(e) => setForm((f) => ({ ...f, sid: e.target.value }))} /></div></div>
          <div className="form-row full"><div className="field"><label>เหตุผล <span className="req">*</span></label><textarea value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} /></div></div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-outline" onClick={() => setAddOpen(false)}>ยกเลิก</button>
          <button className="btn btn-dark" onClick={addEntry}><i className="ti ti-user-off" /> เพิ่มรายชื่อ</button>
        </div>
      </Modal>

      <Modal open={!!restoreId} onClose={() => setRestoreId(null)} size="sm">
        <ModalHead eyebrow="ยืนยันการคืนสิทธิ์" icon="ti-user-check" title="คืนสิทธิ์ผู้ใช้งานนี้?" onClose={() => setRestoreId(null)} />
        <div className="modal-body"><p style={{ fontSize: 14, color: 'var(--c4-70)', lineHeight: 1.6 }}>คุณกำลังจะถอด <strong>{restoreUser?.name}</strong> {restoreUser?.sid && <>(รหัสนักศึกษา {restoreUser.sid}) </>}ออกจากรายชื่อ Blacklist และคืนสิทธิ์ให้สามารถลงทะเบียนกิจกรรมได้ตามปกติ</p></div>
        <div className="modal-foot">
          <button className="btn btn-outline" onClick={() => setRestoreId(null)}>ยกเลิก</button>
          <button className="btn btn-primary" onClick={() => restore(restoreId)}><i className="ti ti-user-check" /> คืนสิทธิ์</button>
        </div>
      </Modal>
    </div>
  );
}
