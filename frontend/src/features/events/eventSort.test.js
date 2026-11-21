import { sortEvents, presetOf, firstDir } from './eventSort';

const ev = (id, title, dateStart, extra = {}) => ({ id, title, dateStart, dateEnd: '', reg: 0, cap: 10, status: 'done', stage: 4, ...extra });
const events = [
  ev(1, 'ค่ายเตรียมความพร้อม', '2026-06-20', { reg: 22, cap: 80 }),
  ev(2, 'AUCC 2027', '2027-02-03', { status: 'open', stage: 1, reg: 5, cap: 5 }),
  ev(3, 'Hackathon', '2026-12-10', { status: 'open', stage: 1, reg: 30, cap: 60 }),
  ev(4, 'การแข่งขัน CPSU Coding', '2026-08-22', { reg: 30, cap: 60 }),
];
const ids = (list) => list.map((e) => e.id);
const today = '2026-11-21';

test('upcoming: the nearest coming event first, then past ones newest first', () => {
  expect(ids(sortEvents(events, { key: 'upcoming', dir: 'asc' }, today))).toEqual([3, 2, 4, 1]);
});
test('dates both ways', () => {
  expect(ids(sortEvents(events, { key: 'date', dir: 'desc' }, today))).toEqual([2, 3, 4, 1]);
  expect(ids(sortEvents(events, { key: 'date', dir: 'asc' }, today))).toEqual([1, 4, 3, 2]);
});
test('names: Thai in dictionary order (ก–ฮ), then English (A–Z)', () => {
  expect(ids(sortEvents(events, { key: 'title', dir: 'asc' }, today))).toEqual([4, 1, 2, 3]);
});
test('registrations, fill, status; ties by date', () => {
  expect(ids(sortEvents(events, { key: 'reg', dir: 'desc' }, today))).toEqual([4, 3, 1, 2]);
  expect(ids(sortEvents(events, { key: 'fill', dir: 'desc' }, today))).toEqual([2, 4, 3, 1]);
  expect(ids(sortEvents(events, { key: 'status', dir: 'asc' }, today))).toEqual([3, 2, 1, 4]);
});
test('menu and headers', () => {
  expect(presetOf({ key: 'reg', dir: 'desc' })).toBe('reg-desc');
  expect(presetOf({ key: 'reg', dir: 'asc' })).toBe('');
  expect(firstDir('title')).toBe('asc');
  expect(firstDir('date')).toBe('desc');
  expect(ids(sortEvents(events, { key: 'nonsense', dir: 'asc' }, today))).toEqual([3, 2, 4, 1]);
});
