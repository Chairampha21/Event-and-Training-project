import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useEvents } from '../hooks/useEvents';
import { ROLE_LANDING } from '../utils/constants';
import Toast from '../components/ui/Toast';

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

/**
 * Students sign up with their university email and a password — the way in
 * that does not depend on Google Sign-In. Staff accounts are made by an admin.
 */
function RegisterForm({ onBack }) {
  const { registerAccount } = useEvents();
  const [f, setF] = useState({ name: '', email: '', studentId: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setF((x) => ({ ...x, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: '' })); setServerError(''); };

  function check() {
    const e = {};
    const email = f.email.trim().toLowerCase();
    if (!f.name.trim()) e.name = 'กรอกชื่อ-นามสกุล';
    if (!/^[^\s@]+@silpakorn\.edu$/.test(email)) e.email = 'ใช้อีเมลของมหาวิทยาลัย @silpakorn.edu';
    if (!/^\d{8,11}$/.test(f.studentId.trim())) e.studentId = 'รหัสนักศึกษาเป็นตัวเลข 8–11 หลัก';
    if (f.password.length < 8) e.password = 'รหัสผ่านอย่างน้อย 8 ตัวอักษร';
    else if (f.password !== f.confirm) e.confirm = 'รหัสผ่านทั้งสองช่องไม่ตรงกัน';
    return e;
  }

  async function submit(ev) {
    ev.preventDefault();
    const e = check();
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    const err = await registerAccount({ name: f.name.trim(), email: f.email.trim().toLowerCase(), password: f.password, studentId: f.studentId.trim() });
    setBusy(false);
    if (err) setServerError(err);
  }

  const field = (k, label, icon, props) => (
    <div className="lf-field">
      <label htmlFor={`reg-${k}`}><i className={`ti ${icon}`} /> {label}</label>
      <div className="with-icon">
        <i className={`ti ${icon}`} />
        <input id={`reg-${k}`} value={f[k]} onChange={set(k)} aria-invalid={!!errors[k]} style={errors[k] ? { borderColor: '#d93636' } : undefined} {...props} />
      </div>
      {errors[k] && <span className="lf-error"><i className="ti ti-alert-circle" /> {errors[k]}</span>}
    </div>
  );

  return (
    <form onSubmit={submit} noValidate>
      {field('name', 'ชื่อ-นามสกุล', 'ti-user', { type: 'text', placeholder: 'เช่น สมชาย ใจดี', autoComplete: 'name' })}
      {field('email', 'อีเมลมหาวิทยาลัย', 'ti-mail', { type: 'email', placeholder: 'username@silpakorn.edu', autoComplete: 'email' })}
      {field('studentId', 'รหัสนักศึกษา', 'ti-id', { type: 'text', inputMode: 'numeric', placeholder: 'เช่น 670710001', autoComplete: 'off' })}
      {field('password', 'รหัสผ่าน', 'ti-key', { type: 'password', placeholder: 'อย่างน้อย 8 ตัวอักษร', autoComplete: 'new-password' })}
      {field('confirm', 'ยืนยันรหัสผ่าน', 'ti-key', { type: 'password', placeholder: 'พิมพ์รหัสผ่านอีกครั้ง', autoComplete: 'new-password' })}
      {serverError && <div className="lf-server-error" role="alert"><i className="ti ti-alert-triangle" /> {serverError}</div>}
      <button type="submit" className="lf-submit" disabled={busy}><i className="ti ti-user-plus" /> {busy ? 'กำลังสมัคร...' : 'สมัครสมาชิก'}</button>
      <p className="lf-switch">มีบัญชีแล้ว? <button type="button" onClick={onBack}>เข้าสู่ระบบ</button></p>
      <p className="lf-hint">สำหรับนักศึกษา · บัญชีอาจารย์และผู้จัดกิจกรรมสร้างโดยผู้ดูแลระบบ</p>
    </form>
  );
}

export default function LoginPage() {
  const { session, login, loginWithGoogle, pushToast } = useEvents();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const location = useLocation();

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || document.getElementById('google-identity-script')) return;
    const script = document.createElement('script');
    script.id = 'google-identity-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }, []);

  if (session) return <Navigate to={location.state?.from || ROLE_LANDING[session.role]} replace />;

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
          <h2>{mode === 'register' ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}</h2>
          {mode === 'register' ? <RegisterForm onBack={() => setMode('login')} /> : (<>
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
          <p className="lf-switch">นักศึกษายังไม่มีบัญชี? <button type="button" onClick={() => setMode('register')}>สมัครสมาชิก</button></p>
          </>)}
        </div>
      </div>
      <Toast />
    </div>
  );
}
