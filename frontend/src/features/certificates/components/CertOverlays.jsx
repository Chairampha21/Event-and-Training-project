import React from 'react';
import { CERT_DEPT, CERT_ORG, CERT_LEAD_IN, CERT_PLACE, certAchievement } from '../utils/certText';
import './CertOverlays.css';

// These overlay the certificate template image with the event's real data —
// used in the organizer's create-event preview (before anyone has registered)
// and on the actual certificate a student sees/downloads, so the two stay
// visually consistent. The elements and their order follow the department's
// own printed certificate: department and faculty, the lead-in line, the
// recipient's name, what they took part in, when and where, then the
// signature with the signer's name in brackets and their position.

// Department and faculty, near the top. Can be switched off per event when
// the uploaded template already prints them.
export function CertOrgOverlay() {
  return (
    <div className="cert-title-overlay">
      <span className="ct-dept">{CERT_DEPT}</span>
      <span className="ct-org">{CERT_ORG}</span>
    </div>
  );
}

// The recipient block in the middle of the template. `certDate` is the long
// formal date ("วันที่ 18 - 19 เดือน ตุลาคม พ.ศ. 2568").
export function CertBodyOverlay({ name, eventTitle, certDate, category }) {
  if (!name) return null;
  return (
    <div className="cert-body-overlay">
      <span className="cb-eyebrow">{CERT_LEAD_IN}</span>
      <span className="cb-name">{name}</span>
      {eventTitle && <span className="cb-achieve">{certAchievement(category)} &ldquo;{eventTitle}&rdquo;</span>}
      {certDate && <span className="cb-date">ใน{certDate}</span>}
      <span className="cb-place">{CERT_PLACE[0]}<br />{CERT_PLACE[1]}</span>
    </div>
  );
}

// The signer's block near the bottom: the scanned signature (if one was
// uploaded), then the name in brackets and the position, as on a signed letter.
export function CertSignerOverlay({ name, title, signature }) {
  if (!name && !title && !signature) return null;
  return (
    <div className="cert-signer-overlay">
      {signature && <img className="cs-sign" src={signature} alt="ลายเซ็นผู้ลงนาม" />}
      {name && <span className="cs-name">({name})</span>}
      {title && <span className="cs-title">{title}</span>}
    </div>
  );
}
