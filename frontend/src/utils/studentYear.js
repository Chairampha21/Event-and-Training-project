// Silpakorn student IDs start with the Buddhist-era year the student was
// admitted: 670710001 = admitted in 2567. The academic year starts in June,
// so in June 2569 (2026) that student moves up to year 3.
const ACADEMIC_YEAR_STARTS = 5; // month index: June

/** The academic year (Buddhist era) on a given day: Nov 2026 → 2569, Mar 2027 → 2569. */
export function academicYearBE(now = new Date()) {
  return now.getFullYear() + 543 - (now.getMonth() < ACADEMIC_YEAR_STARTS ? 1 : 0);
}

/**
 * The year of study ("1".."8") a student ID points to, or '' when the ID
 * doesn't look like one (not 8–11 digits, or a year that makes no sense).
 */
export function studentYearFromId(studentId, now = new Date()) {
  const id = String(studentId || '').trim();
  if (!/^\d{8,11}$/.test(id)) return '';
  const admitted = 2500 + Number(id.slice(0, 2));
  const year = academicYearBE(now) - admitted + 1;
  return year >= 1 && year <= 8 ? String(year) : '';
}
