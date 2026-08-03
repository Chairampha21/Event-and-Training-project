import React, { useMemo, useState } from 'react';
import { useEvents } from '../../hooks/useEvents';
import { downloadCsv } from '../../utils/csvExport';

export default function ReportPage() {
  const { events, rosters, pushToast } = useEvents();
  const listed = useMemo(() => events.filter((e) => e.listed), [events]);
  const [eventId, setEventId] = useState(listed[0]?.id);
  const ev = listed.find((e) => e.id === Number(eventId)) || listed[0];
  const roster = (ev && rosters[ev.id]) || [];
  const attended = roster.filter((p) => p.in).length;
  const attendRate = roster.length ? ((attended / roster.length) * 100) : 0;

  const recent = useMemo(() => listed.slice(0, 6), [listed]);
  const maxV = Math.max(10, ...recent.map((e) => e.reg));

  function exportReport() {
    if (!ev) return;
    pushToast('กำลังส่งออกรายงาน', ev.title.slice(0, 30));
    downloadCsv(`report-${ev.id}`, roster, [
      { label: 'ชื่อ–นามสกุล', value: 'name' },
      { label: 'รหัสนักศึกษา', value: 'sid' },
      { label: 'เช็คอิน', value: (r) => (r.in ? 'เข้าร่วม' : 'ไม่เข้าร่วม') },
    ]);
  }

  if (!ev) {
    return <div className="wrap tight"><div className="empty-state">ยังไม่มีกิจกรรมสำหรับออกรายงาน</div></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div className="ph-inner">
          <div>
            <div className="crumbs"><i className="ti ti-report-analytics" /> รายงาน <i className="ti ti-chevron-right" /> สรุปผลกิจกรรม</div>
            <h1>รายงานสรุปกิจกรรม</h1>
            <p>สรุปผลกิจกรรมรายรายการ · จำนวนผู้สมัครและผู้เข้าร่วม · อัตราเข้าร่วม · เกียรติบัตรที่ออก</p>
          </div>
          <div className="ph-actions">
            <button className="btn btn-accent" onClick={exportReport}><i className="ti ti-file-export" /> ส่งออก CSV</button>
          </div>
        </div>
      </div>

      <div className="wrap tight">
        <div className="report-filter">
          <div className="field">
            <label>กิจกรรม</label>
            <div className="with-icon"><i className="ti ti-calendar-event" />
              <select value={eventId} onChange={(e) => setEventId(Number(e.target.value))}>
                {listed.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="sc-top"><div className="sc-icon"><i className="ti ti-user-plus" /></div></div>
            <div className="sc-label">ผู้สมัครทั้งหมด</div>
            <div className="sc-value">{ev.reg} <small>คน</small></div>
          </div>
          <div className="stat-card">
            <div className="sc-top"><div className="sc-icon"><i className="ti ti-users" /></div></div>
            <div className="sc-label">เข้าร่วม (เช็คอิน)</div>
            <div className="sc-value">{attended} <small>คน</small></div>
          </div>
          <div className="stat-card accent">
            <div className="sc-top"><div className="sc-icon"><i className="ti ti-percentage" /></div></div>
            <div className="sc-label">อัตราเข้าร่วม</div>
            <div className="sc-value">{attendRate.toFixed(1)}% <small>({attended}/{roster.length || 0})</small></div>
          </div>
          <div className="stat-card dark">
            <div className="sc-top"><div className="sc-icon"><i className="ti ti-certificate" /></div></div>
            <div className="sc-label">สถานะกิจกรรม</div>
            <div className="sc-value" style={{ fontSize: 20 }}>{ev.status === 'done' ? 'จัดเสร็จแล้ว' : 'กำลังดำเนินการ'}</div>
          </div>
        </div>

        <div className="chart-row">
          <div className="chart-card">
            <h3><i className="ti ti-chart-bar" /> จำนวนผู้เข้าร่วม {recent.length} กิจกรรมล่าสุด</h3>
            <div className="ch-sub">เปรียบเทียบผู้สมัคร (อ่อน) กับผู้เข้าร่วมจริง (เข้ม)</div>
            <div className="chart-legend">
              <span><span className="dot" style={{ background: 'var(--c2-40)' }} /> ผู้สมัคร</span>
              <span><span className="dot" style={{ background: 'var(--c1)' }} /> เข้าร่วมจริง</span>
            </div>
            <div className="chart-bars-wrap">
              <div className="bar-y-axis"><span>{maxV}</span><span>{Math.round(maxV / 2)}</span><span>0</span></div>
              <div className="bar-chart">
                {recent.map((e) => {
                  const inCount = (rosters[e.id] || []).filter((p) => p.in).length;
                  return (
                    <div className="bar-col" key={e.id}>
                      <div className="bar-pair">
                        <div className="bar" style={{ height: `${Math.round((e.reg / maxV) * 100)}%`, background: 'var(--c2-40)' }} title={e.reg} />
                        <div className="bar b2" style={{ height: `${Math.round((inCount / maxV) * 100)}%` }} title={inCount} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="chart-x-labels">{recent.map((e) => <span className="bx" key={e.id}>{e.title.split(' ')[0]}</span>)}</div>
          </div>

          <div className="chart-card">
            <h3><i className="ti ti-chart-donut" /> สัดส่วนการเข้าร่วม</h3>
            <div className="ch-sub">จากผู้สมัคร {roster.length} คน ({ev.title.slice(0, 24)})</div>
            <div className="pie-wrap">
              <div style={{ position: 'relative', width: 160, height: 160 }}>
                <div className="pie" style={{ background: `conic-gradient(var(--c1) 0% ${attendRate}%, var(--c2-15) ${attendRate}% 100%)` }} />
                <div className="pie-center">{attendRate.toFixed(1)}%<small>เข้าร่วม</small></div>
              </div>
              <div className="pie-legend">
                <div className="pl-row"><span className="lbl"><span className="dot" style={{ background: 'var(--c1)' }} /> เข้าร่วม</span><span className="val">{attended}</span></div>
                <div className="pl-row"><span className="lbl"><span className="dot" style={{ background: 'var(--c2-15)' }} /> ไม่เข้าร่วม</span><span className="val">{roster.length - attended}</span></div>
              </div>
            </div>
          </div>
        </div>

        <div className="table-card">
          <div className="table-toolbar">
            <h3><i className="ti ti-table" /> รายชื่อผู้เข้าร่วม · {ev.title.slice(0, 30)}</h3>
            <div className="tools">
              <span className="filter-chip active"><i className="ti ti-users" /> ทั้งหมด {roster.length}</span>
              <span className="filter-chip"><i className="ti ti-check" /> เข้าร่วม {attended}</span>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>ลำดับ</th><th>ชื่อ–นามสกุล</th><th>รหัสนักศึกษา</th><th className="center">เช็คอิน</th></tr></thead>
              <tbody>
                {roster.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--c4-60)', padding: 24 }}>ยังไม่มีผู้สมัคร</td></tr>}
                {roster.map((p, i) => (
                  <tr key={p.sid}>
                    <td className="center"><strong>{i + 1}</strong></td>
                    <td>{p.name}</td>
                    <td>{p.sid}</td>
                    <td className="center">{p.in ? <i className="ti ti-check" style={{ color: 'var(--c1)' }} /> : <i className="ti ti-x" style={{ color: 'var(--c4-60)' }} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
