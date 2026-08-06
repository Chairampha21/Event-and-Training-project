// No PDF library dependency: renders the certificate as a print-ready HTML
// document in a new window/tab. The user can "Save as PDF" from the browser
// print dialog. If the event has an uploaded certificate template, it's used
// as the background with the title/recipient/signer overlaid (matching the
// CertPreviewModal preview); otherwise falls back to a generic layout.

import { formatCertDate } from './dateFormat';

export function printCertificate({ studentName, eventTitle, date, dateStart, dateEnd, certId, templateUrl, signerName, signerTitle }) {
  const win = window.open('', '_blank', 'width=900,height=650');
  if (!win) return;

  const body = templateUrl ? templatedBody({ studentName, eventTitle, date, certId, templateUrl, signerName, signerTitle }) : genericBody({ studentName, eventTitle, dateStart, dateEnd, certId, signerName, signerTitle });

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

function genericBody({ studentName, eventTitle, dateStart, dateEnd, certId, signerName, signerTitle }) {
  const certDate = formatCertDate(dateStart, dateEnd);
  return `
  <style>
    .cert{--ct-teal:#0e7368;--ct-teal-dk:#0a5952;--ct-orange:#eb9a2f;--ct-gold:#d9b978;
      width:900px;max-width:95vw;aspect-ratio:1.28/1;background:#fffdf8;border:1px solid #e4d9b8;border-radius:10px;
      padding:48px 64px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:5px;position:relative;overflow:hidden}
    .cert::before{content:"";position:absolute;inset:16px;border:2px solid var(--ct-gold);border-radius:8px}
    .logos{display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:6px;position:relative;z-index:1}
    .logo-badge{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;color:#fff;font-size:20px;
      background:radial-gradient(circle at 32% 30%,var(--ct-teal) 0%,var(--ct-teal-dk) 75%);box-shadow:0 0 0 3px #fff,0 0 0 4px var(--ct-gold)}
    .logo-cpsu{display:inline-flex;align-items:center;border-radius:6px;overflow:hidden;font-size:13px;font-weight:800;letter-spacing:.02em}
    .logo-cpsu span{padding:5px 9px}
    .logo-cpsu .cs1{background:#1c2b4a;color:#fff}
    .logo-cpsu .cs2{background:var(--ct-orange);color:#fff}
    .dept{font-size:28px;font-weight:800;color:var(--ct-teal);position:relative;z-index:1}
    .org2{font-size:16px;font-weight:700;color:var(--ct-orange);margin-top:2px;position:relative;z-index:1}
    .eyebrow{font-size:15px;color:rgba(42,34,98,.7);margin-top:14px;position:relative;z-index:1}
    .name{font-size:30px;font-weight:800;color:var(--ct-teal);margin:6px 0;position:relative;z-index:1}
    .for{font-size:15px;color:rgba(42,34,98,.75);line-height:1.6;max-width:88%;position:relative;z-index:1}
    .for strong{color:#2A2262;font-weight:700}
    .date{font-size:14px;color:rgba(42,34,98,.7);margin-top:8px;position:relative;z-index:1}
    .place{font-size:14px;color:rgba(42,34,98,.7);line-height:1.5;position:relative;z-index:1}
    .sign{margin-top:auto;padding-top:14px;display:flex;flex-direction:column;align-items:center;gap:2px;position:relative;z-index:1}
    .sign svg{height:38px;color:var(--ct-teal-dk);margin-bottom:2px}
    .sign-name{font-size:15px;font-weight:700;color:#2A2262}
    .sign-title{font-size:13px;color:rgba(42,34,98,.6)}
  </style>
  <div class="cert">
    <div class="logos">
      <div class="logo-badge">&#9679;</div>
      <div class="logo-cpsu"><span class="cs1">CPSU</span><span class="cs2">NEXT</span></div>
    </div>
    <div class="dept">ภาควิชาคอมพิวเตอร์</div>
    <div class="org2">คณะวิทยาศาสตร์ มหาวิทยาลัยศิลปากร</div>
    <div class="eyebrow">ขอมอบประกาศนียบัตรฉบับนี้ไว้เพื่อแสดงว่า</div>
    <div class="name">${escapeHtml(studentName)}</div>
    <div class="for">ได้เข้ารับการอบรม หัวข้อ &ldquo;<strong>${escapeHtml(eventTitle)}</strong>&rdquo;</div>
    <div class="date">ใน${escapeHtml(certDate)}</div>
    <div class="place">ณ ภาควิชาคอมพิวเตอร์ คณะวิทยาศาสตร์<br />มหาวิทยาลัยศิลปากร วิทยาเขตพระราชวังสนามจันทร์</div>
    <div class="sign">
      <svg viewBox="0 0 120 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 26c6-14 12-18 16-10 3 6-2 12 3 12s7-14 14-16 6 10 12 10 9-8 15-8 4 8 10 8 8-10 14-10 5 9 11 9 9-6 17-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
      ${signerName ? `<div class="sign-name">(${escapeHtml(signerName)})</div>` : ''}
      ${signerTitle ? `<div class="sign-title">${escapeHtml(signerTitle)}</div>` : ''}
    </div>
  </div>
  <div style="position:fixed;bottom:10px;right:16px;font-size:11px;color:rgba(42,34,98,.5)">รหัสตรวจสอบ ${escapeHtml(certId)}</div>`;
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
