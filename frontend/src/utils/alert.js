import Swal from 'sweetalert2';
import './alert.css';

// SweetAlert2 pop-ups for what the system is doing and how it ended:
// a "working…" pop-up while a change is being sent to the server, naming the
// step in progress, then a result pop-up (success closes by itself; a problem
// waits a little longer and has a button). Bell notifications are separate —
// see components/ui/Toast.

// What each change to the server is called while it runs. Requests that are
// not listed (reading data, ticking a check-in switch, marking a notification
// read) happen quietly.
const STEPS = [
  ['POST', /^\/auth\/(login|google)$/, 'กำลังเข้าสู่ระบบ'],
  ['POST', /^\/auth\/register$/, 'กำลังสมัครสมาชิก'],
  ['PUT', /^\/auth\/me$/, 'กำลังบันทึกโปรไฟล์'],
  ['POST', /^\/events$/, 'กำลังสร้างกิจกรรม'],
  ['PUT', /^\/events\/\d+$/, (body) => {
    const keys = Object.keys(body || {});
    if (body?.cycle_stage >= 4) return 'กำลังเปิดสิทธิ์เกียรติบัตร';
    if (keys.length === 1 && keys[0] === 'budget_actual') return 'กำลังบันทึกงบประมาณที่ใช้จริง';
    if (keys.length === 1 && keys[0] === 'status') return 'กำลังเปลี่ยนสถานะการรับสมัคร';
    return 'กำลังบันทึกข้อมูลกิจกรรม';
  }],
  ['DELETE', /^\/events\/\d+$/, 'กำลังลบกิจกรรม'],
  ['POST', /^\/events\/\d+\/register$/, 'กำลังลงทะเบียน'],
  ['POST', /^\/events\/\d+\/self-checkin$/, 'กำลังเช็คอิน'],
  ['PUT', /^\/events\/\d+\/sar$/, 'กำลังบันทึกโปสเตอร์สรุปข่าว'],
  ['PUT', /^\/events\/\d+\/evaluation-questions$/, 'กำลังบันทึกคำถามแบบประเมิน'],
  ['DELETE', /^\/registrations\/\d+$/, 'กำลังยกเลิกการสมัคร'],
  ['PATCH', /^\/registrations\/\d+\/payment$/, 'กำลังบันทึกผลตรวจการชำระเงิน'],
  ['POST', /^\/registrations\/\d+\/slip$/, 'กำลังส่งหลักฐานการชำระเงิน'],
  ['POST', /^\/registrations\/\d+\/evaluation$/, 'กำลังส่งแบบประเมิน'],
  ['POST', /^\/blacklist$/, 'กำลังเพิ่มรายชื่อใน Blacklist'],
  ['POST', /^\/blacklist\/\d+\/restore$/, 'กำลังคืนสิทธิ์'],
  ['POST', /^\/users$/, 'กำลังเพิ่มผู้ใช้งาน'],
  ['PUT', /^\/users\/\d+$/, 'กำลังบันทึกข้อมูลผู้ใช้งาน'],
  ['PATCH', /^\/users\/\d+\/active$/, 'กำลังเปลี่ยนสถานะบัญชี'],
  ['DELETE', /^\/users\/\d+$/, 'กำลังลบผู้ใช้งาน'],
];

function stepLabel(method, path, body) {
  const clean = path.split('?')[0];
  const hit = STEPS.find(([m, re]) => m === method && re.test(clean));
  if (!hit) return null;
  return typeof hit[2] === 'function' ? hit[2](body) : hit[2];
}

// The "working…" pop-up stays at least this long, so a fast server does not
// make it a flicker. It stays up through everything the action does next
// (reloading the data it changed) until the result replaces it; only when the
// system has been idle this long with no result does it close by itself.
const MIN_LOADING_MS = 450;
const IDLE_CLOSE_MS = 1200;

let active = 0; // requests of any kind in flight
let loadingSince = 0;
let closeTimer = null;
// An action made of several steps (see withProgress): while one is running the
// "working…" pop-up never closes, and results are held back until the end.
let scopes = 0;
let held = null; // [title, text, type] to show when the action is over
let resultTimer = null; // countdown of a result that took over the "working…" pop-up
const isLoadingOpen = () => Swal.isVisible() && Swal.isLoading();

