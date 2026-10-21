// Thai (Buddhist calendar) date formatting for the create-event form's
// native <input type="date"> pickers (which give ISO yyyy-mm-dd strings).

import { formatTimeRange } from './timeFormat';

export const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
export const THAI_MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

export function toBuddhistYear(y) { return y + 543; }

function parseIso(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

// Dates are written the way Thai event posters do: day, full month name,
// Buddhist year — "18 สิงหาคม 2569", and "18 - 19 สิงหาคม 2569" for a range.
export function formatThaiDate(iso) {
  const p = parseIso(iso);
  if (!p) return '';
  return `${p.d} ${THAI_MONTHS_FULL[p.m - 1]} ${toBuddhistYear(p.y)}`;
}

/** ISO date → "15 พ.ย." (day and short month), for tight spots such as a button. */
export function formatThaiDayMonth(iso) {
  const p = parseIso(iso);
  return p ? `${p.d} ${THAI_MONTHS[p.m - 1]}` : '';
}

/** Formats a start/end ISO date pair as a Thai range, collapsing month/year when they match. */
export function formatThaiDateRange(startIso, endIso) {
  const s = parseIso(startIso);
  const e = parseIso(endIso);
  if (!s) return '';
  if (!e) return formatThaiDate(startIso);
  if (s.y === e.y && s.m === e.m) {
    if (s.d === e.d) return formatThaiDate(startIso);
    return `${s.d} - ${e.d} ${THAI_MONTHS_FULL[s.m - 1]} ${toBuddhistYear(s.y)}`;
  }
  if (s.y === e.y) {
    return `${s.d} ${THAI_MONTHS_FULL[s.m - 1]} - ${e.d} ${THAI_MONTHS_FULL[e.m - 1]} ${toBuddhistYear(s.y)}`;
  }
  return `${formatThaiDate(startIso)} - ${formatThaiDate(endIso)}`;
}

function isConsecutive(isos) {
  for (let i = 1; i < isos.length; i++) {
    if (Math.round((new Date(isos[i]) - new Date(isos[i - 1])) / 86400000) !== 1) return false;
  }
  return true;
}

// Joins individually-picked days, naming the month/year once per group:
// "23, 25 ตุลาคม 2569" · "30 ตุลาคม, 2 พฤศจิกายน 2569" · "30 ธันวาคม 2569, 2 มกราคม 2570".
function joinDateList(isos, months, monthYear) {
  const ps = isos.map(parseIso).filter(Boolean);
  const sameYear = ps.every((p) => p.y === ps[0].y);
  const groups = [];
  ps.forEach((p) => {
    const g = groups[groups.length - 1];
    if (g && g.y === p.y && g.m === p.m) g.days.push(p.d);
    else groups.push({ y: p.y, m: p.m, days: [p.d] });
  });
  return groups.map((g, i) => {
    const withYear = !sameYear || i === groups.length - 1;
    return `${g.days.join(', ')} ${monthYear(months[g.m - 1], withYear ? toBuddhistYear(g.y) : null)}`;
  }).join(', ');
}

/**
 * Formats the days of a multi-day event that were picked one by one. A
 * consecutive run reads as a range ("23 - 25 ตุลาคม 2569"); otherwise each day is
 * listed ("23, 25 ตุลาคม 2569").
 */
export function formatThaiDateList(isos) {
  const list = (isos || []).filter(Boolean);
  if (list.length === 0) return '';
  if (list.length === 1) return formatThaiDate(list[0]);
  if (isConsecutive(list)) return formatThaiDateRange(list[0], list[list.length - 1]);
  return joinDateList(list, THAI_MONTHS_FULL, (m, y) => (y ? `${m} ${y}` : m));
}

/** Long-form version of formatThaiDateList for certificates: "วันที่ 23, 25 เดือน ตุลาคม พ.ศ. 2569". */
export function formatCertDateList(isos) {
  const list = (isos || []).filter(Boolean);
  if (list.length === 0) return '';
  if (list.length === 1 || isConsecutive(list)) return formatCertDate(list[0], list[list.length - 1]);
  return `วันที่ ${joinDateList(list, THAI_MONTHS_FULL, (m, y) => (y ? `เดือน ${m} พ.ศ. ${y}` : `เดือน ${m}`))}`;
}

/** "09:00-12:00" (per-day time as stored) -> "09.00–12.00 น."; '' if unset. */
export function formatDayTime(range) {
  const [start, end] = (range || '').split('-');
  return formatTimeRange(start, end);
}

/**
 * One-line time summary for a multi-day event whose days each have their own
 * time: the shared time when every day matches, otherwise a note that it varies.
 */
export function summarizeDayTimes(ranges) {
  const list = (ranges || []).filter(Boolean);
  if (list.length === 0) return '';
  return list.every((r) => r === list[0]) ? formatDayTime(list[0]) : 'เวลาต่างกันในแต่ละวัน';
}

/**
 * "8 ตุลาคม 2569 เวลา 14.30 น." from either
 *  - a wall-clock value with no zone ("2026-10-08 14:30:00" / "2026-10-08T14:30"), shown as written, or
 *  - an instant with a zone ("2026-10-08T07:30:00Z"), shown in the viewer's local time.
 */
export function formatThaiDateTime(value) {
  if (!value) return '';
  let iso; let hh; let mm;
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(value)) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    // Thai time whatever the viewer's computer is set to (e.g. a cloud machine on UTC).
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(d).map((x) => [x.type, x.value]));
    iso = `${parts.year}-${parts.month}-${parts.day}`;
    hh = Number(parts.hour); mm = Number(parts.minute);
  } else {
    const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/.exec(value);
    if (!m) return formatThaiDate(value.slice(0, 10));
    iso = m[1]; hh = Number(m[2]); mm = Number(m[3]);
  }
  return `${formatThaiDate(iso)} เวลา ${String(hh).padStart(2, '0')}.${String(mm).padStart(2, '0')} น.`;
}

