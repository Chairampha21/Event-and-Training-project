// Cuts the paper out from behind a scanned or photographed signature, so only
// the ink is left on a transparent background. Runs entirely in the browser.

const MAX_SIDE = 1200; // signatures print small; this keeps the stored file light
// Opacity ramps with how far a pixel is from the paper towards the ink:
// below INK_START of that distance it is paper (fully clear), above INK_FULL
// it is solid ink. Measuring against the ink–paper contrast (not a fixed
// brightness step) is what keeps a slightly darker card, shadow or scan tint
// from surviving as a pale haze behind the signature.
const INK_START = 0.30;
const INK_FULL = 0.65;
const MIN_CONTRAST = 40; // ink must be at least this much darker than the paper (0–255)
const PAD = 6; // px of breathing room kept around the cropped ink

const luminance = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

/**
 * Works on raw RGBA pixels (so it can be tested without a canvas): makes the
 * paper transparent in place and returns the bounding box of the ink that is
 * left, or null if nothing ink-like was found. Expects opaque pixels (flatten
 * any transparency onto white first).
 *
 *  - Paper = the most common brightness in the image (a signature image is
 *    mostly paper), so off-white, grey or tinted paper works.
 *  - Ink   = the darkest strokes.
 *  - Each pixel's opacity is how far it sits between the two, so soft stroke
 *    edges stay soft.
 *  - Kept pixels are re-coloured to the pure ink colour (the paper's share is
 *    subtracted back out). Without this, edge pixels carry a light paper tint
 *    and show as a pale fringe on a coloured certificate.
 */
export function knockOutPaper(data, width, height) {
  const count = width * height;

  // 1. brightness histogram -> paper level (smoothed mode) and ink level (darkest ~1%)
  const hist = new Uint32Array(256);
  for (let i = 0; i < count; i++) hist[Math.round(luminance(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]))] += 1;
  let paper = 255; let best = -1;
  for (let v = 2; v <= 253; v++) {
    const around = hist[v - 2] + hist[v - 1] + hist[v] + hist[v + 1] + hist[v + 2];
    if (around >= best) { best = around; paper = v; } // >= : prefer the brighter of equal peaks
  }
  if (hist[254] + hist[255] >= best) paper = 255;
  let ink = 0; let seen = 0;
  const darkest = Math.max(1, Math.floor(count * 0.01));
  for (let v = 0; v < 256; v++) { seen += hist[v]; if (seen >= darkest) { ink = v; break; } }
  const contrast = paper - ink;
  if (contrast < MIN_CONTRAST) return null;

  // 2. the paper's actual colour (average of pixels at paper brightness), for un-blending
  let pr = 0; let pg = 0; let pb = 0; let pn = 0;
  for (let i = 0; i < count; i++) {
    const r = data[i * 4]; const g = data[i * 4 + 1]; const b = data[i * 4 + 2];
    if (Math.abs(luminance(r, g, b) - paper) <= 4) { pr += r; pg += g; pb += b; pn += 1; }
  }
  pr /= pn || 1; pg /= pn || 1; pb /= pn || 1;

  // 3. opacity from position between paper and ink; recolour to pure ink
  const start = INK_START * contrast;
  const span = (INK_FULL - INK_START) * contrast;
  let minX = width; let minY = height; let maxX = -1; let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i]; const g = data[i + 1]; const b = data[i + 2];
      const a = Math.min(1, Math.max(0, (paper - luminance(r, g, b) - start) / span));
      if (a < 0.04) { data[i + 3] = 0; continue; }
      // pixel = paper * (1 - a) + ink * a  ->  solve for ink
      data[i] = clamp255((r - pr * (1 - a)) / a);
      data[i + 1] = clamp255((g - pg * (1 - a)) / a);
      data[i + 2] = clamp255((b - pb * (1 - a)) / a);
      data[i + 3] = Math.round(a * 255);
      if (a > 0.1) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const x0 = Math.max(0, minX - PAD); const y0 = Math.max(0, minY - PAD);
  return { x: x0, y: y0, w: Math.min(width, maxX + PAD + 1) - x0, h: Math.min(height, maxY + PAD + 1) - y0 };
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Takes a signature image (data: URL) and resolves to a PNG data: URL with
 * the paper removed and the result cropped to the ink. Resolves to
 * {dataUrl, changed: false} with the original when no ink could be told
 * apart from the paper.
 */
export async function removeSignatureBackground(dataUrl) {
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  // Flatten onto white first: an image that already has (partial)
  // transparency — including one cut by an earlier pass — is then handled
  // exactly like a scan, instead of keeping whatever haze it carried.
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  const pixels = ctx.getImageData(0, 0, width, height);

  const box = knockOutPaper(pixels.data, width, height);
  if (!box) return { dataUrl, changed: false };
  ctx.clearRect(0, 0, width, height);
  ctx.putImageData(pixels, 0, 0);

  const out = document.createElement('canvas');
  out.width = box.w;
  out.height = box.h;
  out.getContext('2d').drawImage(canvas, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
  return { dataUrl: out.toDataURL('image/png'), changed: true };
}
