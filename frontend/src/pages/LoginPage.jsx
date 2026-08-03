import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useEvents } from '../hooks/useEvents';
import { ROLE_LANDING } from '../utils/constants';

export default function LoginPage() {
  const { session, login } = useEvents();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  if (session) return <Navigate to={ROLE_LANDING[session.role]} replace />;

  function handleSubmit(e) {
    e.preventDefault();
    const ok = login(email, password);
    if (!ok) setError(true);
  }

  return (
    <div className="login-page">
      <div className="login-brand">
        <div className="lb-logo">
          <div className="mark">CS</div>
          <div className="tx">
            <span className="t1">CPSU ETMS</span>
            <span className="t2">คณะวิทยาศาสตร์ มหาวิทยาลัยศิลปากร</span>
          </div>
        </div>
        <div className="lb-main">
          <span className="lb-eyebrow"><i className="ti ti-sparkles" /> Event &amp; Training Management System</span>
          <h1>ค้นหา · สมัคร · เข้าร่วม · รับเกียรติบัตร ในที่เดียว</h1>
          <p>ระบบจัดการกิจกรรมและการอบรมของคณะวิทยาศาสตร์ ลดขั้นตอนกระดาษ ออกเกียรติบัตรอัตโนมัติ และให้ผู้เข้าร่วมตรวจสอบประวัติได้เองทุกที่</p>
        </div>
        <div className="lb-foot">ภาควิชาคอมพิวเตอร์ คณะวิทยาศาสตร์ มหาวิทยาลัยศิลปากร</div>
      </div>

      <div className="login-form">
        <div className="lf-inner">
          <h2>เข้าสู่ระบบ</h2>
          <form onSubmit={handleSubmit}>
            <div className="lf-field">
              <label><i className="ti ti-at" /> อีเมล</label>
              <div className="with-icon">
                <i className="ti ti-mail" />
                <input
                  type="text"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(false); }}
                  placeholder="username@silpakorn.edu"
                  autoComplete="username"
                  style={error ? { borderColor: '#caa43a' } : undefined}
                />
              </div>
            </div>
            <div className="lf-field">
              <label><i className="ti ti-lock" /> รหัสผ่าน</label>
              <div className="with-icon">
                <i className="ti ti-key" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(false); }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  style={error ? { borderColor: '#caa43a' } : undefined}
                />
              </div>
            </div>
            <button type="submit" className="lf-submit"><i className="ti ti-login-2" /> เข้าสู่ระบบ</button>
          </form>
        </div>
      </div>
    </div>
  );
}
