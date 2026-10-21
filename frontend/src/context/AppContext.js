import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';
import { showResult } from '../utils/alert';
import { api, apiUrl, setAuthToken, setUnauthorizedHandler } from '../services/api';
import { formatThaiDate, formatThaiDateRange, formatThaiDateList, formatDayTime, formatRegPeriod, todayIso } from '../utils/dateFormat';
import { formatBaht } from '../utils/money';
import { normalizeLayout, serializeLayout } from '../features/certificates/utils/certLayout';
import { ROLE_LABEL, EVENT_CATEGORY_ICONS, isParticipant } from '../utils/constants';
import { fullNameTh } from '../utils/personName';

const AppContext = createContext(null);

/* ---------- backend <-> frontend event-shape adapters ----------
 * The Go/MySQL backend stores events in snake_case with category/subcategory,
 * separate day/attend-mode enums, etc. The page components (built against the
 * original localStorage mock) expect a flatter camelCase shape with a few
 * purely-cosmetic fields (icon/tone) that have no backend column at all —
 * those are derived deterministically here instead. */

const TONE_CYCLE = ['', 'alt', 'dark'];
function deriveTone(id) { return TONE_CYCLE[id % TONE_CYCLE.length]; }

function deriveIcon(cat) {
  const base = (cat || '').split('·')[0].trim();
  return EVENT_CATEGORY_ICONS[base] || 'ti-sparkles';
}

function guessMime(dataUrl) {
  const m = /^data:([^;]+);/.exec(dataUrl || '');
  return m ? m[1] : 'image/png';
}

// The event list links to its images ("/events/12/assets/poster?v=…") rather
// than carrying them; make those links usable as an image address.
function assetUrl(v) {
  if (!v) return null;
  return v.startsWith('/events/') ? apiUrl(v) : v;
}

// An image the form holds as it came from the server (a link, not a fresh
// upload) has not changed: leave it out so the stored one stays.
function putAsset(body, key, value) {
  if (value && !value.startsWith('data:')) return;
  body[key] = value || null;
}

// Derives the 5-stage cycle (ประกาศ/รับสมัคร/จัดกิจกรรม/เกียรติบัตร/ปิดกิจกรรม)
// from the event's actual date range and status, instead of trusting a stage an
// organizer may never have gone back to update by hand — so it advances into
// "จัดกิจกรรม" and "เกียรติบัตร" on its own as the real date arrives/passes.
// "ปิดกิจกรรม" only lands once the organizer has explicitly issued
// certificates (status 'done'); until then, an event past its end date just
// sits at "เกียรติบัตร" (over, certificate pending).
function deriveStage(status, dateStart, dateEnd) {
  if (status === 'done') return 4;
  if (status === 'soon') return 0;
  if (!dateStart) return 1;
  const today = todayIso();
  const end = dateEnd || dateStart;
  if (today < dateStart) return 1;
  if (today <= end) return 2;
  return 3;
}

// Display date for an event/registration row: the exact days when a multi-day
// event had them picked one by one, else the start–end range, else one day.
function displayDate(r, isMulti) {
  if (r.event_dates?.length > 1) return formatThaiDateList(r.event_dates);
  return isMulti && r.date_end ? formatThaiDateRange(r.date_start, r.date_end) : formatThaiDate(r.date_start);
}

function adaptEvent(be) {
  return {
    id: be.id,
    title: be.title,
    desc: be.description || '',
    cat: be.category,
    icon: deriveIcon(be.category),
    tone: deriveTone(be.id),
    date: displayDate(be, be.day_mode === 'multi'),
    dateStart: be.date_start || '',
    dateEnd: be.date_end || '',
    dates: be.event_dates || [],
    dayTimes: be.event_times || [], // "HH:MM-HH:MM" per entry of dates
    // Day-by-day schedule for multi-day events with per-day times; [] otherwise.
    schedule: (be.event_times || []).length > 0
      ? (be.event_dates || []).map((d, i) => ({ date: d, label: formatThaiDate(d), time: formatDayTime(be.event_times[i]) }))
      : [],
    regStart: be.reg_start || '',
    regEnd: be.reg_end || '',
    regPeriod: formatRegPeriod(be.reg_start, be.reg_end),
    time: be.time_range || '-',
    // What to show as the place. placeRaw is the room alone, as the organizer typed it.
    place: be.attend_mode === 'online' ? 'ออนไลน์' : be.attend_mode === 'hybrid' && be.place ? `${be.place} + ออนไลน์` : (be.place || '-'),
    placeRaw: be.attend_mode === 'online' ? '' : (be.place || ''),
    cap: be.capacity,
    reg: be.registered_count || 0,
    // Hybrid events count the two ways of attending apart.
    regOnline: be.registered_online || 0,
    regOnsite: (be.registered_count || 0) - (be.registered_online || 0),
    status: be.status,
    stage: deriveStage(be.status, be.date_start, be.date_end),
    org: be.organizer_name || '',
    coordinatorId: be.coordinator_id ?? null, // the teacher account coordinating it (reads its report)
    organizerId: be.organizer_id,
    listed: be.is_listed,
    poster: assetUrl(be.poster_url),
    certTemplate: be.cert_template_url ? { name: 'template', type: guessMime(be.cert_template_url), dataUrl: assetUrl(be.cert_template_url) } : null,
    signer: { name: be.cert_signer_name || '', title: be.cert_signer_title || '', signature: assetUrl(be.cert_signature_url) },
    certLayout: normalizeLayout(be.cert_layout), // how the text is fitted to this event's template
    certLayoutSet: !!be.cert_layout, // false = the main template's own placement
    pretest: { enabled: !!be.pretest_enabled, link: be.pretest_link || '' },
    dayMode: be.day_mode,
    attendMode: be.attend_mode,
    capOnsite: be.capacity_onsite ?? '',
    capOnline: be.capacity_online ?? '',
    // The join link is only sent to registered students, the organizer and admins;
    // hasOnlineLink tells everyone else that one exists (shown after registering).
    onlineLink: be.online_link || '',
    hasOnlineLink: !!be.has_online_link || !!be.online_link,
    // Organizer's message to people registering (e.g. "bring your own notebook").
    attendeeNote: be.attendee_note || '',
    // Notebooks the organizer can lend: how many in total, and how many are still unclaimed.
    loanQty: be.loan_laptop_qty || 0,
    loanTaken: be.loan_laptop_taken || 0,
    loanLeft: Math.max(0, (be.loan_laptop_qty || 0) - (be.loan_laptop_taken || 0)),
    fee: be.fee > 0 ? be.fee : 0, // registration fee in baht; 0 = free
    paymentInfo: be.payment_info || '', // how to pay (account / PromptPay, deadline)
    refundMethod: be.refund_method || 'none', // none | department | transfer — how paid money is given back
    refundNote: be.refund_note || '', // when / where, in the organizer's words
    payerCount: be.payer_count || 0, // money held (slip sent or confirmed) and not refunded yet
    askDietary: !!be.ask_dietary, // food is served: registrants are asked about allergies / dietary needs
    issueCert: be.issue_certificate !== false, // gives certificates; off = one signature box per day on the sign-in sheet
    budgetPlanned: be.budget_planned ?? null, // baht from department income (เงินรายได้); null = not set
    budgetOther: be.budget_other ?? null, // baht from other sources (แหล่งอื่น); null = not set
    budgetTotal: be.budget_total ?? null, // both sources added up; null when neither is set
    budgetActual: be.budget_actual ?? null, // baht actually spent; null = not recorded yet
    // Finished (last day reached, or closed) — the point from which the
    // actual spend may be recorded. Mirrors the rule the backend enforces.
    ended: be.status === 'done' || todayIso() >= (be.date_end || be.date_start || ''),
  };
}

