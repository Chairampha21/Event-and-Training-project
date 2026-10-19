import React, { useEffect, useState } from 'react';
import { useEvents } from '../../hooks/useEvents';
import CertTemplateUpload from '../../features/certificates/components/CertTemplateUpload';
import SignatureUpload from '../../features/certificates/components/SignatureUpload';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { formatCertDate, formatThaiDateTime, todayIso } from '../../utils/dateFormat';
import '../organizer/CreateEventPage.css';

// Admin only: the department's certificate defaults. Every event that has not
// uploaded a template of its own is printed on this main template, and new
// events start with this signer (the organizer may still change both for their
// own event).
export default function CertificateSettingsPage() {
  const { certDefaults, saveCertDefaults } = useEvents();
  const [template, setTemplate] = useState(null);
  const [layout, setLayout] = useState(null);
  const [signerName, setSignerName] = useState('');
  const [signerTitle, setSignerTitle] = useState('');
  const [signature, setSignature] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Fill the form from what is saved (again after each save).
  useEffect(() => {
    if (!certDefaults) return;
    setTemplate(certDefaults.template);
    setLayout(certDefaults.layout);
    setSignerName(certDefaults.signer.name);
    setSignerTitle(certDefaults.signer.title);
    setSignature(certDefaults.signer.signature);
  }, [certDefaults]);

  if (!certDefaults) return <div className="wrap tight"><p style={{ color: 'var(--c4-60)' }}>กำลังโหลด...</p></div>;

  function save(e) {
    e.preventDefault();
    if (!signerName.trim() || !signerTitle.trim()) { setError('กรอกชื่อผู้ลงนามและตำแหน่งให้ครบ'); return; }
    setError('');
    setConfirmOpen(true);
  }

  async function confirmSave() {
    setSaving(true);
    const ok = await saveCertDefaults({ template, layout, signerName: signerName.trim(), signerTitle: signerTitle.trim(), signature });
    setSaving(false);
    if (ok) setConfirmOpen(false);
  }

  return (
    <div>
      <div className="page-header">
        <div className="ph-inner">
          <div>
            <h1>ตั้งค่าเกียรติบัตร</h1>
            <p>แม่แบบหลักของภาควิชาและผู้ลงนามเริ่มต้น · ใช้กับทุกกิจกรรมที่ไม่ได้อัปโหลด template ของตัวเอง แก้ไขได้เฉพาะผู้ดูแลระบบ</p>
          </div>
        </div>
      </div>

      <form className="wrap tight" onSubmit={save}>
        <div className="form-card setup-card">
          <div className="setup-head">
            <div className="setup-head-text">
              <h2><span className="fc-num">1</span> แม่แบบหลักของภาควิชา</h2>
              <p className="fc-sub">ผู้จัดกิจกรรมยังอัปโหลด template ของกิจกรรมตัวเองได้ · เกียรติบัตรที่ออกหลังบันทึกใช้แม่แบบใหม่ ส่วนที่ออกไปแล้วยังใช้แม่แบบเดิม</p>
            </div>
          </div>
          <CertTemplateUpload
            asDefault
            value={template}
            onChange={setTemplate}
            layout={layout}
            onLayoutChange={setLayout}
            signerName={signerName}
            signerTitle={signerTitle}
            signature={signature}
            eventTitle="ชื่อกิจกรรมตัวอย่าง"
            certDate={formatCertDate(todayIso(), todayIso())}
            category="อบรมเชิงบรรยาย"
          />
        </div>

        <div className="form-card setup-card">
          <div className="setup-head">
            <div className="setup-head-text">
              <h2><span className="fc-num">2</span> ผู้ลงนามเริ่มต้น</h2>
              <p className="fc-sub">กิจกรรมใหม่เริ่มต้นด้วยผู้ลงนามนี้ ผู้จัดเปลี่ยนเฉพาะกิจกรรมของตัวเองได้ · กิจกรรมที่สร้างไว้แล้วไม่เปลี่ยนตาม</p>
            </div>
          </div>
          <div className="form-row">
            <div className="field"><label htmlFor="cd-name">ชื่อผู้ลงนาม <span className="req">*</span></label><div className="with-icon"><i className="ti ti-signature" /><input id="cd-name" type="text" maxLength={190} value={signerName} onChange={(e) => setSignerName(e.target.value)} /></div></div>
            <div className="field"><label htmlFor="cd-title">ตำแหน่ง <span className="req">*</span></label><div className="with-icon"><i className="ti ti-id-badge-2" /><input id="cd-title" type="text" maxLength={190} value={signerTitle} onChange={(e) => setSignerTitle(e.target.value)} /></div></div>
          </div>
          <div className="field">
            <label>รูปลายเซ็นผู้ลงนาม</label>
            <SignatureUpload value={signature} onChange={setSignature} />
            <span className="helper">ไม่บังคับ · แสดงเหนือชื่อผู้ลงนามบนเกียรติบัตร</span>
          </div>
        </div>

        {error && <div className="slip-error" role="alert"><i className="ti ti-alert-circle" /> {error}</div>}
        <div className="pf-actions">
          {certDefaults.updatedAt && (
            <span style={{ marginRight: 'auto', fontSize: 12.5, color: 'var(--c4-60)', alignSelf: 'center' }}>
              แก้ไขล่าสุด {formatThaiDateTime(certDefaults.updatedAt)}{certDefaults.updatedBy ? ` โดย ${certDefaults.updatedBy}` : ''}
            </span>
          )}
          <button type="submit" className="btn btn-primary"><i className="ti ti-device-floppy" /> บันทึกค่าเริ่มต้น</button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmOpen}
        eyebrow="ยืนยันการบันทึก"
        icon="ti-certificate"
        title="บันทึกค่าเริ่มต้นเกียรติบัตร?"
        confirmLabel="ยืนยันบันทึก"
        confirmIcon="ti-device-floppy"
        busy={saving}
        onConfirm={confirmSave}
        onCancel={() => setConfirmOpen(false)}
      >
        <p style={{ fontSize: 13.5, color: 'var(--c4-70)', lineHeight: 1.7 }}>
          แม่แบบ: <strong style={{ color: 'var(--c4)' }}>{template ? 'แม่แบบที่อัปโหลด' : 'แม่แบบที่ติดมากับระบบ'}</strong><br />
          ผู้ลงนาม: <strong style={{ color: 'var(--c4)' }}>{signerName.trim()}</strong> · {signerTitle.trim()}{signature ? ' · มีลายเซ็น' : ''}<br />
          กิจกรรมที่ไม่ได้อัปโหลด template ของตัวเองจะใช้แม่แบบนี้กับเกียรติบัตรที่ออกจากนี้ไป · เกียรติบัตรที่ออกไปแล้วยังใช้แม่แบบเดิม
        </p>
      </ConfirmDialog>
    </div>
  );
}
