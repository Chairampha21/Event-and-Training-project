import React, { useEffect, useState } from 'react';
import { useEvents } from '../../hooks/useEvents';
import Modal, { ModalHead } from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { api } from '../../services/api';
import { STUDENT_YEARS } from '../../utils/constants';
import { studentProgram, studentYearKey } from '../../components/common/StudentDeptFields';

const SORTS = [
  { key: 'newest', label: 'บันทึกล่าสุดก่อน' },
  { key: 'oldest', label: 'บันทึกเก่าสุดก่อน' },
  { key: 'absent-desc', label: 'ขาดมากไปน้อย' },
  { key: 'absent-asc', label: 'ขาดน้อยไปมาก' },
  { key: 'name', label: 'ชื่อ ก–ฮ' },
  { key: 'sid', label: 'รหัสนักศึกษา' },
];
const PROGRAM_TAG = { cs: 'CS', it: 'IT' };
const PROGRAM_NAME = { cs: 'วิทยาการคอมพิวเตอร์ (CS)', it: 'เทคโนโลยีสารสนเทศ (IT)' };
const yearLabel = (dept) => STUDENT_YEARS.find((y) => y.key === studentYearKey(dept))?.label || '–';
const programLabel = (dept) => PROGRAM_NAME[studentProgram(dept)] || '–';
// "ปี 3 · CS" for the search suggestions; '' when the profile has neither.
const deptText = (dept) => [STUDENT_YEARS.find((y) => y.key === studentYearKey(dept))?.label, PROGRAM_TAG[studentProgram(dept)]].filter(Boolean).join(' · ');

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts.replace(' ', 'T'));
  return isNaN(d) ? ts : d.toLocaleDateString('th-TH');
}