function toEventBody(payload) {
  const body = {
    title: payload.title,
    description: payload.desc,
    category: payload.cat,
    organizer_name: payload.org,
    day_mode: payload.dayMode,
    attend_mode: payload.attendMode,
    time_range: payload.time,
    place: payload.place,
    online_link: payload.onlineLink || null,
    capacity: parseInt(payload.cap, 10) || 0,
    cert_signer_name: payload.signer?.name || null,
    cert_signer_title: payload.signer?.title || null,
    cert_layout: serializeLayout(payload.certLayout),
    pretest_enabled: !!payload.pretest?.enabled,
    pretest_link: payload.pretest?.link || null,
  };
  putAsset(body, 'poster_url', payload.poster);
  putAsset(body, 'cert_template_url', payload.certTemplate?.dataUrl);
  putAsset(body, 'cert_signature_url', payload.signer?.signature);
  if (payload.capOnsite !== undefined) body.capacity_onsite = parseInt(payload.capOnsite, 10) || 0;
  if (payload.capOnline !== undefined) body.capacity_online = parseInt(payload.capOnline, 10) || 0;
  if (payload.dateIso) body.date_start = payload.dateIso;
  if (payload.dateEndIso) body.date_end = payload.dateEndIso;
  else if (payload.dayMode === 'single') body.date_end = null;
  if (payload.eventDates !== undefined) body.event_dates = payload.eventDates;
  if (payload.eventTimes !== undefined) body.event_times = payload.eventTimes;
  if (payload.budgetPlanned !== undefined) body.budget_planned = payload.budgetPlanned;
  if (payload.attendeeNote !== undefined) body.attendee_note = payload.attendeeNote.trim() || null;
  if (payload.loanQty !== undefined) body.loan_laptop_qty = payload.loanQty || null;
  if (payload.askDietary !== undefined) body.ask_dietary = !!payload.askDietary;
  if (payload.issueCert !== undefined) body.issue_certificate = !!payload.issueCert;
  if (payload.fee !== undefined) {
    body.fee = payload.fee > 0 ? payload.fee : null;
    body.payment_info = payload.fee > 0 ? (payload.paymentInfo || '').trim() || null : null;
    if (payload.refundMethod !== undefined) {
      body.refund_method = payload.fee > 0 ? payload.refundMethod : 'none';
      body.refund_note = payload.fee > 0 ? (payload.refundNote || '').trim() || null : null;
    }
  }
  if (payload.budgetOther !== undefined) body.budget_other = payload.budgetOther;
  if (payload.regStartIso !== undefined) body.reg_start = payload.regStartIso || null;
  if (payload.regEndIso !== undefined) body.reg_end = payload.regEndIso || null;
  return body;
}

// `in` = checked in on every day of the event; `days` = the days checked so
// far; `eventDays` = all the days the event runs on (same on every row).
// `via` = attends 'onsite' or 'online'; `checkinKeys` = per day, the key of the
// self check-in link for online attendees (same on every row).
function adaptRosterRow(r, eventDays = [], checkinKeys = {}) {
  return { sid: r.student_id || '', isTeacher: r.role === 'teacher', name: fullNameTh(r), in: !!r.checked_in, days: r.checkin_dates || [], eventDays, via: r.attend_via || 'onsite', checkinKeys, regId: r.id, status: r.status, wantsLaptop: !!r.wants_laptop, foodAllergy: r.food_allergy || '', dietaryPref: r.dietary_pref || '', paymentStatus: r.payment_status || 'none',
    hasSlip: !!r.has_slip, slipTransferredAt: r.slip_transferred_at || '', slipAmount: r.slip_amount ?? null, rejectReason: r.payment_reject_reason || '',
    refundedAt: r.refunded_at || '', refundPromptPay: r.refund_promptpay || '',
  };
}

function adaptMyRegistration(r) {
  // Carries its own display fields (from the JOIN on the backend) rather than relying
  // on evById — a registration can point at an unlisted/archived event (old semester,
  // soft-deleted) that never appears in the current events list, so it must stay
  // visible in the student's own history/certificates regardless.
  return {
    eid: r.event_id, status: r.status, regId: r.id,
    title: r.title, cat: r.category,
    date: displayDate(r, r.date_end && r.date_end !== r.date_start),
    dateStart: (r.date_start || '').slice(0, 10),
    place: r.place || '-',
    org: r.organizer_name || '',
    wantsLaptop: !!r.wants_laptop,
    via: r.attend_via || 'onsite', // attends 'onsite' or 'online'
    hybrid: r.attend_mode === 'hybrid',
    foodAllergy: r.food_allergy || '',
    dietaryPref: r.dietary_pref || '',
    paymentStatus: r.payment_status || 'none', // none (free) | pending | submitted | rejected | paid | refunded
    refundedAt: r.refunded_at || '',
    refundPromptPay: r.refund_promptpay || '', // where a transfer refund goes
    refundMethod: r.refund_method || 'none',
    refundNote: r.refund_note || '',
    slipTransferredAt: r.slip_transferred_at || '',
    slipAmount: r.slip_amount ?? null,
    rejectReason: r.payment_reject_reason || '',
    daysAttended: (r.checkin_dates || []).length,
    daysTotal: r.days_total || 1,
    fee: r.fee > 0 ? r.fee : 0,
    paymentInfo: r.payment_info || '',
    attendeeNote: r.attendee_note || '',
    onlineLink: r.attend_mode !== 'onsite' ? (r.online_link || '') : '',
    icon: deriveIcon(r.category),
    tone: deriveTone(r.event_id),
    stage: deriveStage(r.event_status, r.date_start, r.date_end),
    regEnd: r.reg_end || '',
    // Still allowed to withdraw by themselves (the server's rule); null when the
    // server did not say (an older backend) — see CancelRegistrationButton.
    canCancel: r.can_cancel === undefined ? null : !!r.can_cancel,
    // The organizer deleted the event after this registration (it is kept as history).
    cancelled: !!r.event_cancelled,
    issueCert: r.issue_certificate !== false, // the event gives certificates
    evaluated: !!r.evaluated, // the evaluation was submitted
  };
}

