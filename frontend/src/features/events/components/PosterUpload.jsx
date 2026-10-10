import React, { useRef, useState } from 'react';
import { fileToDataUrl } from '../../../utils/fileToDataUrl';
import ImageViewer from '../../../components/ui/ImageViewer';
import './PosterUpload.css';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = ['image/jpeg', 'image/png'];

function formatBytes(n) {
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

// Size of the image a base64 data: URL carries (for a poster loaded from the
// server, where there is no File object to ask).
function dataUrlBytes(dataUrl) {
  const b64 = (dataUrl || '').split(',')[1] || '';
  return Math.floor(b64.length * 3 / 4);
}

/**
 * Event poster field: a drop zone when empty; once a poster is chosen, a
 * preview with its details and explicit view / replace / remove actions.
 * `value` is the poster as a data: URL (or null).
 */
export default function PosterUpload({ value, onChange, onError }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [dims, setDims] = useState(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  function fail(msg) {
    setError(msg);
    onError?.(msg);
  }

  async function accept(file) {
    if (!file) return;
    if (!ACCEPT.includes(file.type)) { fail('รองรับเฉพาะไฟล์ JPG หรือ PNG'); return; }
    if (file.size > MAX_BYTES) { fail(`ไฟล์มีขนาด ${formatBytes(file.size)} · เกินขนาดสูงสุด 5 MB`); return; }
    try {
      const dataUrl = await fileToDataUrl(file);
      setError('');
      setFileName(file.name);
      setDims(null);
      onChange(dataUrl);
    } catch {
      fail('อ่านไฟล์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    }
  }

  const pick = () => inputRef.current?.click();

  const dropHandlers = {
    onDragOver: (e) => { e.preventDefault(); setDragOver(true); },
    onDragLeave: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); },
    onDrop: (e) => { e.preventDefault(); setDragOver(false); accept(e.dataTransfer.files?.[0]); },
  };

  return (
    <div className="pup">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT.join(',')}
        hidden
        onChange={(e) => { accept(e.target.files?.[0]); e.target.value = ''; }}
      />

      {value ? (
        <div className={`pup-filled${dragOver ? ' drag' : ''}`} {...dropHandlers}>
          <button type="button" className="pup-thumb" onClick={() => setViewerOpen(true)} aria-label="ดูภาพเต็มและซูม">
            <img src={value} alt="โปสเตอร์กิจกรรม" onLoad={(e) => setDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
            <span className="pup-thumb-zoom"><i className="ti ti-zoom-in" /> คลิกเพื่อดูภาพเต็ม</span>
          </button>
          <div className="pup-info">
            <div className="pup-status"><i className="ti ti-circle-check-filled" /> อัปโหลดโปสเตอร์แล้ว</div>
            <div className="pup-name">{fileName || 'โปสเตอร์ปัจจุบัน'}</div>
            <div className="pup-meta">
              {dims && <span><i className="ti ti-dimensions" /> {dims.w} × {dims.h} px</span>}
              <span><i className="ti ti-file" /> {formatBytes(dataUrlBytes(value))}</span>
            </div>
            <div className="pup-actions">
              <button type="button" className="btn btn-primary" onClick={() => setViewerOpen(true)}><i className="ti ti-zoom-in" /> ดูภาพเต็ม</button>
              <button type="button" className="btn btn-outline" onClick={pick}><i className="ti ti-replace" /> เปลี่ยนรูป</button>
              <button type="button" className="btn btn-outline pup-remove" onClick={() => { onChange(null); setFileName(''); setDims(null); setError(''); }}><i className="ti ti-trash" /> ลบ</button>
            </div>
            <div className="pup-tip">ลากไฟล์ใหม่มาวางบริเวณนี้เพื่อเปลี่ยนรูปได้ · JPG หรือ PNG · สูงสุด 5 MB</div>
          </div>
          {dragOver && <div className="pup-drop-cover"><i className="ti ti-replace" /> วางไฟล์เพื่อเปลี่ยนโปสเตอร์</div>}
        </div>
      ) : (
        <div
          className={`pup-empty${dragOver ? ' drag' : ''}${error ? ' has-error' : ''}`}
          role="button"
          tabIndex={0}
          onClick={pick}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } }}
          {...dropHandlers}
        >
          <div className="pup-empty-ic"><i className={`ti ${dragOver ? 'ti-download' : 'ti-cloud-upload'}`} /></div>
          <div className="pup-empty-title">{dragOver ? 'วางไฟล์ที่นี่เพื่ออัปโหลด' : 'ลากไฟล์โปสเตอร์มาวางที่นี่'}</div>
          {!dragOver && <div className="pup-empty-or">หรือ <span className="pup-browse">เลือกไฟล์จากเครื่อง</span></div>}
          <div className="pup-empty-hint">JPG หรือ PNG · สูงสุด 5 MB · แนะนำแนวตั้ง 4:5 เช่น 1080 × 1350 px</div>
        </div>
      )}

      {error && <div className="pup-error" role="alert"><i className="ti ti-alert-circle" /> {error}</div>}

      <ImageViewer open={viewerOpen} src={value} title="โปสเตอร์กิจกรรม" onClose={() => setViewerOpen(false)} />
    </div>
  );
}
