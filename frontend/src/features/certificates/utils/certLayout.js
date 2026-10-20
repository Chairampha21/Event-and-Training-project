// Where and how the system's text sits on an uploaded certificate template.
// Every template is different (own heading, side artwork, dark background),
// so position, size and colour are adjustable per event. The defaults follow
// the department's own printed certificate: near-black department name, gold
// faculty line, teal recipient name, dark-grey body text.

export const CERT_COLORS = {
  dept: '#2b2b2b', // "ภาควิชาคอมพิวเตอร์"
  org: '#b8953f', // "คณะวิทยาศาสตร์ มหาวิทยาลัยศิลปากร"
  name: '#1f6f6b', // recipient
  text: '#333333', // everything else, including the signer
};

export const COLOR_PRESETS = [
  { key: 'dept', label: 'ตามแบบภาควิชา', colors: { cDept: CERT_COLORS.dept, cOrg: CERT_COLORS.org, cName: CERT_COLORS.name, cText: CERT_COLORS.text } },
  { key: 'dark', label: 'เข้มทั้งหมด', colors: { cDept: '#1a1a2e', cOrg: '#1a1a2e', cName: '#1a1a2e', cText: '#1a1a2e' } },
  { key: 'light', label: 'ขาวทั้งหมด (พื้นเข้ม)', colors: { cDept: '#ffffff', cOrg: '#ffffff', cName: '#ffffff', cText: '#ffffff' } },
];

export const DEFAULT_LAYOUT = {
  showOrg: true, // show the department + faculty lines (turn off when the template already prints them)
  titleTop: 24, // % from the top: department + faculty
  bodyTop: 38, // % from the top: recipient block
  signBottom: 8, // % from the bottom: signature block
  x: 50, // % from the left: centre line of all text
  sTitle: 100, // % size: department + faculty
  sName: 100, // % size: recipient name
  sText: 100, // % size: body text and signer
  cDept: CERT_COLORS.dept,
  cOrg: CERT_COLORS.org,
  cName: CERT_COLORS.name,
  cText: CERT_COLORS.text,
};

export const LAYOUT_LIMITS = {
  titleTop: [2, 90], bodyTop: [5, 90], signBottom: [1, 60], x: [25, 75],
  sTitle: [60, 160], sName: [60, 160], sText: [60, 160],
};
const COLOR_KEYS = ['cDept', 'cOrg', 'cName', 'cText'];
const HEX = /^#[0-9a-f]{6}$/i;

const clamp = (v, [lo, hi], fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : fallback;
};

/** Accepts whatever was stored (object, JSON string, null) and returns a complete, in-range layout. */
export function normalizeLayout(raw) {
  let o = raw;
  if (typeof raw === 'string') {
    try { o = JSON.parse(raw); } catch { o = null; }
  }
  if (!o || typeof o !== 'object') return { ...DEFAULT_LAYOUT };
  const out = { ...DEFAULT_LAYOUT };
  Object.keys(LAYOUT_LIMITS).forEach((k) => { out[k] = clamp(o[k], LAYOUT_LIMITS[k], DEFAULT_LAYOUT[k]); });
  out.showOrg = o.showOrg !== false;

  // Layouts saved before per-part sizes/colours existed had one `scale` and a
  // dark/light `tone`: carry those over rather than silently resetting them.
  if (o.scale !== undefined && o.sTitle === undefined && o.sName === undefined && o.sText === undefined) {
    const legacy = clamp(o.scale, LAYOUT_LIMITS.sText, 100);
    out.sTitle = legacy; out.sName = legacy; out.sText = legacy;
  }
  const legacyColors = o.tone === 'light' ? COLOR_PRESETS[2].colors : o.tone === 'dark' ? COLOR_PRESETS[1].colors : null;
  COLOR_KEYS.forEach((k) => {
    if (typeof o[k] === 'string' && HEX.test(o[k])) out[k] = o[k].toLowerCase();
    else if (legacyColors) out[k] = legacyColors[k];
  });
  return out;
}

export function isDefaultLayout(layout) {
  const l = normalizeLayout(layout);
  return Object.keys(DEFAULT_LAYOUT).every((k) => l[k] === DEFAULT_LAYOUT[k]);
}

