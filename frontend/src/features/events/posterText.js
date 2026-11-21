// Picks event details out of the text OCR read from a poster. Plain rules, not
// AI: it finds Thai dates ("22 ตุลาคม 2569", "23 พ.ย. 68"), time ranges
// ("16:30 - 19:00 น."), the place ("ณ ห้อง ..."), a fee, and takes the
// tallest line as the title. Fields it can't find are null, like the
// server's reader, so the form fills them the same way.

const MONTHS = [
  ['มกราคม', 'ม.ค.', 'jan'], ['กุมภาพันธ์', 'ก.พ.', 'feb'], ['มีนาคม', 'มี.ค.', 'mar'],
  ['เมษายน', 'เม.ย.', 'apr'], ['พฤษภาคม', 'พ.ค.', 'may'], ['มิถุนายน', 'มิ.ย.', 'jun'],
  ['กรกฎาคม', 'ก.ค.', 'jul'], ['สิงหาคม', 'ส.ค.', 'aug'], ['กันยายน', 'ก.ย.', 'sep'],
  ['ตุลาคม', 'ต.ค.', 'oct'], ['พฤศจิกายน', 'พ.ย.', 'nov'], ['ธันวาคม', 'ธ.ค.', 'dec'],
];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Longest first, so "มีนาคม" wins over "มี.ค." and full names over abbreviations.
const MONTH_WORDS = MONTHS.flatMap((names, i) => names.map((n) => [n, i]))
  .sort((a, b) => b[0].length - a[0].length);
const MONTH_RE = MONTH_WORDS.map(([n]) => (/^[a-z]+$/.test(n) ? `${n}[a-z]*` : esc(n))).join('|');
const monthIndex = (word) => {
  const w = word.toLowerCase();
  const hit = MONTH_WORDS.find(([n]) => (/^[a-z]+$/.test(n) ? w.startsWith(n) : w === n));
  return hit ? hit[1] : -1;
};

// "23พฤศจิกายน2568", "22-23ต.ค.69", "5 Nov 2026" (whitespace already removed)
const DATE_RE = new RegExp(`(\\d{1,2})(?:[-–](\\d{1,2}))?(${MONTH_RE})(?:พ\\.?ศ\\.?|ค\\.?ศ\\.?)?(\\d{4}|\\d{2}(?!\\d|[:.]\\d))?`, 'gi');
const DATE_TEST = new RegExp(DATE_RE.source, 'i'); // for .test(): no lastIndex state
// "16:30-19:00", "16.30น.-19.00น.", "9:00ถึง12:00"
const TIME_RE = /(\d{1,2})[:.](\d{2})(?:น\.?)?(?:-|–|—|~|ถึง)(\d{1,2})[:.](\d{2})/;
const REG_LINE_RE = /สมัคร|ปิดรับ|ภายในวันที่|deadline|register/i;

const thaiDigits = (s) => s.replace(/[๐-๙]/g, (d) => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(d)));
// Tesseract puts spaces between Thai letters; Thai doesn't space words, so drop them.
const joinThai = (s) => s.replace(/([ก-๙])\s+(?=[ก-๙])/g, '$1');
const clean = (s) => joinThai(thaiDigits(s || '')).replace(/[|]/g, ' ').replace(/\s+/g, ' ').trim();
const compact = (s) => thaiDigits(s || '').replace(/\s+/g, '');
const pad = (n) => String(n).padStart(2, '0');

function toYear(y, month, day, today) {
  if (!y) {
    // No year: the next such date on or after today.
    const t = new Date(`${today}T00:00:00`);
    let year = t.getFullYear();
    if (new Date(year, month, day) < t) year += 1;
    return year;
  }
  const n = Number(y);
  if (y.length === 2) return 2500 + n - 543; // "69" = 2569
  return n > 2400 ? n - 543 : n;
}

function datesIn(text, today) {
  const out = [];
  for (const m of compact(text).matchAll(DATE_RE)) {
    const month = monthIndex(m[3]);
    const from = Number(m[1]);
    const to = m[2] ? Number(m[2]) : from;
    if (month < 0 || from < 1 || to > 31 || to < from || to - from > 14) continue;
    const year = toYear(m[4], month, from, today);
    for (let d = from; d <= to; d++) {
      const dt = new Date(year, month, d);
      if (dt.getMonth() === month) out.push(`${year}-${pad(month + 1)}-${pad(d)}`);
    }
  }
  return out;
}

