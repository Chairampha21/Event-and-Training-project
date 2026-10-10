import React from 'react';
import Modal, { ModalHead } from '../../../components/ui/Modal';
import { useEvents } from '../../../hooks/useEvents';
import { CertOrgOverlay, CertBodyOverlay, CertSignerOverlay } from './CertOverlays';
import { printCertificate } from '../utils/certificateGen';
import { formatCertDate, formatCertDateList } from '../../../utils/dateFormat';
import { layoutVars, normalizeLayout } from '../utils/certLayout';
import { certTemplateFor } from '../utils/defaultTemplate';

// Everything needed to draw and download the signed-in student's certificate
// for one event — shared by the card in the list and the full preview, so the
// two can never show different things. null when there is nothing to show.
//
// evById only covers currently-listed events — a certificate can belong to an
// older, unlisted/archived event, so the title and date fall back to what the
// certificate itself carries (from /api/me/certificates). The template and
// signer are only on the event, so an archived event's certificate is drawn on
// the department's main template.
export function buildCertificate({ evById, session, myCertificates }, eventId) {
  if (!eventId) return null;
  const ev = evById(eventId);
  const cert = myCertificates.find((c) => c.event_id === Number(eventId));
  if (!ev && !cert) return null;

  const title = ev?.title || cert?.title || '';
  const dateStart = ev?.dateStart || cert?.date_start || '';
  const dateEnd = ev?.dateEnd || dateStart;
  const data = {
    eventId: Number(eventId),
    title,
    // Multi-day events held on hand-picked days list each day; otherwise start–end.
    certDate: ev?.dates?.length > 1 ? formatCertDateList(ev.dates) : formatCertDate(dateStart, dateEnd),
    signerName: ev?.signer?.name || 'ผศ.ดร. ปิยะ จันทรัศมี',
    signerTitle: ev?.signer?.title || '',
    category: ev?.cat || cert?.category || '',
    signature: ev?.signer?.signature || null,
    certId: cert?.cert_code || `SU-CS-${String(eventId).padStart(3, '0')}`,
    studentName: session?.name || '',
    // The event's own template, or the department's main one when it has none.
    template: certTemplateFor(ev),
  };
  // The shape certificateGen prints from.
  data.printable = {
    studentName: data.studentName, eventTitle: title, certDate: data.certDate, certId: data.certId,
    templateUrl: data.template.url, signerName: data.signerName, signerTitle: data.signerTitle,
    signature: data.signature, layout: data.template.layout, category: data.category,
  };
  return data;
}

function useCertificate(eventId) {
  const ctx = useEvents();
  const data = buildCertificate(ctx, eventId);
  if (!data) return null;
  data.download = () => {
    ctx.downloadCert(eventId);
    printCertificate(data.printable);
  };
  return data;
}

// The certificate itself: the template with the system's text laid over it.
// It scales with whatever width it is given, so the same drawing serves as
// the small card picture and the full preview.
function CertificateCanvas({ data, rounded }) {
  return (
    <div className="cert-canvas" style={{ borderRadius: rounded ? 10 : 0, overflow: 'hidden', ...layoutVars(data.template.layout) }}>
      <img src={data.template.url} alt={`เกียรติบัตร ${data.title}`} />
      {normalizeLayout(data.template.layout).showOrg && <CertOrgOverlay />}
      <CertBodyOverlay name={data.studentName} eventTitle={data.title} certDate={data.certDate} category={data.category} />
      <CertSignerOverlay name={data.signerName} title={data.signerTitle} signature={data.signature} />
    </div>
  );
}

export function CertPreviewModal({ eventId, open, onClose }) {
  const data = useCertificate(open ? eventId : null);
  if (!open || !data) return null;

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <ModalHead eyebrow="เกียรติบัตร" icon="ti-certificate" title={data.title.slice(0, 46)} onClose={onClose} />
      <div className="modal-body">
        <CertificateCanvas data={data} rounded />
        <div className="info-grid" style={{ marginTop: 16 }}>
          <div className="ig"><div className="igl">รหัสตรวจสอบ</div><div className="igv">{data.certId}</div></div>
          <div className="ig"><div className="igl">ผู้ลงนาม</div><div className="igv">{data.signerName}</div></div>
        </div>
      </div>
      <div className="modal-foot">
        <button className="btn btn-outline" onClick={onClose}>ปิด</button>
        <button className="btn btn-primary" onClick={data.download}><i className="ti ti-download" /> ดาวน์โหลด PDF</button>
      </div>
    </Modal>
  );
}

// One certificate in the student's list: the picture is the real certificate
// (press it to see it large), the tick box puts it in the selection for a
// combined download, and the button downloads that event's own.
export default function CertificateCard({ event, onView, selected, onToggle }) {
  const data = useCertificate(event.id);
  if (!data) return null;
  return (
    <div className={`cert-card${selected ? ' selected' : ''}`}>
      <div className="cert-thumb-wrap">
        <button type="button" className="cert-thumb-real" onClick={() => onView(event.id)} aria-label={`ดูเกียรติบัตร ${data.title}`}>
          <CertificateCanvas data={data} />
          <span className="cert-thumb-zoom"><i className="ti ti-zoom-in" /> ดูเกียรติบัตร</span>
        </button>
        {onToggle && (
          <label className="cert-pick" title={selected ? 'เอาออกจากรายการที่เลือก' : 'เลือกเกียรติบัตรนี้'}>
            <input type="checkbox" checked={!!selected} onChange={() => onToggle(event.id)} aria-label={`เลือกเกียรติบัตร ${data.title}`} />
          </label>
        )}
      </div>
      <div className="cert-info">
        <div style={{ minWidth: 0 }}>
          <div className="ci-name" title={data.title}>{data.title}</div>
          <div className="ci-date">{event.date} · {data.certId}</div>
        </div>
        <button className="icon-btn" onClick={data.download} title="ดาวน์โหลด PDF" aria-label={`ดาวน์โหลดเกียรติบัตร ${data.title}`}><i className="ti ti-download" /></button>
      </div>
    </div>
  );
}
