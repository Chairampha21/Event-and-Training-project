import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useEvents } from '../../hooks/useEvents';
import { STATUS_META, EVENT_CATEGORIES } from '../../utils/constants';
import { formatThaiDate, formatThaiDateRange, parseThaiDateDisplay } from '../../utils/dateFormat';
import Modal, { ModalHead } from '../../components/Modal';
import './CreateEventPage.css';

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Overlays the signer's name/title near the bottom of the certificate
// template image, so organizers can preview roughly where the signature
// line will read once the certificate is generated.
function CertSignerOverlay({ name, title }) {
  if (!name && !title) return null;
  return (
    <div className="cert-signer-overlay">
      {name && <span className="cs-name">{name}</span>}
      {title && <span className="cs-title">{title}</span>}
    </div>
  );
}

// Overlays the event title near the top of the certificate template image,
// covering whatever placeholder heading the template file was designed with.
function CertTitleOverlay({ eventTitle }) {
  if (!eventTitle) return null;
  return (
    <div className="cert-title-overlay">
      <span>{eventTitle}</span>
    </div>
  );
}

export default function CreateEventPage() {
  const { session, evById, createEvent, updateEvent, pushToast } = useEvents();
  const navigate = useNavigate();
  const location = useLocation();
  const editId = location.state?.editId;
  const editing = editId ? evById(editId) : null;

  const [poster, setPoster] = useState(editing?.poster || null);
  const [posterPreviewOpen, setPosterPreviewOpen] = useState(false);
  const [title, setTitle] = useState(editing?.title || '');
  const [desc, setDesc] = useState(editing?.desc || '');
  const [cat, setCat] = useState(editing?.cat || '');
  const [customCats, setCustomCats] = useState(
    editing?.cat && !EVENT_CATEGORIES.includes(editing.cat) ? [editing.cat] : []
  );
  const [addingCat, setAddingCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const catOptions = useMemo(() => [...EVENT_CATEGORIES, ...customCats], [customCats]);
  const [org, setOrg] = useState(editing?.org || '');

  function addCategory() {
    const name = newCatName.trim();
    if (!name) { setAddingCat(false); return; }
    if (!catOptions.includes(name)) setCustomCats((c) => [...c, name]);
    setCat(name);
    setNewCatName('');
    setAddingCat(false);
  }

  const [dayMode, setDayMode] = useState(editing?.dayMode || 'single');
  const parsedDate = editing ? parseThaiDateDisplay(editing.date) : null;
  const [dateIso, setDateIso] = useState(parsedDate?.startIso || '');
  const [dateEndIso, setDateEndIso] = useState(parsedDate?.endIso || '');

  const parsedTime = editing?.time?.match(/^(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/);
  const [timeStart, setTimeStart] = useState(parsedTime?.[1] || '');
  const [timeEnd, setTimeEnd] = useState(parsedTime?.[2] || '');
  const time = timeStart && timeEnd ? `${timeStart}–${timeEnd} น.` : '';

  const [attendMode, setAttendMode] = useState(editing?.attendMode || 'onsite');
  const [place, setPlace] = useState(editing?.place || '');
  const [cap, setCap] = useState(editing?.cap || '');
  const [capOnsite, setCapOnsite] = useState(editing?.capOnsite || '');
  const [capOnline, setCapOnline] = useState(editing?.capOnline || '');
  const [onlineLink, setOnlineLink] = useState(editing?.onlineLink || '');

  const [pretestOn, setPretestOn] = useState(editing?.pretest?.enabled || false);
  const [pretestLink, setPretestLink] = useState(editing?.pretest?.link || '');

  const [certTemplate, setCertTemplate] = useState(editing?.certTemplate || null);
  const [certPreviewOpen, setCertPreviewOpen] = useState(false);
  const [signerName, setSignerName] = useState(editing?.signer?.name || 'ผศ.ดร.สิรักข์ แก้วจำนงค์');
  const [signerTitle, setSignerTitle] = useState(editing?.signer?.title || 'หัวหน้าภาควิชาคอมพิวเตอร์');

  const dayCount = useMemo(() => {
    if (dayMode !== 'multi' || !dateIso || !dateEndIso) return null;
    const ms = new Date(dateEndIso) - new Date(dateIso);
    return ms >= 0 ? Math.round(ms / 86400000) + 1 : null;
  }, [dayMode, dateIso, dateEndIso]);

  const previewDate = useMemo(() => {
    if (dayMode === 'single' && dateIso) return formatThaiDate(dateIso);
    if (dayMode === 'multi' && dateIso && dateEndIso) return formatThaiDateRange(dateIso, dateEndIso);
    return editing?.date || 'ยังไม่ระบุวันที่';
  }, [dayMode, dateIso, dateEndIso, editing]);

  const previewPlace = useMemo(() => {
    if (attendMode === 'online') return onlineLink ? 'ออนไลน์' : 'ยังไม่ระบุลิงก์';
    if (attendMode === 'hybrid') return place ? `${place} + ออนไลน์` : 'ยังไม่ระบุสถานที่';
    return place || 'ยังไม่ระบุสถานที่';
  }, [attendMode, place, onlineLink]);

  const previewCap = attendMode === 'hybrid' ? (parseInt(capOnsite, 10) || 0) + (parseInt(capOnline, 10) || 0) : (parseInt(cap, 10) || 0);

  function onPosterFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    fileToDataUrl(file).then(setPoster);
  }

  function onCertTemplateFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    fileToDataUrl(file).then((dataUrl) => setCertTemplate({ name: file.name, type: file.type, dataUrl }));
  }

  const checklist = [
    { label: 'ชื่อกิจกรรมและรายละเอียด', done: !!(title && desc) },
    { label: 'กำหนดวันที่และรูปแบบเข้าร่วม', done: !!previewDate && previewDate !== 'ยังไม่ระบุวันที่' && previewCap > 0 },
    { label: 'อัปโหลดโปสเตอร์กิจกรรม', done: !!poster },
    { label: 'ตั้งค่าเกียรติบัตร (ผู้ลงนาม)', done: !!(signerName && signerTitle) },
  ];

  const [confirmOpen, setConfirmOpen] = useState(false);

  function handlePublish() {
    if (!title.trim() || !desc.trim()) {
      pushToast('กรอกข้อมูลไม่ครบ', 'ระบุชื่อกิจกรรมและรายละเอียดก่อน', 'warn');
      return;
    }
    if (!cat) {
      pushToast('ยังไม่ได้เลือกประเภทกิจกรรม', 'กรุณาเลือกประเภทกิจกรรมก่อนเผยแพร่', 'warn');
      return;
    }
    if (!editing && dayMode === 'single' && !dateIso) {
      pushToast('ยังไม่ได้เลือกวันที่', 'กรุณาเลือกวันที่จัดกิจกรรม', 'warn'); return;
    }
    if (!editing && dayMode === 'multi' && (!dateIso || !dateEndIso)) {
      pushToast('ยังไม่ได้เลือกวันที่', 'กรุณาเลือกวันเริ่มและวันสิ้นสุด', 'warn'); return;
    }
    if (attendMode !== 'online' && !place.trim()) {
      pushToast('ยังไม่ได้ระบุสถานที่', 'กรุณาระบุสถานที่จัดกิจกรรม', 'warn'); return;
    }
    if (attendMode !== 'onsite' && !onlineLink.trim()) {
      pushToast('ยังไม่ได้ระบุลิงก์ออนไลน์', 'กรุณาระบุลิงก์เข้าร่วมออนไลน์', 'warn'); return;
    }

    setConfirmOpen(true);
  }

  function doPublish() {
    const payload = {
      title, desc, cat, org,
      dayMode, attendMode,
      time: time || editing?.time || '-',
      place: attendMode === 'online' ? 'ออนไลน์' : attendMode === 'hybrid' ? `${place} + ออนไลน์` : place,
      cap: previewCap || 60,
      capOnsite: attendMode === 'hybrid' ? parseInt(capOnsite, 10) || 0 : undefined,
      capOnline: attendMode === 'hybrid' ? parseInt(capOnline, 10) || 0 : undefined,
      onlineLink: attendMode !== 'onsite' ? onlineLink : undefined,
      poster,
      certTemplate,
      pretest: { enabled: pretestOn, link: pretestLink },
      signer: { name: signerName, title: signerTitle },
    };
    if (dayMode === 'single' && dateIso) payload.date = formatThaiDate(dateIso);
    else if (dayMode === 'multi' && dateIso && dateEndIso) payload.date = formatThaiDateRange(dateIso, dateEndIso);

    if (editing) updateEvent(editing.id, payload);
    else createEvent(payload);
    setConfirmOpen(false);
    navigate(session?.role === 'admin' ? '/admin/dashboard' : '/home');
  }

  const sm = STATUS_META.open;

  return (
    <div>
      <div className="page-header">
        <div className="ph-inner">
          <div>
            <div className="crumbs"><i className="ti ti-layout-dashboard" /> ผู้ดูแลระบบ <i className="ti ti-chevron-right" /> {editing ? 'แก้ไขกิจกรรม' : 'สร้างกิจกรรมใหม่'}</div>
            <h1>{editing ? 'แก้ไขกิจกรรม' : 'สร้างกิจกรรมใหม่'}</h1>
            <p>กรอกรายละเอียด อัปโหลดโปสเตอร์ กำหนดวัน-เวลา และตั้งค่าพรีเทสและเกียรติบัตรในหน้าเดียว</p>
          </div>
        </div>
      </div>

      <div className="wrap ce-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 28, alignItems: 'flex-start', paddingTop: 30 }}>
        <div className="ce-main">
          <div className="form-card">
            <h2><span className="fc-num">1</span> โปสเตอร์กิจกรรม</h2>
            <p className="fc-sub">ภาพประกาศสัมพันธ์ที่จะแสดงบนการ์ดกิจกรรมและหน้ารายละเอียด</p>
            <div className="poster-upload lg" onClick={() => document.getElementById('ce-poster-input').click()}>
              <input type="file" id="ce-poster-input" accept="image/*" style={{ display: 'none' }} onChange={onPosterFile} />
              {poster ? (
                <>
                  <img src={poster} alt="โปสเตอร์กิจกรรม" />
                  <button type="button" className="pu-zoom" onClick={(e) => { e.stopPropagation(); setPosterPreviewOpen(true); }}><i className="ti ti-zoom-in" /> ดูภาพเต็ม</button>
                  <button type="button" className="pu-remove" onClick={(e) => { e.stopPropagation(); setPoster(null); }}><i className="ti ti-x" /></button>
                </>
              ) : (
                <div className="pu-empty">
                  <i className="ti ti-cloud-upload" />
                  <div>คลิกหรือลากไฟล์มาวางเพื่ออัปโหลดโปสเตอร์</div>
                  <span>แนะนำอัตราส่วนแนวตั้ง เช่น 1080×1350 · JPG/PNG · สูงสุด 5 MB</span>
                </div>
              )}
            </div>
          </div>

          <div className="form-card">
            <h2><span className="fc-num">2</span> ข้อมูลกิจกรรม</h2>
            <p className="fc-sub">รายละเอียดหลักที่จะแสดงในหน้ารายการและรายละเอียดกิจกรรม</p>
            <div className="form-row full">
              <div className="field">
                <label>ชื่อกิจกรรม <span className="req">*</span></label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น Python for Data Science: จาก Zero สู่ Pandas" />
              </div>
            </div>
            <div className="form-row full">
              <div className="field">
                <label>รายละเอียด <span className="req">*</span></label>
                <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="อธิบายเนื้อหา กลุ่มเป้าหมาย และสิ่งที่ผู้เข้าร่วมจะได้รับ" />
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label>ประเภทกิจกรรม <span className="req">*</span></label>
                {addingCat ? (
                  <span className="cat-add-input">
                    <i className="ti ti-category" />
                    <input
                      autoFocus
                      type="text"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); addCategory(); }
                        if (e.key === 'Escape') { setAddingCat(false); setNewCatName(''); }
                      }}
                      placeholder="ชื่อประเภทใหม่"
                    />
                    <button type="button" className="cat-add-confirm" onClick={addCategory}><i className="ti ti-check" /></button>
                    <button type="button" className="cat-add-cancel" onClick={() => { setAddingCat(false); setNewCatName(''); }}><i className="ti ti-x" /></button>
                  </span>
                ) : (
                  <div className="with-icon">
                    <i className="ti ti-category" />
                    <select
                      value={cat}
                      onChange={(e) => {
                        if (e.target.value === '__add__') setAddingCat(true);
                        else setCat(e.target.value);
                      }}
                    >
                      <option value="" disabled hidden>โปรดเลือกประเภทกิจกรรม</option>
                      {catOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                      <option value="__add__">+ เพิ่มประเภทใหม่...</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="field"><label>ผู้รับผิดชอบ</label><div className="with-icon"><i className="ti ti-user-cog" /><input type="text" value={org} onChange={(e) => setOrg(e.target.value)} placeholder="ชื่อผู้จัด/อาจารย์ที่ปรึกษา" /></div></div>
            </div>
          </div>

          <div className="form-card">
            <h2><span className="fc-num">3</span> วันเวลาและสถานที่</h2>
            <p className="fc-sub">กำหนดรูปแบบวัน (วันเดียวหรือหลายวัน) เวลา สถานที่ และจำนวนที่รับ</p>

            <div className="day-mode-pick">
              <label className={`dm-opt${dayMode === 'single' ? ' active' : ''}`}><input type="radio" checked={dayMode === 'single'} onChange={() => setDayMode('single')} /><i className="ti ti-calendar-event" /> วันเดียว</label>
              <label className={`dm-opt${dayMode === 'multi' ? ' active' : ''}`}><input type="radio" checked={dayMode === 'multi'} onChange={() => setDayMode('multi')} /><i className="ti ti-calendar-week" /> หลายวัน</label>
            </div>

            <div className={`form-row${dayMode === 'single' ? ' three' : ''}`}>
              <div className="field">
                <label>{dayMode === 'multi' ? 'วันเริ่ม' : 'วันที่จัด'} <span className="req">*</span></label>
                <div className="with-icon"><i className="ti ti-calendar-event" /><input type="date" value={dateIso} onChange={(e) => setDateIso(e.target.value)} /></div>
              </div>
              {dayMode === 'multi' && (
                <div className="field">
                  <label>ถึงวันที่ <span className="req">*</span></label>
                  <div className="with-icon"><i className="ti ti-calendar-event" /><input type="date" value={dateEndIso} min={dateIso || undefined} onChange={(e) => setDateEndIso(e.target.value)} /></div>
                </div>
              )}
              <div className="field">
                <label>จากเวลา <span className="req">*</span></label>
                <div className="with-icon"><i className="ti ti-clock" /><input type="time" lang="th" value={timeStart} onChange={(e) => setTimeStart(e.target.value)} /></div>
              </div>
              <div className="field">
                <label>ถึงเวลา <span className="req">*</span></label>
                <div className="with-icon"><i className="ti ti-clock" /><input type="time" lang="th" value={timeEnd} min={timeStart || undefined} onChange={(e) => setTimeEnd(e.target.value)} /></div>
              </div>
            </div>
            {dayCount && <span className="dm-days-hint"><i className="ti ti-info-circle" /> รวม {dayCount} วัน</span>}
            {editing && !dateIso && <span className="dm-days-hint"><i className="ti ti-info-circle" /> เว้นว่างไว้เพื่อคงวันที่เดิม: {editing.date}</span>}
            {editing && !timeStart && editing.time && <span className="dm-days-hint"><i className="ti ti-info-circle" /> เว้นว่างไว้เพื่อคงเวลาเดิม: {editing.time}</span>}

            <div className="attend-mode-pick">
              <label className={`dm-opt${attendMode === 'onsite' ? ' active' : ''}`}><input type="radio" checked={attendMode === 'onsite'} onChange={() => setAttendMode('onsite')} /><i className="ti ti-building" /> Onsite เท่านั้น</label>
              <label className={`dm-opt${attendMode === 'online' ? ' active' : ''}`}><input type="radio" checked={attendMode === 'online'} onChange={() => setAttendMode('online')} /><i className="ti ti-broadcast" /> Online เท่านั้น</label>
              <label className={`dm-opt${attendMode === 'hybrid' ? ' active' : ''}`}><input type="radio" checked={attendMode === 'hybrid'} onChange={() => setAttendMode('hybrid')} /><i className="ti ti-devices" /> Onsite + Online</label>
            </div>

            <div className="form-row">
              {attendMode !== 'online' && (
                <div className="field"><label>สถานที่ <span className="req">*</span></label><div className="with-icon"><i className="ti ti-map-pin" /><input type="text" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="ระบุอาคารและห้องที่จัดกิจกรรม" /></div></div>
              )}
              {attendMode !== 'hybrid' && (
                <div className="field"><label>จำนวนที่รับ <span className="req">*</span></label><div className="with-icon"><i className="ti ti-users" /><input type="number" min="1" value={cap} onChange={(e) => setCap(e.target.value)} placeholder="ระบุจำนวนที่รับทั้งหมด" /></div></div>
              )}
            </div>
            {attendMode === 'hybrid' && (
              <div className="form-row">
                <div className="field"><label><i className="ti ti-building" style={{ fontSize: 14, verticalAlign: -2, color: 'var(--c2)' }} /> จำนวน Onsite <span className="req">*</span></label><div className="with-icon"><i className="ti ti-users" /><input type="number" min="0" value={capOnsite} onChange={(e) => setCapOnsite(e.target.value)} placeholder="ระบุจำนวนที่รับ Onsite" /></div></div>
                <div className="field"><label><i className="ti ti-broadcast" style={{ fontSize: 14, verticalAlign: -2, color: 'var(--c1)' }} /> จำนวน Online <span className="req">*</span></label><div className="with-icon"><i className="ti ti-users" /><input type="number" min="0" value={capOnline} onChange={(e) => setCapOnline(e.target.value)} placeholder="ระบุจำนวนที่รับ Online" /></div></div>
              </div>
            )}
            {attendMode !== 'onsite' && (
              <div className="field" style={{ marginTop: 2 }}>
                <label>ลิงก์สมัครเข้าร่วม (Online) <span className="req">*</span></label>
                <div className="with-icon"><i className="ti ti-link" /><input type="text" value={onlineLink} onChange={(e) => setOnlineLink(e.target.value)} placeholder="https://forms.gle/..." /></div>
              </div>
            )}
          </div>

          <div className="form-card setup-card">
            <div className="setup-head">
              <div className="setup-head-text">
                <h2><span className="fc-num">4</span> พรีเทส</h2>
                <p className="fc-sub">แบบทดสอบความรู้ก่อนเข้าร่วม · เปิดระหว่างเปิดรับสมัครถึงก่อนวันกิจกรรม (ไม่บังคับ)</p>
              </div>
              <button type="button" className={`switch${pretestOn ? ' on' : ''}`} onClick={() => setPretestOn((o) => !o)} title="เปิด/ปิดการใช้พรีเทส" />
            </div>
            {pretestOn && (
              <div className="setup-body">
                <div className="field full"><label>ลิงก์แบบทดสอบ/แบบฟอร์ม <span className="req">*</span></label><div className="with-icon"><i className="ti ti-link" /><input type="text" value={pretestLink} onChange={(e) => setPretestLink(e.target.value)} placeholder="https://forms.gle/..." /></div></div>
              </div>
            )}
          </div>

          <div className="form-card setup-card">
            <div className="setup-head">
              <div className="setup-head-text">
                <h2><span className="fc-num">5</span> เกียรติบัตร</h2>
                <p className="fc-sub">อัปโหลด template และตั้งค่าผู้ลงนาม · ระบบออกให้อัตโนมัติเมื่อผู้เข้าร่วมทำแบบประเมินสำเร็จ</p>
              </div>
            </div>
            <div className="setup-grid">
              <div className="setup-upload" onClick={() => document.getElementById('ce-cert-input').click()}>
                <input type="file" id="ce-cert-input" accept=".pdf,.png,.svg,image/*" style={{ display: 'none' }} onChange={onCertTemplateFile} />
                {certTemplate ? (
                  certTemplate.type?.startsWith('image/') ? (
                    <>
                      <img src={certTemplate.dataUrl} alt="template เกียรติบัตร" />
                      <CertTitleOverlay eventTitle={title} />
                      <CertSignerOverlay name={signerName} title={signerTitle} />
                      <button type="button" className="pu-zoom" onClick={(e) => { e.stopPropagation(); setCertPreviewOpen(true); }}><i className="ti ti-zoom-in" /> ดูภาพเต็ม</button>
                      <button type="button" className="pu-remove" onClick={(e) => { e.stopPropagation(); setCertTemplate(null); }}><i className="ti ti-x" /></button>
                    </>
                  ) : (
                    <>
                      <div className="su-icon"><i className="ti ti-file-text" /></div>
                      <div className="su-title">{certTemplate.name}</div>
                      <div className="su-sub">คลิกเพื่อเปลี่ยนไฟล์</div>
                      <button type="button" className="pu-remove" onClick={(e) => { e.stopPropagation(); setCertTemplate(null); }}><i className="ti ti-x" /></button>
                    </>
                  )
                ) : (
                  <>
                    <div className="su-icon"><i className="ti ti-photo" /></div>
                    <div className="su-title">อัปโหลด template เกียรติบัตร</div>
                    <div className="su-sub">PDF · PNG · SVG · A4 แนวนอน · สูงสุด 5 MB</div>
                    <span className="su-chip"><i className="ti ti-upload" /> เลือกไฟล์</span>
                  </>
                )}
              </div>
              <div className="setup-fields">
                <div className="field"><label>ชื่อผู้ลงนาม <span className="req">*</span></label><div className="with-icon"><i className="ti ti-signature" /><input type="text" value={signerName} onChange={(e) => setSignerName(e.target.value)} /></div></div>
                <div className="field"><label>ตำแหน่ง <span className="req">*</span></label><div className="with-icon"><i className="ti ti-id-badge-2" /><input type="text" value={signerTitle} onChange={(e) => setSignerTitle(e.target.value)} /></div></div>
              </div>
            </div>
          </div>

          <div className="form-actions">
            <span className="fa-left"><i className="ti ti-device-floppy" /> ยังไม่ได้บันทึก</span>
            <div className="fa-right">
              <button className="btn btn-outline" onClick={() => navigate(-1)}>ยกเลิก</button>
              <button className="btn btn-outline" onClick={() => pushToast('บันทึกร่างแล้ว', 'คุณสามารถกลับมาแก้ไขภายหลัง')}><i className="ti ti-device-floppy" /> บันทึกร่าง</button>
              <button className="btn btn-primary" onClick={handlePublish}><i className="ti ti-send" /> {editing ? 'บันทึกการแก้ไข' : 'เผยแพร่กิจกรรม'}</button>
            </div>
          </div>
        </div>

        <aside className="ce-side">
          <div className="side-card ce-side-sticky">
            <h3><i className="ti ti-eye" /> ตัวอย่างการ์ดกิจกรรม</h3>
            <div className="ce-preview-frame">
              <article className="card ce-live-card">
                <div className="card-strip strip-2" />
                <div className="card-body">
                  <div className="card-top">
                    <div className="icon-box alt"><i className="ti ti-sparkles" /></div>
                    <span className={`badge ${sm.badge}`}><i className={`ti ${sm.ico}`} /> {sm.label}</span>
                  </div>
                  <div className="card-cat">{cat}</div>
                  <h3 className="card-title">{title || 'ชื่อกิจกรรมของคุณ'}</h3>
                  <div className="meta">
                    <div className="row"><i className="ti ti-calendar-event" /> {previewDate}</div>
                    <div className="row"><i className="ti ti-clock" /> {time || 'ยังไม่ระบุเวลา'}</div>
                    <div className="row"><i className="ti ti-map-pin" /> {previewPlace}</div>
                  </div>
                  <div className="card-footer">
                    <div className="seats">
                      <span><strong style={{ color: 'var(--c4)' }}>0</strong> / {previewCap || 0} ที่นั่ง</span>
                      <div className="seats-bar"><div className="seats-fill" style={{ width: '0%' }} /></div>
                    </div>
                    <button className="btn-apply" disabled><i className="ti ti-user-plus" /> สมัคร</button>
                  </div>
                </div>
              </article>
            </div>
            <div className="ce-side-divider" />
            <h3><i className="ti ti-list-check" /> ตรวจสอบความครบถ้วน</h3>
            <div className="checklist">
              {checklist.map((c) => (
                <div className={`ck ${c.done ? 'done' : 'todo'}`} key={c.label}><i className={`ti ${c.done ? 'ti-circle-check-filled' : 'ti-circle'}`} /> {c.label}</div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} size="sm">
        <ModalHead eyebrow="ยืนยันการเผยแพร่" icon="ti-send" title={editing ? 'บันทึกการแก้ไขกิจกรรมนี้?' : 'เผยแพร่กิจกรรมนี้เลยหรือไม่?'} onClose={() => setConfirmOpen(false)} />
        <div className="modal-body"><p style={{ fontSize: 14, color: 'var(--c4-70)', lineHeight: 1.6 }}>{editing ? 'การเปลี่ยนแปลงจะมีผลทันทีและผู้สมัครจะเห็นข้อมูลใหม่' : <>กิจกรรม <strong>{title}</strong> จะแสดงให้ผู้ใช้งานเห็นและเปิดรับสมัครทันที ตรวจสอบข้อมูลให้ครบถ้วนก่อนดำเนินการต่อ</>}</p></div>
        <div className="modal-foot">
          <button className="btn btn-outline" onClick={() => setConfirmOpen(false)}>ยกเลิก</button>
          <button className="btn btn-primary" onClick={doPublish}><i className="ti ti-send" /> {editing ? 'บันทึกการแก้ไข' : 'เผยแพร่กิจกรรม'}</button>
        </div>
      </Modal>

      <Modal open={posterPreviewOpen} onClose={() => setPosterPreviewOpen(false)} size="lg">
        <ModalHead eyebrow="ตัวอย่างโปสเตอร์" icon="ti-photo" title="โปสเตอร์กิจกรรม" onClose={() => setPosterPreviewOpen(false)} />
        <div className="modal-body" style={{ padding: 0, maxHeight: '72vh', overflow: 'hidden', display: 'flex', justifyContent: 'center' }}>
          <img src={poster} alt="โปสเตอร์กิจกรรม" style={{ display: 'block', maxWidth: '100%', maxHeight: '72vh', width: 'auto', height: 'auto', objectFit: 'contain' }} />
        </div>
      </Modal>

      <Modal open={certPreviewOpen} onClose={() => setCertPreviewOpen(false)} size="lg">
        <ModalHead eyebrow="ตัวอย่าง template" icon="ti-certificate" title="เกียรติบัตร" onClose={() => setCertPreviewOpen(false)} />
        <div className="modal-body" style={{ padding: 0, maxHeight: '72vh', overflow: 'hidden', display: 'flex', justifyContent: 'center' }}>
          <div style={{ position: 'relative', display: 'inline-flex', maxWidth: '100%', maxHeight: '72vh' }}>
            <img src={certTemplate?.dataUrl} alt="template เกียรติบัตร" style={{ display: 'block', maxWidth: '100%', maxHeight: '72vh', width: 'auto', height: 'auto', objectFit: 'contain' }} />
            <CertTitleOverlay eventTitle={title} />
            <CertSignerOverlay name={signerName} title={signerTitle} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
