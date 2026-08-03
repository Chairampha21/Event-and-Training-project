import React, { useState } from 'react';
import { useEvents } from '../../hooks/useEvents';
import CertificateCard, { CertPreviewModal } from '../../components/CertificateCard';

export default function CertificatesPage() {
  const { regs, evById } = useEvents();
  const [certId, setCertId] = useState(null);
  const certified = regs.filter((r) => r.status === 'certified');

  return (
    <div className="wrap tight">
      <div className="section-head">
        <div>
          <div className="sh-title">เกียรติบัตรของฉัน <span className="count">{certified.length} ใบ</span></div>
          <div className="sh-sub">เกียรติบัตรอิเล็กทรอนิกส์ทั้งหมดที่คุณได้รับ · ดาวน์โหลดเป็น PDF ได้ทันที</div>
        </div>
      </div>

      {certified.length === 0 ? (
        <div className="empty-state">ยังไม่มีเกียรติบัตร — เข้าร่วมกิจกรรมและทำแบบประเมินให้เสร็จ เพื่อรับเกียรติบัตร</div>
      ) : (
        <div className="cert-grid">
          {certified.map((r) => {
            const ev = evById(r.eid);
            if (!ev) return null;
            return <CertificateCard key={r.eid} event={ev} onView={setCertId} />;
          })}
        </div>
      )}

      <CertPreviewModal eventId={certId} open={!!certId} onClose={() => setCertId(null)} />
    </div>
  );
}
