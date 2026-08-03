import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import useLocalStorage from './useLocalStorage';
import {
  INITIAL_EVENTS,
  INITIAL_REGS,
  INITIAL_USERS,
  INITIAL_NOTIFS,
} from '../data/eventsData';
import { buildInitialRosters } from '../data/rostersData';
import { ROLE_LABEL, MOCK_ACCOUNTS } from '../utils/constants';

const AppContext = createContext(null);

function nowStamp() {
  const d = new Date();
  const p = (n) => (n < 10 ? '0' : '') + n;
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function AppProvider({ children }) {
  const [session, setSession] = useLocalStorage('cpsu-etms:session', null);
  // Bumped to :v2 — earlier cached data had a standalone "Cybersecurity" category
  // (since folded into "Workshop · Cybersecurity"); the new key forces a fresh read.
  const [events, setEvents] = useLocalStorage('cpsu-etms:events:v2', INITIAL_EVENTS);
  const [regs, setRegs] = useLocalStorage('cpsu-etms:regs', INITIAL_REGS);
  // Bumped to :v4 — earlier cached data used masked "xxxxx" student IDs.
  const [rosters, setRosters] = useLocalStorage('cpsu-etms:rosters:v4', () => buildInitialRosters(INITIAL_EVENTS));
  // Bumped to :v2 — earlier cached data only had the first 3 demo students.
  const [users, setUsers] = useLocalStorage('cpsu-etms:users:v2', INITIAL_USERS);
  const [signInSheets, setSignInSheets] = useLocalStorage('cpsu-etms:signinsheets', {});
  const [notifs, setNotifs] = useLocalStorage('cpsu-etms:notifs', INITIAL_NOTIFS);
  const [activityLog, setActivityLog] = useLocalStorage('cpsu-etms:log', []);
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);

  const pushToast = useCallback((title, msg, type = 'ok') => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, title, msg, type }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 3200);
  }, []);

  const addLog = useCallback((action, detail, actionColor) => {
    setActivityLog((log) => [
      { ts: nowStamp(), user: session ? session.name : 'SYSTEM', role: session ? session.role : 'system', action, detail, actionColor: actionColor || 'var(--c2-08)' },
      ...log,
    ].slice(0, 200));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const addNotif = useCallback((title, msg, icon, tone) => {
    setNotifs((n) => [{ id: Date.now(), icon: icon || 'ti-bell', tone: tone || 'accent', title, msg, time: 'เมื่อสักครู่', unread: true }, ...n]);
  }, [setNotifs]);

  const markAllRead = useCallback(() => setNotifs((n) => n.map((x) => ({ ...x, unread: false }))), [setNotifs]);
  const clearAllNotif = useCallback(() => setNotifs([]), [setNotifs]);

  /* ---------- auth ---------- */
  const login = useCallback((email, password) => {
    const account = MOCK_ACCOUNTS.find((a) => a.email.toLowerCase() === (email || '').trim().toLowerCase());
    if (!account || account.password !== password) {
      pushToast('เข้าสู่ระบบไม่สำเร็จ', 'อีเมลหรือรหัสผ่านไม่ถูกต้อง', 'warn');
      return false;
    }
    setSession({ role: account.role, name: account.name, email: account.email });
    pushToast('เข้าสู่ระบบสำเร็จ', `ยินดีต้อนรับ · ${ROLE_LABEL[account.role]}`);
    return true;
  }, [pushToast, setSession]);

  const logout = useCallback(() => {
    setSession(null);
  }, [setSession]);

  const switchRole = useCallback((role) => {
    const account = MOCK_ACCOUNTS.find((a) => a.role === role);
    setSession((s) => (s && account ? { ...s, role, name: account.name, email: account.email } : s));
    pushToast('สลับมุมมอง', `กำลังแสดงข้อมูลของ ${ROLE_LABEL[role]}`);
  }, [pushToast, setSession]);

  /* ---------- events / registration ---------- */
  const evById = useCallback((id) => events.find((e) => e.id === Number(id)), [events]);
  const myStatus = useCallback((eid) => {
    const r = regs.find((x) => x.eid === Number(eid));
    return r ? r.status : null;
  }, [regs]);

  const registerForEvent = useCallback((id) => {
    const ev = evById(id);
    if (!ev || myStatus(id)) return;
    setRegs((r) => [{ eid: Number(id), status: 'registered' }, ...r]);
    setEvents((evs) => evs.map((e) => {
      if (e.id !== Number(id)) return e;
      const reg = e.reg + 1;
      return { ...e, reg, status: reg >= e.cap ? 'full' : e.status };
    }));
    pushToast('ลงทะเบียนสำเร็จ', ev.title.slice(0, 32) + '…');
    addNotif('ลงทะเบียนสำเร็จ', `${ev.title} · รอการเปิดเช็คอินวันจัดกิจกรรม`, 'ti-user-check', 'accent');
    addLog('REGISTER', `ลงทะเบียนกิจกรรม "${ev.title}"`, 'var(--c1-12)');
  }, [evById, myStatus, setRegs, setEvents, pushToast, addNotif, addLog]);

  const toggleEventStatus = useCallback((id) => {
    setEvents((evs) => evs.map((e) => (e.id === Number(id) ? { ...e, status: e.status === 'open' ? 'closed' : 'open' } : e)));
    const ev = evById(id);
    const nextOpen = ev && ev.status !== 'open';
    pushToast(nextOpen ? 'เปิดรับสมัครแล้ว' : 'ปิดรับสมัครแล้ว', ev ? ev.title.slice(0, 30) : '');
    addLog(nextOpen ? 'OPEN' : 'CLOSE', `${nextOpen ? 'เปิด' : 'ปิด'}รับสมัคร "${ev ? ev.title : ''}"`);
  }, [evById, setEvents, pushToast, addLog]);

  const createEvent = useCallback((payload) => {
    const id = Math.max(...events.map((e) => e.id), 0) + 1;
    const newEvent = {
      icon: 'ti-sparkles',
      tone: 'alt',
      reg: 0,
      status: 'open',
      stage: 1,
      listed: true,
      desc: '',
      ...payload,
      id,
      cat: payload.cat || 'Workshop · Programming',
      date: payload.date || 'เร็ว ๆ นี้',
      time: payload.time || '-',
      place: payload.place || '-',
      cap: parseInt(payload.cap, 10) || 60,
      org: payload.org || (session ? session.name : ''),
    };
    setEvents((evs) => [newEvent, ...evs]);
    pushToast('เผยแพร่กิจกรรมสำเร็จ', newEvent.title.slice(0, 30));
    addNotif('กิจกรรมใหม่', `${newEvent.title} เปิดรับสมัครแล้ว`, 'ti-sparkles', 'dark');
    addLog('CREATE', `สร้างกิจกรรมใหม่ "${newEvent.title}"`, 'var(--c1-12)');
    return newEvent;
  }, [events, session, setEvents, pushToast, addNotif, addLog]);

  const updateEvent = useCallback((id, payload) => {
    setEvents((evs) => evs.map((e) => (e.id === Number(id) ? { ...e, ...payload } : e)));
    pushToast('บันทึกการแก้ไขแล้ว', payload.title ? payload.title.slice(0, 30) : '');
    addLog('UPDATE', `แก้ไขกิจกรรม "${payload.title || ''}"`);
  }, [setEvents, pushToast, addLog]);

  const deleteEvent = useCallback((id) => {
    const ev = evById(id);
    setEvents((evs) => evs.map((e) => (e.id === Number(id) ? { ...e, listed: false } : e)));
    pushToast('ลบกิจกรรมแล้ว', ev ? ev.title.slice(0, 30) : '', 'warn');
    addLog('DELETE', `ลบกิจกรรม "${ev ? ev.title : ''}"`, 'var(--c4)');
  }, [evById, setEvents, pushToast, addLog]);

  /* ---------- applicants / check-in ---------- */
  const toggleCheckin = useCallback((eventId, index) => {
    setRosters((rs) => {
      const list = (rs[eventId] || []).map((p, i) => (i === index ? { ...p, in: !p.in } : p));
      return { ...rs, [eventId]: list };
    });
  }, [setRosters]);

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

  const issueCertificate = useCallback((id) => {
    const ev = evById(id);
    const roster = rosters[id] || [];
    const inCount = roster.filter((p) => p.in).length;
    setEvents((evs) => evs.map((e) => (e.id === Number(id) ? { ...e, stage: 3, status: 'done' } : e)));
    setRegs((rs) => rs.map((r) => (r.eid === Number(id) && r.status === 'registered' ? { ...r, status: 'attended' } : r)));
    pushToast('เปิดให้รับเกียรติบัตรแล้ว', 'ผู้เข้าร่วมต้องทำแบบประเมินก่อนดาวน์โหลด');
    addLog('ISSUE', `เปิดสิทธิ์เกียรติบัตร "${ev ? ev.title : ''}" (${inCount || (ev ? ev.reg : 0)} คน)`);
    addNotif('ทำแบบประเมินเพื่อรับเกียรติบัตร', `${ev ? ev.title : ''} · กรุณาทำแบบประเมินกิจกรรมเพื่อรับเกียรติบัตร`, 'ti-clipboard-check', 'accent');
  }, [evById, rosters, setEvents, setRegs, pushToast, addLog, addNotif]);

  const submitEvaluation = useCallback((id) => {
    const ev = evById(id);
    setRegs((rs) => rs.map((r) => (r.eid === Number(id) ? { ...r, status: 'certified' } : r)));
    pushToast('ส่งแบบประเมินสำเร็จ', 'เกียรติบัตรของคุณพร้อมดาวน์โหลดแล้ว');
    addNotif('เกียรติบัตรพร้อมแล้ว', `${ev ? ev.title : ''} · ขอบคุณที่ทำแบบประเมิน`, 'ti-certificate', 'accent');
    addLog('EVALUATE', `ทำแบบประเมินกิจกรรม "${ev ? ev.title : ''}" เสร็จสิ้น`, 'var(--c1-12)');
  }, [evById, setRegs, pushToast, addNotif, addLog]);

  const downloadCert = useCallback((id) => {
    const ev = evById(id);
    pushToast('กำลังดาวน์โหลดเกียรติบัตร', 'ไฟล์ PDF · ' + (ev ? ev.title.slice(0, 28) : ''));
    addLog('DOWNLOAD', `ดาวน์โหลดเกียรติบัตร "${ev ? ev.title : ''}"`);
  }, [evById, pushToast, addLog]);

  /* ---------- users (admin UC-17/18) ---------- */
  const upsertUser = useCallback((payload, id) => {
    if (id) {
      setUsers((us) => us.map((u) => (u.id === id ? { ...u, ...payload } : u)));
      pushToast('บันทึกการแก้ไขแล้ว', payload.name);
      addLog('UPDATE', `แก้ไขผู้ใช้งาน ${payload.name}`);
    } else {
      const newUser = { id: 'u' + Date.now(), active: true, ...payload };
      setUsers((us) => [newUser, ...us]);
      pushToast('เพิ่มผู้ใช้งานสำเร็จ', payload.name);
      addLog('CREATE', `เพิ่มผู้ใช้งาน ${payload.name} (${ROLE_LABEL[payload.role]})`, 'var(--c1-12)');
    }
  }, [setUsers, pushToast, addLog]);

  const toggleUserActive = useCallback((id) => {
    setUsers((us) => us.map((u) => (u.id === id ? { ...u, active: !u.active } : u)));
  }, [setUsers]);

  const deleteUser = useCallback((id) => {
    const u = users.find((x) => x.id === id);
    setUsers((us) => us.filter((x) => x.id !== id));
    if (u) {
      pushToast('ลบผู้ใช้งานแล้ว', u.name, 'warn');
      addLog('DELETE', `ลบผู้ใช้งาน ${u.name}`, 'var(--c4)');
    }
  }, [users, setUsers, pushToast, addLog]);

  const value = useMemo(() => ({
    session, events, regs, rosters, users, notifs, toasts, activityLog, signInSheets,
    evById, myStatus,
    login, logout, switchRole,
    registerForEvent, toggleEventStatus, createEvent, updateEvent, deleteEvent,
    toggleCheckin, setSignInSheet, issueCertificate, submitEvaluation, downloadCert,
    upsertUser, toggleUserActive, deleteUser,
    addNotif, markAllRead, clearAllNotif,
    pushToast, addLog,
  }), [
    session, events, regs, rosters, users, notifs, toasts, activityLog, signInSheets,
    evById, myStatus, login, logout, switchRole,
    registerForEvent, toggleEventStatus, createEvent, updateEvent, deleteEvent,
    toggleCheckin, setSignInSheet, issueCertificate, submitEvaluation, downloadCert,
    upsertUser, toggleUserActive, deleteUser,
    addNotif, markAllRead, clearAllNotif, pushToast, addLog,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useEvents() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useEvents must be used within an AppProvider');
  return ctx;
}