function showLoading(label) {
  clearTimeout(closeTimer);
  clearTimeout(resultTimer);
  if (isLoadingOpen()) {
    // A further step of the same action: say what is happening now.
    const title = Swal.getTitle();
    if (title) title.textContent = `${label}...`;
    return;
  }
  loadingSince = Date.now();
  Swal.fire({
    title: `${label}...`,
    text: 'กรุณารอสักครู่',
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    didOpen: () => Swal.showLoading(),
  });
}

/**
 * Called by the API layer around every request: shows the "working…" pop-up
 * for the changes listed in STEPS, and keeps it up while any request is still
 * running. Returns a function to call when the request is over (whatever the
 * outcome).
 */
export function trackRequest(method, path, body) {
  const label = stepLabel(method, path, body);
  active += 1;
  clearTimeout(closeTimer);
  if (label) showLoading(label);
  return () => {
    active -= 1;
    if (active > 0 || scopes > 0 || !isLoadingOpen()) return;
    // The action normally reports its result next (showResult); close only if it never does.
    closeTimer = setTimeout(() => { if (active === 0 && isLoadingOpen()) Swal.close(); }, IDLE_CLOSE_MS);
  };
}

// Turns the open "working…" pop-up into the result, in place: same window,
// same dimmed background, the spinner becomes the icon — nothing closes or
// reopens in between. SweetAlert cannot add its own timer to a pop-up that is
// already open, so the countdown (and its bar) is run here.
function morphIntoResult(title, text, warn, ms) {
  Swal.hideLoading();
  Swal.update({
    icon: warn ? 'warning' : 'success',
    title,
    text: text || '',
    showConfirmButton: warn,
    confirmButtonText: 'ตกลง',
    allowOutsideClick: true,
    allowEscapeKey: true,
  });
  const popup = Swal.getPopup();
  const bar = Swal.getTimerProgressBar();
  const run = () => {
    clearTimeout(resultTimer);
    resultTimer = setTimeout(() => { if (Swal.getPopup() === popup) Swal.close(); }, ms);
    if (!bar) return;
    bar.parentElement.style.display = 'flex';
    bar.style.transition = 'none';
    bar.style.width = '100%';
    // eslint-disable-next-line no-unused-expressions
    bar.offsetWidth; // apply the full width before starting to shrink it
    bar.style.transition = `width ${ms}ms linear`;
    bar.style.width = '0%';
  };
  // No pause on hover: the pointer is usually already here, on the button that
  // was just pressed, and would keep the result open for no reason.
  run();
}

/**
 * Runs an action made of several steps (e.g. save the event, then its
 * evaluation questions) under one "working…" pop-up: it stays up from the
 * first step to the last, naming each step, and only then turns into the
 * result. A problem reported by any step is what gets shown; otherwise the
 * last success is.
 */
export async function withProgress(action) {
  scopes += 1;
  try {
    return await action();
  } finally {
    scopes -= 1;
    if (scopes === 0) {
      const result = held;
      held = null;
      if (result) showResult(...result);
      else if (active === 0 && isLoadingOpen()) Swal.close();
    }
  }
}

/** Result of an action: type 'ok' (closes by itself) or 'warn' (has a button). */
export function showResult(title, text, type = 'ok') {
  if (scopes > 0) {
    if (!held || held[2] !== 'warn') held = [title, text, type];
    return;
  }
  clearTimeout(closeTimer);
  clearTimeout(resultTimer);
  const warn = type === 'warn';
  const ms = warn ? 6000 : 2200;
  const fire = () => {
    if (isLoadingOpen()) { morphIntoResult(title, text, warn, ms); return; }
    Swal.fire({
      icon: warn ? 'warning' : 'success',
      title,
      text: text || undefined,
      timer: ms,
      timerProgressBar: true,
      showConfirmButton: warn,
      confirmButtonText: 'ตกลง',
    });
  };
  const wait = isLoadingOpen() ? MIN_LOADING_MS - (Date.now() - loadingSince) : 0;
  if (wait > 0) setTimeout(fire, wait);
  else fire();
}
