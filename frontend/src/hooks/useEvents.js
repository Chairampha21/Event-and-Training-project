import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import useLocalStorage from './useLocalStorage';
import { api, setAuthToken } from '../utils/api';
import { formatThaiDate, formatThaiDateRange } from '../utils/dateFormat';
import { ROLE_LABEL, EVENT_CATEGORY_ICONS } from '../utils/constants';

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

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Derives the 4-stage cycle (ประกาศ/รับสมัคร/จัดกิจกรรม/เกียรติบัตร) from the
// event's actual date range and status, instead of trusting a stage an
// organizer may never have gone back to update by hand — so it advances into
// "จัดกิจกรรม" and "เกียรติบัตร" on its own as the real date arrives/passes.
// 'done' is still an explicit organizer action (opening certificate
// eligibility), so it always wins once set.
function deriveStage(status, dateStart, dateEnd) {
  if (status === 'done') return 3;
  if (status === 'soon') return 0;
  if (!dateStart) return 1;
  const today = todayIso();
  const end = dateEnd || dateStart;
  if (today < dateStart) return 1;
  if (today <= end) return 2;
  return 3;
}

function adaptEvent(be) {
  return {
    id: be.id,
    title: be.title,
    desc: be.description || '',
    cat: be.category,
    icon: deriveIcon(be.category),
    tone: deriveTone(be.id),
    date: be.day_mode === 'multi' && be.date_end ? formatThaiDateRange(be.date_start, be.date_end) : formatThaiDate(be.date_start),
    dateStart: be.date_start || '',
    dateEnd: be.date_end || '',
    time: be.time_range || '-',
    place: be.attend_mode === 'online' ? 'ออนไลน์' : (be.place || '-'),
    cap: be.capacity,
    reg: be.registered_count || 0,
    status: be.status,
    stage: deriveStage(be.status, be.date_start, be.date_end),
    org: be.organizer_name || '',
    organizerId: be.organizer_id,
    listed: be.is_listed,
    poster: be.poster_url || null,
    certTemplate: be.cert_template_url ? { name: 'template', type: guessMime(be.cert_template_url), dataUrl: be.cert_template_url } : null,
    signer: { name: be.cert_signer_name || '', title: be.cert_signer_title || '' },
    pretest: { enabled: !!be.pretest_enabled, link: be.pretest_link || '' },
    dayMode: be.day_mode,
    attendMode: be.attend_mode,
    capOnsite: be.capacity_onsite ?? '',
    capOnline: be.capacity_online ?? '',
    onlineLink: be.online_link || '',
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
    poster_url: payload.poster || null,
    cert_template_url: payload.certTemplate?.dataUrl || null,
    cert_signer_name: payload.signer?.name || null,
    cert_signer_title: payload.signer?.title || null,
    pretest_enabled: !!payload.pretest?.enabled,
    pretest_link: payload.pretest?.link || null,
  };
  if (payload.capOnsite !== undefined) body.capacity_onsite = parseInt(payload.capOnsite, 10) || 0;
  if (payload.capOnline !== undefined) body.capacity_online = parseInt(payload.capOnline, 10) || 0;
  if (payload.dateIso) body.date_start = payload.dateIso;
  if (payload.dateEndIso) body.date_end = payload.dateEndIso;
  return body;
}

function adaptRosterRow(r) {
  return { sid: r.student_id || '', name: r.name, in: !!r.checked_in, regId: r.id, status: r.status };
}

