import React, { useRef, useState } from 'react';
import { fileToDataUrl } from '../../../utils/fileToDataUrl';
import ImageViewer from '../../../components/ui/ImageViewer';
import { removeSignatureBackground } from '../utils/signatureBackground';
import './SignatureUpload.css';

const MAX_BYTES = 1024 * 1024; // matches the limit the backend enforces
const ACCEPT = ['image/png', 'image/jpeg'];

/**
 * The signer's scanned signature, printed above their name on the
 * certificate. Optional — without one, a certificate on an uploaded template
 * shows just the name, and the built-in design keeps its decorative stroke.
 * `value` is a data: URL or null.
 */
export default function SignatureUpload({ value, onChange }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [viewerOpen, setViewerOpen] = useState(false);
  // Background removal: on by default for new uploads; a signature that was
  // already saved starts unticked (it is shown as stored) and can be cut by
  // ticking the box. The untouched image is kept (this session only) so the
  // organizer can switch the cut off again.
  const [autoCut, setAutoCut] = useState(!value);
  const [original, setOriginal] = useState(null);
  const [cutState, setCutState] = useState('idle'); // idle | working | done | unchanged
  const source = original || value;

  // Applies (or undoes) the background cut to `src` and hands the result up.
  async function apply(src, cut) {
    if (!cut) { setCutState('idle'); onChange(src); return; }
    setCutState('working');
    try {
      const res = await removeSignatureBackground(src);
      setCutState(res.changed ? 'done' : 'unchanged');
      onChange(res.dataUrl);
    } catch {
      setCutState('idle');
      setError('ตัดพื้นหลังไม่สำเร็จ ระบบใช้รูปเดิมแทน');
      onChange(src);
    }
  }

  function toggleCut(next) {
    setAutoCut(next);
    setError('');
    if (source) apply(source, next);
  }

  async function accept(file) {
    if (!file) return;
    if (!ACCEPT.includes(file.type)) { setError('รองรับเฉพาะไฟล์ PNG หรือ JPG'); return; }
    if (file.size > MAX_BYTES) { setError(`ไฟล์มีขนาด ${(file.size / 1024 / 1024).toFixed(1)} MB · เกินขนาดสูงสุด 1 MB`); return; }
    try {
      const dataUrl = await fileToDataUrl(file);
      setError('');
      setOriginal(dataUrl);
      await apply(dataUrl, autoCut);
    } catch {
      setError('อ่านไฟล์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    }
  }

  const pick = () => inputRef.current?.click();
  const dropHandlers = {
    onDragOver: (e) => { e.preventDefault(); setDragOver(true); },
    onDragLeave: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); },
    onDrop: (e) => { e.preventDefault(); setDragOver(false); accept(e.dataTransfer.files?.[0]); },
  };

  return (
    <div className="sgu">
      <input ref={inputRef} type="file" accept={ACCEPT.join(',')} hidden onChange={(e) => { accept(e.target.files?.[0]); e.target.value = ''; }} />

      {value ? (
        <div className={`sgu-filled${dragOver ? ' drag' : ''}`} {...dropHandlers}>
          <button type="button" className={`sgu-preview${cutState === 'done' ? ' cut' : ''}`} onClick={() => setViewerOpen(true)} aria-label="ดูรูปลายเซ็นเต็มจอและซูม" title="คลิกเพื่อดูเต็มจอและซูม">
            <img src={value} alt="ลายเซ็นผู้ลงนาม" />
            <span className="sgu-zoom"><i className="ti ti-zoom-in" /></span>
          </button>
          <div className="sgu-side">
            <div className="sgu-status">
              <i className="ti ti-circle-check-filled" /> ใช้ลายเซ็นนี้บนเกียรติบัตร
              {cutState === 'working' && <span className="sgu-note"> · กำลังตัดพื้นหลัง...</span>}
              {cutState === 'done' && <span className="sgu-note"> · ตัดพื้นหลังแล้ว</span>}
              {cutState === 'unchanged' && <span className="sgu-note"> · แยกเส้นลายเซ็นจากพื้นหลังไม่ได้ ใช้รูปเดิม</span>}
            </div>
            <div className="sgu-actions">
              <button type="button" className="btn btn-outline" onClick={() => setViewerOpen(true)}><i className="ti ti-zoom-in" /> ดูเต็มจอ</button>
              <button type="button" className="btn btn-outline" onClick={pick}><i className="ti ti-replace" /> เปลี่ยน</button>
              <button type="button" className="btn btn-outline sgu-remove" onClick={() => { onChange(null); setOriginal(null); setCutState('idle'); setError(''); }}><i className="ti ti-trash" /> ลบ</button>
            </div>
          </div>
        </div>
      ) : (
        <div
          className={`sgu-empty${dragOver ? ' drag' : ''}${error ? ' has-error' : ''}`}
          role="button"
          tabIndex={0}
          onClick={pick}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } }}
          {...dropHandlers}
        >
          <i className={`ti ${dragOver ? 'ti-download' : 'ti-signature'} sgu-empty-ic`} />
          <div>
            <div className="sgu-empty-title">{dragOver ? 'วางไฟล์ที่นี่' : <>ลากรูปลายเซ็นมาวาง หรือ <span className="sgu-browse">เลือกไฟล์</span></>}</div>
            <div className="sgu-empty-hint">PNG หรือ JPG · สูงสุด 1 MB · ถ่ายหรือสแกนลายเซ็นบนกระดาษขาวได้เลย</div>
          </div>
        </div>
      )}

      <label className="sgu-cut">
        <input type="checkbox" checked={autoCut} disabled={cutState === 'working'} onChange={(e) => toggleCut(e.target.checked)} />
        <span>ตัดพื้นหลังออกอัตโนมัติ <small>เหลือเฉพาะเส้นลายเซ็น วางบน template ได้โดยไม่มีกรอบขาว</small></span>
      </label>

      <ImageViewer open={viewerOpen && !!value} src={value} title="รูปลายเซ็นผู้ลงนาม" paper onClose={() => setViewerOpen(false)} />

      {error && <div className="sgu-error" role="alert"><i className="ti ti-alert-circle" /> {error}</div>}
    </div>
  );
}
