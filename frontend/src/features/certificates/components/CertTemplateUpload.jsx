import React, { useEffect, useRef, useState } from 'react';
import { fileToDataUrl } from '../../../utils/fileToDataUrl';
import ImageViewer from '../../../components/ui/ImageViewer';
import { CertOrgOverlay, CertBodyOverlay, CertSignerOverlay } from './CertOverlays';
import { COLOR_PRESETS, DEFAULT_LAYOUT, LAYOUT_LIMITS, analyzeTemplate, isDefaultLayout, layoutVars, normalizeLayout } from '../utils/certLayout';
import './CertTemplateUpload.css';
import { DEFAULT_CERT_TEMPLATE_URL, DEFAULT_TEMPLATE_LAYOUT, mainTemplate } from '../utils/defaultTemplate';
import { useEvents } from '../../../hooks/useEvents';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = ['image/jpeg', 'image/png'];
const A4_RATIO = 297 / 210; // landscape
// A4 landscape in pixels: 3508 x 2480 at 300 dpi (sharp print), 1754 x 1240 at 150 dpi (acceptable).
const PRINT_SHARP_W = 3508;
const PRINT_OK_W = 1754;
const SAMPLE_NAME = 'ชื่อ-นามสกุล ผู้เข้าร่วม';
// Controls of the "fit text to template" panel.
const POSITION_SLIDERS = [
  { key: 'titleTop', label: 'ชื่อภาควิชาและคณะ', hint: 'ระยะจากขอบบน', needsOrg: true },
  { key: 'bodyTop', label: 'ชื่อผู้เข้าร่วมและข้อความ', hint: 'ระยะจากขอบบน' },
  { key: 'signBottom', label: 'ลายเซ็นและผู้ลงนาม', hint: 'ระยะจากขอบล่าง' },
  { key: 'x', label: 'ตำแหน่งซ้าย–ขวา', hint: '50% = กึ่งกลาง' },
];
const SIZE_SLIDERS = [
  { key: 'sTitle', label: 'ชื่อภาควิชาและคณะ', needsOrg: true },
  { key: 'sName', label: 'ชื่อผู้เข้าร่วม' },
  { key: 'sText', label: 'ข้อความและผู้ลงนาม' },
];
const COLOR_FIELDS = [
  { key: 'cDept', label: 'ชื่อภาควิชา', needsOrg: true },
  { key: 'cOrg', label: 'ชื่อคณะ', needsOrg: true },
  { key: 'cName', label: 'ชื่อผู้เข้าร่วม' },
  { key: 'cText', label: 'ข้อความและผู้ลงนาม' },
];

