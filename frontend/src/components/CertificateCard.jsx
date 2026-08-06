import React from 'react';
import Modal, { ModalHead } from './Modal';
import { useEvents } from '../hooks/useEvents';
import { CertOrgOverlay, CertBodyOverlay, CertSignerOverlay } from './CertOverlays';
import { printCertificate } from '../utils/certificateGen';
import { formatThaiDate, formatCertDate } from '../utils/dateFormat';

// Decorative signature squiggle — stands in for a scanned signature image,
// which isn't part of this project's assets.
function SignatureSquiggle() {
  return (
    <svg className="cp-sign-svg" viewBox="0 0 120 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 26c6-14 12-18 16-10 3 6-2 12 3 12s7-14 14-16 6 10 12 10 9-8 15-8 4 8 10 8 8-10 14-10 5 9 11 9 9-6 17-6"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function CertPreviewModal({ eventId, open, onClose }) {
  const { evById, session, myCertificates, downloadCert } = useEvents();
  if (!open || !eventId) return null;

  // evById only covers currently-listed events — a certificate can belong to an
  // older, unlisted/archived event, so fall back to the certificate's own
  // embedded title/date (from /api/me/certificates) when that's the case.
  // Same reasoning for certTemplate/signer: only evById carries those (the
  // certificates endpoint doesn't echo the whole event), so an archived
  // event's certificate falls back to the generic layout below.
  const ev = evById(eventId);
  const cert = myCertificates.find((c) => c.event_id === Number(eventId));
  if (!ev && !cert) return null;

  const title = ev?.title || cert?.title || '';
  const date = ev?.date || (cert ? formatThaiDate(cert.date_start) : '');
  const dateStart = ev?.dateStart || cert?.date_start || '';
  const dateEnd = ev?.dateEnd || dateStart;
  const signerName = ev?.signer?.name || 'ผศ.ดร. ปิยะ จันทรัศมี';
  const signerTitle = ev?.signer?.title || '';
  const certId = cert?.cert_code || `SU-CS-${String(eventId).padStart(3, '0')}`;
  const studentName = session?.name || '';

  function handleDownload() {
    downloadCert(eventId);
    printCertificate({ studentName, eventTitle: title, date, dateStart, dateEnd, certId, templateUrl: ev?.certTemplate?.dataUrl, signerName, signerTitle });
  }

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <ModalHead eyebrow="เกียรติบัตร" icon="ti-certificate" title={title.slice(0, 46)} onClose={onClose} />
      <div className="modal-body">
        {ev?.certTemplate ? (
          <div style={{ position: 'relative', display: 'block', width: '100%' }}>
            <img src={ev.certTemplate.dataUrl} alt="เกียรติบัตร" style={{ display: 'block', width: '100%', borderRadius: 10 }} />
            <CertOrgOverlay />
            <CertBodyOverlay name={studentName} eventTitle={title} date={date} />
            <CertSignerOverlay name={signerName} title={signerTitle} />
          </div>
        ) : (
          <div className="cert-preview">
            <div className="cp-logos">
              <div className="cp-logo-badge"><i className="ti ti-atom-2" /></div>
              <div className="cp-logo-cpsu"><span className="cs1">CPSU</span><span className="cs2">NEXT</span></div>
            </div>
            <div className="cp-dept">ภาควิชาคอมพิวเตอร์</div>
            <div className="cp-org">คณะวิทยาศาสตร์ มหาวิทยาลัยศิลปากร</div>
            <div className="cp-eyebrow">ขอมอบประกาศนียบัตรฉบับนี้ไว้เพื่อแสดงว่า</div>
            <div className="cp-name">{studentName}</div>
            <div className="cp-for">ได้เข้ารับการอบรม หัวข้อ &ldquo;<strong>{title}</strong>&rdquo;</div>
            <div className="cp-date">ใน{formatCertDate(dateStart, dateEnd)}</div>
            <div className="cp-place">ณ ภาควิชาคอมพิวเตอร์ คณะวิทยาศาสตร์<br />มหาวิทยาลัยศิลปากร วิทยาเขตพระราชวังสนามจันทร์</div>
            <div className="cp-sign">
              <SignatureSquiggle />
              {signerName && <div className="cp-sign-name">({signerName})</div>}
              {signerTitle && <div className="cp-sign-title">{signerTitle}</div>}
            </div>
          </div>
        )}
        <div className="info-grid" style={{ marginTop: 16 }}>
          <div className="ig"><div className="igl">รหัสตรวจสอบ</div><div className="igv">{certId}</div></div>
          <div className="ig"><div className="igl">ผู้ลงนาม</div><div className="igv">{signerName}</div></div>
        </div>
      </div>
      <div className="modal-foot">
        <button className="btn btn-outline" onClick={onClose}>ปิด</button>
        <button className="btn btn-primary" onClick={handleDownload}><i className="ti ti-download" /> ดาวน์โหลด PDF</button>
      </div>
    </Modal>
  );
}

export default function CertificateCard({ event, onView }) {
  const { myCertificates } = useEvents();
  const cert = myCertificates.find((c) => c.event_id === event.id);
  return (
    <div className="cert-card">
      <div className="cert-thumb">
        <div className="ct-eyebrow">SU-CS Certificate</div>
        <div className="ct-mid">{event.title}</div>
        <div className="ct-foot">
          <span>{event.date}</span>
          <div className="ct-stamp"><i className="ti ti-rosette-discount-check" /></div>
        </div>
      </div>
      <div className="cert-info">
        <div>
          <div className="ci-name">{event.title.slice(0, 38)}</div>
          <div className="ci-date">{cert?.cert_code || `SU-CS-${String(event.id).padStart(3, '0')}`}</div>
        </div>
        <button className="icon-btn" onClick={() => onView(event.id)}><i className="ti ti-download" /></button>
      </div>
    </div>
  );
}
