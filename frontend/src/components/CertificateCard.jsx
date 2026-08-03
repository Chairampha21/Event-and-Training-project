import React from 'react';
import Modal, { ModalHead } from './Modal';
import { useEvents } from '../hooks/useEvents';
import { SELF } from '../utils/constants';
import { printCertificate } from '../utils/certificateGen';

export function CertPreviewModal({ eventId, open, onClose }) {
  const { evById, downloadCert } = useEvents();
  if (!open || !eventId) return null;
  const ev = evById(eventId);
  if (!ev) return null;
  const certId = `SU-CS-2568-${String(ev.id).padStart(3, '0')}`;

  function handleDownload() {
    downloadCert(ev.id);
    printCertificate({ studentName: SELF.name, eventTitle: ev.title, date: ev.date, certId });
  }

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <ModalHead eyebrow="เกียรติบัตร" icon="ti-certificate" title={ev.title.slice(0, 46)} onClose={onClose} />
      <div className="modal-body">
        <div className="cert-preview">
          <div className="cp-eyebrow">Certificate of Participation</div>
          <div className="cp-for">มอบให้เพื่อแสดงว่า</div>
          <div className="cp-name">{SELF.name}</div>
          <div className="cp-for">ได้เข้าร่วมและผ่านกิจกรรม</div>
          <div className="cp-event">{ev.title}</div>
          <div className="cp-foot"><span>{ev.date}</span><span>คณะวิทยาศาสตร์ · ม.ศิลปากร</span></div>
          <div className="cp-seal"><i className="ti ti-rosette-discount-check" /></div>
        </div>
        <div className="info-grid" style={{ marginTop: 16 }}>
          <div className="ig"><div className="igl">รหัสตรวจสอบ</div><div className="igv">{certId}</div></div>
          <div className="ig"><div className="igl">ผู้ลงนาม</div><div className="igv">ผศ.ดร. ปิยะ จันทรัศมี</div></div>
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
          <div className="ci-date">SU-CS-2568-{String(event.id).padStart(3, '0')}</div>
        </div>
        <button className="icon-btn" onClick={() => onView(event.id)}><i className="ti ti-download" /></button>
      </div>
    </div>
  );
}
