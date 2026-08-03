import React, { useMemo, useState } from 'react';
import { useEvents } from '../../hooks/useEvents';
import { EVAL_QUESTIONS } from '../../data/evalQuestions';
import EvalResultChart from '../../components/EvalResultChart';
import { ROLE_LABEL } from '../../utils/constants';

export default function SarReportPage() {
  const { events, session, pushToast } = useEvents();
  const doneEvents = events.filter((e) => e.listed && e.status === 'done');
  const [eventId, setEventId] = useState(doneEvents[0]?.id);
  const ev = events.find((e) => e.id === Number(eventId)) || doneEvents[0];

  const [purpose, setPurpose] = useState('1) เพื่อให้นักศึกษานำความรู้ไปประยุกต์ใช้ในโครงงาน\n2) เพื่อยกระดับทักษะปฏิบัติให้ทันความต้องการของตลาดแรงงาน\n3) เพื่อสร้างเครือข่ายความร่วมมือระหว่างนักศึกษาต่างชั้นปี');
  const [outcome, setOutcome] = useState('ผู้เข้าร่วมส่วนใหญ่สามารถนำความรู้ไปประยุกต์ใช้ได้จริง และให้คะแนนความพึงพอใจในระดับดีถึงดีมาก');
  const [gaps, setGaps] = useState('พบว่าผู้เข้าร่วมบางส่วนยังขาดพื้นฐานที่จำเป็นก่อนเข้าร่วม ทำให้ตามเนื้อหาบางช่วงไม่ทัน ควรเพิ่มเอกสารเตรียมความพร้อมล่วงหน้า');
  const [improve, setImprove] = useState('1) จัดทำ pre-workshop checklist ให้ผู้เข้าร่วมเตรียมเครื่องมือล่วงหน้า\n2) แบ่งกลุ่มตามระดับพื้นฐานเพื่อให้เนื้อหาตรงกลุ่มเป้าหมายมากขึ้น\n3) เพิ่มแบบฝึกหัดระหว่าง session เพื่อวัดความเข้าใจ');

  const evalData = useMemo(() => EVAL_QUESTIONS.map((q, i) => ({ label: q.label, avg: 4.1 + (i % 3) * 0.2 })), []);
  const attendRate = ev ? ((ev.reg / ev.cap) * 100).toFixed(1) : '0';

  function handleExport() {
    pushToast('กำลังสร้าง SAR PDF', ev ? ev.title.slice(0, 30) : '');
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
            <button className="btn btn-primary" onClick={handleExport}><i className="ti ti-file-download" /> ส่งออก PDF</button>
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

        <div className="sar-card">
          <div className="sar-head">
            <h3><i className="ti ti-clipboard-text" /> SAR — {ev.title}</h3>
            <span className="sar-meta">รหัสรายงาน: SAR-2568-{String(ev.id).padStart(3, '0')} · สถานะ: ฉบับร่าง</span>
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
              <div className="field"><label>วัตถุประสงค์</label><textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} /></div>
            </div>
            <div className="form-row full" style={{ marginBottom: 0, marginTop: 16 }}>
              <div className="field"><label>ผลลัพธ์ที่เกิดขึ้นจริง</label><textarea value={outcome} onChange={(e) => setOutcome(e.target.value)} /></div>
            </div>
          </div>

          <div className="sar-section">
            <h4><span className="num">3</span> ตัวเลขเชิงปริมาณ</h4>
            <div className="sar-grid">
              <div className="field"><label>ผู้สมัครทั้งหมด</label><div className="sar-readout"><span className="lg">{ev.reg}</span></div></div>
              <div className="field"><label>ที่นั่งทั้งหมด</label><div className="sar-readout"><span className="lg">{ev.cap}</span></div></div>
              <div className="field"><label>อัตราเข้าร่วม</label><div className="sar-readout"><span className="lg">{attendRate}%</span></div></div>
              <div className="field"><label>ระดับความพึงพอใจ</label><div className="sar-readout"><span className="lg">{(evalData.reduce((a, r) => a + r.avg, 0) / evalData.length).toFixed(1)} / 5</span></div></div>
            </div>
          </div>

          <div className="sar-section">
            <h4><span className="num">4</span> ผลการประเมินความพึงพอใจ (รายด้าน)</h4>
            <EvalResultChart data={evalData} />
          </div>

          <div className="sar-section">
            <h4><span className="num">5</span> ข้อสังเกต &amp; ปัญหาที่พบ</h4>
            <div className="form-row full" style={{ marginBottom: 0 }}>
              <div className="field"><textarea value={gaps} onChange={(e) => setGaps(e.target.value)} /></div>
            </div>
          </div>

          <div className="sar-section">
            <h4><span className="num">6</span> แนวทางพัฒนาครั้งต่อไป</h4>
            <div className="form-row full" style={{ marginBottom: 0 }}>
              <div className="field"><textarea value={improve} onChange={(e) => setImprove(e.target.value)} /></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
