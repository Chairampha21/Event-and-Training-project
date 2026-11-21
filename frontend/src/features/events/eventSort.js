// Orders for the organizer's event table. `key` is what is compared, `dir`
// 'asc' or 'desc'; the column headers flip `dir`, the "เรียงตาม" menu picks a
// ready-made pair. Ties fall back to the event date, then the newest event.

const STATUS_ORDER = { open: 0, full: 1, soon: 2, closed: 3, done: 4 };
const th = new Intl.Collator('th', { sensitivity: 'base', numeric: true });

const lastDay = (e) => e.dateEnd || e.dateStart || '';
const fill = (e) => (Number(e.cap) > 0 ? e.reg / Number(e.cap) : -1);

// "ใกล้ถึงก่อน": events still to come or under way, the nearest first; then
// the ones already over, the most recent first.
function upcomingRank(e, today) {
  const over = lastDay(e) && lastDay(e) < today;
  return over ? [1, -Date.parse(lastDay(e))] : [0, Date.parse(e.dateStart || '9999-12-31')];
}

const COMPARE = {
  upcoming: (a, b, today) => {
    const [ga, va] = upcomingRank(a, today);
    const [gb, vb] = upcomingRank(b, today);
    return ga - gb || va - vb;
  },
  date: (a, b) => (a.dateStart || '').localeCompare(b.dateStart || ''),
  title: (a, b) => th.compare(a.title || '', b.title || ''),
  status: (a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9),
  stage: (a, b) => (a.stage ?? 0) - (b.stage ?? 0),
  reg: (a, b) => (a.reg || 0) - (b.reg || 0),
  fill: (a, b) => fill(a) - fill(b),
  created: (a, b) => a.id - b.id,
};

/** The "เรียงตาม" menu: each choice is a key and a direction. */
export const SORT_PRESETS = [
  { value: 'upcoming', label: 'ใกล้ถึงก่อน', key: 'upcoming', dir: 'asc' },
  { value: 'date-desc', label: 'วันที่จัด · ล่าสุดก่อน', key: 'date', dir: 'desc' },
  { value: 'date-asc', label: 'วันที่จัด · เก่าสุดก่อน', key: 'date', dir: 'asc' },
  { value: 'created-desc', label: 'สร้างล่าสุด', key: 'created', dir: 'desc' },
  { value: 'title-asc', label: 'ชื่อ ก–ฮ / A–Z', key: 'title', dir: 'asc' },
  { value: 'title-desc', label: 'ชื่อ ฮ–ก / Z–A', key: 'title', dir: 'desc' },
  { value: 'reg-desc', label: 'ผู้สมัครมากสุด', key: 'reg', dir: 'desc' },
  { value: 'fill-desc', label: 'ที่นั่งใกล้เต็มที่สุด', key: 'fill', dir: 'desc' },
  { value: 'status-asc', label: 'สถานะ · เปิดรับก่อน', key: 'status', dir: 'asc' },
  { value: 'stage-asc', label: 'ขั้นตอน · ยังไม่ปิดก่อน', key: 'stage', dir: 'asc' },
];

export const DEFAULT_SORT = { key: 'upcoming', dir: 'asc' };

/** Which menu choice matches a sort, or '' when it was set from a header. */
export const presetOf = (sort) => SORT_PRESETS.find((p) => p.key === sort.key && p.dir === sort.dir)?.value || '';

/** Which way a column header click goes first: names A→Z, numbers and dates biggest/newest first. */
export const firstDir = (key) => (key === 'title' || key === 'status' || key === 'stage' || key === 'upcoming' ? 'asc' : 'desc');

export function sortEvents(list, sort, today) {
  const cmp = COMPARE[sort.key] || COMPARE.upcoming;
  const sign = sort.dir === 'desc' ? -1 : 1;
  return [...list].sort((a, b) => sign * cmp(a, b, today)
    || (a.dateStart || '').localeCompare(b.dateStart || '')
    || b.id - a.id);
}
