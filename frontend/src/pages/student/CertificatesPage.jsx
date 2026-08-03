import React, { useState } from 'react';
import { useEvents } from '../../hooks/useEvents';
import CertificateCard, { CertPreviewModal } from '../../components/CertificateCard';
import { formatThaiDate } from '../../utils/dateFormat';

export default function CertificatesPage() {
  const { myCertificates } = useEvents();
  const [certId, setCertId] = useState(null);

  return (
    <div className="wrap tight">
      <div className="section-head">
        <div>
          <div className="sh-title">เกียรติบัตรของฉัน <span className="count">{myCertificates.length} ใบ</span></div>
          <div className="sh-sub">เกียรติบัตรอิเล็กทรอนิกส์ทั้งหมดที่คุณได้รับ · ดาวน์โหลดเป็น PDF ได้ทันที</div>
        </div>
      </div>

      {myCertificates.length === 0 ? (
        <div className="empty-state">ยังไม่มีเกียรติบัตร — เข้าร่วมกิจกรรมและทำแบบประเมินให้เสร็จ เพื่อรับเกียรติบัตร</div>
      ) : (
        <div className="cert-grid">
          {myCertificates.map((c) => (
            <CertificateCard
              key={c.event_id}
              event={{ id: c.event_id, title: c.title, date: formatThaiDate(c.date_start) }}
              onView={setCertId}
            />
          ))}
        </div>
      )}

      <CertPreviewModal eventId={certId} open={!!certId} onClose={() => setCertId(null)} />
    </div>
  );
}