export default function BlacklistPage() {
  const { blacklist, addToBlacklist, restoreFromBlacklist } = useEvents();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', sid: '', reason: '', dept: '' });
  const [restoreId, setRestoreId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [sidMatches, setSidMatches] = useState([]);

  const sidQuery = form.sid.trim();
  useEffect(() => {
    if (!sidQuery) { setSidMatches([]); setForm((f) => ({ ...f, dept: '' })); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const { users } = await api.get(`/blacklist/lookup?q=${encodeURIComponent(sidQuery)}`);
        if (cancelled) return;
        const exact = users.find((u) => u.student_id === sidQuery);
        if (exact) {
          setForm((f) => ({ ...f, name: exact.name || '', email: exact.email || '', dept: exact.dept || '' }));
          setSidMatches([]);
        } else {
          setForm((f) => ({ ...f, dept: '' }));
          setSidMatches(users);
        }
      } catch {
        if (!cancelled) setSidMatches([]);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [sidQuery]);

  function pickUser(u) {
    setForm((f) => ({ ...f, name: u.name || '', email: u.email || '', sid: u.student_id || '', dept: u.dept || '' }));
    setSidMatches([]);
  }

  const [yearFilter, setYearFilter] = useState('all'); // 'all' | '1'..'5' | 'none'
  const [programFilter, setProgramFilter] = useState('all'); // 'all' | 'cs' | 'it' | 'none'
  const [sortBy, setSortBy] = useState('newest');

  const q = search.trim().toLowerCase();
  const filtered = blacklist
    .filter((u) => !q ||
      (u.student_id || '').toLowerCase().includes(q) ||
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q))
    .filter((u) => {
      if (yearFilter === 'all') return true;
      const y = studentYearKey(u.dept);
      return yearFilter === 'none' ? !y : y === yearFilter;
    })
    .filter((u) => {
      if (programFilter === 'all') return true;
      const p = studentProgram(u.dept);
      return programFilter === 'none' ? !p : p === programFilter;
    });
  const byDate = (a, b) => (a.created_at || '').localeCompare(b.created_at || '');
  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'oldest': return byDate(a, b);
      case 'absent-desc': return (b.absence_count || 0) - (a.absence_count || 0) || byDate(b, a);
      case 'absent-asc': return (a.absence_count || 0) - (b.absence_count || 0) || byDate(b, a);
      case 'name': return (a.name || '').localeCompare(b.name || '', 'th');
      case 'sid': return (a.student_id || '').localeCompare(b.student_id || '');
      default: return byDate(b, a);
    }
  });
  const narrowed = !!q || yearFilter !== 'all' || programFilter !== 'all';

  // Suspending someone takes effect at once and tells them, so it is asked first.
  const [addAsk, setAddAsk] = useState(false);
  function askAdd() {
    if (!form.name.trim() || !form.reason.trim()) return;
    setAddAsk(true);
  }

  async function addEntry() {
    setAddAsk(false);
    setSaving(true);
    await addToBlacklist(form);
    setSaving(false);
    setForm({ name: '', email: '', sid: '', reason: '', dept: '' });
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
          <div className="bl-tools">
            <div className="field bl-search">
              <input
                type="text"
                placeholder="ค้นหาด้วยรหัสนักศึกษา, ชื่อ หรืออีเมล"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="bl-facets">
              <label className="facet-select"><i className="ti ti-stairs-up" />
                <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} aria-label="กรองตามชั้นปี">
                  <option value="all">ทุกชั้นปี</option>
                  {STUDENT_YEARS.map((y) => <option key={y.key} value={y.key}>{y.label}</option>)}
                  <option value="none">ไม่ระบุชั้นปี</option>
                </select>
              </label>
              <label className="facet-select"><i className="ti ti-school" />
                <select value={programFilter} onChange={(e) => setProgramFilter(e.target.value)} aria-label="กรองตามสาขา">
                  <option value="all">ทุกสาขา</option>
                  <option value="cs">CS</option>
                  <option value="it">IT</option>
                  <option value="none">ไม่ระบุสาขา</option>
                </select>
              </label>
              <label className="facet-select"><i className="ti ti-arrows-sort" />
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="เรียงลำดับ">
                  {SORTS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
              </label>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr><th>ชื่อ–นามสกุล</th><th>รหัสนักศึกษา</th><th className="center">ขาด (ครั้ง)</th><th>เหตุผล</th><th>วันที่บันทึก</th><th>ผู้บันทึก</th><th className="right">การจัดการ</th></tr>
              </thead>
              <tbody>
                {sorted.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--c4-60)', padding: 24 }}>{blacklist.length === 0 ? 'ไม่มีรายชื่อ Blacklist' : narrowed ? 'ไม่พบรายชื่อที่ตรงกับการค้นหาหรือตัวกรอง' : 'ไม่พบรายชื่อ'}</td></tr>}
                {sorted.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="ev-cell">
                        <div className="ev-thumb dark"><i className="ti ti-user-x" /></div>
                        <div><div className="ev-title">{u.name}</div><div className="ev-sub">{u.email}</div></div>
                      </div>
                    </td>
                    <td>
                      <strong>{u.student_id || '–'}</strong>
                      {(studentYearKey(u.dept) || studentProgram(u.dept)) && (
                        <div className="ev-sub">{[STUDENT_YEARS.find((y) => y.key === studentYearKey(u.dept))?.label, PROGRAM_TAG[studentProgram(u.dept)]].filter(Boolean).join(' · ')}</div>
                      )}
                    </td>
                    <td className="center"><span className={`bl-absent${u.absence_count >= 3 ? ' high' : ''}`}>{u.absence_count || 0}</span></td>
                    <td style={{ maxWidth: 260 }}>{u.reason}</td>
                    <td>{formatDate(u.created_at)}</td>
                    <td>{u.created_by_name || (u.created_by ? '–' : 'ระบบ (อัตโนมัติ)')}</td>
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
          <div className="table-foot"><span>แสดง {sorted.length} จาก {blacklist.length} รายการ</span></div>
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
                      <span>{u.name}{deptText(u.dept) && <small style={{ color: 'var(--c4-60)', marginLeft: 6 }}>{deptText(u.dept)}</small>}</span>
                      <strong style={{ color: 'var(--c4-60)' }}>{u.student_id}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="form-row full"><div className="field"><label>ชื่อ–นามสกุล <span className="req">*</span></label><input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div></div>
          <div className="form-row">
            <div className="field"><label>ชั้นปี</label><input type="text" readOnly disabled value={yearLabel(form.dept)} /></div>
            <div className="field"><label>สาขา</label><input type="text" readOnly disabled value={programLabel(form.dept)} /></div>
          </div>
          <span className="helper budget-hint" style={{ display: 'block', marginTop: -8, marginBottom: 14 }}><i className="ti ti-info-circle" /> {form.sid.trim() && !form.dept && !form.name ? 'ไม่พบรหัสนี้ในระบบ · ชั้นปีและสาขาจะแสดงเมื่อเลือกนักศึกษาที่มีบัญชี' : 'ดึงจากโปรไฟล์ของนักศึกษาเมื่อเลือกรหัสนักศึกษา'}</span>
          <div className="form-row full"><div className="field"><label>อีเมล</label><input type="text" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div></div>
          <div className="form-row full"><div className="field"><label>เหตุผล <span className="req">*</span></label><textarea value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} /></div></div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-outline" onClick={() => setAddOpen(false)}>ยกเลิก</button>
          <button className="btn btn-dark" onClick={askAdd} disabled={saving}><i className="ti ti-user-off" /> {saving ? 'กำลังบันทึก...' : 'เพิ่มรายชื่อ'}</button>
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
      <ConfirmDialog
        open={addAsk}
        eyebrow="ระงับสิทธิ์การลงทะเบียน"
        icon="ti-user-off"
        title="เพิ่มรายชื่อเข้า Blacklist?"
        confirmLabel="ระงับสิทธิ์"
        confirmIcon="ti-user-off"
        onConfirm={addEntry}
        onCancel={() => setAddAsk(false)}
      >
        <p style={{ fontSize: 13.5, color: 'var(--c4-70)', lineHeight: 1.7 }}>
          <strong style={{ color: 'var(--c4)' }}>{form.name}</strong>{form.sid && <> (รหัสนักศึกษา {form.sid})</>} จะลงทะเบียนกิจกรรมไม่ได้ทันที และได้รับแจ้งเตือนพร้อมเหตุผล<br />
          เหตุผล: {form.reason}
        </p>
      </ConfirmDialog>
    </div>
  );
}