function timeIn(text) {
  const m = compact(text).match(TIME_RE);
  if (!m) return null;
  const [h1, m1, h2, m2] = m.slice(1).map(Number);
  if (h1 > 23 || h2 > 23 || m1 > 59 || m2 > 59) return null;
  return { start: `${pad(h1)}:${m[2]}`, end: `${pad(h2)}:${m[4]}` };
}

function placeIn(lines) {
  for (const line of lines) {
    const raw = thaiDigits(line.text || '');
    // "ณ" as its own word (not inside a word like "คุณ"), or a "สถานที่:" label.
    const m = raw.match(/(?:^|\s)ณ\s+(.+)/) || raw.match(/สถานที่\s*[:：]?\s*(.+)/) || clean(raw).match(/^((?:ห้อง|อาคาร)\S.*)/);
    if (m) {
      const place = clean(m[1]).replace(/^[:：\s]+/, '').slice(0, 150);
      if (place.length >= 3) return place;
    }
  }
  return null;
}

function feeIn(text) {
  const c = compact(text);
  if (/ฟรี|ไม่มีค่าใช้จ่าย|ไม่เสียค่าใช้จ่าย|free/i.test(c)) return null;
  const m = c.match(/ค่า(?:ลงทะเบียน|สมัคร|ใช้จ่าย)[^0-9]{0,10}(\d[\d,]*)(?:\.\d+)?บาท/);
  return m ? Number(m[1].replace(/,/g, '')) || null : null;
}

function titleIn(lines) {
  const isInfo = (t) => DATE_TEST.test(compact(t)) || TIME_RE.test(compact(t)) || /(?:^|\s)ณ\s/.test(t) || /https?:|www\.|@|\d{3}-\d{3}/.test(t);
  const candidates = lines
    .map((l, i) => ({ ...l, i, text: clean(l.text), h: l.bbox ? l.bbox.y1 - l.bbox.y0 : 0 }))
    .filter((l) => (l.text.match(/[A-Za-zก-๙]/g) || []).length >= 3 && (l.confidence ?? 100) >= 55)
    .filter((l) => !isInfo(l.text));
  if (candidates.length === 0) return null;
  // Without sizes (no bounding boxes) the first line is the best guess.
  const best = candidates.reduce((a, b) => (b.h > a.h ? b : a), candidates[0]);
  let title = best.text;
  // A title set over two lines in the same large type: take the next line too.
  const next = candidates.find((l) => l.i === best.i + 1);
  if (next && best.h > 0 && next.h >= best.h * 0.75) title = `${title} ${next.text}`;
  return title.slice(0, 200);
}

/**
 * @param {{text: string, confidence?: number, bbox?: {y0: number, y1: number}}[]} lines OCR lines, top to bottom
 * @param {string} today YYYY-MM-DD
 */
export function parsePosterText(lines, today) {
  const all = lines.map((l) => l.text || '').join('\n');
  const days = [];
  let regEnd = null;
  for (const line of lines) {
    const found = datesIn(line.text, today);
    if (found.length === 0) continue;
    if (REG_LINE_RE.test(compact(line.text))) regEnd = regEnd || found[found.length - 1];
    else days.push(...found);
  }
  const uniqueDays = [...new Set(days)].sort();
  const time = timeIn(all);
  const place = placeIn(lines);
  const online = /online|ออนไลน์|zoom|teams|googlemeet|meet\.google/i.test(compact(all));
  const link = (all.match(/https?:\/\/[^\s]+/i) || [])[0] || null;

  return {
    title: titleIn(lines),
    description: null,
    category: null,
    days: uniqueDays.map((date) => ({ date, start: time?.start || null, end: time?.end || null })),
    attend_mode: online ? (place ? 'hybrid' : 'online') : (place ? 'onsite' : null),
    place,
    online_link: link,
    fee: feeIn(all),
    reg_end: regEnd,
  };
}
