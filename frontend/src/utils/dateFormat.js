// Thai (Buddhist calendar) date formatting for the create-event form's
// native <input type="date"> pickers (which give ISO yyyy-mm-dd strings).

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const THAI_MONTH_INDEX = THAI_MONTHS.reduce((m, name, i) => { m[name] = i + 1; return m; }, {});

function parseIso(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

function toBuddhistYear(y) { return y + 543; }

function toIso(y, m, d) { return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }

function fromParts(d, mon, by) {
  const m = THAI_MONTH_INDEX[mon];
  if (!m) return null;
  return toIso(Number(by) - 543, m, Number(d));
}

export function formatThaiDate(iso) {
  const p = parseIso(iso);
  if (!p) return '';
  return `${p.d} ${THAI_MONTHS[p.m - 1]} ${toBuddhistYear(p.y)}`;
}

/** Formats a start/end ISO date pair as a Thai range, collapsing month/year when they match. */
export function formatThaiDateRange(startIso, endIso) {
  const s = parseIso(startIso);
  const e = parseIso(endIso);
  if (!s) return '';
  if (!e) return formatThaiDate(startIso);
  if (s.y === e.y && s.m === e.m) {
    return `${s.d}–${e.d} ${THAI_MONTHS[s.m - 1]} ${toBuddhistYear(s.y)}`;
  }
  if (s.y === e.y) {
    return `${s.d} ${THAI_MONTHS[s.m - 1]} – ${e.d} ${THAI_MONTHS[e.m - 1]} ${toBuddhistYear(s.y)}`;
  }
  return `${formatThaiDate(startIso)} – ${formatThaiDate(endIso)}`;
}

/**
 * Best-effort inverse of formatThaiDate/formatThaiDateRange, used to pre-fill the
 * <input type="date"> pickers when editing an existing event (only its formatted
 * Thai display string is stored, not the original ISO value).
 * Returns { startIso, endIso } (endIso null for a single day), or null if unparseable.
 */
export function parseThaiDateDisplay(display) {
  if (!display) return null;
  let m;
  if ((m = display.match(/^(\d{1,2})\s+(\S+)\s+(\d{4})$/))) {
    const startIso = fromParts(m[1], m[2], m[3]);
    return startIso ? { startIso, endIso: null } : null;
  }
  if ((m = display.match(/^(\d{1,2})[–-](\d{1,2})\s+(\S+)\s+(\d{4})$/))) {
    const startIso = fromParts(m[1], m[3], m[4]);
    const endIso = fromParts(m[2], m[3], m[4]);
    return startIso && endIso ? { startIso, endIso } : null;
  }
  if ((m = display.match(/^(\d{1,2})\s+(\S+)\s+[–-]\s+(\d{1,2})\s+(\S+)\s+(\d{4})$/))) {
    const startIso = fromParts(m[1], m[2], m[5]);
    const endIso = fromParts(m[3], m[4], m[5]);
    return startIso && endIso ? { startIso, endIso } : null;
  }
  if ((m = display.match(/^(\d{1,2})\s+(\S+)\s+(\d{4})\s+[–-]\s+(\d{1,2})\s+(\S+)\s+(\d{4})$/))) {
    const startIso = fromParts(m[1], m[2], m[3]);
    const endIso = fromParts(m[4], m[5], m[6]);
    return startIso && endIso ? { startIso, endIso } : null;
  }
  return null;
}
