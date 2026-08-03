import React from 'react';
import Modal, { ModalHead } from './Modal';
import { useEvents } from '../hooks/useEvents';
import { CertOrgOverlay, CertBodyOverlay, CertSignerOverlay } from './CertOverlays';
import { printCertificate } from '../utils/certificateGen';
import { formatThaiDate } from '../utils/dateFormat';

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
  const signerName = ev?.signer?.name || 'ผศ.ดร. ปิยะ จันทรัศมี';
  const signerTitle = ev?.signer?.title || '';
  const certId = cert?.cert_code || `SU-CS-${String(eventId).padStart(3, '0')}`;
  const studentName = session?.name || '';

  function handleDownload() {
    downloadCert(eventId);
    printCertificate({ studentName, eventTitle: title, date, certId, templateUrl: ev?.certTemplate?.dataUrl, signerName, signerTitle });
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
            <span className="cp-corner tl" /><span className="cp-corner tr" /><span className="cp-corner bl" /><span className="cp-corner br" />
            <div className="cp-seal"><i className="ti ti-rosette-discount-check" /></div>
            <div className="cp-org">คณะวิทยาศาสตร์ มหาวิทยาลัยศิลปากร</div>
            <div className="cp-eyebrow">ขอมอบใบประกาศเกียรติคุณฉบับนี้ไว้เพื่อเป็นเกียรติแก่</div>
            <div className="cp-name">{studentName}</div>
            <div className="cp-for">ซึ่งได้เข้าร่วมและผ่านกิจกรรม</div>
            <div className="cp-event">{title}</div>
            <div className="cp-blessing">ขอให้มีความสุข ความเจริญ และประสบความสำเร็จในการศึกษาสืบไป</div>
            <div className="cp-date">ให้ไว้ ณ วันที่ {date}</div>
            <div className="cp-sign">
              <div className="cp-sign-line" />
              <div className="cp-sign-name">{signerName}</div>
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
