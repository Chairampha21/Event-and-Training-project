import React from 'react';

// These overlay the certificate template image with the event's real data —
// used both in the organizer's create-event preview (before anyone has
// registered) and on the actual certificate a student sees/downloads, so the
// two stay visually consistent.

// Overlays the organization name near the top, covering whatever placeholder
// heading the template file was designed with — matches the header of the
// generic (no-template) certificate design; the event's own title already
// appears further down in the achievement line (see CertBodyOverlay).
export function CertOrgOverlay() {
  return (
    <div className="cert-title-overlay">
      <span>คณะวิทยาศาสตร์ มหาวิทยาลัยศิลปากร</span>
    </div>
  );
}

// Overlays the recipient's name plus the same formal lead-in/blessing/date
// text used on the generic (no-template) certificate design, in the middle
// of the template where a generic "ขอมอบเกียรติบัตร..." line typically leaves
// blank space — so an uploaded template reads the same as the built-in design.
export function CertBodyOverlay({ name, eventTitle, date }) {
  if (!name) return null;
  return (
    <div className="cert-body-overlay">
      <span className="cb-eyebrow">ขอมอบใบประกาศเกียรติคุณฉบับนี้ไว้เพื่อเป็นเกียรติแก่</span>
      <span className="cb-name">{name}</span>
      {eventTitle && <span className="cb-achieve">ซึ่งได้เข้าร่วมและผ่านกิจกรรม<br /><strong>{eventTitle}</strong></span>}
      <span className="cb-blessing">ขอให้มีความสุข ความเจริญ และประสบความสำเร็จในการศึกษาสืบไป</span>
      {date && <span className="cb-date">ให้ไว้ ณ วันที่ {date}</span>}
    </div>
  );
}

// Overlays the signer's name/title near the bottom, where a signature line
// would read once the certificate is generated for real.
export function CertSignerOverlay({ name, title }) {
  if (!name && !title) return null;
  return (
    <div className="cert-signer-overlay">
      {name && <span className="cs-name">{name}</span>}
      {title && <span className="cs-title">{title}</span>}
    </div>
  );
}