/** What gets stored: null for the defaults (keeps old events untouched), else compact JSON. */
export function serializeLayout(layout) {
  return isDefaultLayout(layout) ? null : JSON.stringify(normalizeLayout(layout));
}

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

// A soft glow behind each line keeps it readable on a busy template: light
// behind dark text, dark behind light text.
const haloFor = (hex) => (luminance(hex) > 0.6 ? 'rgba(0,0,0,.55)' : '#ffffff');

/** CSS custom properties for the .cert-canvas element; CertOverlays.css reads them. */
export function layoutVars(layout) {
  const l = normalizeLayout(layout);
  return {
    '--ct-title-top': `${l.titleTop}%`,
    '--ct-body-top': `${l.bodyTop}%`,
    '--ct-sign-bottom': `${l.signBottom}%`,
    '--ct-x': `${l.x}%`,
    '--ct-s-title': String(l.sTitle / 100),
    '--ct-s-name': String(l.sName / 100),
    '--ct-s-text': String(l.sText / 100),
    '--ct-c-dept': l.cDept, '--ct-h-dept': haloFor(l.cDept),
    '--ct-c-org': l.cOrg, '--ct-h-org': haloFor(l.cOrg),
    '--ct-c-name': l.cName, '--ct-h-name': haloFor(l.cName),
    '--ct-c-text': l.cText, '--ct-h-text': haloFor(l.cText),
  };
}

/** Same properties as an inline style string, for the print window (no React there). */
export function layoutStyleString(layout) {
  return Object.entries(layoutVars(layout)).map(([k, v]) => `${k}:${v}`).join(';');
}

const toHex = (r, g, b) => `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;

/**
 * Pure part of the template analysis (testable without a canvas): from RGBA
 * pixels, works out whether the middle of the image — where the text goes —
 * is dark, and picks the template's own accent colours (its most common
 * strong hues) so text can be coloured to match the design.
 */
export function analyzePixels(data, width, height) {
  let midSum = 0; let midCount = 0;
  const buckets = new Map(); // hue bucket -> {r,g,b,n}
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i]; const g = data[i + 1]; const b = data[i + 2];
      if (x >= width * 0.2 && x < width * 0.8 && y >= height * 0.2 && y < height * 0.8) {
        midSum += 0.299 * r + 0.587 * g + 0.114 * b; midCount += 1;
      }
      const max = Math.max(r, g, b); const min = Math.min(r, g, b);
      const light = (max + min) / 510;
      const sat = max === min ? 0 : (max - min) / (255 - Math.abs(max + min - 255));
      // only colours strong and dark enough to work as text on a light page
      if (sat < 0.35 || light < 0.15 || light > 0.6) continue;
      let hue;
      if (max === r) hue = ((g - b) / (max - min)) % 6;
      else if (max === g) hue = (b - r) / (max - min) + 2;
      else hue = (r - g) / (max - min) + 4;
      const key = Math.floor((((hue * 60) + 360) % 360) / 30); // 12 hue families
      const bucket = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 };
      bucket.r += r; bucket.g += g; bucket.b += b; bucket.n += 1;
      buckets.set(key, bucket);
    }
  }
  const minShare = width * height * 0.004; // ignore specks
  const palette = [...buckets.values()]
    .filter((k) => k.n >= minShare)
    .sort((a, b) => b.n - a.n)
    .slice(0, 5)
    .map((k) => toHex(k.r / k.n, k.g / k.n, k.b / k.n));
  return { dark: midCount > 0 && midSum / midCount < 115, palette };
}

/**
 * Looks at a template image. Resolves to {dark, palette}: `dark` when the
 * area behind the text is dark (so white text is needed), and `palette`, the
 * template's own accent colours as hex strings.
 */
export function analyzeTemplate(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    // A stored template is a link to the API (another origin in development):
    // ask for it with CORS so its pixels can be read.
    if (!dataUrl.startsWith('data:')) img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = 96; const h = Math.max(1, Math.round((96 * img.naturalHeight) / img.naturalWidth));
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(analyzePixels(ctx.getImageData(0, 0, w, h).data, w, h));
      } catch {
        resolve({ dark: false, palette: [] });
      }
    };
    img.onerror = () => resolve({ dark: false, palette: [] });
    img.src = dataUrl;
  });
}
