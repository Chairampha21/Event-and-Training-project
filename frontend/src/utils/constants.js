// Shared lookup tables / constants used across the app.
// NOTE: Thai copy here was rewritten by hand (the original source files that were
// migrated into this project arrived with corrupted Thai text/mojibake), so please
// spot-check wording against your original CPSU ETMS files if exact phrasing matters.

export const CYCLE = ['ประกาศ', 'รับสมัคร', 'จัดกิจกรรม', 'เกียรติบัตร', 'ปิดกิจกรรม'];

// Single source of truth for event categories, shared by the create-event form
// (organizer can still type a new one) and the home page category filter pills.
export const EVENT_CATEGORIES = ['อบรมเชิงบรรยาย', 'อบรมเชิงปฏิบัติการ', 'การแข่งขัน'];
export const EVENT_CATEGORY_ICONS = { 'อบรมเชิงบรรยาย': 'ti-microphone', 'อบรมเชิงปฏิบัติการ': 'ti-tools', 'การแข่งขัน': 'ti-trophy' };

export const ROLE_LABEL = {
  admin: 'ผู้ดูแลระบบ',
  organizer: 'ผู้จัดกิจกรรม',
  student: 'นักศึกษา / ผู้เข้าร่วม',
  teacher: 'อาจารย์',
};

// Roles that join events (register, check in, evaluate, get certificates).
// Teachers use the same pages as students; they just have no student ID.
export const PARTICIPANT_ROLES = ['student', 'teacher'];
export const isParticipant = (role) => PARTICIPANT_ROLES.includes(role);

export const ROLE_LANDING = {
  admin: '/admin/dashboard',
  organizer: '/home',
  student: '/home',
  teacher: '/home',
};

export const STATUS_META = {
  open: { badge: 'badge-open', pill: 'ps-open', label: 'เปิดรับสมัคร', ico: 'ti-circle-check-filled' },
  closed: { badge: 'badge-draft', pill: 'ps-soon', label: 'ปิดรับสมัคร', ico: 'ti-circle-minus' },
  soon: { badge: 'badge-soon', pill: 'ps-soon', label: 'รอเปิดรับสมัคร', ico: 'ti-circle-filled' },
  full: { badge: 'badge-full', pill: 'ps-full', label: 'เต็มแล้ว', ico: 'ti-circle-filled' },
  done: { badge: 'badge-done', pill: 'ps-done', label: 'สิ้นสุดแล้ว', ico: 'ti-circle-filled' },
};

export const REG_STATUS_META = {
  registered: { cls: 'ps-wait', ico: 'ti-clock-hour-4', label: 'ลงทะเบียนแล้ว · รอเข้าร่วม' },
  attended: { cls: 'ps-soon', ico: 'ti-clipboard-text', label: 'เข้าร่วมแล้ว · รอทำแบบประเมิน' },
  certified: { cls: 'ps-pass', ico: 'ti-circle-check-filled', label: 'รับเกียรติบัตรแล้ว' },
  absent: { cls: 'ps-fail', ico: 'ti-circle-x', label: 'ไม่ได้เข้าร่วม' },
};

// Who may register for an event: everyone, or students of one programme
// (matched against the major in the student's profile).
export const EVENT_PROGRAMS = [
  { key: 'all', label: 'ทุกสาขา', short: '', tag: '' },
  { key: 'cs', label: 'เฉพาะสาขาวิทยาการคอมพิวเตอร์ (CS)', short: 'วิทยาการคอมพิวเตอร์', tag: 'CS' },
  { key: 'it', label: 'เฉพาะสาขาเทคโนโลยีสารสนเทศ (IT)', short: 'เทคโนโลยีสารสนเทศ', tag: 'IT' },
];

// Years of study an event can be limited to; '5' covers year 5 and above.
// An event with none picked takes every year.
export const STUDENT_YEARS = [
  { key: '1', label: 'ปี 1' },
  { key: '2', label: 'ปี 2' },
  { key: '3', label: 'ปี 3' },
  { key: '4', label: 'ปี 4' },
  { key: '5', label: 'ปี 5 ขึ้นไป' },
];

/** ['1', '2'] → "ชั้นปีที่ 1, 2"; [] → '' (every year). */
export function yearsText(years) {
  if (!years || years.length === 0) return '';
  return `ชั้นปีที่ ${years.map((y) => (y === '5' ? '5 ขึ้นไป' : y)).join(', ')}`;
}