// The usual signer when the admin has not set one (what the form used to start with).
const FALLBACK_SIGNER = { name: 'ผศ.ดร.สิรักข์ แก้วจำนงค์', title: 'หัวหน้าภาควิชาคอมพิวเตอร์' };

function adaptCertDefaults(d) {
  return {
    templateId: d?.template_id ?? null, // version of the main template; null = built-in
    template: d?.template_url ? { name: 'template', type: guessMime(d.template_url), dataUrl: d.template_url } : null, // null = built-in
    layout: normalizeLayout(d?.layout),
    layoutSet: !!d?.layout, // false on the built-in template = its own placement
    signer: { name: d?.signer_name || FALLBACK_SIGNER.name, title: d?.signer_title || FALLBACK_SIGNER.title, signature: d?.signature_url || null },
    updatedAt: d?.updated_at || '',
    updatedBy: d?.updated_by || '',
  };
}

// A failed sign-in call as the sign-in page uses it: the server's reason, and
// `verify` when the address still needs its emailed code first.
// What the page keeps about the signed-in person (plus the token).
function sessionFields(user) {
  return {
    id: user.id, role: user.role, email: user.email, student_id: user.student_id, dept: user.dept,
    name: user.name, title_th: user.title_th || '', name_en: user.name_en || '', title_en: user.title_en || '',
  };
}

function authResult(err) {
  return {
    error: err.message || 'เกิดข้อผิดพลาด',
    verify: !!err.data?.verification_required,
    email: err.data?.email || '',
    retryAfter: err.data?.retry_after || 0,
  };
}

