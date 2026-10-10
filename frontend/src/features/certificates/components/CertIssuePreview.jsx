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
