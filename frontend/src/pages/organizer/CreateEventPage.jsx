import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useEvents } from '../../hooks/useEvents';
import useLocalStorage from '../../hooks/useLocalStorage';
import { STATUS_META, EVENT_CATEGORIES } from '../../utils/constants';
import { formatThaiDate, formatThaiDateList, formatCertDate, formatCertDateList, formatDayTime, formatRegPeriod, summarizeDayTimes, todayIso } from '../../utils/dateFormat';
import MultiDatePicker from '../../components/ui/MultiDatePicker';
import TimeInput from '../../components/ui/TimeInput';
import { formatTimeRange, parseTimeRange } from '../../utils/timeFormat';
import PosterUpload from '../../features/events/components/PosterUpload';
import EventDetailModal from '../../features/events/components/EventDetailModal';
import DateInput from '../../components/ui/DateInput';
import { REFUND_METHODS } from '../../features/events/components/PaymentBox';
import { parseMoney, formatBaht } from '../../utils/money';

import Modal, { ModalHead } from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { withProgress } from '../../utils/alert';
import CertTemplateUpload from '../../features/certificates/components/CertTemplateUpload';
import SignatureUpload from '../../features/certificates/components/SignatureUpload';
import './CreateEventPage.css';

// Categories where attendees usually work on their own machine, so the
// "what to prepare" block starts switched on. It's only a default — any
// category can turn it on or off (a lecture may still ask for a student ID).
const HANDS_ON_CATEGORIES = ['อบรมเชิงปฏิบัติการ', 'การแข่งขัน'];
const NOTE_MAX = 500;
// One-tap starting points for the message to attendees.
const NOTE_PRESETS = ['ให้นำโน้ตบุ๊กส่วนตัวมาด้วย', 'ติดตั้งโปรแกรมที่ใช้มาล่วงหน้า', 'นำบัตรนักศึกษามาแสดงหน้างาน'];
// The quick-message chips start as NOTE_PRESETS; an organizer can add their own
// and delete any of them. The list is kept in this browser, per account.
const MAX_PRESETS = 15;
const CUSTOM_PRESET_MAX = 100;
const BUDGET_ERROR = 'กรอกเป็นตัวเลข ไม่ติดลบ และทศนิยมไม่เกิน 2 ตำแหน่ง';
const BUDGET_ERROR_STYLE = { color: '#b91c1c', fontWeight: 600 };

// Starter template for a new event's evaluation form — organizers can freely
// edit, remove, or add to these before publishing (or skip entirely and set
// it up later from the same edit form).
// Fewest seats an event can take (each side of a hybrid event); the server checks it too.
const MIN_SEATS = 2;

const COORDINATOR_OPTIONS = [
  'ผศ.ดร.สิรักข์ แก้วจำนงค์',
  'ผศ.โอภาส วงษ์ทวีทรัพย์',
  'อ.ดร.ภูริวัจน์ วรวิชัยพัฒน์',
  'รศ.ดร.ปานใจ ธารทัศนวงศ์',
  'ผศ.ดร.กรัญญา สิทธิสงวน',
  'ผศ.ดร.กฤษณะ สีพนมวัน',
  'ผศ.ดร.คทา ประดิษฐวงศ์',
  'ผศ.ดร.ณัฐโชติ พรหมฤทธิ์',
  'ผศ.ดร.ทัศนวรรณ ศูนย์กลาง',
  'ผศ.ดร.ปัญญนัท อ้นพงษ์',
  'ผศ.ดร.รัชดาพร คณาวงษ์',
  'ผศ.ดร.วีณาวดี ม่วงอ้น',
  'ผศ.ดร.สัจจาภรณ์ ไวจรรยา',
  'ผศ.ดร.สุนีย์ พงษ์พินิจภิญโญ',
  'ผศ.ดร.อรวรรณ เชาวลิต',
  'อ.ดร.ณัฐพงศ์ จิวมั่งมี',
  'อ.ดร.บูชาภัทร ป้านศรี',
  'อ.ดร.วัสรา รอดเหตุภัย',
  'อ.ดร.เสาวลักษณ์ อร่ามพงศานุวัต',
  'อ.เสฐลัทธ์ รอดเหตุภัย',
  'อ.อภิเษก หงษ์วิทยากร',
];

const DEFAULT_EVAL_QUESTIONS = [
  { type: 'choice', label: 'เพศ', required: true, options: ['ชาย', 'หญิง', 'ไม่ประสงค์ระบุเพศ'] },
  { type: 'choice', label: 'สาขาวิชา', required: true, options: ['สาขาวิชาวิทยาการคอมพิวเตอร์', 'สาขาวิชาเทคโนโลยีสารสนเทศ'] },
  { type: 'scale', label: 'นักศึกษามีความรู้ความเข้าใจในรายวิชามากขึ้น สามารถวิเคราะห์ปัญหาและพัฒนาโปรแกรมคอมพิวเตอร์ตามความต้องการของผู้ใช้ได้', required: true, options: [] },
  { type: 'scale', label: 'นักศึกษาสามารถนำความรู้ที่ได้จากโครงการไปปรับใช้ในรายวิชาอื่น ๆ ที่เกี่ยวข้องต่อไปได้', required: true, options: [] },
  { type: 'scale', label: 'นักศึกษาได้รับความรู้ แนวทางในการเรียน สามารถนำความรู้ที่ได้ไปประยุกต์ในการเรียนการสอนต่อไปได้', required: true, options: [] },
];

