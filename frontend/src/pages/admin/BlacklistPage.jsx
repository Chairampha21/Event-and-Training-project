import React, { useEffect, useState } from 'react';
import { useEvents } from '../../hooks/useEvents';
import Modal, { ModalHead } from '../../components/Modal';
import { api } from '../../utils/api';

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts.replace(' ', 'T'));
  return isNaN(d) ? ts : d.toLocaleDateString('th-TH');
}

export default function BlacklistPage() {
  const { blacklist, addToBlacklist, restoreFromBlacklist } = useEvents();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', sid: '', reason: '' });
  const [restoreId, setRestoreId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [sidMatches, setSidMatches] = useState([]);

  const sidQuery = form.sid.trim();
  useEffect(() => {
    if (!sidQuery) { setSidMatches([]); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const { users } = await api.get(`/blacklist/lookup?q=${encodeURIComponent(sidQuery)}`);
        if (cancelled) return;
        const exact = users.find((u) => u.student_id === sidQuery);
        if (exact) {
          setForm((f) => ({ ...f, name: exact.name || '', email: exact.email || '' }));
          setSidMatches([]);
        } else {
          setSidMatches(users);
        }
      } catch {
        if (!cancelled) setSidMatches([]);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [sidQuery]);

  function pickUser(u) {
    setForm((f) => ({ ...f, name: u.name || '', email: u.email || '', sid: u.student_id || '' }));
    setSidMatches([]);
  }

  const q = search.trim().toLowerCase();
  const filtered = q
    ? blacklist.filter((u) =>
        (u.student_id || '').toLowerCase().includes(q) ||
        (u.name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
      )
    : blacklist;

  async function addEntry() {
    if (!form.name.trim() || !form.reason.trim()) return;
    setSaving(true);
    await addToBlacklist(form);
    setSaving(false);
    setForm({ name: '', email: '', sid: '', reason: '' });
    setAddOpen(false);
  }

  async function restore(id) {
    await restoreFromBlacklist(id);
    setRestoreId(null);
  }

  const restoreUser = blacklist.find((x) => x.id === restoreId);

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
          <div><div className="sh-title">รายชื่อ Blacklist <span className="count">{blacklist.length} รายการ</span></div><div className="sh-sub">ผู้ที่ถูกเฝ้าระวังการเข้าร่วมกิจกรรม จะไม่สามารถลงทะเบียนกิจกรรมใหม่ได้จนกว่าจะถอดออก</div></div>
          <button className="btn btn-primary" onClick={() => setAddOpen(true)}><i className="ti ti-plus" /> เพิ่มรายชื่อ</button>
        </div>

        <div className="table-card">
          <div style={{ padding: 16, borderBottom: '1px solid var(--c4-10)' }}>
            <div className="field" style={{ maxWidth: 320 }}>
              <input
                type="text"
                placeholder="ค้นหาด้วยรหัสนักศึกษา, ชื่อ หรืออีเมล"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr><th>ชื่อ–นามสกุล</th><th>รหัสนักศึกษา</th><th>เหตุผล</th><th>วันที่บันทึก</th><th>ผู้บันทึก</th><th className="right">การจัดการ</th></tr>
              </thead>
              <tbody>
                {filtered.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--c4-60)', padding: 24 }}>{blacklist.length === 0 ? 'ไม่มีรายชื่อ Blacklist' : 'ไม่พบรายชื่อที่ค้นหา'}</td></tr>}
                {filtered.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="ev-cell">
                        <div className="ev-thumb dark"><i className="ti ti-user-x" /></div>
                        <div><div className="ev-title">{u.name}</div><div className="ev-sub">{u.email}</div></div>
                      </div>
                    </td>
                    <td><strong>{u.student_id}</strong></td>
                    <td style={{ maxWidth: 260 }}>{u.reason}</td>
                    <td>{formatDate(u.created_at)}</td>
                    <td>{u.created_by_name}</td>
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
          <div className="table-foot"><span>แสดง {filtered.length} จาก {blacklist.length} รายการ</span></div>
        </div>
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} size="sm">
        <ModalHead eyebrow="เพิ่มรายชื่อ" icon="ti-user-off" title="เพิ่มเข้า Blacklist" onClose={() => setAddOpen(false)} />
        <div className="modal-body">
          <div className="form-row full">
            <div className="field" style={{ position: 'relative' }}>
              <label>รหัสนักศึกษา</label>
              <input
                type="text"
                value={form.sid}
                onChange={(e) => setForm((f) => ({ ...f, sid: e.target.value }))}
                onBlur={() => setTimeout(() => setSidMatches([]), 150)}
                placeholder="พิมพ์เพื่อค้นหาจากรหัสนักศึกษาที่ลงทะเบียนในระบบ"
                autoComplete="off"
              />
              {sidMatches.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, background: 'var(--card-bg, #fff)', border: '1px solid var(--c4-10)', borderRadius: 8, marginTop: 4, boxShadow: '0 8px 24px rgba(0,0,0,.12)', maxHeight: 220, overflowY: 'auto' }}>
                  {sidMatches.map((u) => (
                    <div
                      key={u.id}
                      onMouseDown={() => pickUser(u)}
                      style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 8 }}
                      className="sid-suggest-item"
                    >
                      <span>{u.name}</span>
                      <strong style={{ color: 'var(--c4-60)' }}>{u.student_id}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="form-row full"><div className="field"><label>ชื่อ–นามสกุล <span className="req">*</span></label><input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div></div>
          <div className="form-row full"><div className="field"><label>อีเมล</label><input type="text" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div></div>
          <div className="form-row full"><div className="field"><label>เหตุผล <span className="req">*</span></label><textarea value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} /></div></div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-outline" onClick={() => setAddOpen(false)}>ยกเลิก</button>
          <button className="btn btn-dark" onClick={addEntry} disabled={saving}><i className="ti ti-user-off" /> {saving ? 'กำลังบันทึก...' : 'เพิ่มรายชื่อ'}</button>
        </div>
      </Modal>

      <Modal open={!!restoreId} onClose={() => setRestoreId(null)} size="sm">
        <ModalHead eyebrow="ยืนยันการคืนสิทธิ์" icon="ti-user-check" title="คืนสิทธิ์ผู้ใช้งานนี้?" onClose={() => setRestoreId(null)} />
        <div className="modal-body"><p style={{ fontSize: 14, color: 'var(--c4-70)', lineHeight: 1.6 }}>คุณกำลังจะถอด <strong>{restoreUser?.name}</strong> {restoreUser?.student_id && <>(รหัสนักศึกษา {restoreUser.student_id}) </>}ออกจากรายชื่อ Blacklist และคืนสิทธิ์ให้สามารถลงทะเบียนกิจกรรมได้ตามปกติ</p></div>
        <div className="modal-foot">
          <button className="btn btn-outline" onClick={() => setRestoreId(null)}>ยกเลิก</button>
          <button className="btn btn-primary" onClick={() => restore(restoreId)}><i className="ti ti-user-check" /> คืนสิทธิ์</button>
        </div>
      </Modal>
    </div>
  );
}
