// Thai (Buddhist calendar) date formatting for the create-event form's
// native <input type="date"> pickers (which give ISO yyyy-mm-dd strings).

export const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
export const THAI_MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

export function toBuddhistYear(y) { return y + 543; }

function parseIso(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
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

/** "วันที่ 18 – 19 เดือน ตุลาคม พ.ศ. 2568" style long-form date, for certificates. */
export function formatCertDate(startIso, endIso) {
  const s = parseIso(startIso);
  const e = parseIso(endIso);
  if (!s) return '';
  if (!e || (e.y === s.y && e.m === s.m && e.d === s.d)) {
    return `วันที่ ${s.d} เดือน ${THAI_MONTHS_FULL[s.m - 1]} พ.ศ. ${toBuddhistYear(s.y)}`;
  }
  if (s.y === e.y && s.m === e.m) {
    return `วันที่ ${s.d} – ${e.d} เดือน ${THAI_MONTHS_FULL[s.m - 1]} พ.ศ. ${toBuddhistYear(s.y)}`;
  }
  if (s.y === e.y) {
    return `วันที่ ${s.d} เดือน ${THAI_MONTHS_FULL[s.m - 1]} – ${e.d} เดือน ${THAI_MONTHS_FULL[e.m - 1]} พ.ศ. ${toBuddhistYear(s.y)}`;
  }
  return `วันที่ ${s.d} เดือน ${THAI_MONTHS_FULL[s.m - 1]} พ.ศ. ${toBuddhistYear(s.y)} – ${e.d} เดือน ${THAI_MONTHS_FULL[e.m - 1]} พ.ศ. ${toBuddhistYear(e.y)}`;
}