// Days to pre-select when editing a multi-day event: the stored list, or — for
// events saved before per-day selection existed — every day of the old
// start–end range.
function initialEventDates(editing) {
  if (!editing || editing.dayMode !== 'multi') return [];
  if (editing.dates?.length) return editing.dates;
  const out = [];
  const end = editing.dateEnd || editing.dateStart;
  for (let d = new Date(`${editing.dateStart}T00:00:00Z`); out.length < 60 && d.toISOString().slice(0, 10) <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

// Per-day times to pre-fill when editing: the stored ones, or — for events
// saved before per-day times existed — the event's single time on every day.
function initialDayTimes(editing, dates, parsedTime) {
  const out = {};
  dates.forEach((d, i) => {
    const [start, end] = (editing?.dayTimes?.[i] || '').split('-');
    if (start && end) out[d] = { start, end };
    else if (parsedTime) out[d] = { start: parsedTime[0], end: parsedTime[1] };
  });
  return out;
}

export default function CreateEventPage() {
  const { session, evById, createEvent, updateEvent, pushToast, getEventEvalSetup, saveEventEvalQuestions, certDefaults } = useEvents();
  const navigate = useNavigate();
  const location = useLocation();
  const editId = location.state?.editId;
  const editing = editId ? evById(editId) : null;

  const [poster, setPoster] = useState(editing?.poster || null);
  const [title, setTitle] = useState(editing?.title || '');
  const [desc, setDesc] = useState(editing?.desc || '');
  const [cat, setCat] = useState(editing?.cat || '');
  const [customCats, setCustomCats] = useState(
    editing?.cat && !EVENT_CATEGORIES.includes(editing.cat) ? [editing.cat] : []
  );
  const [addingCat, setAddingCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const catOptions = useMemo(() => [...EVENT_CATEGORIES, ...customCats], [customCats]);
  const [org, setOrg] = useState(editing?.org || '');

  function addCategory() {
    const name = newCatName.trim();
    if (!name) { setAddingCat(false); return; }
    if (!catOptions.includes(name)) setCustomCats((c) => [...c, name]);
    setCat(name);
    setNewCatName('');
    setAddingCat(false);
  }

  const [dayMode, setDayMode] = useState(editing?.dayMode || 'single');
  const [dateIso, setDateIso] = useState(editing?.dateStart || '');
  // Multi-day events: the exact days, picked one by one (need not be consecutive).
  const [eventDates, setEventDates] = useState(() => initialEventDates(editing));

  function changeDayMode(mode) {
    // Carry the date already chosen across the switch so it isn't retyped.
    if (mode === 'multi' && eventDates.length === 0 && dateIso) setEventDates([dateIso]);
    if (mode === 'single' && !dateIso && eventDates.length > 0) setDateIso(eventDates[0]);
    setDayMode(mode);
  }
  // Registration window (inclusive dates). New events default to opening today.
  const [regStartIso, setRegStartIso] = useState(editing ? editing.regStart || '' : todayIso());
  const [regEndIso, setRegEndIso] = useState(editing?.regEnd || '');

  const parsedTime = parseTimeRange(editing?.time); // ["HH:MM", "HH:MM"] or null
  const [timeStart, setTimeStart] = useState(parsedTime?.[0] || '');
  const [timeEnd, setTimeEnd] = useState(parsedTime?.[1] || '');
  // Multi-day events: each picked day has its own time ({[iso]: {start, end}}).
  const [dayTimes, setDayTimes] = useState(() => initialDayTimes(editing, eventDates, parsedTime));
  const eventTimes = eventDates.map((d) => (dayTimes[d]?.start && dayTimes[d]?.end ? `${dayTimes[d].start}-${dayTimes[d].end}` : ''));
  const time = dayMode === 'multi'
    ? summarizeDayTimes(eventTimes)
    : formatTimeRange(timeStart, timeEnd);

  const [attendMode, setAttendMode] = useState(editing?.attendMode || 'onsite');
  const [place, setPlace] = useState(editing?.placeRaw || '');
  const [cap, setCap] = useState(editing?.cap || '');
  const [capOnsite, setCapOnsite] = useState(editing?.capOnsite ?? '');
  const [capOnline, setCapOnline] = useState(editing?.capOnline ?? '');
  const [onlineLink, setOnlineLink] = useState(editing?.onlineLink || '');
  // Registration fee: off = free. Payment happens outside the system, so the
  // organizer also says how to pay; they confirm each payment in the roster.
  const [feeOn, setFeeOn] = useState(editing?.fee > 0);
  const [feeText, setFeeText] = useState(editing?.fee > 0 ? String(editing.fee) : '');
  const [paymentInfo, setPaymentInfo] = useState(editing?.paymentInfo || '');
  // How paid money is given back. Can change later, but not to "no refund"
  // once people have paid on the promise of one (the server enforces it too).
  const [refundMethod, setRefundMethod] = useState(editing?.refundMethod || 'none');
  const [refundNote, setRefundNote] = useState(editing?.refundNote || '');
  const refundLocked = !!editing && editing.payerCount > 0 && editing.refundMethod !== 'none';
  const feeValue = parseMoney(feeText);
  const [detailPreviewOpen, setDetailPreviewOpen] = useState(false);

  // What attendees need to know or bring, and how many notebooks can be lent.
  const [attendeeNote, setAttendeeNote] = useState(editing?.attendeeNote || '');
  const [loanQtyText, setLoanQtyText] = useState(editing?.loanQty ? String(editing.loanQty) : '');
  const loanQty = loanQtyText.trim() === '' ? 0 : Number(loanQtyText);
  const loanQtyInvalid = !Number.isInteger(loanQty) || loanQty < 0 || loanQty > 1000;
  const loanTaken = editing?.loanTaken || 0;
  // The block is optional and collapsed by default so the form stays short for
  // events that don't need it. When editing it opens if anything was saved in it.
  const [prepOn, setPrepOn] = useState(!!(editing?.attendeeNote || editing?.loanQty));
  // The event serves food: ask registrants about food allergies
  // (its own section — food is something the organizer provides, not something attendees bring).
  const [askDietary, setAskDietary] = useState(!!editing?.askDietary);
  const prepTouched = useRef(false);
  // Lending notebooks only makes sense when people come in person.
  const loanAvailable = attendMode !== 'online' || loanTaken > 0;

  useEffect(() => {
    // Follow the category until the organizer flips the switch themselves.
    if (!editing && !prepTouched.current) setPrepOn(HANDS_ON_CATEGORIES.includes(cat));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat]);

  // Arriving from "แก้ไขเกียรติบัตร" (the issue-certificate confirmation):
  // go straight to the certificate section of the form.
  useEffect(() => {
    if (location.state?.section !== 'cert') return undefined;
    const t = setTimeout(() => document.getElementById('ce-cert')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function togglePrep() {
    if (prepOn && loanTaken > 0) {
      pushToast('ปิดส่วนนี้ไม่ได้', `มีผู้ขอยืมโน้ตบุ๊กแล้ว ${loanTaken} เครื่อง`, 'warn');
      return;
    }
    prepTouched.current = true;
    setPrepOn((o) => !o);
  }

  // Preset chips toggle: tap to add the sentence, tap again to take it back out
  // (anything else the organizer typed is left alone).
  const presetKey = `cpsu-etms:note-presets:${session?.id || 'guest'}`;
  const [presets, setPresets] = useLocalStorage(`${presetKey}:v2`, () => {
    // Carry over chips added before the defaults became deletable (that key held only the added ones).
    let added = [];
    try { added = JSON.parse(window.localStorage.getItem(presetKey)) || []; } catch { /* none */ }
    return [...NOTE_PRESETS, ...added.filter((t) => !NOTE_PRESETS.includes(t))];
  });
  const [presetDraft, setPresetDraft] = useState(null); // null = not adding; string = the text being typed
  const presetDraftTrim = (presetDraft || '').trim();
  const presetDraftDup = presets.includes(presetDraftTrim);

  function addCustomPreset() {
    if (!presetDraftTrim || presetDraftDup || presets.length >= MAX_PRESETS) return;
    setPresets((list) => [...list, presetDraftTrim]);
    setPresetDraft(null);
  }

  // Delete mode: the trash button turns the chips into a pick list; the picked
  // ones go only when the deletion is confirmed.
  const [presetDeleting, setPresetDeleting] = useState(null); // null = off; array = picked texts

  function togglePresetPick(text) {
    setPresetDeleting((picked) => (picked.includes(text) ? picked.filter((t) => t !== text) : [...picked, text]));
  }

  function deletePickedPresets() {
    setPresets((list) => list.filter((t) => !presetDeleting.includes(t)));
    setPresetDeleting(null);
  }

  function toggleNotePreset(text) {
    setAttendeeNote((n) => (
      n.includes(text)
        ? n.replace(text, '').replace(/[ \t]{2,}/g, ' ').replace(/ ?\n ?/g, '\n').trim()
        : (n.trim() ? `${n.trim()} ${text}` : text).slice(0, NOTE_MAX)
    ));
  }

  // Planned budget in baht, kept as typed text; optional (empty = no budget set).
  const [budgetText, setBudgetText] = useState(editing?.budgetPlanned != null ? String(editing.budgetPlanned) : '');
  const budgetPlanned = parseMoney(budgetText);
  // Budget from any other funding source; the event's budget is the two added up.
  const [budgetOtherText, setBudgetOtherText] = useState(editing?.budgetOther != null ? String(editing.budgetOther) : '');
  const budgetOther = parseMoney(budgetOtherText);
  const budgetInvalid = Number.isNaN(budgetPlanned) || Number.isNaN(budgetOther);
  const budgetTotalText = budgetInvalid || (budgetPlanned == null && budgetOther == null)
    ? '–'
    : formatBaht((budgetPlanned || 0) + (budgetOther || 0));

  const [pretestOn, setPretestOn] = useState(editing?.pretest?.enabled || false);
  const [pretestLink, setPretestLink] = useState(editing?.pretest?.link || '');

  const [certTemplate, setCertTemplate] = useState(editing?.certTemplate || null);
  // Whether the event gives certificates at all. Off: nothing to set up here,
  // and the sign-in sheet has one signature box per day instead of morning/afternoon.
  const [issueCert, setIssueCert] = useState(editing ? editing.issueCert !== false : true);
  // A new event starts with the signer an admin set as the department default
  // (ตั้งค่าเกียรติบัตร); the organizer may change it for this event.
  const [signerName, setSignerName] = useState(editing?.signer?.name || certDefaults?.signer.name || '');
  const [signerTitle, setSignerTitle] = useState(editing?.signer?.title || certDefaults?.signer.title || '');
  const [signature, setSignature] = useState(editing ? editing.signer?.signature || null : certDefaults?.signer.signature || null); // scanned signature (data: URL), optional
  // Off: the certificate is printed without a signature image and the signer
  // signs each one by hand. The uploaded image is kept while off, in case it is switched back on.
  const [signatureOn, setSignatureOn] = useState(editing ? !!editing.signer?.signature : true);
  const signerTouched = useRef(false);
  useEffect(() => {
    if (editing || !certDefaults || signerTouched.current) return;
    setSignerName(certDefaults.signer.name);
    setSignerTitle(certDefaults.signer.title);
    setSignature(certDefaults.signer.signature);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [certDefaults]);
  const [certLayout, setCertLayout] = useState(editing?.certLayout || null); // how the text is fitted to the template; null = defaults

  const evalKeyRef = useRef(0);
  const newEvalKey = () => `eq-${evalKeyRef.current++}`;
  const [evalQuestions, setEvalQuestions] = useState(() =>
    DEFAULT_EVAL_QUESTIONS.map((q) => ({ ...q, _key: newEvalKey() }))
  );
  const [evalQuestionsLoaded, setEvalQuestionsLoaded] = useState(!editing);
  const [evalOn, setEvalOn] = useState(false);
  // Certificates issued or answers in: the questions stay as they are (saving
  // them again would delete the answers). The server refuses it too.
  const [evalLocked, setEvalLocked] = useState(false);

  useEffect(() => {
    if (!editing) return;
    let cancelled = false;
    getEventEvalSetup(editing.id).then(({ questions: qs, locked }) => {
      if (cancelled) return;
      setEvalLocked(locked);
      setEvalQuestions(
        qs.length
          ? qs.map((q) => ({ _key: newEvalKey(), label: q.label, type: q.type, required: q.required, options: q.options || [] }))
          : DEFAULT_EVAL_QUESTIONS.map((q) => ({ ...q, _key: newEvalKey() }))
      );
      setEvalOn(qs.length > 0);
      setEvalQuestionsLoaded(true);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id]);

  function addEvalQuestion(type) {
    setEvalQuestions((qs) => [...qs, { _key: newEvalKey(), type, label: '', required: true, options: type === 'choice' ? ['', ''] : [] }]);
  }
  function removeEvalQuestion(key) {
    setEvalQuestions((qs) => qs.filter((q) => q._key !== key));
  }
  function updateEvalQuestion(key, patch) {
    setEvalQuestions((qs) => qs.map((q) => (q._key === key ? { ...q, ...patch } : q)));
  }
  function setEvalQuestionType(key, type) {
    setEvalQuestions((qs) => qs.map((q) => (q._key === key ? { ...q, type, options: type === 'choice' ? (q.options.length ? q.options : ['', '']) : q.options } : q)));
  }
  function updateEvalOption(key, index, value) {
    setEvalQuestions((qs) => qs.map((q) => (q._key === key ? { ...q, options: q.options.map((o, i) => (i === index ? value : o)) } : q)));
  }
  function addEvalOption(key) {
    setEvalQuestions((qs) => qs.map((q) => (q._key === key ? { ...q, options: [...q.options, ''] } : q)));
  }
  function removeEvalOption(key, index) {
    setEvalQuestions((qs) => qs.map((q) => (q._key === key ? { ...q, options: q.options.filter((_, i) => i !== index) } : q)));
  }

  const previewDate = useMemo(() => {
    if (dayMode === 'single' && dateIso) return formatThaiDate(dateIso);
    if (dayMode === 'multi' && eventDates.length > 0) return formatThaiDateList(eventDates);
    return 'ยังไม่ระบุวันที่';
  }, [dayMode, dateIso, eventDates]);

  // Last day of the event — registration can't run past it.
  // Past days cannot be picked. When editing, a date the event already has
  // stays allowed, so an old event can still be saved without moving it.
  const today = todayIso();
  const minFor = (original) => (original && original < today ? original : today);
  const eventLastIso = dayMode === 'multi' ? (eventDates[eventDates.length - 1] || '') : dateIso;
  const previewRegPeriod = formatRegPeriod(regStartIso, regEndIso);

  const previewPlace = useMemo(() => {
    if (attendMode === 'online') return onlineLink ? 'ออนไลน์' : 'ยังไม่ระบุลิงก์';
    if (attendMode === 'hybrid') return place ? `${place} + ออนไลน์` : 'ยังไม่ระบุสถานที่';
    return place || 'ยังไม่ระบุสถานที่';
  }, [attendMode, place, onlineLink]);

  const previewCap = attendMode === 'hybrid' ? (parseInt(capOnsite, 10) || 0) + (parseInt(capOnline, 10) || 0) : (parseInt(cap, 10) || 0);

  const checklist = [
    { label: 'ชื่อกิจกรรมและรายละเอียด', done: !!(title && desc) },
    { label: 'กำหนดวันที่และรูปแบบเข้าร่วม', done: !!previewDate && previewDate !== 'ยังไม่ระบุวันที่' && previewCap > 0 },
    { label: 'อัปโหลดโปสเตอร์กิจกรรม', done: !!poster },
    { label: issueCert ? 'ตั้งค่าเกียรติบัตร (ผู้ลงนาม)' : 'เกียรติบัตร (ไม่ออก)', done: !issueCert || !!(signerName && signerTitle) },
  ];

  const [confirmOpen, setConfirmOpen] = useState(false);

  // The first thing in the way of publishing, as { key, msg } (key = the
  // data-field of the box to fix), or null. Pure, so it can run on every render
  // once a publish was tried and keep the red box on what is still missing.
  function findProblem() {
    const at = (key, msg) => ({ key, msg });
    if (!poster) return at('poster', 'กรุณาอัปโหลดโปสเตอร์กิจกรรม');
    if (!title.trim()) return at('title', 'กรุณาระบุชื่อกิจกรรม');
    if (!desc.trim()) return at('desc', 'กรุณาระบุรายละเอียดกิจกรรม');
    if (!cat) return at('cat', 'กรุณาเลือกประเภทกิจกรรม');
    if (Number.isNaN(budgetPlanned)) return at('budget', BUDGET_ERROR);
    if (Number.isNaN(budgetOther)) return at('budgetOther', BUDGET_ERROR);
    if (dayMode === 'single' && !dateIso) return at('date', 'กรุณาเลือกวันที่จัดกิจกรรม');
    if (dayMode === 'single' && timeStart && timeEnd && timeEnd <= timeStart) return at('timeEnd', 'เวลาสิ้นสุดต้องหลังเวลาเริ่ม');
    if (dayMode === 'multi' && eventDates.length < 2) return at('date', 'กิจกรรมแบบหลายวันต้องเลือกอย่างน้อย 2 วัน');
    if (dayMode === 'multi') {
      const missing = eventDates.find((d) => !dayTimes[d]?.start || !dayTimes[d]?.end);
      if (missing) return at('date', `กรุณาระบุเวลาเริ่มและสิ้นสุดของวันที่ ${formatThaiDate(missing)}`);
      const backwards = eventDates.find((d) => dayTimes[d].end <= dayTimes[d].start);
      if (backwards) return at('date', `เวลาสิ้นสุดของวันที่ ${formatThaiDate(backwards)} ต้องหลังเวลาเริ่ม`);
    }
    // Typing a date by hand gets past the picker's limit, so check again here.
    const originalDates = editing ? [editing.dateStart, ...(editing.dates || []), editing.regStart, editing.regEnd] : [];
    const isPast = (d) => !!d && d < today && !originalDates.includes(d);
    if (isPast(dayMode === 'single' ? dateIso : eventDates.find(isPast))) return at('date', 'ไม่สามารถเลือกวันที่ผ่านมาแล้วได้');
    if ((!editing || regStartIso || regEndIso) && !regStartIso) return at('regStart', 'กรุณาเลือกวันเปิดรับสมัคร');
    if ((!editing || regStartIso || regEndIso) && !regEndIso) return at('regEnd', 'กรุณาเลือกวันปิดรับสมัคร');
    if (isPast(regStartIso)) return at('regStart', 'ไม่สามารถเลือกวันที่ผ่านมาแล้วได้');
    if (isPast(regEndIso)) return at('regEnd', 'ไม่สามารถเลือกวันที่ผ่านมาแล้วได้');
    if (regStartIso && regEndIso && regEndIso < regStartIso) return at('regEnd', 'วันปิดรับสมัครต้องไม่ก่อนวันเปิดรับสมัคร');
    if (regEndIso && eventLastIso && regEndIso > eventLastIso) return at('regEnd', 'วันปิดรับสมัครต้องไม่เกินวันจัดกิจกรรม');
    if (attendMode !== 'online' && !place.trim()) return at('place', 'กรุณาระบุสถานที่จัดกิจกรรม');
    // Seats: whole numbers, and never fewer than the people already registered.
    const seats = (v) => (/^\d+$/.test(String(v).trim()) ? parseInt(v, 10) : NaN);
    if (attendMode === 'hybrid') {
      const on = seats(capOnsite);
      const ol = seats(capOnline);
      if (!(on >= MIN_SEATS)) return at('capOnsite', `กรุณาระบุจำนวนที่รับ Onsite เป็นจำนวนเต็มตั้งแต่ ${MIN_SEATS} ขึ้นไป`);
      if (!(ol >= MIN_SEATS)) return at('capOnline', `กรุณาระบุจำนวนที่รับ Online เป็นจำนวนเต็มตั้งแต่ ${MIN_SEATS} ขึ้นไป`);
      if (editing && on < editing.regOnsite) return at('capOnsite', `มีผู้สมัครแบบ Onsite แล้ว ${editing.regOnsite} คน จึงลดต่ำกว่านี้ไม่ได้`);
      if (editing && ol < editing.regOnline) return at('capOnline', `มีผู้สมัครแบบ Online แล้ว ${editing.regOnline} คน จึงลดต่ำกว่านี้ไม่ได้`);
    } else {
      const n = seats(cap);
      if (!(n >= MIN_SEATS)) return at('cap', `กรุณาระบุจำนวนที่รับเป็นจำนวนเต็มตั้งแต่ ${MIN_SEATS} ขึ้นไป`);
      if (editing && n < editing.reg) return at('cap', `มีผู้สมัครแล้ว ${editing.reg} คน จึงลดจำนวนที่รับต่ำกว่านี้ไม่ได้`);
    }
    if (attendMode !== 'onsite' && !onlineLink.trim()) return at('link', 'กรุณาระบุลิงก์เข้าร่วมออนไลน์');
    if (attendMode !== 'onsite' && !/^https?:\/\/\S+$/i.test(onlineLink.trim())) return at('link', 'ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://');
    if (feeOn && !(feeValue > 0)) return at('fee', 'กรอกจำนวนเงินมากกว่า 0 หรือปิดสวิตช์หากไม่มีค่าใช้จ่าย');
    if (feeOn && !paymentInfo.trim()) return at('payinfo', 'บอกผู้สมัครว่าต้องชำระอย่างไร เช่น เลขบัญชีหรือพร้อมเพย์');
    if (prepOn && loanAvailable && loanQtyInvalid) return at('loan', 'กรอกเป็นจำนวนเต็ม 0–1000 เครื่อง');
    if (prepOn && loanAvailable && loanQty < loanTaken) return at('loan', `มีผู้ขอยืมแล้ว ${loanTaken} เครื่อง จึงลดต่ำกว่านี้ไม่ได้`);
    return null;
  }

  // After a publish was tried, the box still in the way is outlined in red
  // with what to do written under it; fixing it moves the red box to the next.
  const [triedPublish, setTriedPublish] = useState(false);
  const problem = triedPublish ? findProblem() : null;
  const errCls = (key) => (problem?.key === key ? ' has-error' : '');
  const errMsg = (key) => (problem?.key === key ? <span className="field-error" role="alert"><i className="ti ti-alert-circle" /> {problem.msg}</span> : null);

  function handlePublish() {
    const found = findProblem();
    if (found) {
      setTriedPublish(true);
      // Take the person to the box to fix: scroll it into the middle of the screen and put the cursor in it.
      const box = document.querySelector(`[data-field="${found.key}"]`);
      if (box) {
        box.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => box.querySelector('input, textarea, select, button')?.focus({ preventScroll: true }), 350);
      }
      return;
    }
    setConfirmOpen(true);
  }

  const [publishing, setPublishing] = useState(false);

  function buildPayload() {
    return {
      title, desc, cat, org,
      dayMode, attendMode,
      // Keep the stored time only when the day mode is unchanged — a multi-day
      // summary ("เวลาต่างกันในแต่ละวัน") must not carry over to a single day.
      time: time || (editing?.dayMode === dayMode ? editing.time : '') || '-',
      place: attendMode === 'online' ? 'ออนไลน์' : place, // "+ ออนไลน์" is added when shown, never stored
      cap: previewCap,
      budgetPlanned,
      budgetOther,
      // Switched off = not used for this event, so nothing from it is saved.
      attendeeNote: prepOn ? attendeeNote : '',
      loanQty: prepOn && loanAvailable ? loanQty : 0,
      askDietary,
      issueCert,
      fee: feeOn && feeValue > 0 ? feeValue : 0,
      paymentInfo: feeOn ? paymentInfo : '',
      refundMethod: feeOn ? refundMethod : 'none',
      refundNote: feeOn ? refundNote : '',
      capOnsite: attendMode === 'hybrid' ? parseInt(capOnsite, 10) || 0 : undefined,
      capOnline: attendMode === 'hybrid' ? parseInt(capOnline, 10) || 0 : undefined,
      onlineLink: attendMode !== 'onsite' ? onlineLink.trim() : undefined,
      poster,
      certTemplate,
      pretest: { enabled: pretestOn, link: pretestLink },
      signer: { name: signerName, title: signerTitle, signature: signatureOn ? signature : null },
      certLayout: certTemplate ? certLayout : null,
      dateIso: (dayMode === 'multi' ? eventDates[0] : dateIso) || undefined,
      dateEndIso: dayMode === 'multi' ? eventDates[eventDates.length - 1] : undefined,
      eventDates: dayMode === 'multi' ? eventDates : [],
      eventTimes: dayMode === 'multi' ? eventTimes : [],
      regStartIso, regEndIso,
    };
  }

  // Leaving with unsaved edits asks first. The baseline is taken at the first
  // key press or click in the form, once everything loaded has settled in.
  const baseline = useRef(null);
  const snapshot = () => JSON.stringify([buildPayload(), evalOn, evalQuestions]);
  const markBaseline = () => { if (baseline.current === null) baseline.current = snapshot(); };
  const isDirty = () => baseline.current !== null && !publishing && snapshot() !== baseline.current;
  const dirtyRef = useRef(isDirty);
  dirtyRef.current = isDirty;
  useEffect(() => {
    const warn = (e) => { if (dirtyRef.current()) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);
  const [leaveAsk, setLeaveAsk] = useState(false);
  function handleCancel() {
    if (isDirty()) setLeaveAsk(true);
    else navigate(-1);
  }

  async function doPublish() {
    const payload = buildPayload();
    setPublishing(true);
    try {
      // One "working…" pop-up from the first step to the last, then the result.
      await withProgress(async () => {
        let eventId = editing?.id;
        if (editing) await updateEvent(editing.id, payload);
        else {
          const created = await createEvent(payload);
          eventId = created?.id;
        }
        // Only write when the section is switched on — "off" just hides the
        // builder, it must never silently wipe questions saved in an earlier
        // session (e.g. from opening the edit form with the toggle off).
        if (eventId && evalQuestionsLoaded && evalOn && !evalLocked) {
          try {
            const questions = evalQuestions
              .filter((q) => q.label.trim())
              .map((q) => ({ label: q.label.trim(), type: q.type, required: q.required, options: q.type === 'choice' ? q.options.map((o) => o.trim()).filter(Boolean) : [] }));
            await saveEventEvalQuestions(eventId, questions);
          } catch (err) {
            pushToast('บันทึกแบบประเมินไม่สำเร็จ', err.message, 'warn');
          }
        }
      });
      setConfirmOpen(false);
      navigate(session?.role === 'admin' ? '/admin/dashboard' : '/home');
    } catch {
      setConfirmOpen(false);
    } finally {
      setPublishing(false);
    }
  }

  const sm = STATUS_META.open;

  // The event as a student would see it, built from what is in the form right
  // now — fed to the real detail modal in preview mode, so the preview can
  // never drift from the actual screen.
  const previewEvent = {
    id: 0,
    title: title || 'ชื่อกิจกรรมของคุณ',
    desc,
    cat: cat || 'ประเภทกิจกรรม',
    date: previewDate,
    time: time || 'ยังไม่ระบุเวลา',
    place: previewPlace,
    cap: previewCap || 0,
    reg: 0,
    capOnsite: parseInt(capOnsite, 10) || 0,
    capOnline: parseInt(capOnline, 10) || 0,
    regOnsite: 0,
    regOnline: 0,
    status: 'open',
    stage: 1,
    org: org || '-',
    poster,
    regPeriod: previewRegPeriod,
    attendMode,
    placeRaw: attendMode === 'online' ? '' : place,
    hasOnlineLink: attendMode !== 'onsite' && !!onlineLink.trim(),
    onlineLink: '', // a student who hasn't registered yet doesn't get the link
    schedule: dayMode === 'multi' ? eventDates.map((d, i) => ({ date: d, label: formatThaiDate(d), time: formatDayTime(eventTimes[i]) })).filter((d) => d.time) : [],
    attendeeNote: prepOn ? attendeeNote.trim() : '',
    loanQty: prepOn && loanAvailable && !loanQtyInvalid ? loanQty : 0,
    loanLeft: prepOn && loanAvailable && !loanQtyInvalid ? Math.max(0, loanQty - loanTaken) : 0,
    askDietary,
    issueCert,
    fee: feeOn && feeValue > 0 ? feeValue : 0,
    paymentInfo: feeOn ? paymentInfo.trim() : '',
    refundMethod: feeOn ? refundMethod : 'none',
    refundNote: feeOn ? refundNote.trim() : '',
  };

  return (
    <div>
      <div className="page-header">
        <div className="ph-inner">
          <div>
            <h1>{editing ? 'แก้ไขกิจกรรม' : 'สร้างกิจกรรมใหม่'}</h1>
            <p>กรอกรายละเอียด อัปโหลดโปสเตอร์ กำหนดวัน-เวลา และตั้งค่าพรีเทสและเกียรติบัตรในหน้าเดียว</p>
          </div>
        </div>
      </div>

      <div className="wrap ce-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 28, alignItems: 'flex-start', paddingTop: 30 }}>
        <div className="ce-main" onKeyDownCapture={markBaseline} onPointerDownCapture={markBaseline}>
          <div className="form-card">
            <h2><span className="fc-num">1</span> โปสเตอร์กิจกรรม <span className="req">*</span></h2>
            <p className="fc-sub">ภาพประกาศสัมพันธ์ที่จะแสดงบนการ์ดกิจกรรมและหน้ารายละเอียด · ต้องอัปโหลดก่อนเผยแพร่</p>
            <div className={`field${errCls('poster')}`} data-field="poster">
              <PosterUpload value={poster} onChange={setPoster} />
              {errMsg('poster')}
            </div>
          </div>

          <div className="form-card">
            <h2><span className="fc-num">2</span> ข้อมูลกิจกรรม</h2>
            <p className="fc-sub">รายละเอียดหลักที่จะแสดงในหน้ารายการและรายละเอียดกิจกรรม</p>
            <div className="form-row full">
              <div className={`field${errCls('title')}`} data-field="title">
                <label htmlFor="ce-title">ชื่อกิจกรรม <span className="req">*</span></label>
                <input id="ce-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} aria-invalid={problem?.key === 'title'} />
                {errMsg('title') || <span className="helper budget-hint"><i className="ti ti-info-circle" /> เช่น Python for Data Science: จาก Zero สู่ Pandas</span>}
              </div>
            </div>
            <div className="form-row full">
              <div className={`field${errCls('desc')}`} data-field="desc">
                <label htmlFor="ce-desc">รายละเอียด <span className="req">*</span></label>
                <textarea id="ce-desc" value={desc} onChange={(e) => setDesc(e.target.value)} aria-invalid={problem?.key === 'desc'} />
                {errMsg('desc') || <span className="helper budget-hint"><i className="ti ti-info-circle" /> อธิบายเนื้อหา กลุ่มเป้าหมาย และสิ่งที่ผู้เข้าร่วมจะได้รับ</span>}
              </div>
            </div>
            <div className="form-row">
              <div className={`field${errCls('cat')}`} data-field="cat">
                <label>ประเภทกิจกรรม <span className="req">*</span></label>
                {addingCat ? (
                  <span className="cat-add-input">
                    <i className="ti ti-category" />
                    <input
                      autoFocus
                      type="text"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); addCategory(); }
                        if (e.key === 'Escape') { setAddingCat(false); setNewCatName(''); }
                      }}
                      placeholder="ชื่อประเภทใหม่"
                    />
                    <button type="button" className="cat-add-confirm" onClick={addCategory}><i className="ti ti-check" /></button>
                    <button type="button" className="cat-add-cancel" onClick={() => { setAddingCat(false); setNewCatName(''); }}><i className="ti ti-x" /></button>
                  </span>
                ) : (
                  <div className="with-icon">
                    <i className="ti ti-category" />
                    <select
                      value={cat}
                      onChange={(e) => {
                        if (e.target.value === '__add__') setAddingCat(true);
                        else setCat(e.target.value);
                      }}
                    >
                      <option value="" disabled hidden>โปรดเลือกประเภทกิจกรรม</option>
                      {catOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                      <option value="__add__">+ เพิ่มประเภทใหม่...</option>
                    </select>
                  </div>
                )}
                {errMsg('cat')}
              </div>
              <div className="field">
                <label>อาจารย์ผู้ประสานงาน</label>
                <div className="with-icon">
                  <i className="ti ti-user-cog" />
                  <select value={org} onChange={(e) => setOrg(e.target.value)}>
                    <option value="" disabled hidden>เลือกอาจารย์ผู้ประสานงาน</option>
                    {org && !COORDINATOR_OPTIONS.includes(org) && <option value={org}>{org}</option>}
                    {COORDINATOR_OPTIONS.map((name) => <option key={name} value={name}>{name}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="form-row three" style={{ marginBottom: 6 }}>
              <div className={`field${errCls('budget')}`} data-field="budget">
                <label htmlFor="ce-budget">งบประมาณเงินรายได้ (บาท)</label>
                <div className="with-icon">
                  <i className="ti ti-currency-baht" />
                  <input id="ce-budget" type="text" inputMode="decimal" value={budgetText} onChange={(e) => setBudgetText(e.target.value)} aria-invalid={Number.isNaN(budgetPlanned)} />
                </div>
                {Number.isNaN(budgetPlanned) ? <span className="field-error" role="alert"><i className="ti ti-alert-circle" /> {BUDGET_ERROR}</span> : null}
              </div>
              <div className={`field${errCls('budgetOther')}`} data-field="budgetOther">
                <label htmlFor="ce-budget-other">งบประมาณแหล่งอื่น (บาท)</label>
                <div className="with-icon">
                  <i className="ti ti-currency-baht" />
                  <input id="ce-budget-other" type="text" inputMode="decimal" value={budgetOtherText} onChange={(e) => setBudgetOtherText(e.target.value)} aria-invalid={Number.isNaN(budgetOther)} />
                </div>
                {Number.isNaN(budgetOther) ? <span className="field-error" role="alert"><i className="ti ti-alert-circle" /> {BUDGET_ERROR}</span> : null}
              </div>
              <div className="field">
                <label>รวม (บาท)</label>
                <div className="budget-total" aria-live="polite">{budgetTotalText}</div>
              </div>
            </div>
            <span className="helper budget-hint"><i className="ti ti-info-circle" /> หากไม่มีงบประมาณจากแหล่งใด ให้ใส่ - หรือ 0</span>
          </div>

          <div className="form-card">
            <h2><span className="fc-num">3</span> วันเวลาและสถานที่</h2>
            <p className="fc-sub">กำหนดรูปแบบวัน (วันเดียวหรือหลายวัน) เวลา ระยะเวลารับสมัคร สถานที่ และจำนวนที่รับ · แบบหลายวันกำหนดเวลาแยกแต่ละวันได้</p>

            <div className="day-mode-pick">
              <label className={`dm-opt${dayMode === 'single' ? ' active' : ''}`}><input type="radio" checked={dayMode === 'single'} onChange={() => changeDayMode('single')} /><i className="ti ti-calendar-event" /> วันเดียว</label>
              <label className={`dm-opt${dayMode === 'multi' ? ' active' : ''}`}><input type="radio" checked={dayMode === 'multi'} onChange={() => changeDayMode('multi')} /><i className="ti ti-calendar-week" /> หลายวัน</label>
            </div>

            {dayMode === 'multi' && (
              <div className="form-row full">
                <div className={`field${errCls('date')}`} data-field="date">
                  <label>วันที่จัด <span className="req">*</span></label>
                  <MultiDatePicker value={eventDates} onChange={setEventDates} times={dayTimes} onTimesChange={setDayTimes} minDate={today} />
                  {errMsg('date')}
                </div>
              </div>
            )}

            {dayMode === 'single' && (
              <div className="form-row three">
                <div className={`field${errCls('date')}`} data-field="date">
                  <label>วันที่จัด <span className="req">*</span></label>
                  <DateInput value={dateIso} min={minFor(editing?.dateStart)} onChange={setDateIso} icon="ti-calendar-event" aria-label="วันที่จัดกิจกรรม" />
                  {errMsg('date')}
                </div>
                <div className="field">
                  <label>จากเวลา <span className="req">*</span></label>
                  <TimeInput value={timeStart} onChange={setTimeStart} placeholder="เลือกเวลาเริ่ม" aria-label="จากเวลา" />
                </div>
                <div className={`field${errCls('timeEnd')}`} data-field="timeEnd">
                  <label>ถึงเวลา <span className="req">*</span></label>
                  <TimeInput value={timeEnd} onChange={setTimeEnd} placeholder="เลือกเวลาสิ้นสุด" aria-label="ถึงเวลา" />
                  {errMsg('timeEnd')}
                </div>
              </div>
            )}
            {dayMode === 'multi' && eventDates.length > 0 && <span className="dm-days-hint"><i className="ti ti-info-circle" /> จัด {eventDates.length} วัน · {formatThaiDateList(eventDates)}</span>}
            {dayMode === 'single' && editing?.dayMode === 'single' && !timeStart && editing.time && <span className="dm-days-hint"><i className="ti ti-info-circle" /> เว้นว่างไว้เพื่อคงเวลาเดิม: {editing.time}</span>}

            <div className="form-row">
              <div className={`field${errCls('regStart')}`} data-field="regStart">
                <label>เปิดรับสมัคร {!editing && <span className="req">*</span>}</label>
                <DateInput value={regStartIso} min={minFor(editing?.regStart)} max={regEndIso || eventLastIso || undefined} onChange={setRegStartIso} icon="ti-calendar-plus" aria-label="วันเปิดรับสมัคร" />
                {errMsg('regStart')}
              </div>
              <div className={`field${errCls('regEnd')}`} data-field="regEnd">
                <label>ปิดรับสมัคร {!editing && <span className="req">*</span>}</label>
                <DateInput value={regEndIso} min={regStartIso > minFor(editing?.regEnd) ? regStartIso : minFor(editing?.regEnd)} max={eventLastIso || undefined} onChange={setRegEndIso} icon="ti-calendar-x" aria-label="วันปิดรับสมัคร" />
                {errMsg('regEnd')}
              </div>
            </div>
            <span className="dm-days-hint"><i className="ti ti-info-circle" /> {previewRegPeriod ? `รับสมัคร ${previewRegPeriod} · ` : ''}ระบบเปิดและปิดรับสมัครให้อัตโนมัติตามวันที่กำหนด</span>

            <div className="attend-mode-pick">
              <label className={`dm-opt${attendMode === 'onsite' ? ' active' : ''}`}><input type="radio" checked={attendMode === 'onsite'} onChange={() => setAttendMode('onsite')} /><i className="ti ti-building" /> Onsite เท่านั้น</label>
              <label className={`dm-opt${attendMode === 'online' ? ' active' : ''}`}><input type="radio" checked={attendMode === 'online'} onChange={() => setAttendMode('online')} /><i className="ti ti-broadcast" /> Online เท่านั้น</label>
              <label className={`dm-opt${attendMode === 'hybrid' ? ' active' : ''}`}><input type="radio" checked={attendMode === 'hybrid'} onChange={() => setAttendMode('hybrid')} /><i className="ti ti-devices" /> Onsite + Online</label>
            </div>

            <div className="form-row">
              {attendMode !== 'online' && (
                <div className={`field${errCls('place')}`} data-field="place"><label>สถานที่ <span className="req">*</span></label><div className="with-icon"><i className="ti ti-map-pin" /><input type="text" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="ระบุอาคารและห้องที่จัดกิจกรรม" /></div>{errMsg('place')}</div>
              )}
              {attendMode !== 'hybrid' && (
                <div className={`field${errCls('cap')}`} data-field="cap"><label>จำนวนที่รับ <span className="req">*</span></label><div className="with-icon"><i className="ti ti-users" /><input type="number" min={Math.max(MIN_SEATS, editing?.reg || 0)} step="1" value={cap} onChange={(e) => setCap(e.target.value)} placeholder="ระบุจำนวนที่รับทั้งหมด" /></div>{errMsg('cap')}</div>
              )}
            </div>
            {attendMode === 'hybrid' && (
              <div className="form-row">
                <div className={`field${errCls('capOnsite')}`} data-field="capOnsite"><label><i className="ti ti-building" style={{ fontSize: 14, verticalAlign: -2, color: 'var(--c2)' }} /> จำนวน Onsite <span className="req">*</span></label><div className="with-icon"><i className="ti ti-users" /><input type="number" min={Math.max(MIN_SEATS, editing?.regOnsite || 0)} step="1" value={capOnsite} onChange={(e) => setCapOnsite(e.target.value)} placeholder="ระบุจำนวนที่รับ Onsite" /></div>{errMsg('capOnsite')}</div>
                <div className={`field${errCls('capOnline')}`} data-field="capOnline"><label><i className="ti ti-broadcast" style={{ fontSize: 14, verticalAlign: -2, color: 'var(--c1)' }} /> จำนวน Online <span className="req">*</span></label><div className="with-icon"><i className="ti ti-users" /><input type="number" min={Math.max(MIN_SEATS, editing?.regOnline || 0)} step="1" value={capOnline} onChange={(e) => setCapOnline(e.target.value)} placeholder="ระบุจำนวนที่รับ Online" /></div>{errMsg('capOnline')}</div>
              </div>
            )}
            {attendMode !== 'onsite' && (
              <div className={`field${errCls('link')}`} data-field="link" style={{ marginTop: 2 }}>
                <label>ลิงก์เข้าร่วมออนไลน์ <span className="req">*</span></label>
                <div className="with-icon"><i className="ti ti-link" /><input type="text" value={onlineLink} onChange={(e) => setOnlineLink(e.target.value)} /></div>
                {errMsg('link') || <span className="helper budget-hint"><i className="ti ti-info-circle" /> เช่น https://meet.google.com/... หรือ https://zoom.us/j/...</span>}
                <span className="helper budget-hint"><i className="ti ti-lock" /> แสดงเฉพาะนักศึกษาที่ลงทะเบียนกิจกรรมนี้แล้วเท่านั้น</span>
              </div>
            )}
          </div>

          <div className="form-card setup-card">
            <div className="setup-head">
              <div className="setup-head-text">
                <h2><span className="fc-num">4</span> ค่าลงทะเบียน</h2>
                <p className="fc-sub">{feeOn ? 'กิจกรรมนี้มีค่าลงทะเบียน · ผู้สมัครอยู่สถานะ "รอชำระเงิน" จนกว่าคุณจะยืนยันในรายชื่อผู้สมัคร' : 'กิจกรรมนี้ไม่มีค่าใช้จ่าย · เปิดสวิตช์หากต้องชำระค่าลงทะเบียน'}</p>
              </div>
              <button type="button" className={`switch${feeOn ? ' on' : ''}`} onClick={() => setFeeOn((o) => !o)} role="switch" aria-checked={feeOn} aria-label="กิจกรรมนี้มีค่าลงทะเบียน" title="เปิด/ปิดค่าลงทะเบียน" />
            </div>
            {feeOn && (
              <div>
                <div className="form-row">
                  <div className={`field${errCls('fee')}`} data-field="fee">
                    <label htmlFor="ce-fee">ค่าลงทะเบียนต่อคน (บาท) <span className="req">*</span></label>
                    <div className="with-icon">
                      <i className="ti ti-currency-baht" />
                      <input id="ce-fee" type="text" inputMode="decimal" value={feeText} onChange={(e) => setFeeText(e.target.value)} aria-invalid={Number.isNaN(feeValue)} />
                    </div>
                    {Number.isNaN(feeValue) ? <span className="field-error" role="alert"><i className="ti ti-alert-circle" /> {BUDGET_ERROR}</span> : errMsg('fee')}
                  </div>
                </div>
                <div className="form-row full" style={{ marginBottom: 0 }}>
                  <div className={`field${errCls('payinfo')}`} data-field="payinfo">
                    <label htmlFor="ce-payinfo">วิธีชำระเงิน <span className="req">*</span></label>
                    <textarea id="ce-payinfo" value={paymentInfo} maxLength={500} onChange={(e) => setPaymentInfo(e.target.value)} style={{ minHeight: 84 }} />
                    {errMsg('payinfo') || <span className="helper budget-hint"><i className="ti ti-info-circle" /> เช่น โอนเข้าบัญชี ธ.กรุงไทย 123-4-56789-0 ชื่อบัญชี ภาควิชาคอมพิวเตอร์ หรือพร้อมเพย์ 08x-xxx-xxxx · ชำระภายใน 3 วันหลังสมัคร</span>}
                    <span className="helper budget-hint"><i className="ti ti-info-circle" /> แสดงให้ผู้สมัครเห็นในรายละเอียดกิจกรรมและตอนยืนยันการสมัคร · ระบบไม่ได้รับชำระเงินเอง คุณเป็นผู้ตรวจและกด "ยืนยันชำระเงิน" ในรายชื่อผู้สมัคร</span>
                  </div>
                </div>
                <div className="form-row full" style={{ marginTop: 14, marginBottom: 0 }}>
                  <div className="field">
                    <label>การคืนเงิน</label>
                    <div className="attend-mode-pick" role="radiogroup" aria-label="การคืนเงิน">
                      {Object.entries(REFUND_METHODS).map(([key, m]) => (
                        <label key={key} className={`dm-opt${refundMethod === key ? ' active' : ''}${key === 'none' && refundLocked ? ' disabled' : ''}`} title={key === 'none' && refundLocked ? 'มีผู้ชำระเงินแล้วโดยแจ้งว่าจะได้เงินคืน' : m.hint}>
                          <input type="radio" name="refund-method" checked={refundMethod === key} disabled={key === 'none' && refundLocked} onChange={() => setRefundMethod(key)} />
                          <i className={`ti ${m.icon}`} /> {m.label}
                        </label>
                      ))}
                    </div>
                    <span className="helper budget-hint"><i className="ti ti-info-circle" /> {REFUND_METHODS[refundMethod].hint} · แก้ไขทีหลังได้ ผู้ที่ชำระแล้วจะได้รับแจ้งเตือน{refundLocked ? ' · มีผู้ชำระเงินแล้ว จึงเปลี่ยนเป็น "ไม่คืนเงิน" ไม่ได้' : ''}</span>
                  </div>
                </div>
                {refundMethod !== 'none' && (
                  <div className="form-row full" style={{ marginBottom: 0 }}>
                    <div className="field">
                      <label htmlFor="ce-refundnote">รายละเอียดการคืนเงิน</label>
                      <textarea id="ce-refundnote" value={refundNote} maxLength={300} onChange={(e) => setRefundNote(e.target.value)} style={{ minHeight: 64 }}
                        placeholder={refundMethod === 'department' ? 'เช่น คืนมัดจำตอนลงทะเบียนหน้างาน · ไม่มาร่วมกิจกรรมไม่คืนมัดจำ' : 'เช่น โอนคืนภายใน 7 วันหลังจบกิจกรรม'} />
                      <span className="helper budget-hint"><i className="ti ti-info-circle" /> ไม่บังคับ · บอกว่าคืนเมื่อไร ที่ไหน และเงื่อนไข เช่น ไม่มาร่วมไม่คืนมัดจำ</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="form-card setup-card">
            <div className="setup-head">
              <div className="setup-head-text">
                <h2><span className="fc-num">5</span> สิ่งที่ผู้เข้าร่วมต้องเตรียม</h2>
                <p className="fc-sub">{prepOn ? 'แจ้งสิ่งที่ต้องนำมา และจำนวนโน้ตบุ๊กที่มีให้ยืม · ปิดสวิตช์หากกิจกรรมนี้ไม่ต้องใช้' : 'ไม่บังคับ · เปิดใช้เมื่อผู้เข้าร่วมต้องเตรียมหรือนำอุปกรณ์มาเอง เช่น โน้ตบุ๊ก'}</p>
              </div>
              <button type="button" className={`switch${prepOn ? ' on' : ''}`} onClick={togglePrep} role="switch" aria-checked={prepOn} aria-label="ใช้ส่วนสิ่งที่ผู้เข้าร่วมต้องเตรียม" title="เปิด/ปิดส่วนสิ่งที่ผู้เข้าร่วมต้องเตรียม" />
            </div>
            {prepOn && (
              <div>
                <div className="form-row full">
                  <div className="field">
                    <label htmlFor="ce-note">ข้อความถึงผู้เข้าร่วม</label>
                    <textarea id="ce-note" value={attendeeNote} maxLength={NOTE_MAX} onChange={(e) => setAttendeeNote(e.target.value)} style={{ minHeight: 64 }} />
                    <span className="helper budget-hint"><i className="ti ti-info-circle" /> เช่น ให้นำโน้ตบุ๊กส่วนตัวมาด้วย</span>
                    <div className="note-presets">
                      {presetDeleting ? (
                        <>
                          {presets.map((t) => {
                            const picked = presetDeleting.includes(t);
                            return (
                              <button type="button" key={t} className={`note-preset pick${picked ? ' picked' : ''}`} onClick={() => togglePresetPick(t)} aria-pressed={picked} title={picked ? 'กดเพื่อไม่ลบ' : 'กดเพื่อเลือกลบ'}>
                                <i className={`ti ${picked ? 'ti-square-check' : 'ti-square'}`} /> {t}
                              </button>
                            );
                          })}
                          <button type="button" className="note-preset danger" onClick={deletePickedPresets} disabled={presetDeleting.length === 0}><i className="ti ti-trash" /> ลบที่เลือก{presetDeleting.length > 0 ? ` (${presetDeleting.length})` : ''}</button>
                          <button type="button" className="note-preset" onClick={() => setPresetDeleting(null)}>ยกเลิก</button>
                        </>
                      ) : (
                        <>
                          {presets.map((t) => {
                            const used = attendeeNote.includes(t);
                            return (
                              <button type="button" key={t} className={`note-preset${used ? ' on' : ''}`} onClick={() => toggleNotePreset(t)} aria-pressed={used} title={used ? 'กดเพื่อเอาออกจากข้อความ' : 'กดเพื่อเพิ่มลงในข้อความ'}>
                                <i className={`ti ${used ? 'ti-x' : 'ti-plus'}`} /> {t}
                              </button>
                            );
                          })}
                          {presetDraft === null ? (
                            presets.length < MAX_PRESETS && (
                              <button type="button" className="note-preset add" onClick={() => setPresetDraft('')} title="สร้างข้อความด่วนของคุณเอง ใช้ซ้ำได้ในกิจกรรมถัดไป">
                                <i className="ti ti-plus" /> เพิ่มข้อความด่วน
                              </button>
                            )
                          ) : (
                            <span className="note-preset-form">
                              <input
                                type="text"
                                autoFocus
                                value={presetDraft}
                                maxLength={CUSTOM_PRESET_MAX}
                                onChange={(e) => setPresetDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') { e.preventDefault(); addCustomPreset(); }
                                  if (e.key === 'Escape') setPresetDraft(null);
                                }}
                                aria-label="ข้อความด่วนใหม่"
                                aria-invalid={presetDraftDup}
                              />
                              <button type="button" className="note-preset on" onClick={addCustomPreset} disabled={!presetDraftTrim || presetDraftDup}><i className="ti ti-check" /> บันทึก</button>
                              <button type="button" className="note-preset" onClick={() => setPresetDraft(null)}>ยกเลิก</button>
                              {presetDraftDup && <span className="field-error"><i className="ti ti-alert-circle" /> มีข้อความนี้อยู่แล้ว</span>}
                            </span>
                          )}
                          {presets.length > 0 && presetDraft === null && (
                            <button type="button" className="note-preset-del" onClick={() => setPresetDeleting([])} title="เลือกข้อความด่วนที่จะลบ" aria-label="ลบข้อความด่วน"><i className="ti ti-trash" /></button>
                          )}
                        </>
                      )}
                      <span className="helper" style={{ marginLeft: 'auto' }}>{attendeeNote.length}/{NOTE_MAX}</span>
                    </div>
                    <span className="helper budget-hint"><i className="ti ti-info-circle" /> แสดงในหน้ารายละเอียดกิจกรรม ตอนยืนยันการสมัคร และในการแจ้งเตือนหลังลงทะเบียน</span>
                  </div>
                </div>
                {loanAvailable ? (
                    <div className="form-row">
                      <div className="field" data-field="loan">
                        <label htmlFor="ce-loan">โน้ตบุ๊กให้ยืม (เครื่อง)</label>
                        <div className="with-icon"><i className="ti ti-device-laptop" /><input id="ce-loan" type="number" min={loanTaken} max="1000" step="1" value={loanQtyText} onChange={(e) => setLoanQtyText(e.target.value)} placeholder="ระบุจำนวนเครื่องที่ให้ยืม" aria-invalid={loanQtyInvalid || loanQty < loanTaken} /></div>
                        <span className="helper budget-hint" style={loanQtyInvalid || loanQty < loanTaken ? BUDGET_ERROR_STYLE : undefined}>
                          <i className={`ti ${loanQtyInvalid || loanQty < loanTaken ? 'ti-alert-circle' : 'ti-info-circle'}`} />
                          {loanQtyInvalid
                            ? 'กรอกเป็นจำนวนเต็ม 0–1000 เครื่อง'
                            : loanQty < loanTaken
                              ? `มีผู้ขอยืมแล้ว ${loanTaken} เครื่อง จึงลดต่ำกว่านี้ไม่ได้`
                              : loanQty > 0
                                ? `ผู้สมัครเลือก "ขอยืมโน้ตบุ๊ก" ได้ตอนลงทะเบียน จนครบ ${loanQty} เครื่อง${loanTaken ? ` · ขอยืมแล้ว ${loanTaken}` : ''}`
                                : 'เว้นว่างหรือ 0 หากไม่มีโน้ตบุ๊กให้ยืม'}
                        </span>
                      </div>
                    </div>
                ) : (
                  <span className="helper budget-hint" style={{ marginBottom: 16 }}><i className="ti ti-info-circle" /> กิจกรรมแบบ Online เท่านั้นไม่มีการให้ยืมโน้ตบุ๊ก</span>
                )}
              </div>
            )}
          </div>

          <div className="form-card setup-card">
            <div className="setup-head">
              <div className="setup-head-text">
                <h2><span className="fc-num">6</span> อาหารและของว่าง</h2>
                <p className="fc-sub">{askDietary ? 'กิจกรรมนี้มีอาหารหรือของว่าง · ผู้สมัครจะถูกถามเรื่องการแพ้อาหารตอนลงทะเบียน' : 'ไม่บังคับ · เปิดใช้เมื่อกิจกรรมมีอาหารหรือของว่าง เพื่อสอบถามการแพ้อาหารของผู้สมัคร'}</p>
              </div>
              <button type="button" className={`switch${askDietary ? ' on' : ''}`} onClick={() => setAskDietary((o) => !o)} role="switch" aria-checked={askDietary} aria-label="สอบถามการแพ้อาหารตอนลงทะเบียน" title="เปิด/ปิดการสอบถามการแพ้อาหาร" />
            </div>
            {askDietary && (
              <div className="diet-preview">
                <div className="diet-preview-title">ผู้สมัครจะต้องตอบตอนยืนยันการสมัคร</div>
                <p className="diet-preview-q"><strong>แพ้อาหารหรือไม่</strong> <span className="req">(บังคับตอบ)</span> — ถ้าแพ้ ให้เลือกอาหารที่แพ้จากรายการ เช่น อาหารทะเล ถั่วลิสง นมวัว หรือพิมพ์ระบุเอง</p>
                <span className="helper budget-hint"><i className="ti ti-lock" /> คำตอบเห็นเฉพาะผู้จัดกิจกรรมนี้ ในหน้ารายชื่อผู้สมัครและไฟล์ Excel</span>
              </div>
            )}
          </div>

          <div className="form-card setup-card">
            <div className="setup-head">
              <div className="setup-head-text">
                <h2><span className="fc-num">7</span> พรีเทส</h2>
                <p className="fc-sub">แบบทดสอบความรู้ก่อนเข้าร่วม · เปิดระหว่างเปิดรับสมัครถึงก่อนวันกิจกรรม (ไม่บังคับ)</p>
              </div>
              <button type="button" className={`switch${pretestOn ? ' on' : ''}`} onClick={() => setPretestOn((o) => !o)} title="เปิด/ปิดการใช้พรีเทส" />
            </div>
            {pretestOn && (
              <div className="setup-body">
                <div className="field full"><label>ลิงก์แบบทดสอบ/แบบฟอร์ม <span className="req">*</span></label><div className="with-icon"><i className="ti ti-link" /><input type="text" value={pretestLink} onChange={(e) => setPretestLink(e.target.value)} placeholder="https://forms.gle/..." /></div></div>
              </div>
            )}
          </div>

          <div className="form-card setup-card" id="ce-cert" style={{ scrollMarginTop: 90 }}>
            <div className="setup-head">
              <div className="setup-head-text">
                <h2><span className="fc-num">8</span> เกียรติบัตร</h2>
                <p className="fc-sub">{issueCert
                  ? 'อัปโหลด template (ไม่บังคับ) และตั้งค่าผู้ลงนาม · ระบบออกให้อัตโนมัติเมื่อผู้เข้าร่วมทำแบบประเมินสำเร็จ · ใบลงชื่อมีช่องเช้า/บ่าย'
                  : 'กิจกรรมนี้ไม่ออกเกียรติบัตร · ใบลงชื่อมีช่องลงชื่อช่องเดียวต่อวัน'}</p>
              </div>
              <button type="button" className={`switch${issueCert ? ' on' : ''}`} onClick={() => setIssueCert((o) => !o)} role="switch" aria-checked={issueCert} aria-label="ออกเกียรติบัตร" title="เปิด/ปิดการออกเกียรติบัตร" />
            </div>
            {issueCert && (<>
            <CertTemplateUpload
              value={certTemplate}
              onChange={setCertTemplate}
              layout={certLayout}
              onLayoutChange={setCertLayout}
              signerName={signerName}
              signerTitle={signerTitle}
              signature={signatureOn ? signature : null}
              eventTitle={title}
              certDate={dayMode === 'multi' ? formatCertDateList(eventDates) : formatCertDate(dateIso, dateIso)}
              category={cat}
            />
            <div className="form-row" style={{ marginTop: 18 }}>
              <div className="field"><label>ชื่อผู้ลงนาม <span className="req">*</span></label><div className="with-icon"><i className="ti ti-signature" /><input type="text" value={signerName} onChange={(e) => { signerTouched.current = true; setSignerName(e.target.value); }} /></div></div>
              <div className="field"><label>ตำแหน่ง <span className="req">*</span></label><div className="with-icon"><i className="ti ti-id-badge-2" /><input type="text" value={signerTitle} onChange={(e) => { signerTouched.current = true; setSignerTitle(e.target.value); }} /></div></div>
            </div>
            <div className="field">
              <div className="sig-toggle-row">
                <label id="sig-toggle-label">ใส่รูปลายเซ็นบนเกียรติบัตร</label>
                <button type="button" className={`switch sm${signatureOn ? ' on' : ''}`} role="switch" aria-checked={signatureOn} aria-labelledby="sig-toggle-label" onClick={() => setSignatureOn((o) => !o)} />
              </div>
              {signatureOn ? (
                <>
                  <SignatureUpload value={signature} onChange={(v) => { signerTouched.current = true; setSignature(v); }} />
                  <span className="helper">ไม่บังคับ · แสดงเหนือชื่อผู้ลงนามบนเกียรติบัตร{certTemplate ? ' (ดูผลได้ในตัวอย่างด้านบน)' : ''}</span>
                </>
              ) : (
                <div className="sig-off-note"><i className="ti ti-writing" /> ไม่ใส่ลายเซ็นบนเกียรติบัตร · พิมพ์ออกมาแล้วผู้ลงนามเซ็นด้วยมือเหนือชื่อ</div>
              )}
            </div>
            </>)}
          </div>

          <div className="form-card setup-card">
            <div className="setup-head">
              <div className="setup-head-text">
                <h2><span className="fc-num">9</span> แบบประเมินกิจกรรม</h2>
                <p className="fc-sub">คำถามเพิ่มเติมต่อจากแบบประเมินมาตรฐาน · เปิดเมื่อพร้อมตั้งค่า หรือเปิดกลับมาตั้งค่าทีหลังได้เช่นเดียวกับพรีเทส</p>
              </div>
              {!evalLocked && <button type="button" className={`switch${evalOn ? ' on' : ''}`} onClick={() => setEvalOn((o) => !o)} title="เปิด/ปิดการใช้แบบประเมินเพิ่มเติม" />}
            </div>
            {evalLocked ? (
              <div className="eval-locked">
                <div className="eval-locked-note"><i className="ti ti-lock" /> ออกเกียรติบัตรหรือมีผู้ทำแบบประเมินแล้ว จึงแก้ไขแบบประเมินไม่ได้ · เพื่อไม่ให้คำตอบที่มีอยู่หายไป</div>
                {evalOn ? (
                  <ol className="eval-locked-list">
                    {evalQuestions.map((q) => (
                      <li key={q._key}>
                        <span>{q.label}</span>
                        <small>{q.type === 'choice' ? `เลือกตอบ: ${q.options.join(' / ')}` : 'คะแนน 1–5'}{q.required ? ' · บังคับตอบ' : ''}</small>
                      </li>
                    ))}
                  </ol>
                ) : <p className="eval-locked-empty">กิจกรรมนี้ไม่มีคำถามเพิ่มเติม</p>}
              </div>
            ) : evalOn && (!evalQuestionsLoaded ? (
              <p style={{ fontSize: 13, color: 'var(--c4-60)' }}>กำลังโหลด...</p>
            ) : (
              <div className="eval-q-list">
                {evalQuestions.map((q, i) => (
                  <div className="eval-q-card" key={q._key}>
                    <div className="eval-q-top">
                      <span className="eval-q-idx">{i + 1}</span>
                      <div className="eval-q-main">
                        <input
                          type="text"
                          value={q.label}
                          onChange={(e) => updateEvalQuestion(q._key, { label: e.target.value })}
                          placeholder="ข้อความคำถาม"
                        />
                        <div className="eval-q-controls">
                          <select value={q.type} onChange={(e) => setEvalQuestionType(q._key, e.target.value)}>
                            <option value="scale">คะแนน 1–5</option>
                            <option value="choice">แบบเลือกตอบ</option>
                          </select>
                          <label className="eval-q-required">
                            <input type="checkbox" checked={q.required} onChange={(e) => updateEvalQuestion(q._key, { required: e.target.checked })} />
                            บังคับตอบ
                          </label>
                          <button type="button" className="icon-btn danger eval-q-remove" title="ลบคำถามนี้" onClick={() => removeEvalQuestion(q._key)}>
                            <i className="ti ti-trash" />
                          </button>
                        </div>
                        {q.type === 'choice' && (
                          <div className="eval-q-options">
                            {q.options.map((opt, oi) => (
                              <div className="eval-q-opt-row" key={oi}>
                                <input
                                  type="text"
                                  value={opt}
                                  onChange={(e) => updateEvalOption(q._key, oi, e.target.value)}
                                  placeholder={`ตัวเลือกที่ ${oi + 1}`}
                                />
                                {q.options.length > 2 && (
                                  <button type="button" className="icon-btn" title="ลบตัวเลือกนี้" onClick={() => removeEvalOption(q._key, oi)}>
                                    <i className="ti ti-x" />
                                  </button>
                                )}
                              </div>
                            ))}
                            <button type="button" className="eval-q-add-opt" onClick={() => addEvalOption(q._key)}>
                              <i className="ti ti-plus" /> เพิ่มตัวเลือก
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div className="eval-q-add-row">
                  <button type="button" className="btn btn-outline" onClick={() => addEvalQuestion('scale')}><i className="ti ti-plus" /> เพิ่มคำถามคะแนน 1–5</button>
                  <button type="button" className="btn btn-outline" onClick={() => addEvalQuestion('choice')}><i className="ti ti-plus" /> เพิ่มคำถามแบบเลือกตอบ</button>
                </div>
              </div>
            ))}
          </div>

          <div className="form-actions">
            <span className="fa-left">{isDirty() && <><i className="ti ti-device-floppy" /> มีการแก้ไขที่ยังไม่ได้บันทึก</>}</span>
            <div className="fa-right">
              <button className="btn btn-outline" onClick={handleCancel}>ยกเลิก</button>
              <button className="btn btn-primary" onClick={handlePublish}><i className="ti ti-send" /> {editing ? 'บันทึกการแก้ไข' : 'เผยแพร่กิจกรรม'}</button>
            </div>
          </div>
        </div>

        <aside className="ce-side">
          <div className="side-card ce-side-sticky">
            <h3><i className="ti ti-eye" /> ตัวอย่างการ์ดกิจกรรม</h3>
            <div className="ce-preview-frame">
              <article className="card ce-live-card">
                {/* Mirrors EventCard: with a poster, it leads the card and carries the status badge. */}
                {poster ? (
                  <div className="card-poster">
                    <img src={poster} alt="" />
                    <span className={`badge ${sm.badge}`}><i className={`ti ${sm.ico}`} /> {sm.label}</span>
                  </div>
                ) : (
                  <div className="card-strip strip-2" />
                )}
                <div className="card-body">
                  <div className="card-top">
                    <div className="icon-box alt"><i className="ti ti-sparkles" /></div>
                    {!poster && <span className={`badge ${sm.badge}`}><i className={`ti ${sm.ico}`} /> {sm.label}</span>}
                  </div>
                  <div className="card-cat">{cat}</div>
                  <h3 className="card-title">{title || 'ชื่อกิจกรรมของคุณ'}</h3>
                  <div className="meta">
                    <div className="row"><i className="ti ti-calendar-event" /> {previewDate}</div>
                    <div className="row"><i className="ti ti-clock" /> {time || 'ยังไม่ระบุเวลา'}</div>
                    <div className="row"><i className="ti ti-map-pin" /> {previewPlace}</div>
                    {previewRegPeriod && <div className="row"><i className="ti ti-user-plus" /> รับสมัคร {previewRegPeriod}</div>}
                    <div className="row"><i className="ti ti-cash" /> {feeOn && feeValue > 0 ? `ค่าลงทะเบียน ${formatBaht(feeValue)}` : 'ไม่มีค่าใช้จ่าย'}</div>
                  </div>
                  <div className="card-footer">
                    <div className="seats">
                      <span><strong style={{ color: 'var(--c4)' }}>0</strong> / {previewCap || 0} ที่นั่ง</span>
                      <div className="seats-bar"><div className="seats-fill" style={{ width: '0%' }} /></div>
                    </div>
                    <button className="btn-apply" disabled><i className="ti ti-user-plus" /> สมัคร</button>
                  </div>
                </div>
              </article>
            </div>
            <button type="button" className="btn btn-outline ce-preview-btn" onClick={() => setDetailPreviewOpen(true)}>
              <i className="ti ti-eye" /> ดูตัวอย่างรายละเอียดกิจกรรม
            </button>
            <p className="ce-preview-hint">เปิดดูหน้ารายละเอียดและขั้นตอนสมัครแบบที่นักศึกษาจะเห็น จากข้อมูลที่กรอกอยู่ตอนนี้</p>
            <div className="ce-side-divider" />
            <h3><i className="ti ti-list-check" /> ตรวจสอบความครบถ้วน</h3>
            <div className="checklist">
              {checklist.map((c) => (
                <div className={`ck ${c.done ? 'done' : 'todo'}`} key={c.label}><i className={`ti ${c.done ? 'ti-circle-check-filled' : 'ti-circle'}`} /> {c.label}</div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <EventDetailModal open={detailPreviewOpen} preview={previewEvent} onClose={() => setDetailPreviewOpen(false)} />

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} size="sm">
        <ModalHead eyebrow="ยืนยันการเผยแพร่" icon="ti-send" title={editing ? 'บันทึกการแก้ไขกิจกรรมนี้?' : 'เผยแพร่กิจกรรมนี้เลยหรือไม่?'} onClose={() => setConfirmOpen(false)} />
        <div className="modal-body"><p style={{ fontSize: 14, color: 'var(--c4-70)', lineHeight: 1.6 }}>{editing ? 'การเปลี่ยนแปลงจะมีผลทันทีและผู้สมัครจะเห็นข้อมูลใหม่' : <>กิจกรรม <strong>{title}</strong> จะแสดงให้ผู้ใช้งานเห็นและเปิดรับสมัครทันที ตรวจสอบข้อมูลให้ครบถ้วนก่อนดำเนินการต่อ</>}</p></div>
        <div className="modal-foot">
          <button className="btn btn-outline" onClick={() => setConfirmOpen(false)}>ยกเลิก</button>
          <button className="btn btn-primary" onClick={doPublish} disabled={publishing}><i className="ti ti-send" /> {publishing ? 'กำลังบันทึก...' : editing ? 'บันทึกการแก้ไข' : 'เผยแพร่กิจกรรม'}</button>
        </div>
      </Modal>

      <ConfirmDialog
        open={leaveAsk}
        eyebrow="ออกจากหน้านี้"
        icon="ti-alert-triangle"
        title="ออกโดยไม่บันทึก?"
        confirmLabel="ออกโดยไม่บันทึก"
        confirmIcon="ti-logout"
        onConfirm={() => { setLeaveAsk(false); baseline.current = null; navigate(-1); }}
        onCancel={() => setLeaveAsk(false)}
      >
        <p style={{ fontSize: 13.5, color: 'var(--c4-70)', lineHeight: 1.7 }}>
          {editing ? 'การแก้ไขกิจกรรมนี้' : 'ข้อมูลกิจกรรมที่กรอกไว้'}ยังไม่ได้บันทึก และจะหายไปเมื่อออกจากหน้านี้
        </p>
      </ConfirmDialog>
    </div>
  );
}
