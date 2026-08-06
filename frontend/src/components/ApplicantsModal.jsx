import React, { useMemo, useState } from 'react';
import Modal, { ModalHead } from './Modal';
import { useEvents } from '../hooks/useEvents';
import { downloadCsv } from '../utils/csvExport';

function initials(name) {
  const p = (name || '').replace(/^(นาย|น\.ส\.|นางสาว|นาง)\s*/, '').trim().split(' ');
  return (p[0] || '').slice(0, 1) + (p[1] || '').slice(0, 1);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ApplicantsModal({ eventId, open, onClose }) {
  const { evById, rosters, toggleCheckin, signInSheets, setSignInSheet, issueCertificate, pushToast } = useEvents();
  const [query, setQuery] = useState('');

  const ev = eventId ? evById(eventId) : null;
  const roster = useMemo(() => (eventId ? (rosters[eventId] || []) : []), [eventId, rosters]);
  const signInSheet = eventId ? signInSheets[eventId] : null;
  const inCount = roster.filter((p) => p.in).length;
  const pct = roster.length ? Math.round((inCount / roster.length) * 100) : 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return roster.map((p, i) => ({ ...p, i }));
    return roster
      .map((p, i) => ({ ...p, i }))
      .filter((p) => (p.name + ' ' + p.sid).toLowerCase().includes(q));
  }, [roster, query]);

  const allChecked = filtered.length > 0 && filtered.every((p) => p.in);

  function toggleAll() {
    const next = !allChecked;
    filtered.forEach((p) => {
      if (p.in !== next) toggleCheckin(eventId, p.i);
    });
  }

  if (!open || !eventId) return null;

  function onSignInSheetFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    fileToDataUrl(file).then((dataUrl) => {
      setSignInSheet(eventId, dataUrl);
      pushToast('อัปโหลดใบเซ็นชื่อแล้ว', 'ใช้เทียบรายชื่อกับการติ๊กเช็คอินด้านล่าง');
    });
    e.target.value = '';
  }

  function exportRoster() {
    downloadCsv(`รายชื่อผู้เข้าร่วม-${(ev?.title || '').slice(0, 30)}`, roster.map((p, i) => ({
      no: i + 1, sid: p.sid, name: p.name, state: p.in ? 'ตรวจสอบแล้ว' : 'ยังไม่ตรวจสอบ',
    })), [
      { label: 'ลำดับ', value: 'no' },
      { label: 'รหัสนักศึกษา', value: 'sid' },
      { label: 'ชื่อ-สกุล', value: 'name' },
      { label: 'สถานะเช็คอิน', value: 'state' },
    ]);
    pushToast('ดาวน์โหลดรายชื่อแล้ว', 'ไฟล์สำหรับพิมพ์ใบเซ็นชื่อหน้างาน');
  }

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <ModalHead eyebrow="รายชื่อผู้สมัคร · เช็คอิน" icon="ti-users" title={(ev?.title || '').slice(0, 40)} onClose={onClose} />
      <div className="modal-body">
        <div className="ci-summary">
          <div className="ci-ring-wrap">
            <div className="ci-ring" style={{ background: `conic-gradient(var(--c1) ${pct}%, var(--c2-10) ${pct}%)` }}>
              <div className="ci-ring-hole"><b>{pct}%</b></div>
            </div>
          </div>
          <div className="ci-sum-nums">
            <div className="ci-sum-item"><span className="v" style={{ color: 'var(--c1)' }}>{inCount}</span><span className="l">ตรวจสอบแล้ว</span></div>
            <div className="ci-sum-item"><span className="v">{roster.length - inCount}</span><span className="l">ยังไม่ตรวจสอบ</span></div>
            <div className="ci-sum-item"><span className="v">{roster.length}</span><span className="l">ผู้สมัครทั้งหมด</span></div>
          </div>
        </div>

        <div className="ci-toolrow">
          <div className="ci-actions">
            <button className="btn btn-outline" onClick={exportRoster}>
              <i className="ti ti-file-spreadsheet" /> ดาวน์โหลด/ปริ้นรายชื่อ (Excel)
            </button>
            <label className="btn btn-accent" style={{ cursor: 'pointer' }}>
              <i className="ti ti-camera-plus" /> {signInSheet ? 'เปลี่ยนรูปใบเซ็นชื่อ' : 'อัปโหลดรูปใบเซ็นชื่อ'}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={onSignInSheetFile} />
            </label>
          </div>
          <p className="ci-hint"><i className="ti ti-info-circle" /> ปริ้นรายชื่อให้ผู้เข้าร่วมเซ็นหน้างาน ถ่ายรูปใบเซ็นชื่ออัปโหลดไว้เป็นหลักฐาน แล้วติ๊กเช็คอินให้ตรงกับรายชื่อจริงก่อนออกเกียรติบัตร</p>
          {signInSheet && (
            <div className="ci-sheet-preview">
              <img src={signInSheet} alt="ใบเซ็นชื่อผู้เข้าร่วม" />
              <button type="button" className="pu-remove" onClick={() => setSignInSheet(eventId, null)} title="ลบรูป"><i className="ti ti-x" /></button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
          <div className="input-search" style={{ marginBottom: 0 }}>
            <i className="ti ti-search" />
            <input type="text" placeholder="ค้นหารหัสนักศึกษา/ชื่อ..." value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <label className="ci-checkall">
            <span>ตรวจสอบทั้งหมด{query.trim() ? ' (เฉพาะที่ค้นหา)' : ''}</span>
            <button type="button" className={`switch sm${allChecked ? ' on' : ''}`} onClick={toggleAll} disabled={filtered.length === 0} />
          </label>
        </div>

        <div>
          {roster.length === 0 && <div className="empty-state">ยังไม่มีผู้สมัครสำหรับกิจกรรมนี้</div>}
          {roster.length > 0 && filtered.length === 0 && <div className="empty-state">ไม่พบรายชื่อที่ตรงกับคำค้นหา</div>}
          {filtered.map((p) => (
            <div className="ci-row" key={p.sid}>
              <div className="ci-av">{initials(p.name)}</div>
              <div className="ci-info">
                <div className="ci-name">{p.name}</div>
                <div className="ci-id">{p.sid}</div>
              </div>
              <div className="ci-right">
                <span className={`ci-badge${p.in ? ' in' : ''}`}>
                  <i className={`ti ${p.in ? 'ti-circle-check' : 'ti-clock'}`} /> {p.in ? 'ตรวจสอบแล้ว' : 'ยังไม่ตรวจสอบ'}
                </span>
                <button className={`switch sm${p.in ? ' on' : ''}`} onClick={() => toggleCheckin(eventId, p.i)} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="modal-foot">
        <button className="btn btn-outline" onClick={onClose}>ปิด</button>
        <button className="btn btn-primary" onClick={() => { issueCertificate(eventId); onClose(); }}>
          <i className="ti ti-certificate" /> เปิดสิทธิ์เกียรติบัตรให้ผู้เข้าร่วม
        </button>
      </div>
    </Modal>
  );
}
