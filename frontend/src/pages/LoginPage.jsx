import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useEvents } from '../hooks/useEvents';
import { ROLE_LANDING } from '../utils/constants';
import Toast from '../components/Toast';

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.68-3.87 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.98v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.66 9c0-.59.1-1.17.29-1.7V4.97H.98A9 9 0 0 0 0 9c0 1.45.35 2.83.98 4.03l2.97-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .98 4.97l2.97 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
    </svg>
  );
}

export default function LoginPage() {
  const { session, login, loginWithGoogle, pushToast } = useEvents();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || document.getElementById('google-identity-script')) return;
    const script = document.createElement('script');
    script.id = 'google-identity-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }, []);

  if (session) return <Navigate to={ROLE_LANDING[session.role]} replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    const ok = await login(email, password);
    setSubmitting(false);
    if (!ok) setError(true);
  }

  function handleGoogleClick() {
    if (!GOOGLE_CLIENT_ID) {
      pushToast('ยังไม่ได้ตั้งค่า Google Sign-In', 'ต้องเพิ่ม Google Client ID ในระบบก่อน', 'warn');
      return;
    }
    if (!window.google?.accounts?.id) {
      pushToast('กำลังโหลด Google Sign-In', 'กรุณาลองใหม่อีกครั้งในอีกสักครู่', 'warn');
      return;
    }
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async ({ credential }) => {
        setGoogleBusy(true);
        await loginWithGoogle(credential);
        setGoogleBusy(false);
      },
    });
    window.google.accounts.id.prompt();
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
            <button type="submit" className="lf-submit" disabled={submitting}><i className="ti ti-login-2" /> {submitting ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}</button>
          </form>
          <div className="lf-divider"><span>หรือ</span></div>
          <button type="button" className="google-btn" onClick={handleGoogleClick} disabled={googleBusy}>
            <GoogleIcon /> {googleBusy ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบด้วย Google'}
          </button>
        </div>
      </div>
      <Toast />
    </div>
  );
}
