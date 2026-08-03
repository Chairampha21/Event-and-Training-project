// No PDF library dependency: renders the certificate as a print-ready HTML
// document in a new window/tab. The user can "Save as PDF" from the browser
// print dialog. If the event has an uploaded certificate template, it's used
// as the background with the title/recipient/signer overlaid (matching the
// CertPreviewModal preview); otherwise falls back to a generic layout.

export function printCertificate({ studentName, eventTitle, date, certId, templateUrl, signerName, signerTitle }) {
  const win = window.open('', '_blank', 'width=900,height=650');
  if (!win) return;

  const body = templateUrl ? templatedBody({ studentName, eventTitle, date, certId, templateUrl, signerName, signerTitle }) : genericBody({ studentName, eventTitle, date, certId, signerName, signerTitle });

  win.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8" />
  <title>เกียรติบัตร · ${escapeHtml(eventTitle)}</title>
  <style>
    body{font-family:'Noto Sans Thai',system-ui,sans-serif;background:#f1f1f8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
    @media print{ body{background:#fff} }
  </style></head><body>
  ${body}
  <script>window.onload = () => setTimeout(() => window.print(), 200);</script>
  </body></html>`);
  win.document.close();
}

function templatedBody({ studentName, eventTitle, date, certId, templateUrl, signerName, signerTitle }) {
  const halo = 'text-shadow:0 0 4px #fff,0 0 4px #fff,0 1px 2px #fff';
  return `
  <div style="position:relative;width:900px;max-width:95vw">
    <img src="${escapeHtml(templateUrl)}" alt="" style="display:block;width:100%;border-radius:10px" />
    <div style="position:absolute;left:8%;right:8%;top:32%;display:flex;justify-content:center">
      <span style="max-width:100%;font-size:26px;font-weight:800;color:#1a1a2e;text-align:center;line-height:1.3;${halo}">คณะวิทยาศาสตร์ มหาวิทยาลัยศิลปากร</span>
    </div>
    ${studentName ? `<div style="position:absolute;left:8%;right:8%;top:42%;display:flex;flex-direction:column;align-items:center;gap:6px;color:#1a1a2e;text-align:center;${halo}">
      <span style="font-size:14px;opacity:.8">ขอมอบใบประกาศเกียรติคุณฉบับนี้ไว้เพื่อเป็นเกียรติแก่</span>
      <span style="font-size:26px;font-weight:800">${escapeHtml(studentName)}</span>
      ${eventTitle ? `<span style="font-size:13px;opacity:.8;line-height:1.5">ซึ่งได้เข้าร่วมและผ่านกิจกรรม<br /><strong>${escapeHtml(eventTitle)}</strong></span>` : ''}
      <span style="font-size:13px;opacity:.8">ขอให้มีความสุข ความเจริญ และประสบความสำเร็จในการศึกษาสืบไป</span>
      ${date ? `<span style="font-size:13px;opacity:.8">ให้ไว้ ณ วันที่ ${escapeHtml(date)}</span>` : ''}
    </div>` : ''}
    ${(signerName || signerTitle) ? `<div style="position:absolute;left:6%;right:6%;bottom:10%;text-align:center;color:#1a1a2e;line-height:1.25;${halo}">
      ${signerName ? `<span style="display:block;font-size:17px;font-weight:700">${escapeHtml(signerName)}</span>` : ''}
      ${signerTitle ? `<span style="display:block;font-size:13px;opacity:.75;margin-top:2px">${escapeHtml(signerTitle)}</span>` : ''}
    </div>` : ''}
  </div>
  <div style="position:fixed;bottom:10px;right:16px;font-size:11px;color:rgba(42,34,98,.5)">รหัสตรวจสอบ ${escapeHtml(certId)}</div>`;
}

function genericBody({ studentName, eventTitle, date, certId, signerName, signerTitle }) {
  return `
  <style>
    .cert{width:900px;max-width:95vw;aspect-ratio:1.414/1;background:#fffdf8;border:1px solid #e4d9b8;border-radius:8px;padding:56px 64px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:6px;position:relative}
    .cert::before{content:"";position:absolute;inset:14px;border:2px solid #c9a227;border-radius:6px}
    .corner{position:absolute;width:44px;height:44px;border:4px solid #c9a227}
    .corner.tl{top:24px;left:24px;border-right:none;border-bottom:none}
    .corner.tr{top:24px;right:24px;border-left:none;border-bottom:none}
    .corner.bl{bottom:24px;left:24px;border-right:none;border-top:none}
    .corner.br{bottom:24px;right:24px;border-left:none;border-top:none}
    .seal{width:74px;height:74px;border-radius:50%;background:#fff;border:3px solid #c9a227;display:grid;place-items:center;color:#c9a227;font-size:32px;margin-bottom:6px}
    .org{font-size:20px;font-weight:800;color:#2A2262}
    .eyebrow{font-size:15px;color:rgba(42,34,98,.7)}
    .name{font-size:32px;font-weight:800;color:#38419D;margin:6px 0}
    .for{font-size:15px;color:rgba(42,34,98,.6)}
    .event{font-size:20px;font-weight:700;color:#2A2262;margin-top:2px}
    .blessing{font-size:14px;color:rgba(42,34,98,.6);margin-top:12px}
    .date{font-size:14px;color:rgba(42,34,98,.6);margin-top:6px}
    .sign{margin-top:auto;padding-top:16px;display:flex;flex-direction:column;align-items:center;gap:3px}
    .sign-line{width:200px;border-top:1px dashed #c9a227;margin-bottom:8px}
    .sign-name{font-size:16px;font-weight:700;color:#2A2262}
    .sign-title{font-size:13px;color:rgba(42,34,98,.6)}
  </style>
  <div class="cert">
    <span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span>
    <div class="seal">&#10003;</div>
    <div class="org">คณะวิทยาศาสตร์ มหาวิทยาลัยศิลปากร</div>
    <div class="eyebrow">ขอมอบใบประกาศเกียรติคุณฉบับนี้ไว้เพื่อเป็นเกียรติแก่</div>
    <div class="name">${escapeHtml(studentName)}</div>
    <div class="for">ซึ่งได้เข้าร่วมและผ่านกิจกรรม</div>
    <div class="event">${escapeHtml(eventTitle)}</div>
    <div class="blessing">ขอให้มีความสุข ความเจริญ และประสบความสำเร็จในการศึกษาสืบไป</div>
    <div class="date">ให้ไว้ ณ วันที่ ${escapeHtml(date)}</div>
    <div class="sign">
      <div class="sign-line"></div>
      ${signerName ? `<div class="sign-name">${escapeHtml(signerName)}</div>` : ''}
      ${signerTitle ? `<div class="sign-title">${escapeHtml(signerTitle)}</div>` : ''}
    </div>
  </div>
  <div style="position:fixed;bottom:10px;right:16px;font-size:11px;color:rgba(42,34,98,.5)">รหัสตรวจสอบ ${escapeHtml(certId)}</div>`;
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
