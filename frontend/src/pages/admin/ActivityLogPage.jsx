import React, { useState } from 'react';
import { useEvents } from '../../hooks/useEvents';

export default function ActivityLogPage() {
  const { activityLog } = useEvents();
  const [search, setSearch] = useState('');

  const q = search.trim().toLowerCase();
  const filtered = q
    ? activityLog.filter((l) =>
        (l.user || '').toLowerCase().includes(q) ||
        (l.action || '').toLowerCase().includes(q) ||
        (l.detail || '').toLowerCase().includes(q)
      )
    : activityLog;

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
          <div><div className="sh-title">Log ทั้งหมด <span className="count">{activityLog.length} รายการ</span></div><div className="sh-sub">เรียงจากล่าสุดไปเก่าสุด</div></div>
        </div>

        <div className="table-card">
          <div style={{ padding: 16, borderBottom: '1px solid var(--c4-10)' }}>
            <div className="field" style={{ maxWidth: 320 }}>
              <input
                type="text"
                placeholder="ค้นหาด้วยผู้ทำรายการ, Action หรือรายละเอียด"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr><th>เวลา</th><th>ผู้ทำรายการ</th><th>Action</th><th>รายละเอียด</th></tr>
              </thead>
              <tbody>
                {filtered.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--c4-60)', padding: 24 }}>{activityLog.length === 0 ? 'ยังไม่มีกิจกรรมในระบบ' : 'ไม่พบรายการที่ค้นหา'}</td></tr>}
                {filtered.map((l, i) => (
                  <tr key={i}>
                    <td><div className="ev-title" style={{ fontSize: 13 }}>{l.ts}</div></td>
                    <td>{l.user}</td>
                    <td><span className="badge" style={{ background: l.actionColor, color: 'var(--c2)' }}>{l.action}</span></td>
                    <td>{l.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-foot"><span>แสดง {filtered.length} จาก {activityLog.length} รายการ</span></div>
        </div>
      </div>
    </div>
  );
}