function timeAgo(iso) {
  const then = new Date((iso || '').replace(' ', 'T'));
  const diffMin = Math.round((Date.now() - then.getTime()) / 60000);
  if (!isFinite(diffMin) || diffMin < 1) return 'เมื่อสักครู่';
  if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} ชั่วโมงที่แล้ว`;
  return `${Math.round(diffHr / 24)} วันที่แล้ว`;
}

function adaptNotif(n) {
  return { id: n.id, icon: n.icon || 'ti-bell', tone: n.tone || 'accent', title: n.title, msg: n.message || '', unread: !n.is_read, time: timeAgo(n.created_at), link: n.link || '', items: Array.isArray(n.items) ? n.items : [] };
}

// How often the bell re-checks the server while the tab is visible.
const NOTIF_POLL_MS = 15000;
// A new notification pops up on screen for this long (the Toast pauses it
// while the pointer is over it), and at most this many pop up at once.
const NOTIF_TOAST_MS = 5000;
const NOTIF_TOAST_MAX = 3;

export function AppProvider({ children }) {
  // Bumped to :v3 — session now carries a real JWT + numeric id instead of the mock's {role,name,email}.
  const [session, setSession] = useLocalStorage('cpsu-etms:session:v3', null);
  setAuthToken(session?.token || null);

  const [events, setEvents] = useState([]);
  const [regs, setRegs] = useState([]); // student's own registrations: {eid, status, regId}
  const [rosters, setRosters] = useState({}); // eventId -> [{sid, name, in, regId, status}]
  const [users, setUsers] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [blacklist, setBlacklist] = useState([]);
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);
  const questionsRef = useRef(null);

  // The result of an action ('ok' / 'warn') is a SweetAlert pop-up in the
  // middle of the screen. A new bell notification ('notif') is a card under
  // the bell instead: it stays for `duration` ms, and the Toast component runs
  // the countdown (so it can pause on hover) and calls dismissToast at the end.
  // Right after a forced sign-out, the other requests that failed with it
  // would each pop up their own "couldn't load …": only the sign-out message shows.
  const quietUntil = useRef(0);
  const pushToast = useCallback((title, msg, type = 'ok', extra = {}) => {
    if (type === 'warn' && Date.now() < quietUntil.current) return;
    if (type !== 'notif') { showResult(title, msg, type); return; }
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, title, msg, type, duration: 5000, ...extra }]);
  }, []);
  const dismissToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  // Notification ids already seen in this session; null until the first load,
  // so what was waiting at sign-in does not all pop up at once.
  const seenNotifs = useRef(null);

  // Notifications are created server-side by the action that causes them (so
  // the right person gets them, on any device) — the client only reads them.
  // { silent: true } after the user's own action: the bell gets its line, but
  // it doesn't pop up on top of the action's own message.
  const refreshNotifications = useCallback(async (opts) => {
    try {
      const { notifications } = await api.get('/me/notifications');
      const list = notifications.map(adaptNotif);
      setNotifs(list);
      // Anything unread that was not there on the previous check is new: pop it up.
      if (seenNotifs.current && !opts?.silent) {
        const fresh = list.filter((n) => n.unread && !seenNotifs.current.has(n.id));
        fresh.slice(0, NOTIF_TOAST_MAX).forEach((n) => pushToast(n.title, n.msg, 'notif', { duration: NOTIF_TOAST_MS, icon: n.icon, tone: n.tone, link: n.link, notifId: n.id }));
        if (fresh.length > NOTIF_TOAST_MAX) pushToast(`และการแจ้งเตือนใหม่อีก ${fresh.length - NOTIF_TOAST_MAX} รายการ`, 'กดที่กระดิ่งเพื่อดูทั้งหมด', 'notif', { duration: NOTIF_TOAST_MS, icon: 'ti-bell' });
      }
      seenNotifs.current = new Set(list.map((n) => n.id));
    } catch {
      // notifications are ambient/non-critical — fail silently
    }
  }, [pushToast]);

  const markAllRead = useCallback(async () => {
    setNotifs((n) => n.map((x) => ({ ...x, unread: false })));
    try {
      await api.post('/me/notifications/read-all');
    } catch {
      refreshNotifications();
    }
  }, [refreshNotifications]);

  const markNotifRead = useCallback(async (id) => {
    setNotifs((n) => n.map((x) => (x.id === id ? { ...x, unread: false } : x)));
    try {
      await api.post(`/notifications/${id}/read`);
    } catch {
      refreshNotifications();
    }
  }, [refreshNotifications]);

  const clearAllNotif = useCallback(async () => {
    setNotifs([]);
    try {
      await api.del('/me/notifications');
    } catch (err) {
      pushToast('ล้างการแจ้งเตือนไม่สำเร็จ', err.message, 'warn');
      refreshNotifications();
    }
  }, [pushToast, refreshNotifications]);

  /* ---------- refresh helpers ---------- */
  const refreshEvents = useCallback(async (opts) => {
    try {
      const { events: list } = await api.get('/events');
      const adapted = list.map(adaptEvent);
      setEvents(adapted);
      const role = opts?.role ?? session?.role;
      // Only fetch rosters for events this account can actually see the roster of —
      // admins can see every event, but an organizer only owns a subset, and the
      // roster endpoint 403s (correctly) for events they don't organize.
      // A teacher reads the rosters of the events they coordinate.
      const rosterTargets = role === 'admin' ? adapted
        : role === 'organizer' ? adapted.filter((e) => e.organizerId === session?.id)
        : role === 'teacher' ? adapted.filter((e) => e.coordinatorId === session?.id) : [];
      if (rosterTargets.length > 0) {
        const entries = await Promise.all(rosterTargets.map(async (e) => {
          try {
            const { registrations, days, checkin_keys: keys } = await api.get(`/events/${e.id}/registrations`);
            return [e.id, registrations.map((r) => adaptRosterRow(r, days || [], keys || {}))];
          } catch {
            return [e.id, []];
          }
        }));
        setRosters(Object.fromEntries(entries));
      }
      return adapted;
    } catch (err) {
      pushToast('โหลดข้อมูลกิจกรรมไม่สำเร็จ', err.message, 'warn');
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.role, pushToast]);

  const refreshMyRegistrations = useCallback(async () => {
    try {
      const { registrations } = await api.get('/me/registrations');
      setRegs(registrations.map(adaptMyRegistration));
    } catch (err) {
      pushToast('โหลดประวัติการลงทะเบียนไม่สำเร็จ', err.message, 'warn');
    }
  }, [pushToast]);

  const refreshMyCertificates = useCallback(async () => {
    try {
      const { certificates } = await api.get('/me/certificates');
      return certificates;
    } catch {
      return [];
    }
  }, []);

  const [myCertificates, setMyCertificates] = useState([]);
  // Department-wide certificate defaults set by an admin (main template and its
  // text layout, the usual signer); null until loaded. See GET /settings/certificate.
  const [certDefaults, setCertDefaults] = useState(null);
  // Earlier versions of the main template that issued certificates were drawn
  // on, by version id: {url, layout}. Filled as the student's certificates load.
  const [certTemplateCache, setCertTemplateCache] = useState({});
  const loadMyCertificates = useCallback(async () => {
    const list = await refreshMyCertificates();
    setMyCertificates(list);
    // Each certificate keeps the main template it was issued on: fetch those versions once.
    const ids = [...new Set(list.map((c) => c.default_template_id).filter((id) => id != null))];
    const fetched = await Promise.all(ids.map(async (id) => {
      try {
        const t = await api.get(`/settings/certificate/templates/${id}`);
        return [id, { url: t.template_url, layout: normalizeLayout(t.layout) }];
      } catch {
        return null;
      }
    }));
    setCertTemplateCache((c) => ({ ...c, ...Object.fromEntries(fetched.filter(Boolean)) }));
  }, [refreshMyCertificates]);

  const refreshUsers = useCallback(async () => {
    try {
      const { users: list } = await api.get('/users');
      setUsers(list);
    } catch (err) {
      pushToast('โหลดรายชื่อผู้ใช้งานไม่สำเร็จ', err.message, 'warn');
    }
  }, [pushToast]);

  const refreshBlacklist = useCallback(async () => {
    try {
      const { blacklist: list } = await api.get('/blacklist');
      setBlacklist(list);
    } catch (err) {
      pushToast('โหลดรายชื่อ Blacklist ไม่สำเร็จ', err.message, 'warn');
    }
  }, [pushToast]);

  const refreshActivityLog = useCallback(async () => {
    try {
      const { logs } = await api.get('/activity-logs');
      setActivityLog(logs.map((l) => ({
        ts: l.created_at, user: l.user_name || 'SYSTEM', action: l.action, detail: l.detail || '', actionColor: 'var(--c2-08)',
      })));
    } catch {
      // admin/organizer-only, non-critical for the rest of the app
    }
  }, []);

  useEffect(() => {
    seenNotifs.current = null; // a different person signed in (or out): start over
    if (!session) {
      setEvents([]); setRegs([]); setRosters({}); setUsers([]); setNotifs([]); setBlacklist([]); setActivityLog([]); setMyCertificates([]); setCertDefaults(null);
      return;
    }
    refreshEvents({ role: session.role });
    loadCertDefaults();
    // What was remembered at sign-in may be out of date (name, title, role).
    api.get('/auth/me').then(({ user }) => setSession((cur) => (cur && cur.id === user.id ? { ...cur, ...sessionFields(user) } : cur))).catch(() => {});
    refreshNotifications();
    if (isParticipant(session.role)) {
      refreshMyRegistrations();
      loadMyCertificates();
    }
    if (session.role === 'organizer' || session.role === 'admin') {
      refreshBlacklist();
    }
    if (session.role === 'admin') {
      refreshUsers();
      refreshActivityLog();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  // Keep the bell live: poll while the tab is visible, and catch up right away
  // when the user comes back to it.
  useEffect(() => {
    if (!session?.id) return undefined;
    const tick = () => { if (document.visibilityState === 'visible') refreshNotifications(); };
    const timer = setInterval(tick, NOTIF_POLL_MS);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('focus', tick);
    };
  }, [session?.id, refreshNotifications]);

  /* ---------- auth ---------- */
  const applySession = useCallback((user, token) => {
    setAuthToken(token);
    setSession({ ...sessionFields(user), token });
    pushToast('เข้าสู่ระบบสำเร็จ', `ยินดีต้อนรับ · ${ROLE_LABEL[user.role]}`);
  }, [pushToast, setSession]);

  // The sign-in page's calls each resolve { ok } or authResult(error).
  const login = useCallback(async (email, password) => {
    try {
      const { user, token } = await api.post('/auth/login', { email, password }, { auth: false });
      applySession(user, token);
      return { ok: true };
    } catch (err) {
      return authResult(err);
    }
  }, [applySession]);

  // Confirms the address with its 6-digit code and signs in.
  const verifyEmail = useCallback(async (email, code) => {
    try {
      const { user, token } = await api.post('/auth/verify-email', { email, code }, { auth: false });
      applySession(user, token);
      return { ok: true };
    } catch (err) {
      return authResult(err);
    }
  }, [applySession]);

  // purpose: 'verify' | 'reset'
  const resendCode = useCallback(async (email, purpose) => {
    try {
      const r = await api.post('/auth/resend-code', { email, purpose }, { auth: false });
      return { ok: true, retryAfter: r.retry_after || 60 };
    } catch (err) {
      return authResult(err);
    }
  }, []);

  const forgotPassword = useCallback(async (email) => {
    try {
      const r = await api.post('/auth/forgot-password', { email }, { auth: false });
      return { ok: true, retryAfter: r.retry_after || 60 };
    } catch (err) {
      return authResult(err);
    }
  }, []);

  // Sets a new password with the emailed code and signs in.
  const resetPassword = useCallback(async (email, code, password) => {
    try {
      const { user, token } = await api.post('/auth/reset-password', { email, code, password }, { auth: false });
      applySession(user, token);
      return { ok: true };
    } catch (err) {
      return authResult(err);
    }
  }, [applySession]);

  // Sign-up with email and password (always a student account) — the way in
  // that works without Google Sign-In. The account opens once the code mailed
  // to the address is entered (verifyEmail).
  const registerAccount = useCallback(async ({ name, titleTh, nameEn, titleEn, email, password, studentId }) => {
    try {
      const r = await api.post('/auth/register', { name, title_th: titleTh, name_en: nameEn, title_en: titleEn, email, password, student_id: studentId }, { auth: false });
      return { ok: true, email: r.email, retryAfter: r.retry_after || 60 };
    } catch (err) {
      return authResult(err);
    }
  }, []);

  const loginWithGoogle = useCallback(async (credential) => {
    try {
      const { user, token } = await api.post('/auth/google', { credential }, { auth: false });
      applySession(user, token);
      return true;
    } catch (err) {
      pushToast('เข้าสู่ระบบด้วย Google ไม่สำเร็จ', err.message || '', 'warn');
      return false;
    }
  }, [pushToast, applySession]);

  const updateProfile = useCallback(async (payload) => {
    try {
      const { user } = await api.put('/auth/me', payload);
      setSession((s) => (s ? { ...s, ...sessionFields(user) } : s));
      pushToast('บันทึกโปรไฟล์แล้ว', fullNameTh(user));
      return true;
    } catch (err) {
      pushToast('บันทึกโปรไฟล์ไม่สำเร็จ', err.message || '', 'warn');
      return false;
    }
  }, [pushToast, setSession]);

  const logout = useCallback(() => {
    setAuthToken(null);
    setSession(null);
  }, [setSession]);

  // A signed-in request refused with 401: sign out (the pages then send the
  // person to /login) and say why, once — several requests may fail together.
  const signedIn = useRef(false);
  signedIn.current = !!session;
  useEffect(() => {
    setUnauthorizedHandler((message) => {
      if (!signedIn.current) return;
      signedIn.current = false;
      setAuthToken(null);
      setSession(null);
      pushToast('กรุณาเข้าสู่ระบบอีกครั้ง', message || 'เซสชันหมดอายุ', 'warn');
      quietUntil.current = Date.now() + 5000;
    });
    return () => setUnauthorizedHandler(null);
  }, [setSession, pushToast]);

  /* ---------- events / registration ---------- */
  const evById = useCallback((id) => events.find((e) => e.id === Number(id)), [events]);
  const myStatus = useCallback((eid) => {
    const r = regs.find((x) => x.eid === Number(eid));
    return r ? r.status : null;
  }, [regs]);

  // opts.borrowLaptop: ask for one of the event's loan notebooks.
  // opts.foodAllergy / opts.dietaryPref: answers to the food questions (events that ask).
  const registerForEvent = useCallback(async (id, opts) => {
    const ev = evById(id);
    if (!ev || myStatus(id)) return;
    try {
      await api.post(`/events/${id}/register`, {
        borrow_laptop: !!opts?.borrowLaptop,
        food_allergy: opts?.foodAllergy || '',
        dietary_pref: opts?.dietaryPref || '',
        attend_via: opts?.attendVia || '',
      });
      await Promise.all([refreshEvents(), refreshMyRegistrations(), refreshNotifications({ silent: true })]);
      pushToast('ลงทะเบียนสำเร็จ', ev.title.slice(0, 32) + '…');
    } catch (err) {
      pushToast('ลงทะเบียนไม่สำเร็จ', err.message, 'warn');
      refreshEvents(); // e.g. the last loan notebook was just taken — show the real count
    }
  }, [evById, myStatus, refreshEvents, refreshMyRegistrations, refreshNotifications, pushToast]);

  // An online attendee checking themselves in from the day's link. Resolves
  // { ok, title, date, dayNo, daysTotal, attended } or { ok: false, error, title }.
  const selfCheckin = useCallback(async (eventId, date, key) => {
    try {
      const res = await api.post(`/events/${eventId}/self-checkin`, { date, key });
      refreshMyRegistrations();
      refreshNotifications();
      return { ok: true, title: res.title, date: res.date, dayNo: res.day_no, daysTotal: res.days_total, attended: (res.checkin_dates || []).length };
    } catch (err) {
      return { ok: false, error: err.message, title: err.data?.title || '' };
    }
  }, [refreshMyRegistrations, refreshNotifications]);

  const toggleEventStatus = useCallback(async (id) => {
    const ev = evById(id);
    if (!ev) return;
    const nextOpen = ev.status !== 'open';
    try {
      await api.put(`/events/${id}`, { status: nextOpen ? 'open' : 'closed' });
      await refreshEvents();
      pushToast(nextOpen ? 'เปิดรับสมัครแล้ว' : 'ปิดรับสมัครแล้ว', ev.title.slice(0, 30));
    } catch (err) {
      pushToast('ดำเนินการไม่สำเร็จ', err.message, 'warn');
    }
  }, [evById, refreshEvents, pushToast]);

  const createEvent = useCallback(async (payload) => {
    try {
      const body = toEventBody(payload);
      body.status = 'open';
      body.cycle_stage = 1;
      const { event } = await api.post('/events', body);
      await refreshEvents();
      pushToast('เผยแพร่กิจกรรมสำเร็จ', (payload.title || '').slice(0, 30));
      return adaptEvent(event);
    } catch (err) {
      pushToast('เผยแพร่กิจกรรมไม่สำเร็จ', err.message, 'warn');
      throw err;
    }
  }, [refreshEvents, pushToast]);

  const updateEvent = useCallback(async (id, payload) => {
    try {
      const body = toEventBody(payload);
      await api.put(`/events/${id}`, body);
      await refreshEvents();
      pushToast('บันทึกการแก้ไขแล้ว', payload.title ? payload.title.slice(0, 30) : '');
    } catch (err) {
      pushToast('บันทึกการแก้ไขไม่สำเร็จ', err.message, 'warn');
      throw err;
    }
  }, [refreshEvents, pushToast]);

  // `refund` ({ method, note }) is how people who already paid get their money
  // back; required by the server when anyone has paid. Resolves true on success.
  const deleteEvent = useCallback(async (id, refund) => {
    const ev = evById(id);
    try {
      await api.del(`/events/${id}`, refund ? { body: { refund_method: refund.method, refund_note: refund.note || '' } } : undefined);
      await refreshEvents();
      pushToast('ลบกิจกรรมแล้ว', ev ? ev.title.slice(0, 30) : '', 'warn');
      return true;
    } catch (err) {
      pushToast('ลบกิจกรรมไม่สำเร็จ', err.message, 'warn');
      return false;
    }
  }, [evById, refreshEvents, pushToast]);

  /* ---------- applicants / check-in ---------- */
  // Checks a registrant in (or takes it back) for one day of the event.
  // `date` may be left out for a one-day event.
  const toggleCheckin = useCallback(async (eventId, index, date) => {
    const list = rosters[eventId] || [];
    const item = list[index];
    if (!item) return;
    const day = date || item.eventDays[0];
    const next = !item.days.includes(day);
    const patch = (days) => setRosters((rs) => ({
      ...rs,
      [eventId]: (rs[eventId] || []).map((p) => (p.regId === item.regId ? { ...p, days, in: days.length >= p.eventDays.length } : p)),
    }));
    patch(next ? [...item.days, day] : item.days.filter((d) => d !== day));
    try {
      const res = await api.patch(`/registrations/${item.regId}/checkin`, { checked_in: next, date: day });
      patch(res.checkin_dates || []);
    } catch (err) {
      patch(item.days);
      pushToast('อัปเดตเช็คอินไม่สำเร็จ', err.message, 'warn');
    }
  }, [rosters, pushToast]);

  // Organizer's verdict on a registrant's payment: 'confirm', 'reject' (with a
  // reason the payer will see), 'reset', or 'refund' / 'unrefund' once the
  // money is given back. Resolves true on success.
  const setPaymentStatus = useCallback(async (eventId, regId, action, reason) => {
    try {
      const { payment_status: status } = await api.patch(`/registrations/${regId}/payment`, { action, reason: reason || '' });
      setRosters((rs) => ({
        ...rs,
        [eventId]: (rs[eventId] || []).map((p) => (p.regId === regId ? { ...p, paymentStatus: status, rejectReason: status === 'rejected' ? reason : '', refundedAt: status === 'refunded' ? new Date().toISOString() : '' } : p)),
      }));
      return true;
    } catch (err) {
      pushToast('อัปเดตการชำระเงินไม่สำเร็จ', err.message, 'warn');
      return false;
    }
  }, [pushToast]);

  // One registrant's slip with what they declared (payer, the organizer, admins).
  const getSlip = useCallback(async (regId) => {
    try {
      return await api.get(`/registrations/${regId}/slip`);
    } catch {
      return null;
    }
  }, []);

  // The payer sends proof of payment for their own registration. Resolves true on success.
  // The student withdraws from an event. Resolves true on success.
  const cancelRegistration = useCallback(async (regId, title) => {
    try {
      await api.del(`/registrations/${regId}`);
      await Promise.all([refreshMyRegistrations(), refreshEvents(), refreshNotifications()]);
      pushToast('ยกเลิกการสมัครแล้ว', title ? title.slice(0, 40) : '');
      return true;
    } catch (err) {
      pushToast('ยกเลิกการสมัครไม่สำเร็จ', err.message, 'warn');
      return false;
    }
  }, [refreshMyRegistrations, refreshEvents, refreshNotifications, pushToast]);

  const submitSlip = useCallback(async (regId, { slip, transferredAt, amount, refundPromptPay }) => {
    try {
      await api.post(`/registrations/${regId}/slip`, { slip, transferred_at: transferredAt, amount, refund_promptpay: refundPromptPay || '' });
      await refreshMyRegistrations();
      pushToast('ส่งหลักฐานการชำระเงินแล้ว', 'รอผู้จัดกิจกรรมตรวจสอบ');
      return true;
    } catch (err) {
      pushToast('ส่งหลักฐานไม่สำเร็จ', err.message, 'warn');
      return false;
    }
  }, [refreshMyRegistrations, pushToast]);

  // The payer gives (or corrects) the PromptPay a transfer refund goes to. Resolves true on success.
  const setRefundAccount = useCallback(async (regId, promptPay) => {
    try {
      await api.patch(`/registrations/${regId}/refund-account`, { refund_promptpay: promptPay });
      await refreshMyRegistrations();
      pushToast('บันทึกพร้อมเพย์สำหรับรับเงินคืนแล้ว', '');
      return true;
    } catch (err) {
      pushToast('บันทึกไม่สำเร็จ', err.message, 'warn');
      return false;
    }
  }, [refreshMyRegistrations, pushToast]);

  // Advances the event to the certificate stage; individual certificates are then
  // issued automatically per-student when they submit their evaluation (see
  // submitEvaluation) — matches the roster hint text: check people in first.
  const issueCertificate = useCallback(async (id) => {
    try {
      // Safe to repeat: the server notifies each attendee only once, so doing
      // it again reaches only the people checked in since the last time.
      const already = evById(id)?.stage === 4;
      const noCert = evById(id)?.issueCert === false;
      const res = await api.put(`/events/${id}`, { cycle_stage: 4, status: 'done' });
      const notified = res.cert_notified || 0;
      await refreshEvents();
      if (!already) pushToast(noCert ? 'ปิดกิจกรรมแล้ว' : 'เปิดให้รับเกียรติบัตรแล้ว', noCert ? `แจ้งเตือนผู้เข้าร่วม ${notified} คน ให้ทำแบบประเมิน` : `แจ้งเตือนผู้เข้าร่วม ${notified} คน · ต้องทำแบบประเมินก่อนดาวน์โหลด`);
      else if (notified > 0) pushToast('แจ้งเตือนผู้ที่เช็คอินเพิ่มแล้ว', `${notified} คน · ผู้ที่เคยได้รับแจ้งเตือนแล้วไม่ได้รับซ้ำ`);
      else pushToast('ออกเกียรติบัตรไปแล้ว', 'ไม่มีผู้เช็คอินเพิ่ม จึงไม่ได้ส่งแจ้งเตือนซ้ำ');
    } catch (err) {
      pushToast('ดำเนินการไม่สำเร็จ', err.message, 'warn');
    }
  }, [evById, refreshEvents, pushToast]);

  async function getEvalQuestions() {
    if (questionsRef.current) return questionsRef.current;
    const { questions } = await api.get('/evaluations/questions', { auth: false });
    questionsRef.current = questions;
    return questions;
  }

  // Extra, event-specific questions an organizer added on top of the fixed
  // standard survey (empty array if the organizer never set any up).
  const getEventEvalQuestions = useCallback(async (eventId) => {
    try {
      const { questions } = await api.get(`/events/${eventId}/evaluation-questions`);
      return questions;
    } catch {
      return [];
    }
  }, []);

  // The edit form's view: the questions plus whether they may still change
  // (not once certificates are out or anyone has answered).
  const getEventEvalSetup = useCallback(async (eventId) => {
    try {
      const { questions, locked } = await api.get(`/events/${eventId}/evaluation-questions`);
      return { questions, locked: !!locked };
    } catch {
      return { questions: [], locked: false };
    }
  }, []);

  // Replaces the full set of extra questions for an event — used from the
  // create/edit event form, whether set up at creation or added later.
  const saveEventEvalQuestions = useCallback(async (eventId, questions) => {
    const { questions: saved } = await api.put(`/events/${eventId}/evaluation-questions`, { questions });
    return saved;
  }, []);

  // scores: {[q_key]: 1-5} for the standard questions.
  // customValues: {[question_id]: 1-5 (scale question) | string (choice question)}
  // for the event's own extra questions (if any).
  // Submitting also auto-issues the certificate server-side once the
  // registration is 'attended' — matches the form's own promise to the user.
  const submitEvaluation = useCallback(async (id, scores, customValues) => {
    const reg = regs.find((r) => r.eid === Number(id));
    if (!reg) { pushToast('ไม่พบการลงทะเบียนของคุณ', '', 'warn'); return; }
    try {
      const questions = await getEvalQuestions();
      const answers = questions.map((q) => ({ question_id: q.id, score: scores?.[q.q_key] })).filter((a) => a.score);
      const customAnswers = Object.entries(customValues || {})
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([questionId, v]) => (
          typeof v === 'string'
            ? { question_id: Number(questionId), answer_text: v }
            : { question_id: Number(questionId), score: v }
        ));
      await api.post(`/registrations/${reg.regId}/evaluation`, { answers, custom_answers: customAnswers });
      await Promise.all([refreshMyRegistrations(), refreshNotifications()]);
      pushToast('ส่งแบบประเมินสำเร็จ', evById(id)?.issueCert === false ? 'ขอบคุณที่ร่วมทำแบบประเมิน' : 'เกียรติบัตรของคุณพร้อมดาวน์โหลดแล้ว');
    } catch (err) {
      pushToast('ส่งแบบประเมินไม่สำเร็จ', err.message, 'warn');
      throw err;
    }
  }, [regs, evById, refreshMyRegistrations, refreshNotifications, pushToast]);

  const downloadCert = useCallback((id) => {
    const ev = evById(id);
    pushToast('กำลังดาวน์โหลดเกียรติบัตร', 'ไฟล์ PDF · ' + (ev ? ev.title.slice(0, 28) : ''));
  }, [evById, pushToast]);

  /* ---------- blacklist (admin UC-15/16) ---------- */
  const addToBlacklist = useCallback(async (payload) => {
    try {
      await api.post('/blacklist', { name: payload.name, email: payload.email, student_id: payload.sid, reason: payload.reason });
      await refreshBlacklist();
      pushToast('เพิ่มรายชื่อ Blacklist แล้ว', payload.name, 'warn');
    } catch (err) {
      pushToast('เพิ่มรายชื่อไม่สำเร็จ', err.message, 'warn');
    }
  }, [refreshBlacklist, pushToast]);

  const restoreFromBlacklist = useCallback(async (id) => {
    const u = blacklist.find((x) => x.id === id);
    try {
      await api.post(`/blacklist/${id}/restore`);
      await refreshBlacklist();
      if (u) pushToast('คืนสิทธิ์ผู้ใช้งานแล้ว', u.name);
    } catch (err) {
      pushToast('ดำเนินการไม่สำเร็จ', err.message, 'warn');
    }
  }, [blacklist, refreshBlacklist, pushToast]);

  /* ---------- SAR / evaluation-results (fetched on-demand per event) ---------- */
  const getSar = useCallback(async (eventId) => {
    try {
      const { sar } = await api.get(`/events/${eventId}/sar`);
      return sar;
    } catch {
      return null;
    }
  }, []);

  const saveSar = useCallback(async (eventId, body) => {
    const { sar } = await api.put(`/events/${eventId}/sar`, body);
    return sar;
  }, []);

  const getEvaluationResults = useCallback(async (eventId) => {
    try {
      const { results } = await api.get(`/events/${eventId}/evaluations`);
      return results;
    } catch {
      return [];
    }
  }, []);

  const getDashboardYearly = useCallback(async () => {
    try {
      const { yearly } = await api.get('/dashboard/yearly');
      return yearly;
    } catch {
      return [];
    }
  }, []);

  // One row per listed event with its planned/actual budget — the yearly
  // dashboard rolls these up itself so it can also show the per-event detail.
  const getDashboardBudget = useCallback(async () => {
    try {
      const { budget } = await api.get('/dashboard/budget');
      return budget;
    } catch {
      return [];
    }
  }, []);

  // Records what an event actually cost (null clears it). Returns true on success.
  const saveBudgetActual = useCallback(async (eventId, amount) => {
    try {
      await api.put(`/events/${eventId}`, { budget_actual: amount });
      await refreshEvents();
      pushToast(amount === null ? 'ล้างงบประมาณที่ใช้จริงแล้ว' : 'บันทึกงบประมาณที่ใช้จริงแล้ว', amount === null ? '' : formatBaht(amount));
      return true;
    } catch (err) {
      pushToast('บันทึกงบประมาณที่ใช้จริงไม่สำเร็จ', err.message, 'warn');
      return false;
    }
  }, [refreshEvents, pushToast]);

  const loadCertDefaults = useCallback(async () => {
    try {
      const { defaults: d } = await api.get('/settings/certificate');
      setCertDefaults(adaptCertDefaults(d));
    } catch {
      setCertDefaults(adaptCertDefaults(null)); // fall back to the built-in template
    }
  }, []);

  // Admin only. `payload` = { template: {dataUrl}|null, layout, signerName, signerTitle, signature }.
  const saveCertDefaults = useCallback(async (payload) => {
    try {
      const { defaults: d } = await api.put('/settings/certificate', {
        template_url: payload.template?.dataUrl || '',
        layout: serializeLayout(payload.layout) || '',
        signer_name: payload.signerName,
        signer_title: payload.signerTitle,
        signature_url: payload.signature || '',
      });
      setCertDefaults(adaptCertDefaults(d));
      pushToast('บันทึกค่าเริ่มต้นเกียรติบัตรแล้ว', 'ใช้กับกิจกรรมที่ไม่ได้อัปโหลด template ของตัวเอง');
      return true;
    } catch (err) {
      pushToast('บันทึกไม่สำเร็จ', err.message, 'warn');
      return false;
    }
  }, [pushToast]);

  const getDashboardSummary = useCallback(async () => {
    try {
      const { summary } = await api.get('/dashboard/summary');
      return summary;
    } catch {
      return null;
    }
  }, []);

  /* ---------- users (admin UC-17/18) ---------- */
  const upsertUser = useCallback(async (payload, id) => {
    try {
      if (id) {
        const names = { title_th: payload.title_th || '', name_en: payload.name_en || '', title_en: payload.title_en || '' };
        const { user } = await api.put(`/users/${id}`, { name: payload.name, email: payload.email, role: payload.role, dept: payload.dept, ...names });
        setUsers((us) => us.map((u) => (u.id === id ? user : u)));
        pushToast('บันทึกการแก้ไขแล้ว', payload.name);
      } else {
        await api.post('/users', { name: payload.name, email: payload.email, role: payload.role, dept: payload.dept, title_th: payload.title_th || '', name_en: payload.name_en || '', title_en: payload.title_en || '' });
        await refreshUsers();
        pushToast('เพิ่มผู้ใช้งานสำเร็จ', payload.name);
      }
    } catch (err) {
      pushToast('บันทึกไม่สำเร็จ', err.message, 'warn');
    }
  }, [refreshUsers, pushToast]);

  const toggleUserActive = useCallback(async (id) => {
    const u = users.find((x) => x.id === id);
    if (!u) return;
    try {
      await api.patch(`/users/${id}/active`, { active: !u.active });
      setUsers((us) => us.map((x) => (x.id === id ? { ...x, active: !x.active } : x)));
    } catch (err) {
      pushToast('ดำเนินการไม่สำเร็จ', err.message, 'warn');
    }
  }, [users, pushToast]);

  const deleteUser = useCallback(async (id) => {
    const u = users.find((x) => x.id === id);
    try {
      await api.del(`/users/${id}`);
      setUsers((us) => us.filter((x) => x.id !== id));
      if (u) pushToast('ลบผู้ใช้งานแล้ว', u.name, 'warn');
    } catch (err) {
      pushToast('ลบไม่สำเร็จ', err.message, 'warn');
    }
  }, [users, pushToast]);

  const value = useMemo(() => ({
    session, events, regs, rosters, users, notifs, toasts, activityLog, blacklist, myCertificates,
    evById, myStatus,
    login, logout, loginWithGoogle, registerAccount, verifyEmail, resendCode, forgotPassword, resetPassword, updateProfile,
    registerForEvent, toggleEventStatus, createEvent, updateEvent, deleteEvent,
    toggleCheckin, setPaymentStatus, getSlip, submitSlip, setRefundAccount, cancelRegistration, selfCheckin, issueCertificate, submitEvaluation, downloadCert,
    addToBlacklist, restoreFromBlacklist,
    getSar, saveSar, getEvaluationResults, getEventEvalQuestions, getEventEvalSetup, saveEventEvalQuestions, getDashboardYearly, getDashboardSummary, certDefaults, saveCertDefaults, certTemplateCache,
    getDashboardBudget, saveBudgetActual,
    upsertUser, toggleUserActive, deleteUser,
    refreshNotifications, markAllRead, markNotifRead, clearAllNotif,
    pushToast, dismissToast,
  }), [
    session, events, regs, rosters, users, notifs, toasts, activityLog, blacklist, myCertificates,
    evById, myStatus, login, logout, loginWithGoogle, registerAccount, verifyEmail, resendCode, forgotPassword, resetPassword, updateProfile,
    registerForEvent, toggleEventStatus, createEvent, updateEvent, deleteEvent,
    toggleCheckin, setPaymentStatus, getSlip, submitSlip, setRefundAccount, cancelRegistration, selfCheckin, issueCertificate, submitEvaluation, downloadCert,
    addToBlacklist, restoreFromBlacklist,
    getSar, saveSar, getEvaluationResults, getEventEvalQuestions, getEventEvalSetup, saveEventEvalQuestions, getDashboardYearly, getDashboardSummary, certDefaults, saveCertDefaults, certTemplateCache,
    getDashboardBudget, saveBudgetActual,
    upsertUser, toggleUserActive, deleteUser,
    refreshNotifications, markAllRead, markNotifRead, clearAllNotif, pushToast, dismissToast,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useEvents() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useEvents must be used within an AppProvider');
  return ctx;
}
