// Thai (Buddhist calendar) date formatting for the create-event form's
// native <input type="date"> pickers (which give ISO yyyy-mm-dd strings).

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

function parseIso(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

function toBuddhistYear(y) { return y + 543; }

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
