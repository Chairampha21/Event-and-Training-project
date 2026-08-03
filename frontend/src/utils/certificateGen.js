// No PDF library dependency: renders the certificate as a print-ready HTML
// document in a new window/tab. The user can "Save as PDF" from the browser
// print dialog. Swap this out for a real PDF pipeline (pdf-lib / server-side)
// once the backend is wired up.

export function printCertificate({ studentName, eventTitle, date, certId }) {
  const win = window.open('', '_blank', 'width=900,height=650');
  if (!win) return;
  win.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8" />
  <title>เกียรติบัตร · ${escapeHtml(eventTitle)}</title>
  <style>
    body{font-family:'Noto Sans Thai',system-ui,sans-serif;background:#f1f1f8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
    .cert{width:900px;max-width:95vw;aspect-ratio:1.414/1;background:linear-gradient(135deg,#fbfbfe,#f1f1f8);border:1px solid rgba(56,65,157,.15);border-radius:16px;padding:50px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;position:relative}
    .cert::before{content:"";position:absolute;inset:16px;border:3px solid rgba(56,65,157,.2);border-radius:12px}
    .eyebrow{font-size:14px;letter-spacing:.25em;text-transform:uppercase;color:#38419D;font-weight:600}
    .name{font-size:34px;font-weight:800;color:#2A2262}
    .for{font-size:14px;color:rgba(42,34,98,.6)}
    .event{font-size:22px;font-weight:700;color:#38419D}
    .foot{margin-top:18px;display:flex;gap:40px;font-size:12px;color:rgba(42,34,98,.6)}
    @media print{ body{background:#fff} .cert{box-shadow:none} }
  </style></head><body>
  <div class="cert">
    <div class="eyebrow">Certificate of Participation</div>
    <div class="for">มอบให้เพื่อแสดงว่า</div>
    <div class="name">${escapeHtml(studentName)}</div>
    <div class="for">ได้เข้าร่วมและผ่านกิจกรรม</div>
    <div class="event">${escapeHtml(eventTitle)}</div>
    <div class="foot"><span>${escapeHtml(date)}</span><span>รหัสตรวจสอบ ${escapeHtml(certId)}</span></div>
  </div>
  <script>window.onload = () => setTimeout(() => window.print(), 200);</script>
  </body></html>`);
  win.document.close();
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
