// Shared lookup tables / constants used across the app.
// NOTE: Thai copy here was rewritten by hand (the original source files that were
// migrated into this project arrived with corrupted Thai text/mojibake), so please
// spot-check wording against your original CPSU ETMS files if exact phrasing matters.

export const CYCLE = ['ประกาศ', 'รับสมัคร', 'จัดกิจกรรม', 'เกียรติบัตร'];

// Single source of truth for event categories, shared by the create-event form
// (organizer can still type a new one) and the home page category filter pills.
export const EVENT_CATEGORIES = ['สัมมนา', 'Workshop', 'การแข่งขัน'];
export const EVENT_CATEGORY_ICONS = { 'สัมมนา': 'ti-microphone', Workshop: 'ti-tools', 'การแข่งขัน': 'ti-trophy' };

export const ROLE_LABEL = {
  admin: 'ผู้ดูแลระบบ',
  organizer: 'ผู้จัดกิจกรรม',
  student: 'นักศึกษา / ผู้เข้าร่วม',
};

export const ROLE_LANDING = {
  admin: '/admin/dashboard',
  organizer: '/home',
  student: '/home',
};

export const STATUS_META = {
  open: { badge: 'badge-open', pill: 'ps-open', label: 'เปิดรับสมัคร', ico: 'ti-circle-check-filled' },
  closed: { badge: 'badge-draft', pill: 'ps-soon', label: 'ปิดรับสมัคร', ico: 'ti-circle-minus' },
  soon: { badge: 'badge-soon', pill: 'ps-soon', label: 'เร็ว ๆ นี้', ico: 'ti-circle-filled' },
  full: { badge: 'badge-full', pill: 'ps-full', label: 'เต็มแล้ว', ico: 'ti-circle-filled' },
  done: { badge: 'badge-done', pill: 'ps-done', label: 'สิ้นสุดแล้ว', ico: 'ti-circle-filled' },
};

export const REG_STATUS_META = {
  registered: { cls: 'ps-wait', ico: 'ti-clock-hour-4', label: 'ลงทะเบียนแล้ว · รอเข้าร่วม' },
  attended: { cls: 'ps-soon', ico: 'ti-clipboard-text', label: 'เข้าร่วมแล้ว · รอทำแบบประเมิน' },
  certified: { cls: 'ps-pass', ico: 'ti-circle-check-filled', label: 'รับเกียรติบัตรแล้ว' },
  absent: { cls: 'ps-fail', ico: 'ti-circle-x', label: 'ไม่ได้เข้าร่วม' },
};

export const SELF = {
  sid: '670710001',
  name: 'ภัทร ยะคำวุฒิ',
  email: 'phat_y@silpakorn.edu',
};

// Demo login accounts (no real backend yet — see useEvents.login). One account per role.
export const MOCK_ACCOUNTS = [
  { email: 'piya_c@silpakorn.edu', password: 'demo1234', role: 'admin', name: 'ผศ.ดร. ปิยะ จันทรัศมี' },
  { email: 'krisada_p@silpakorn.edu', password: 'demo1234', role: 'organizer', name: 'วรันธร สอนสงวน' },
  { email: SELF.email, password: 'demo1234', role: 'student', name: SELF.name },
];
