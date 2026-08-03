import React, { useEffect, useMemo, useState } from 'react';
import { useEvents } from '../../hooks/useEvents';
import EvalResultChart from '../../components/EvalResultChart';
import { ROLE_LABEL } from '../../utils/constants';

const EMPTY_SAR = { purpose: '', outcome: '', gaps: '', improvement: '' };

export default function SarReportPage() {
  const { events, session, pushToast, getSar, saveSar, getEvaluationResults } = useEvents();
  const doneEvents = useMemo(() => events.filter((e) => e.listed && e.status === 'done'), [events]);
  const [eventId, setEventId] = useState(doneEvents[0]?.id);
  const ev = events.find((e) => e.id === Number(eventId)) || doneEvents[0];

  const [form, setForm] = useState(EMPTY_SAR);
  const [reportCode, setReportCode] = useState(null);
  const [status, setStatus] = useState('draft');
  const [evalData, setEvalData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!ev) return;
    setLoading(true);
    Promise.all([getSar(ev.id), getEvaluationResults(ev.id)]).then(([sar, results]) => {
      setForm(sar ? { purpose: sar.purpose || '', outcome: sar.outcome || '', gaps: sar.gaps || '', improvement: sar.improvement || '' } : EMPTY_SAR);
      setReportCode(sar?.report_code || null);
      setStatus(sar?.status || 'draft');
      setEvalData(results.map((r) => ({ label: r.label, avg: r.avg_score || 0 })));
      setLoading(false);
    });
  }, [ev, getSar, getEvaluationResults]);

  const attendRate = ev && ev.cap ? ((ev.reg / ev.cap) * 100).toFixed(1) : '0';
  const avgSatisfaction = evalData.length ? (evalData.reduce((a, r) => a + r.avg, 0) / evalData.length).toFixed(1) : '0.0';

  async function handleSave(nextStatus) {
    if (!ev) return;
    setSaving(true);
    try {
      const sar = await saveSar(ev.id, { ...form, status: nextStatus });
      setReportCode(sar.report_code);
      setStatus(sar.status);
      pushToast(nextStatus === 'final' ? 'ยืนยัน SAR ฉบับสมบูรณ์แล้ว' : 'บันทึกฉบับร่างแล้ว', ev.title.slice(0, 30));
    } catch (err) {
      pushToast('บันทึกไม่สำเร็จ', err.message, 'warn');
    } finally {
      setSaving(false);
    }
  }

  if (!ev) {
    return <div className="wrap tight"><div className="empty-state">ยังไม่มีกิจกรรมที่จัดเสร็จสิ้นสำหรับออกรายงาน SAR</div></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div className="ph-inner">
          <div>
            <div className="crumbs"><i className="ti ti-clipboard-text" /> {ROLE_LABEL[session.role]} <i className="ti ti-chevron-right" /> SAR</div>
            <h1>Self Assessment Report (SAR)</h1>
            <p>รายงานประเมินผลกิจกรรมตามรูปแบบระดับคุณภาพการศึกษา สำหรับหลักฐานประกอบและส่งออก PDF</p>
          </div>
          <div className="ph-actions">
            <button className="btn btn-outline" onClick={() => handleSave('draft')} disabled={saving}><i className="ti ti-device-floppy" /> บันทึกฉบับร่าง</button>
            <button className="btn btn-primary" onClick={() => handleSave('final')} disabled={saving}><i className="ti ti-file-download" /> ยืนยันฉบับสมบูรณ์</button>
          </div>
        </div>
      </div>

      <div className="wrap tight">
        <div className="form-card">
          <div className="field" style={{ maxWidth: 420 }}>
            <label>เลือกกิจกรรมที่จัดเสร็จสิ้นแล้ว</label>
            <select className="role-select" style={{ width: '100%' }} value={eventId} onChange={(e) => setEventId(Number(e.target.value))}>
              {doneEvents.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
          </div>
        </div>

        <div className="sar-card" style={loading ? { opacity: .5, pointerEvents: 'none' } : undefined}>
          <div className="sar-head">
            <h3><i className="ti ti-clipboard-text" /> SAR — {ev.title}</h3>
            <span className="sar-meta">รหัสรายงาน: {reportCode || 'ยังไม่ได้บันทึก'} · สถานะ: {status === 'final' ? 'ฉบับสมบูรณ์' : 'ฉบับร่าง'}</span>
          </div>

          <div className="sar-section">
            <h4><span className="num">1</span> ข้อมูลกิจกรรม</h4>
            <div className="sar-grid">
              <div className="field"><label>ชื่อกิจกรรม</label><div className="sar-readout">{ev.title}</div></div>
              <div className="field"><label>วันที่จัด</label><div className="sar-readout">{ev.date}</div></div>
              <div className="field"><label>สถานที่</label><div className="sar-readout">{ev.place}</div></div>
              <div className="field"><label>ผู้รับผิดชอบ</label><div className="sar-readout">{ev.org}</div></div>
            </div>
          </div>

          <div className="sar-section">
            <h4><span className="num">2</span> วัตถุประสงค์ &amp; ผลลัพธ์การเรียนรู้</h4>
            <div className="form-row full" style={{ margin: 0 }}>
              <div className="field"><label>วัตถุประสงค์</label><textarea value={form.purpose} onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))} /></div>
            </div>
            <div className="form-row full" style={{ marginBottom: 0, marginTop: 16 }}>
              <div className="field"><label>ผลลัพธ์ที่เกิดขึ้นจริง</label><textarea value={form.outcome} onChange={(e) => setForm((f) => ({ ...f, outcome: e.target.value }))} /></div>
            </div>
          </div>

          <div className="sar-section">
            <h4><span className="num">3</span> ตัวเลขเชิงปริมาณ</h4>
            <div className="sar-grid">
              <div className="field"><label>ผู้สมัครทั้งหมด</label><div className="sar-readout"><span className="lg">{ev.reg}</span></div></div>
              <div className="field"><label>ที่นั่งทั้งหมด</label><div className="sar-readout"><span className="lg">{ev.cap}</span></div></div>
              <div className="field"><label>อัตราเข้าร่วม</label><div className="sar-readout"><span className="lg">{attendRate}%</span></div></div>
              <div className="field"><label>ระดับความพึงพอใจ</label><div className="sar-readout"><span className="lg">{avgSatisfaction} / 5</span></div></div>
            </div>
          </div>

          <div className="sar-section">
            <h4><span className="num">4</span> ผลการประเมินความพึงพอใจ (รายด้าน)</h4>
            {evalData.length > 0 ? <EvalResultChart data={evalData} /> : <p style={{ fontSize: 13, color: 'var(--c4-60)' }}>ยังไม่มีผู้ทำแบบประเมินสำหรับกิจกรรมนี้</p>}
          </div>

          <div className="sar-section">
            <h4><span className="num">5</span> ข้อสังเกต &amp; ปัญหาที่พบ</h4>
            <div className="form-row full" style={{ marginBottom: 0 }}>
              <div className="field"><textarea value={form.gaps} onChange={(e) => setForm((f) => ({ ...f, gaps: e.target.value }))} /></div>
            </div>
          </div>

          <div className="sar-section">
            <h4><span className="num">6</span> แนวทางพัฒนาครั้งต่อไป</h4>
            <div className="form-row full" style={{ marginBottom: 0 }}>
              <div className="field"><textarea value={form.improvement} onChange={(e) => setForm((f) => ({ ...f, improvement: e.target.value }))} /></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
