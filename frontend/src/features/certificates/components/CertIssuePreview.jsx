import React, { useState } from 'react';
import ImageViewer from '../../../components/ui/ImageViewer';
import { CertOrgOverlay, CertBodyOverlay, CertSignerOverlay } from './CertOverlays';
import { formatCertDate, formatCertDateList } from '../../../utils/dateFormat';
import { layoutVars, normalizeLayout } from '../utils/certLayout';
import { certTemplateFor } from '../utils/defaultTemplate';
import './CertTemplateUpload.css';

const SAMPLE_NAME = 'ชื่อ-นามสกุล ผู้เข้าร่วม';
const A4_RATIO = 297 / 210; // landscape

/**
 * The certificate an event's attendees will get, drawn with a sample name —
 * shown before the organizer issues certificates, so they confirm what they
 * have actually seen. Press it to open the same zoom viewer as the template
 * editor in the event form.
 */
export default function CertIssuePreview({ ev }) {
  const [open, setOpen] = useState(false);
  const [aspect, setAspect] = useState(A4_RATIO);
  const template = certTemplateFor(ev);
  const lay = normalizeLayout(template.layout);
  const certDate = ev.dates?.length > 1 ? formatCertDateList(ev.dates) : formatCertDate(ev.dateStart, ev.dateEnd || ev.dateStart);

  const canvas = (
    <div className="cert-canvas" style={layoutVars(template.layout)}>
      <img src={template.url} alt={`ตัวอย่างเกียรติบัตร ${ev.title}`} onLoad={(e) => setAspect(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)} />
      {lay.showOrg && <CertOrgOverlay />}
      <CertBodyOverlay name={SAMPLE_NAME} eventTitle={ev.title} certDate={certDate} category={ev.cat} />
      <CertSignerOverlay name={ev.signer?.name} title={ev.signer?.title} signature={ev.signer?.signature} />
    </div>
  );

  return (
    <>
      <button type="button" className="ctu-thumb" onClick={() => setOpen(true)} aria-label="ดูตัวอย่างเกียรติบัตรเต็มจอและซูม">
        {canvas}
        <span className="ctu-thumb-zoom"><i className="ti ti-zoom-in" /> คลิกเพื่อดูเต็มจอและซูม</span>
      </button>
      <ImageViewer open={open} title="ตัวอย่างเกียรติบัตร · ชื่อผู้เข้าร่วมเป็นชื่อสมมติ" aspect={aspect} onClose={() => setOpen(false)}>
        {canvas}
      </ImageViewer>
    </>
  );
}

/**
 * Body of the "issue certificates?" confirmation, the same wherever it is
 * asked (event menu, check-in list): which template and signer will be used,
 * a way to go and change them, then the certificate itself. `onEdit` takes
 * the organizer to the certificate section of the event form.
 */
export function CertIssueReview({ ev, onEdit }) {
  return (
    <>
      <div className="me-cert-meta">
        <div>
          <div><i className="ti ti-photo" /> {certTemplateFor(ev).own ? 'ใช้ template ของกิจกรรมนี้' : 'ใช้ template หลักของภาควิชา'}</div>
          <div><i className="ti ti-signature" /> {ev.signer?.name ? `ผู้ลงนาม ${ev.signer.name}${ev.signer.signature ? '' : ' · ยังไม่มีลายเซ็น'}` : 'ยังไม่ได้ระบุผู้ลงนาม'}</div>
        </div>
        <button type="button" className="btn btn-outline" onClick={onEdit}>
          <i className="ti ti-edit" /> แก้ไขเกียรติบัตร
        </button>
      </div>
      <CertIssuePreview ev={ev} />
    </>
  );
}
