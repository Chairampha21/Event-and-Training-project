import { api } from '../../services/api';
import { todayIso } from '../../utils/dateFormat';
import { parsePosterText } from './posterText';

// The model sees images at up to ~1568 px on the long edge; a smaller JPEG
// uploads faster and keeps the request well under the size limit.
const MAX_EDGE = 1568;

function shrink(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; // transparent PNG areas become white, not black
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// Free fallback: Tesseract OCR in the browser (Thai + English), then plain
// rules pick the details out of the text. Loaded only when needed; the
// language data comes from the jsDelivr CDN on first use.
async function readWithOcr(image) {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker(['tha', 'eng']);
  try {
    const { data } = await worker.recognize(image, {}, { blocks: true });
    const lines = (data.blocks || []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines));
    return parsePosterText(lines, todayIso());
  } finally {
    await worker.terminate();
  }
}

/**
 * What the poster says: { title, description, category, days: [{date, start, end}],
 * attend_mode, place, online_link, fee, reg_end } (each null when it doesn't
 * say), and how it was read: 'ai' (Gemini or Claude, on the server) or 'ocr' (in the
 * browser, when the server has no API key or can't be reached).
 */
export async function readPoster(dataUrl, categories) {
  const image = await shrink(dataUrl);
  try {
    const { fields } = await api.post('/events/read-poster', { image, categories });
    return { fields, source: 'ai' };
  } catch (err) {
    if (err.status !== 503 && err.status !== 0) throw err;
  }
  return { fields: await readWithOcr(image), source: 'ocr' };
}