function adaptMyRegistration(r) {
  // Carries its own display fields (from the JOIN on the backend) rather than relying
  // on evById — a registration can point at an unlisted/archived event (old semester,
  // soft-deleted) that never appears in the current events list, so it must stay
  // visible in the student's own history/certificates regardless.
  return {
    eid: r.event_id, status: r.status, regId: r.id,
    title: r.title, cat: r.category,
    date: r.date_end && r.date_end !== r.date_start ? formatThaiDateRange(r.date_start, r.date_end) : formatThaiDate(r.date_start),
    place: r.place || '-',
    icon: deriveIcon(r.category),
    tone: deriveTone(r.event_id),
    stage: deriveStage(r.event_status, r.date_start, r.date_end),
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
  return { id: n.id, icon: n.icon || 'ti-bell', tone: n.tone || 'accent', title: n.title, msg: n.message || '', unread: !n.is_read, time: timeAgo(n.created_at), _server: true };
}

export function AppProvider({ children }) {
  // Bumped to :v3 — session now carries a real JWT + numeric id instead of the mock's {role,name,email}.
  const [session, setSession] = useLocalStorage('cpsu-etms:session:v3', null);
  setAuthToken(session?.token || null);

  const [events, setEvents] = useState([]);
  const [regs, setRegs] = useState([]); // student's own registrations: {eid, status, regId}
  const [rosters, setRosters] = useState({}); // eventId -> [{sid, name, in, regId, status}]
  const [users, setUsers] = useState([]);
  const [signInSheets, setSignInSheets] = useLocalStorage('cpsu-etms:signinsheets', {}); // no backend table for this — local-only evidence photo
  const [notifs, setNotifs] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [blacklist, setBlacklist] = useState([]);
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);
  const questionsRef = useRef(null);

  const pushToast = useCallback((title, msg, type = 'ok') => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, title, msg, type }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 3200);
  }, []);

  const addNotif = useCallback((title, msg, icon, tone) => {
    setNotifs((n) => [{ id: `local${Date.now()}`, icon: icon || 'ti-bell', tone: tone || 'accent', title, msg, time: 'เมื่อสักครู่', unread: true }, ...n]);
  }, []);

  const markAllRead = useCallback(() => {
    setNotifs((n) => n.map((x) => ({ ...x, unread: false })));
    notifs.filter((x) => x.unread && x._server).forEach((x) => {
      api.post(`/notifications/${x.id}/read`).catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifs]);

  const clearAllNotif = useCallback(() => setNotifs([]), []);

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
      const rosterTargets = role === 'admin' ? adapted : role === 'organizer' ? adapted.filter((e) => e.organizerId === session?.id) : [];
      if (rosterTargets.length > 0) {
        const entries = await Promise.all(rosterTargets.map(async (e) => {
          try {
            const { registrations } = await api.get(`/events/${e.id}/registrations`);
            return [e.id, registrations.map(adaptRosterRow)];
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
  const loadMyCertificates = useCallback(async () => {
    const list = await refreshMyCertificates();
    setMyCertificates(list);
  }, [refreshMyCertificates]);

  const refreshUsers = useCallback(async () => {
    try {
      const { users: list } = await api.get('/users');
      setUsers(list);
    } catch (err) {
      pushToast('โหลดรายชื่อผู้ใช้งานไม่สำเร็จ', err.message, 'warn');
    }
  }, [pushToast]);

  const refreshNotifications = useCallback(async () => {
    try {
      const { notifications } = await api.get('/me/notifications');
      setNotifs(notifications.map(adaptNotif));
    } catch {
      // notifications are ambient/non-critical — fail silently
    }
  }, []);

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
    if (!session) {
      setEvents([]); setRegs([]); setRosters({}); setUsers([]); setNotifs([]); setBlacklist([]); setActivityLog([]); setMyCertificates([]);
      return;
    }
    refreshEvents({ role: session.role });
    refreshNotifications();
    if (session.role === 'student') {
      refreshMyRegistrations();
      loadMyCertificates();
    }
    if (session.role === 'organizer' || session.role === 'admin') {
      refreshBlacklist();
      refreshActivityLog();
    }
    if (session.role === 'admin') {
      refreshUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  /* ---------- auth ---------- */
  const login = useCallback(async (email, password) => {
    try {
      const { user, token } = await api.post('/auth/login', { email, password }, { auth: false });
      setAuthToken(token);
      setSession({ id: user.id, role: user.role, name: user.name, email: user.email, student_id: user.student_id, dept: user.dept, token });
      pushToast('เข้าสู่ระบบสำเร็จ', `ยินดีต้อนรับ · ${ROLE_LABEL[user.role]}`);
      return true;
    } catch (err) {
      pushToast('เข้าสู่ระบบไม่สำเร็จ', err.message || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง', 'warn');
      return false;
    }
  }, [pushToast, setSession]);

  const logout = useCallback(() => {
    setAuthToken(null);
    setSession(null);
  }, [setSession]);

  /* ---------- events / registration ---------- */
  const evById = useCallback((id) => events.find((e) => e.id === Number(id)), [events]);
  const myStatus = useCallback((eid) => {
    const r = regs.find((x) => x.eid === Number(eid));
    return r ? r.status : null;
  }, [regs]);

  const registerForEvent = useCallback(async (id) => {
    const ev = evById(id);
    if (!ev || myStatus(id)) return;
    try {
      await api.post(`/events/${id}/register`);
      await Promise.all([refreshEvents(), refreshMyRegistrations()]);
      pushToast('ลงทะเบียนสำเร็จ', ev.title.slice(0, 32) + '…');
      addNotif('ลงทะเบียนสำเร็จ', `${ev.title} · รอการเปิดเช็คอินวันจัดกิจกรรม`, 'ti-user-check', 'accent');
    } catch (err) {
      pushToast('ลงทะเบียนไม่สำเร็จ', err.message, 'warn');
    }
  }, [evById, myStatus, refreshEvents, refreshMyRegistrations, pushToast, addNotif]);

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
      addNotif('กิจกรรมใหม่', `${payload.title} เปิดรับสมัครแล้ว`, 'ti-sparkles', 'dark');
      return adaptEvent(event);
    } catch (err) {
      pushToast('เผยแพร่กิจกรรมไม่สำเร็จ', err.message, 'warn');
      throw err;
    }
  }, [refreshEvents, pushToast, addNotif]);

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

  const deleteEvent = useCallback(async (id) => {
    const ev = evById(id);
    try {
      await api.del(`/events/${id}`);
      await refreshEvents();
      pushToast('ลบกิจกรรมแล้ว', ev ? ev.title.slice(0, 30) : '', 'warn');
    } catch (err) {
      pushToast('ลบกิจกรรมไม่สำเร็จ', err.message, 'warn');
    }
  }, [evById, refreshEvents, pushToast]);

  /* ---------- applicants / check-in ---------- */
  const toggleCheckin = useCallback(async (eventId, index) => {
    const list = rosters[eventId] || [];
    const item = list[index];
    if (!item) return;
    const next = !item.in;
    setRosters((rs) => ({ ...rs, [eventId]: (rs[eventId] || []).map((p, i) => (i === index ? { ...p, in: next } : p)) }));
    try {
      await api.patch(`/registrations/${item.regId}/checkin`, { checked_in: next });
    } catch (err) {
      setRosters((rs) => ({ ...rs, [eventId]: (rs[eventId] || []).map((p, i) => (i === index ? { ...p, in: !next } : p)) }));
      pushToast('อัปเดตเช็คอินไม่สำเร็จ', err.message, 'warn');
    }
  }, [rosters, pushToast]);

  const setSignInSheet = useCallback((eventId, dataUrl) => {
    setSignInSheets((sheets) => {
      if (dataUrl === null) {
        const next = { ...sheets };
        delete next[eventId];
        return next;
      }
      return { ...sheets, [eventId]: dataUrl };
    });
  }, [setSignInSheets]);

  // Advances the event to the certificate stage; individual certificates are then
  // issued automatically per-student when they submit their evaluation (see
  // submitEvaluation) — matches the roster hint text: check people in first.
  const issueCertificate = useCallback(async (id) => {
    const ev = evById(id);
    try {
      await api.put(`/events/${id}`, { cycle_stage: 3, status: 'done' });
      await refreshEvents();
      pushToast('เปิดให้รับเกียรติบัตรแล้ว', 'ผู้เข้าร่วมต้องทำแบบประเมินก่อนดาวน์โหลด');
      addNotif('ทำแบบประเมินเพื่อรับเกียรติบัตร', `${ev ? ev.title : ''} · กรุณาทำแบบประเมินกิจกรรมเพื่อรับเกียรติบัตร`, 'ti-clipboard-check', 'accent');
    } catch (err) {
      pushToast('ดำเนินการไม่สำเร็จ', err.message, 'warn');
    }
  }, [evById, refreshEvents, pushToast, addNotif]);

  async function getEvalQuestions() {
    if (questionsRef.current) return questionsRef.current;
    const { questions } = await api.get('/evaluations/questions', { auth: false });
    questionsRef.current = questions;
    return questions;
  }

  // scores: {[q_key]: 1-5}. Submitting also auto-issues the certificate server-side
  // once the registration is 'attended' — matches the form's own promise to the user.
  const submitEvaluation = useCallback(async (id, scores) => {
    const ev = evById(id);
    const reg = regs.find((r) => r.eid === Number(id));
    if (!reg) { pushToast('ไม่พบการลงทะเบียนของคุณ', '', 'warn'); return; }
    try {
      const questions = await getEvalQuestions();
      const answers = questions.map((q) => ({ question_id: q.id, score: scores?.[q.q_key] })).filter((a) => a.score);
      await api.post(`/registrations/${reg.regId}/evaluation`, { answers });
      await refreshMyRegistrations();
      pushToast('ส่งแบบประเมินสำเร็จ', 'เกียรติบัตรของคุณพร้อมดาวน์โหลดแล้ว');
      addNotif('เกียรติบัตรพร้อมแล้ว', `${ev ? ev.title : ''} · ขอบคุณที่ทำแบบประเมิน`, 'ti-certificate', 'accent');
    } catch (err) {
      pushToast('ส่งแบบประเมินไม่สำเร็จ', err.message, 'warn');
      throw err;
    }
  }, [evById, regs, refreshMyRegistrations, pushToast, addNotif]);

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

  /* ---------- users (admin UC-17/18) ---------- */
  const upsertUser = useCallback(async (payload, id) => {
    try {
      if (id) {
        const { user } = await api.put(`/users/${id}`, { name: payload.name, email: payload.email, role: payload.role, dept: payload.dept });
        setUsers((us) => us.map((u) => (u.id === id ? user : u)));
        pushToast('บันทึกการแก้ไขแล้ว', payload.name);
      } else {
        await api.post('/users', { name: payload.name, email: payload.email, role: payload.role, dept: payload.dept });
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
    session, events, regs, rosters, users, notifs, toasts, activityLog, signInSheets, blacklist, myCertificates,
    evById, myStatus,
    login, logout,
    registerForEvent, toggleEventStatus, createEvent, updateEvent, deleteEvent,
    toggleCheckin, setSignInSheet, issueCertificate, submitEvaluation, downloadCert,
    addToBlacklist, restoreFromBlacklist,
    getSar, saveSar, getEvaluationResults, getDashboardYearly,
    upsertUser, toggleUserActive, deleteUser,
    addNotif, markAllRead, clearAllNotif,
    pushToast,
  }), [
    session, events, regs, rosters, users, notifs, toasts, activityLog, signInSheets, blacklist, myCertificates,
    evById, myStatus, login, logout,
    registerForEvent, toggleEventStatus, createEvent, updateEvent, deleteEvent,
    toggleCheckin, setSignInSheet, issueCertificate, submitEvaluation, downloadCert,
    addToBlacklist, restoreFromBlacklist,
    getSar, saveSar, getEvaluationResults, getDashboardYearly,
    upsertUser, toggleUserActive, deleteUser,
    addNotif, markAllRead, clearAllNotif, pushToast,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useEvents() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useEvents must be used within an AppProvider');
  return ctx;
}
