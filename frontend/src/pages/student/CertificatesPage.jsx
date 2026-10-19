import React, { useMemo, useState } from 'react';
import { useEvents } from '../../hooks/useEvents';
import CertificateCard, { CertPreviewModal, buildCertificate } from '../../features/certificates/components/CertificateCard';
import { printCertificates } from '../../features/certificates/utils/certificateGen';
import { buddhistYearOf, formatThaiDate } from '../../utils/dateFormat';

export default function CertificatesPage() {
  const ctx = useEvents();
  const { myCertificates, pushToast } = ctx;
  const [certId, setCertId] = useState(null);
  const [query, setQuery] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [catFilter, setCatFilter] = useState('');
  // Ticked certificates, by event id. Kept apart from what is on screen, so
  // searching or filtering never drops a tick that was already made.
  const [picked, setPicked] = useState(() => new Set());

  const years = useMemo(() => [...new Set(myCertificates.map((c) => buddhistYearOf(c.date_start)).filter(Boolean))].sort((a, b) => b - a), [myCertificates]);
  const categories = useMemo(() => [...new Set(myCertificates.map((c) => c.category).filter(Boolean))], [myCertificates]);

  const q = query.trim().toLowerCase();
  const shown = myCertificates.filter((c) => {
    if (q && !`${c.title} ${c.cert_code}`.toLowerCase().includes(q)) return false;
    if (yearFilter && buddhistYearOf(c.date_start) !== Number(yearFilter)) return false;
    if (catFilter && c.category !== catFilter) return false;
    return true;
  });
  const filtering = !!q || !!yearFilter || !!catFilter;
  const pickedList = myCertificates.filter((c) => picked.has(c.event_id));
  const allShownPicked = shown.length > 0 && shown.every((c) => picked.has(c.event_id));

  function toggle(eventId) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId); else next.add(eventId);
      return next;
    });
  }

  // "Select all" means everything on screen now — the filtered list.
  function toggleAllShown() {
    setPicked((prev) => {
      const next = new Set(prev);
      shown.forEach((c) => { if (allShownPicked) next.delete(c.event_id); else next.add(c.event_id); });
      return next;
    });
  }

  // Several certificates come out as one document, a page each, so they are
  // saved as a single PDF instead of one print window per certificate.
  function download(list) {
    const printable = list.map((c) => buildCertificate(ctx, c.event_id)?.printable).filter(Boolean);
    if (printable.length === 0) return;
    printCertificates(printable);
    pushToast('กำลังเตรียมเกียรติบัตร', `${printable.length} ใบ · เลือก "บันทึกเป็น PDF" ในหน้าต่างพิมพ์ ได้ไฟล์เดียวรวมทุกใบ`);
  }

  return (
    <div className="wrap tight">
      <div className="section-head">
        <div>
          <div className="sh-title">เกียรติบัตรของฉัน <span className="count">{myCertificates.length} ใบ</span></div>
          <div className="sh-sub">เกียรติบัตรอิเล็กทรอนิกส์ทั้งหมดที่คุณได้รับ · ดาวน์โหลดเป็น PDF ทีละใบ หรือเลือกหลายใบได้</div>
        </div>
      </div>

      {myCertificates.length === 0 ? (
        <div className="empty-state">ยังไม่มีเกียรติบัตร — เข้าร่วมกิจกรรมและทำแบบประเมินให้เสร็จ เพื่อรับเกียรติบัตร</div>
      ) : (
        <>
          <div className="cert-tools">
            <div className="input-search" style={{ marginBottom: 0 }}>
              <i className="ti ti-search" />
              <input type="text" placeholder="ค้นหาชื่อกิจกรรมหรือรหัสเกียรติบัตร..." value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <select className="role-select" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} aria-label="กรองตามปีที่จัด">
              <option value="">ทุกปี</option>
              {years.map((y) => <option key={y} value={y}>พ.ศ. {y}</option>)}
            </select>
            <select className="role-select" value={catFilter} onChange={(e) => setCatFilter(e.target.value)} aria-label="กรองตามประเภทกิจกรรม">
              <option value="">ทุกประเภท</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {filtering && (
              <button type="button" className="btn btn-ghost" onClick={() => { setQuery(''); setYearFilter(''); setCatFilter(''); }}><i className="ti ti-rotate" /> ล้างตัวกรอง</button>
            )}
          </div>

          <div className={`cert-bulk${picked.size > 0 ? ' active' : ''}`}>
            <label className="cert-bulk-all">
              <input type="checkbox" checked={allShownPicked} onChange={toggleAllShown} disabled={shown.length === 0} />
              <span>เลือกทั้งหมด{filtering ? 'ที่แสดงอยู่' : ''} ({shown.length})</span>
            </label>
            <span className="cert-bulk-count" role="status">
              {picked.size > 0 ? `เลือกแล้ว ${picked.size} ใบ` : 'ยังไม่ได้เลือก'}
              {picked.size > 0 && <button type="button" className="cert-bulk-clear" onClick={() => setPicked(new Set())}>ยกเลิกการเลือก</button>}
            </span>
            <div className="cert-bulk-actions">
              <button type="button" className="btn btn-primary" disabled={picked.size === 0} onClick={() => download(pickedList)}>
                <i className="ti ti-download" /> ดาวน์โหลดที่เลือก{picked.size > 0 ? ` (${picked.size})` : ''}
              </button>
            </div>
          </div>

          {shown.length === 0 ? (
            <div className="empty-state">ไม่พบเกียรติบัตรที่ตรงกับการค้นหาหรือตัวกรอง</div>
          ) : (
            <div className="cert-grid">
              {shown.map((c) => (
                <CertificateCard
                  key={c.event_id}
                  event={{ id: c.event_id, title: c.title, date: formatThaiDate(c.date_start) }}
                  onView={setCertId}
                  selected={picked.has(c.event_id)}
                  onToggle={toggle}
                />
              ))}
            </div>
          )}
        </>
      )}

      <CertPreviewModal eventId={certId} open={!!certId} onClose={() => setCertId(null)} />
    </div>
  );
}