function formatBytes(n) {
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

function dataUrlBytes(dataUrl) {
  const b64 = (dataUrl || '').split(',')[1] || '';
  return Math.floor(b64.length * 3 / 4);
}

// Suitability checks for a certificate background, from its pixel size.
function checkTemplate(dims) {
  if (!dims) return [];
  const ratio = dims.w / dims.h;
  const checks = [];
  if (ratio < 1) {
    checks.push({ ok: false, text: 'ภาพเป็นแนวตั้ง · เกียรติบัตรใช้ A4 แนวนอน ข้อความจะวางไม่ตรงตำแหน่ง' });
  } else if (Math.abs(ratio - A4_RATIO) / A4_RATIO > 0.03) {
    checks.push({ ok: false, text: 'อัตราส่วนไม่ใช่ A4 แนวนอน (297 × 210 มม.) · ตรวจตำแหน่งข้อความในตัวอย่างก่อนใช้' });
  } else {
    checks.push({ ok: true, text: 'อัตราส่วน A4 แนวนอน' });
  }
  if (dims.w >= PRINT_SHARP_W) checks.push({ ok: true, text: 'ความละเอียดคมชัดสำหรับพิมพ์ (300 dpi)' });
  else if (dims.w >= PRINT_OK_W) checks.push({ ok: true, text: 'ความละเอียดพิมพ์ได้ (150 dpi ขึ้นไป)' });
  else checks.push({ ok: false, text: `ความละเอียดต่ำ (กว้าง ${dims.w} px) · อาจไม่คมชัดเมื่อพิมพ์ แนะนำ ${PRINT_SHARP_W} × 2480 px` });
  return checks;
}

/**
 * Certificate template field: a drop zone when empty; once a template is
 * chosen, a live preview with the event's real text laid over it (sample
 * recipient), the file's suitability for an A4 certificate, and explicit
 * preview / replace / remove actions. Uploading is optional — without a
 * template the built-in certificate design is used.
 * `value` is {name, type, dataUrl} or null.
 */
// `asDefault`: used on the admin's settings page to set the department's main
// template itself, so "without an upload" means the template built into the site.
export default function CertTemplateUpload({ value, onChange, layout, onLayoutChange, signerName, signerTitle, signature, eventTitle, certDate, category, asDefault }) {
  const { certDefaults } = useEvents();
  const fallbackUrl = asDefault ? DEFAULT_CERT_TEMPLATE_URL : mainTemplate(certDefaults).url;
  // How the text sits on that template, so its preview matches the real certificate.
  const fallbackLay = normalizeLayout(asDefault ? DEFAULT_TEMPLATE_LAYOUT : mainTemplate(certDefaults).layout);
  const adminSet = !asDefault && !!certDefaults?.template;
  const lay = normalizeLayout(layout);
  const setLayout = (patch) => onLayoutChange({ ...lay, ...patch });
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [dims, setDims] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [fallbackOpen, setFallbackOpen] = useState(false); // the built-in / department template, full screen
  // Only images can sit behind the overlaid text (an older event may still hold a PDF).
  // A stored template arrives as a link to the image; only an old PDF upload can't be drawn on.
  const isImage = !!value?.dataUrl && !value.dataUrl.startsWith('data:application/pdf');
  // The adjust panel starts open only when this event already has a custom layout.
  const [layoutOpen, setLayoutOpen] = useState(() => !isDefaultLayout(layout));
  // The template's own accent colours, offered as swatches so text can match the design.
  const [palette, setPalette] = useState([]);
  useEffect(() => {
    let alive = true;
    if (isImage) analyzeTemplate(value.dataUrl).then((r) => { if (alive) setPalette(r.palette); });
    else setPalette([]);
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.dataUrl]);
  const activePreset = COLOR_PRESETS.find((p) => Object.keys(p.colors).every((k) => p.colors[k] === lay[k]))?.key;

  const checks = checkTemplate(dims);

  async function accept(file) {
    if (!file) return;
    if (!ACCEPT.includes(file.type)) { setError('รองรับเฉพาะไฟล์ JPG หรือ PNG'); return; }
    if (file.size > MAX_BYTES) { setError(`ไฟล์มีขนาด ${formatBytes(file.size)} · เกินขนาดสูงสุด 5 MB`); return; }
    try {
      const dataUrl = await fileToDataUrl(file);
      setError('');
      setDims(null);
      onChange({ name: file.name, type: file.type, dataUrl });
      // A new template starts from the default layout (the department's own
      // colours), switched to white text when the template is dark behind it.
      const { dark } = await analyzeTemplate(dataUrl);
      onLayoutChange({ ...DEFAULT_LAYOUT, ...(dark ? COLOR_PRESETS[2].colors : {}) });
    } catch {
      setError('อ่านไฟล์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    }
  }

  const pick = () => inputRef.current?.click();
  const remove = () => { onChange(null); onLayoutChange({ ...DEFAULT_LAYOUT }); setDims(null); setError(''); };

  const dropHandlers = {
    onDragOver: (e) => { e.preventDefault(); setDragOver(true); },
    onDragLeave: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); },
    onDrop: (e) => { e.preventDefault(); setDragOver(false); accept(e.dataTransfer.files?.[0]); },
  };

  // The certificate as it will look, with a sample recipient.
  const canvas = isImage && (
    <div className="cert-canvas" style={layoutVars(lay)}>
      <img src={value.dataUrl} alt="template เกียรติบัตร" onLoad={(e) => setDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
      {lay.showOrg && <CertOrgOverlay />}
      <CertBodyOverlay name={SAMPLE_NAME} eventTitle={eventTitle || 'ชื่อกิจกรรม'} certDate={certDate || 'วันที่จัดกิจกรรม'} category={category} />
      <CertSignerOverlay name={signerName} title={signerTitle} signature={signature} />
    </div>
  );

  // The same preview on the main template, for an event that uses it.
  const fallbackCanvas = (
    <div className="cert-canvas" style={layoutVars(fallbackLay)}>
      <img src={fallbackUrl} alt="แม่แบบเกียรติบัตรหลักของภาควิชา" />
      {fallbackLay.showOrg && <CertOrgOverlay />}
      <CertBodyOverlay name={SAMPLE_NAME} eventTitle={eventTitle || 'ชื่อกิจกรรม'} certDate={certDate || 'วันที่จัดกิจกรรม'} category={category} />
      <CertSignerOverlay name={signerName} title={signerTitle} signature={signature} />
    </div>
  );

  return (
    <div className="ctu">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT.join(',')}
        hidden
        onChange={(e) => { accept(e.target.files?.[0]); e.target.value = ''; }}
      />

      {isImage ? (
        <div className={`ctu-filled${dragOver ? ' drag' : ''}`} {...dropHandlers}>
          <button type="button" className="ctu-thumb" onClick={() => setPreviewOpen(true)} aria-label="ดูตัวอย่างเกียรติบัตรเต็มจอและซูม">
            {canvas}
            <span className="ctu-thumb-zoom"><i className="ti ti-zoom-in" /> คลิกเพื่อดูเต็มจอและซูม</span>
          </button>
          <div className="ctu-info">
            <div className="ctu-status"><i className="ti ti-circle-check-filled" /> อัปโหลด template แล้ว</div>
            <div className="ctu-name">{value.name && value.name !== 'template' ? value.name : 'template ปัจจุบัน'}</div>
            <div className="ctu-meta">
              {dims && <span><i className="ti ti-dimensions" /> {dims.w} × {dims.h} px</span>}
              {value.dataUrl.startsWith('data:') && <span><i className="ti ti-file" /> {formatBytes(dataUrlBytes(value.dataUrl))}</span>}
            </div>
            {checks.length > 0 && (
              <ul className="ctu-checks">
                {checks.map((c) => (
                  <li key={c.text} className={c.ok ? 'ok' : 'warn'}><i className={`ti ${c.ok ? 'ti-check' : 'ti-alert-triangle'}`} /> {c.text}</li>
                ))}
              </ul>
            )}
            <div className="ctu-actions">
              <button type="button" className="btn btn-primary" onClick={() => setPreviewOpen(true)}><i className="ti ti-zoom-in" /> ดูตัวอย่างเต็มจอ</button>
              <button type="button" className="btn btn-outline" onClick={pick}><i className="ti ti-replace" /> เปลี่ยน template</button>
              <button type="button" className="btn btn-outline ctu-remove" onClick={remove}><i className="ti ti-trash" /> ลบ</button>
            </div>
            <div className="ctu-tip">ตัวอย่างใช้ชื่อสมมติ · {asDefault ? 'ลบ template เพื่อกลับไปใช้แม่แบบที่ติดมากับระบบ' : 'ลบ template เพื่อกลับไปใช้แม่แบบหลักของภาควิชา'}</div>
          </div>
          {dragOver && <div className="ctu-drop-cover"><i className="ti ti-replace" /> วางไฟล์เพื่อเปลี่ยน template</div>}
        </div>
      ) : (
        <>
          {value && (
            <div className="ctu-legacy" role="alert">
              <i className="ti ti-alert-triangle" />
              <span>ไฟล์ template เดิม ({value.name}) ไม่ใช่รูปภาพ ระบบวางชื่อผู้เข้าร่วมทับไม่ได้ กรุณาอัปโหลดใหม่เป็น JPG หรือ PNG</span>
              <button type="button" className="btn btn-outline ctu-remove" onClick={remove}><i className="ti ti-trash" /> ลบไฟล์เดิม</button>
            </div>
          )}
          <div
            className={`ctu-empty${dragOver ? ' drag' : ''}${error ? ' has-error' : ''}`}
            role="button"
            tabIndex={0}
            onClick={pick}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } }}
            {...dropHandlers}
          >
            <div className="ctu-empty-ic"><i className={`ti ${dragOver ? 'ti-download' : 'ti-certificate'}`} /></div>
            <div className="ctu-empty-title">{dragOver ? 'วางไฟล์ที่นี่เพื่ออัปโหลด' : 'ลากไฟล์ template เกียรติบัตรมาวางที่นี่'}</div>
            {!dragOver && <div className="ctu-empty-or">หรือ <span className="ctu-browse">เลือกไฟล์จากเครื่อง</span></div>}
            <div className="ctu-empty-hint">JPG หรือ PNG · สูงสุด 5 MB · A4 แนวนอน แนะนำ {PRINT_SHARP_W} × 2480 px</div>
            <div className="ctu-empty-opt"><i className="ti ti-info-circle" /> {asDefault ? 'หากไม่อัปโหลด ระบบใช้แม่แบบที่ติดมากับระบบ (ด้านล่าง)' : 'ไม่บังคับ · หากไม่อัปโหลด ระบบใช้แม่แบบหลักของภาควิชา (ด้านล่าง)'}</div>
          </div>
          <div className="ctu-filled ctu-main">
            <button type="button" className="ctu-thumb" onClick={() => setFallbackOpen(true)} aria-label="ดูตัวอย่างเกียรติบัตรเต็มจอและซูม">
              {fallbackCanvas}
              <span className="ctu-thumb-zoom"><i className="ti ti-zoom-in" /> คลิกเพื่อดูเต็มจอและซูม</span>
            </button>
            <div className="ctu-info">
              <div className="ctu-status"><i className="ti ti-circle-check-filled" /> {asDefault ? 'ใช้แม่แบบที่ติดมากับระบบ' : 'ใช้แม่แบบหลักของภาควิชา'}</div>
              <div className="ctu-main-note">{asDefault
                ? 'ใช้เป็นแม่แบบหลักถ้าไม่อัปโหลดแม่แบบของภาควิชาเอง'
                : `ใช้กับกิจกรรมนี้โดยอัตโนมัติถ้าไม่อัปโหลด template ของตัวเอง · ระบบวางชื่อผู้รับ ชื่อกิจกรรม วันที่ และผู้ลงนามให้${adminSet ? ' · ตั้งค่าโดยผู้ดูแลระบบ' : ''}`}</div>
              <div className="ctu-actions">
                <button type="button" className="btn btn-primary" onClick={() => setFallbackOpen(true)}><i className="ti ti-zoom-in" /> ดูตัวอย่างเต็มจอ</button>
              </div>
              <div className="ctu-tip">{asDefault ? 'ตัวอย่างใช้ชื่อผู้รับและชื่อกิจกรรมสมมติ · ผู้ลงนามตามที่กรอกในหน้านี้' : 'ตัวอย่างใช้ชื่อสมมติ · ชื่อกิจกรรม วันที่ และผู้ลงนามตามที่กรอกในหน้านี้'}</div>
            </div>
          </div>
          <ImageViewer open={fallbackOpen} title="ตัวอย่างเกียรติบัตร · ชื่อผู้เข้าร่วมเป็นชื่อสมมติ" aspect={A4_RATIO} onClose={() => setFallbackOpen(false)}>
            {fallbackCanvas}
          </ImageViewer>
        </>
      )}

      {error && <div className="ctu-error" role="alert"><i className="ti ti-alert-circle" /> {error}</div>}

      {isImage && (
        <details className="ctu-layout" open={layoutOpen} onToggle={(e) => setLayoutOpen(e.currentTarget.open)}>
          <summary><i className="ti ti-adjustments-horizontal" /> ปรับสี ขนาด และตำแหน่งข้อความให้เข้ากับ template <span>ค่าเริ่มต้นอ้างอิงจากเกียรติบัตรของภาควิชา · ดูผลในตัวอย่างด้านบนทันที</span><i className="ti ti-chevron-down ctu-layout-caret" /></summary>
          <div className="ctu-layout-body">
            <div className="ctu-group">
              <div className="ctu-group-title"><i className="ti ti-palette" /> สีตัวอักษร</div>
              <div className="ctu-presets" role="group" aria-label="ชุดสี">
                {COLOR_PRESETS.map((p) => (
                  <button type="button" key={p.key} className={activePreset === p.key ? 'on' : ''} aria-pressed={activePreset === p.key} onClick={() => setLayout(p.colors)}>
                    <span className="ctu-preset-dots">{[p.colors.cDept, p.colors.cOrg, p.colors.cName].map((c, i) => <i key={i} style={{ background: c }} />)}</span>
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="ctu-colors">
                {COLOR_FIELDS.filter((f) => !f.needsOrg || lay.showOrg).map((f) => (
                  <div className="ctu-color" key={f.key}>
                    <label>
                      <input type="color" value={lay[f.key]} onChange={(e) => setLayout({ [f.key]: e.target.value })} />
                      <span>{f.label}<small>{lay[f.key]}</small></span>
                    </label>
                    {palette.length > 0 && (
                      <div className="ctu-swatches" aria-label={`สีจาก template สำหรับ${f.label}`}>
                        {palette.map((c) => (
                          <button type="button" key={c} className={lay[f.key] === c ? 'on' : ''} style={{ background: c }} onClick={() => setLayout({ [f.key]: c })} title={`ใช้สี ${c} จาก template`} aria-label={`ใช้สี ${c} จาก template`} />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {palette.length > 0 && <span className="helper budget-hint"><i className="ti ti-info-circle" /> จุดสีเล็ก ๆ ใต้แต่ละช่องคือสีที่พบใน template · กดเพื่อใช้สีนั้นให้เข้ากับลวดลาย</span>}
            </div>

            <label className="ctu-layout-check">
              <input type="checkbox" checked={lay.showOrg} onChange={(e) => setLayout({ showOrg: e.target.checked })} />
              <span>แสดงชื่อภาควิชาและคณะ <small>"ภาควิชาคอมพิวเตอร์ · คณะวิทยาศาสตร์ มหาวิทยาลัยศิลปากร" · ปิดได้หาก template พิมพ์ไว้แล้ว</small></span>
            </label>

            <div className="ctu-group">
              <div className="ctu-group-title"><i className="ti ti-text-size" /> ขนาดตัวอักษร <small>100% = ตามแบบของภาควิชา</small></div>
              <div className="ctu-sliders">
                {SIZE_SLIDERS.filter((sl) => !sl.needsOrg || lay.showOrg).map((sl) => (
                  <label className="ctu-slider" key={sl.key}>
                    <span className="ctu-slider-head"><span>{sl.label}</span><output>{lay[sl.key]}%</output></span>
                    <input type="range" min={LAYOUT_LIMITS[sl.key][0]} max={LAYOUT_LIMITS[sl.key][1]} step="1" value={lay[sl.key]} onChange={(e) => setLayout({ [sl.key]: Number(e.target.value) })} />
                  </label>
                ))}
              </div>
            </div>

            <div className="ctu-group">
              <div className="ctu-group-title"><i className="ti ti-arrows-move" /> ตำแหน่ง</div>
              <div className="ctu-sliders">
                {POSITION_SLIDERS.filter((sl) => !sl.needsOrg || lay.showOrg).map((sl) => (
                  <label className="ctu-slider" key={sl.key}>
                    <span className="ctu-slider-head"><span>{sl.label} <small>{sl.hint}</small></span><output>{lay[sl.key]}%</output></span>
                    <input type="range" min={LAYOUT_LIMITS[sl.key][0]} max={LAYOUT_LIMITS[sl.key][1]} step="1" value={lay[sl.key]} onChange={(e) => setLayout({ [sl.key]: Number(e.target.value) })} />
                  </label>
                ))}
              </div>
            </div>
            <button type="button" className="btn btn-outline ctu-layout-reset" onClick={() => onLayoutChange({ ...DEFAULT_LAYOUT })} disabled={isDefaultLayout(lay)}><i className="ti ti-restore" /> คืนค่าตามแบบของภาควิชา</button>
          </div>
        </details>
      )}

      {/* Same zoom/pan viewer as the poster, showing the template with the live text on it. */}
      <ImageViewer
        open={previewOpen && isImage}
        title="ตัวอย่างเกียรติบัตร · ชื่อผู้เข้าร่วมเป็นชื่อสมมติ"
        aspect={dims ? dims.w / dims.h : A4_RATIO}
        onClose={() => setPreviewOpen(false)}
      >
        {canvas}
      </ImageViewer>
    </div>
  );
}
