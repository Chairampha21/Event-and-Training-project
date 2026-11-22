import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../services/api';
import { formatThaiDate, todayIso } from '../../utils/dateFormat';

// Thai names for the actions the backend logs; an unknown one shows as it is.
const ACTION_LABEL = {
  CREATE: 'สร้าง',
  UPDATE: 'แก้ไข',
  DELETE: 'ลบ',
  REGISTER: 'ลงทะเบียน',
  ISSUE: 'ออกเกียรติบัตร',
  BLACKLIST: 'Blacklist',
};
const ROLE_LABEL = { admin: 'ผู้ดูแลระบบ', organizer: 'ผู้จัดกิจกรรม', teacher: 'อาจารย์', student: 'นักศึกษา' };
const PAGE = 100;

const EMPTY = { action: '', role: '', day: '', q: '' };

/**
 * The activity log, filtered and paged on the server: by action (sign-ins are
 * never shown here), by the role of whoever did it, by date and by
 * text — so a filter looks through the whole log, not just the latest page.
 */
export default function ActivityLogPage() {
  const [filters, setFilters] = useState(EMPTY);
  const [query, setQuery] = useState(''); // typed text, applied after a pause
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [actions, setActions] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.q === query.trim() ? f : { ...f, q: query.trim() })), 300);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async (before) => {
    const params = new URLSearchParams({ limit: String(PAGE) });
    const { day, ...rest } = filters;
    Object.entries(rest).forEach(([k, v]) => { if (v) params.set(k, v); });
    if (day) { params.set('from', day); params.set('to', day); } // one whole day
    if (before) params.set('before', String(before));
    setLoading(true);
    try {
      const res = await api.get(`/activity-logs?${params}`);
      setLogs((cur) => (before ? [...cur, ...res.logs] : res.logs));
      setTotal(res.total);
      setActions(res.actions || []);
      setHasMore(res.has_more);
      setError('');
    } catch (err) {
      setError(err.message || 'โหลด Log ไม่สำเร็จ');
    }
    setLoading(false);
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const set = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));
  const today = todayIso();
  const dayInput = useRef(null);
  // Opens the browser's own calendar for the hidden date field.
  function openCalendar() {
    const el = dayInput.current;
    if (!el) return;
    try { el.showPicker(); } catch { el.focus(); el.click(); }
  }
  const dayCount = filters.day ? total : 0;
  const narrowed = Object.values(filters).some(Boolean) || !!query;
  const nonLogin = actions.filter((a) => a.action !== 'LOGIN').reduce((s, a) => s + a.count, 0);

  return (
    <div>
      <div className="page-header">
        <div className="ph-inner">
          <div>
            <h1>กิจกรรมล่าสุดในระบบ</h1>
            <p>ประวัติการทำรายการทั้งหมดในระบบ เช่น การเข้าสู่ระบบ การเพิ่ม/แก้ไขข้อมูล และ Blacklist</p>
          </div>
        </div>
      </div>

      <div className="wrap tight">
        <div className="section-head">
          <div>
            <div className="sh-title">Log ทั้งหมด <span className="count">{total.toLocaleString('en-US')} รายการ</span></div>
            <div className="sh-sub">เรียงจากล่าสุดไปเก่าสุด · เวลาประเทศไทย · ไม่รวมการเข้าสู่ระบบ</div>
          </div>
        </div>

        <div className="table-card">
          <div className="log-tools">
            <div className="field log-search">
              <input type="text" placeholder="ค้นหาด้วยผู้ทำรายการ, Action หรือรายละเอียด" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <label className="facet-select"><i className="ti ti-bolt" />
              <select value={filters.action} onChange={set('action')} aria-label="กรองตาม Action">
                <option value="">ทุก Action · {nonLogin}</option>
                {/* Sign-ins are left out of this page altogether. */}
                {actions.filter((a) => a.action !== 'LOGIN').map((a) => <option key={a.action} value={a.action}>{ACTION_LABEL[a.action] || a.action} ({a.action}) · {a.count}</option>)}
              </select>
            </label>
            <label className="facet-select"><i className="ti ti-user" />
              <select value={filters.role} onChange={set('role')} aria-label="กรองตามผู้ทำรายการ">
                <option value="">ผู้ทำรายการทุกบทบาท</option>
                {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                <option value="system">ระบบ (อัตโนมัติ)</option>
              </select>
            </label>
            {/* One day at a time, picked on a calendar; the button shows it the Thai way. */}
            {/* The whole box opens the calendar (icon included); the button inside keeps it reachable by keyboard. */}
            <div className={`facet-select log-day${filters.day ? ' on' : ''}`} onClick={openCalendar}>
              <i className="ti ti-calendar" />
              <button type="button" className="log-day-btn" aria-label="เลือกวันจากปฏิทิน">
                {filters.day ? `${formatThaiDate(filters.day)}${filters.day === today ? ' (วันนี้)' : ''} · ${dayCount} รายการ` : 'ทุกวัน'}
              </button>
              {filters.day && <button type="button" className="log-day-clear" onClick={(e) => { e.stopPropagation(); setFilters((f) => ({ ...f, day: '' })); }} aria-label="แสดงทุกวัน"><i className="ti ti-x" /></button>}
              <input ref={dayInput} type="date" className="log-day-input" value={filters.day} max={today} onChange={set('day')} tabIndex={-1} aria-hidden="true" />
            </div>
            <div className="log-quick">
              {narrowed && <button type="button" className="clear" onClick={() => { setFilters(EMPTY); setQuery(''); }}><i className="ti ti-x" /> ล้างตัวกรอง</button>}
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr><th>เวลา</th><th>ผู้ทำรายการ</th><th>Action</th><th>รายละเอียด</th></tr>
              </thead>
              <tbody>
                {error && <tr><td colSpan={4} style={{ textAlign: 'center', color: '#b42318', padding: 24 }}>{error}</td></tr>}
                {!error && !loading && logs.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--c4-60)', padding: 24 }}>{narrowed ? 'ไม่พบรายการที่ตรงกับตัวกรอง' : 'ยังไม่มีกิจกรรมในระบบ'}</td></tr>}
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td><div className="ev-title" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{l.created_at}</div></td>
                    <td>
                      {l.user_name || 'ระบบ (อัตโนมัติ)'}
                      {l.user_role && <div className="ev-sub">{ROLE_LABEL[l.user_role] || l.user_role}</div>}
                    </td>
                    <td><span className="badge" style={{ background: 'var(--c2-08)', color: 'var(--c2)' }} title={ACTION_LABEL[l.action] || ''}>{l.action}</span></td>
                    <td>{l.detail || '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-foot">
            <span>แสดง {logs.length.toLocaleString('en-US')} จาก {total.toLocaleString('en-US')} รายการ</span>
            {hasMore && (
              <button type="button" className="btn btn-outline" style={{ padding: '6px 14px', fontSize: 13 }} disabled={loading} onClick={() => load(logs[logs.length - 1]?.id)}>
                {loading ? 'กำลังโหลด...' : `โหลดเพิ่มอีก ${Math.min(PAGE, total - logs.length)} รายการ`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
