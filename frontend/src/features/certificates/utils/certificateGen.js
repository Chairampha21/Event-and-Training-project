// No PDF library dependency: renders the certificate as a print-ready HTML
// document in a new window/tab. The user can "Save as PDF" from the browser
// print dialog. If the event has an uploaded certificate template, it's used
// as the background with the title/recipient/signer overlaid (matching the
// CertPreviewModal preview); otherwise falls back to a generic layout.


import { layoutStyleString, normalizeLayout } from './certLayout';
import { CERT_DEPT, CERT_ORG, CERT_LEAD_IN, CERT_PLACE, certAchievement } from './certText';

/**
 * Opens one print-ready document holding every certificate in `list` (each
 * the same shape as printCertificate's argument), one certificate per A4
 * landscape page — "Save as PDF" then gives a single file with all of them.
 */
export function printCertificates(list) {
  if (!list || list.length === 0) return;
  const win = window.open('', '_blank', 'width=900,height=650');
  if (!win) return;

  const pages = list.map((c) => `<section class="cert-page">${c.templateUrl ? templatedBody(c) : genericBody(c)}</section>`).join('\n');
  const title = list.length === 1 ? `เกียรติบัตร · ${escapeHtml(list[0].eventTitle)}` : `เกียรติบัตร ${list.length} ใบ`;

  win.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8" />
  <title>${title}</title>
  <style>
    body{font-family:'Noto Sans Thai',system-ui,sans-serif;background:#f1f1f8;margin:0}
    .cert-page{position:relative;min-height:100vh;display:flex;align-items:center;justify-content:center;break-after:page;page-break-after:always}
    .cert-page:last-child{break-after:auto;page-break-after:auto}
    .cert-sheet{width:900px;max-width:95vw}
    .cert-code{position:absolute;bottom:10px;right:16px;font-size:11px;color:rgba(42,34,98,.5)}
    ${overlayCss()}
    @page{size:A4 landscape;margin:0}
    @media print{
      body{background:#fff}
      .cert-page{min-height:0;width:297mm;height:209mm;overflow:hidden}
      .cert-sheet{width:297mm;max-width:none}
      .cert-sheet .cert-canvas{border-radius:0 !important}
      .cert-code{bottom:3mm;right:5mm}
    }
  </style></head><body>
  ${pages}
  <script>window.onload = () => setTimeout(() => window.print(), 300);</script>
  </body></html>`);
  win.document.close();
}

export function printCertificate(cert) {
  printCertificates([cert]);
}

// The overlay rules live in CertOverlays.css. Rather than keep a second copy
// here, lift them out of the page's loaded stylesheets so the printed
// certificate is laid out by exactly the same CSS as the on-screen one.
function overlayCss() {
  const out = [];
  Array.from(document.styleSheets).forEach((sheet) => {
    let rules;
    try { rules = sheet.cssRules; } catch { return; } // cross-origin sheet (e.g. icon font CDN)
    Array.from(rules || []).forEach((rule) => {
      if (rule.selectorText && /\.cert-(canvas|title-overlay|body-overlay|signer-overlay)/.test(rule.selectorText)) out.push(rule.cssText);
    });
  });
  return out.join('\n');
}

function templatedBody({ studentName, eventTitle, certDate, certId, templateUrl, signerName, signerTitle, signature, layout, category }) {
  const lay = normalizeLayout(layout);
  return `
  <div class="cert-sheet">
    <div class="cert-canvas" style="${layoutStyleString(lay)};border-radius:10px;overflow:hidden">
      <img src="${escapeHtml(templateUrl)}" alt="" />
      ${lay.showOrg ? `<div class="cert-title-overlay"><span class="ct-dept">${escapeHtml(CERT_DEPT)}</span><span class="ct-org">${escapeHtml(CERT_ORG)}</span></div>` : ''}
      ${studentName ? `<div class="cert-body-overlay">
        <span class="cb-eyebrow">${escapeHtml(CERT_LEAD_IN)}</span>
        <span class="cb-name">${escapeHtml(studentName)}</span>
        ${eventTitle ? `<span class="cb-achieve">${escapeHtml(certAchievement(category))} &ldquo;${escapeHtml(eventTitle)}&rdquo;</span>` : ''}
        ${certDate ? `<span class="cb-date">ใน${escapeHtml(certDate)}</span>` : ''}
        <span class="cb-place">${escapeHtml(CERT_PLACE[0])}<br />${escapeHtml(CERT_PLACE[1])}</span>
      </div>` : ''}
      ${(signerName || signerTitle || signature) ? `<div class="cert-signer-overlay">
        ${signature ? `<img class="cs-sign" src="${escapeHtml(signature)}" alt="" />` : ''}
        ${signerName ? `<span class="cs-name">(${escapeHtml(signerName)})</span>` : ''}
        ${signerTitle ? `<span class="cs-title">${escapeHtml(signerTitle)}</span>` : ''}
      </div>` : ''}
    </div>
  </div>
  <div class="cert-code">รหัสตรวจสอบ ${escapeHtml(certId)}</div>`;
}

function genericBody({ studentName, eventTitle, certDate, certId, signerName, signerTitle, signature, category }) {
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
    .sign-img{height:46px;max-width:210px;object-fit:contain;margin-bottom:2px}
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
    <div class="for">${escapeHtml(certAchievement(category))} &ldquo;<strong>${escapeHtml(eventTitle)}</strong>&rdquo;</div>
    <div class="date">ใน${escapeHtml(certDate)}</div>
    <div class="place">ณ ภาควิชาคอมพิวเตอร์ คณะวิทยาศาสตร์<br />มหาวิทยาลัยศิลปากร วิทยาเขตพระราชวังสนามจันทร์</div>
    <div class="sign">
      ${signature ? `<img class="sign-img" src="${escapeHtml(signature)}" alt="" />` : `
      <svg viewBox="0 0 120 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 26c6-14 12-18 16-10 3 6-2 12 3 12s7-14 14-16 6 10 12 10 9-8 15-8 4 8 10 8 8-10 14-10 5 9 11 9 9-6 17-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>`}
      ${signerName ? `<div class="sign-name">(${escapeHtml(signerName)})</div>` : ''}
      ${signerTitle ? `<div class="sign-title">${escapeHtml(signerTitle)}</div>` : ''}
    </div>
  </div>
  <div class="cert-code">รหัสตรวจสอบ ${escapeHtml(certId)}</div>`;
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