/** Today's date in the browser's local timezone, as ISO yyyy-mm-dd. */
export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Buddhist-era calendar year of a date: 2026-10-11 -> 2569. */
export function buddhistYearOf(iso) {
  return iso ? Number(iso.slice(0, 4)) + 543 : null;
}

/**
 * Thai fiscal year (Buddhist era) a date falls in. The year runs 1 October to
 * 30 September and is named after the year it ends in: 2026-10-01 -> 2570.
 */
export function fiscalYearOf(iso) {
  if (!iso) return null;
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  return y + (m >= 10 ? 1 : 0) + 543;
}

/** Registration window as display text; either side may be unset. '' when neither is set. */
export function formatRegPeriod(startIso, endIso) {
  if (startIso && endIso) return startIso === endIso ? formatThaiDate(startIso) : formatThaiDateRange(startIso, endIso);
  if (startIso) return `ตั้งแต่ ${formatThaiDate(startIso)}`;
  if (endIso) return `ถึง ${formatThaiDate(endIso)}`;
  return '';
}

/** "วันที่ 18 - 19 เดือน ตุลาคม พ.ศ. 2568" style long-form date, for certificates. */
export function formatCertDate(startIso, endIso) {
  const s = parseIso(startIso);
  const e = parseIso(endIso);
  if (!s) return '';
  if (!e || (e.y === s.y && e.m === s.m && e.d === s.d)) {
    return `วันที่ ${s.d} เดือน ${THAI_MONTHS_FULL[s.m - 1]} พ.ศ. ${toBuddhistYear(s.y)}`;
  }
  if (s.y === e.y && s.m === e.m) {
    return `วันที่ ${s.d} - ${e.d} เดือน ${THAI_MONTHS_FULL[s.m - 1]} พ.ศ. ${toBuddhistYear(s.y)}`;
  }
  if (s.y === e.y) {
    return `วันที่ ${s.d} เดือน ${THAI_MONTHS_FULL[s.m - 1]} - ${e.d} เดือน ${THAI_MONTHS_FULL[e.m - 1]} พ.ศ. ${toBuddhistYear(s.y)}`;
  }
  return `วันที่ ${s.d} เดือน ${THAI_MONTHS_FULL[s.m - 1]} พ.ศ. ${toBuddhistYear(s.y)} - ${e.d} เดือน ${THAI_MONTHS_FULL[e.m - 1]} พ.ศ. ${toBuddhistYear(e.y)}`;
}
