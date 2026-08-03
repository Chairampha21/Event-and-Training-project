import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEvents } from '../../hooks/useEvents';
import { REG_STATUS_META, CYCLE, SELF } from '../../utils/constants';
import { CertPreviewModal } from '../../components/CertificateCard';

export default function MyRegistrationsPage() {
  const { regs, evById } = useEvents();
  const navigate = useNavigate();
  const [certId, setCertId] = useState(null);

  const certified = regs.filter((r) => r.status === 'certified').length;
  const attendedMin = regs.filter((r) => r.status !== 'registered').length;

  return (
    <div>
      <div className="page-header dark" style={{ padding: '46px 32px 90px' }}>
        <div className="ph-inner" style={{ display: 'block' }}>
          <div className="ph-top">
            <div className="avatar">{SELF.name.slice(0, 1)}</div>
            <div className="ph-info">
              <span className="ph-role"><i className="ti ti-school" /> นักศึกษาปัจจุบัน</span>
              <div className="ph-name">{SELF.name}</div>
              <div className="ph-id">
                <span><i className="ti ti-id" /> {SELF.sid}</span>
                <span><i className="ti ti-mail" /> {SELF.email}</span>
              </div>
            </div>
          </div>
          <div className="ph-stats">
            <div className="ph-stat"><div className="pi"><i className="ti ti-calendar-check" /></div><div><div className="pv">{regs.length} <small>รายการ</small></div><div className="pl">ลงทะเบียนปีการศึกษานี้</div></div></div>
            <div className="ph-stat"><div className="pi"><i className="ti ti-certificate" /></div><div><div className="pv">{certified} <small>ใบ</small></div><div className="pl">เกียรติบัตรที่ได้รับ</div></div></div>
            <div className="ph-stat"><div className="pi"><i className="ti ti-clock-hour-4" /></div><div><div className="pv">{attendedMin} <small>ครั้ง</small></div><div className="pl">เข้าร่วมกิจกรรมสะสม</div></div></div>
            <div className="ph-stat"><div className="pi"><i className="ti ti-clipboard-check" /></div><div><div className="pv">{regs.filter((r) => r.status === 'attended').length} <small>รายการ</small></div><div className="pl">รอทำแบบประเมิน</div></div></div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1240, margin: '-58px auto 0', padding: '0 32px 56px', position: 'relative', zIndex: 2 }}>
        <div className="section-head"><div><div className="sh-title">ประวัติการลงทะเบียน <span className="count">{regs.length}</span></div><div className="sh-sub">ตรวจสอบสถานะการสมัครและการเข้าร่วมของคุณในปีการศึกษานี้</div></div></div>

        <div className="history-list">
          {regs.length === 0 && <div className="empty-state">ยังไม่มีประวัติการลงทะเบียน</div>}
          {regs.map((r) => {
            const ev = evById(r.eid);
            if (!ev) return null;
            const s = REG_STATUS_META[r.status];
            return (
              <div className="hist-item" key={r.eid}>
                <div className={`hi-icon ${ev.tone}`}><i className={`ti ${ev.icon}`} /></div>
                <div className="hi-info">
                  <div className="hi-cat">{ev.cat}</div>
                  <div className="hi-title">{ev.title}</div>
                  <div className="hi-meta">
                    <span><i className="ti ti-calendar-event" /> {ev.date}</span>
                    <span><i className="ti ti-map-pin" /> {ev.place}</span>
                    <span><i className="ti ti-route" /> Cycle: {CYCLE[ev.stage]}</span>
                  </div>
                  {r.status === 'attended' && (
                    <div className="hi-note"><i className="ti ti-alert-circle" /> ต้องทำแบบประเมินกิจกรรมให้เสร็จก่อนจึงจะรับเกียรติบัตรได้</div>
                  )}
                </div>
                <div className="hi-actions">
                  <span className={`pill-status ${s.cls}`}><i className={`ti ${s.ico}`} /> {s.label}</span>
                  {r.status === 'certified' && (
                    <button className="btn-download" onClick={() => setCertId(ev.id)}><i className="ti ti-download" /> เกียรติบัตร</button>
                  )}
                  {r.status === 'attended' && (
                    <button className="btn-download eval" onClick={() => navigate(`/evaluate/${ev.id}`)}><i className="ti ti-clipboard-check" /> ทำแบบประเมิน</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <CertPreviewModal eventId={certId} open={!!certId} onClose={() => setCertId(null)} />
    </div>
  );
}
