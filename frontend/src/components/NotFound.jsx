import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="wrap" style={{ textAlign: 'center', paddingTop: 100, paddingBottom: 100 }}>
      <i className="ti ti-map-off" style={{ fontSize: 54, color: 'var(--c2-15)' }} />
      <h1 style={{ fontSize: 24, color: 'var(--c4)', margin: '14px 0 8px' }}>ไม่พบหน้าที่คุณค้นหา</h1>
      <p style={{ color: 'var(--c4-60)', marginBottom: 20 }}>ลิงก์นี้อาจถูกย้ายหรือไม่มีอยู่ในระบบ</p>
      <Link className="btn btn-primary" to="/"><i className="ti ti-home" /> กลับหน้าแรก</Link>
    </div>
  );
}
