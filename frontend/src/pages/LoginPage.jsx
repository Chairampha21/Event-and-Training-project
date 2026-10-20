import React, { useEffect, useRef, useState } from 'react';
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

const EMAIL_RE = /^[^\s@]+@silpakorn\.edu$/;
const normEmail = (v) => v.trim().toLowerCase();

/** Countdown in seconds, for "send the code again in N s". */
function useCountdown() {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return undefined;
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return [left, setLeft];
}

function Field({ id, label, icon, error, aside, children }) {
  return (
    <div className="lf-field">
      <div className="lf-label-row">
        <label htmlFor={id}>{label}</label>
        {aside}
      </div>
      <div className={`with-icon${error ? ' has-error' : ''}`}>
        <i className={`ti ${icon}`} />
        {children}
      </div>
      {error && <span className="lf-error" id={`${id}-err`}><i className="ti ti-alert-circle" /> {error}</span>}
    </div>
  );
}

/** Password input with a show/hide eye. */
function PasswordInput({ id, value, onChange, autoComplete, placeholder, invalid }) {
  const [shown, setShown] = useState(false);
  return (
    <>
      <input id={id} type={shown ? 'text' : 'password'} value={value} onChange={onChange} autoComplete={autoComplete}
        placeholder={placeholder} aria-invalid={invalid} aria-describedby={invalid ? `${id}-err` : undefined} className="has-eye" />
      <button type="button" className="lf-eye" onClick={() => setShown((v) => !v)} aria-label={shown ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}>
        <i className={`ti ${shown ? 'ti-eye-off' : 'ti-eye'}`} />
      </button>
    </>
  );
}

/** Six boxes for the emailed code: typing moves on, backspace moves back, pasting fills them all. */
function CodeInput({ value, onChange, disabled }) {
  const refs = useRef([]);
  const digits = value.padEnd(6, ' ').slice(0, 6).split('');
  function put(i, ch) {
    const next = digits.slice(); next[i] = ch || ' ';
    onChange(next.join('').replace(/\s+$/, ''));
  }
  return (
    <div className="lf-code" onPaste={(e) => {
      const d = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
      if (d) { e.preventDefault(); onChange(d); refs.current[Math.min(d.length, 5)]?.focus(); }
    }}>
      {digits.map((d, i) => (
        <input key={i} ref={(el) => { refs.current[i] = el; }} inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1} value={d.trim()} disabled={disabled} aria-label={`รหัสหลักที่ ${i + 1}`} autoFocus={i === 0}
          onChange={(e) => { const ch = e.target.value.replace(/\D/g, '').slice(-1); put(i, ch); if (ch && i < 5) refs.current[i + 1]?.focus(); }}
          onKeyDown={(e) => { if (e.key === 'Backspace' && !d.trim() && i > 0) { refs.current[i - 1]?.focus(); put(i - 1, ''); } }} />
      ))}
    </div>
  );
}

function Banner({ tone = 'error', children }) {
  if (!children) return null;
  return <div className={`lf-banner ${tone}`} role={tone === 'error' ? 'alert' : 'status'}><i className={`ti ${tone === 'error' ? 'ti-alert-triangle' : 'ti-info-circle'}`} /> <span>{children}</span></div>;
}

// ---------------------------------------------------------------- steps

function SignIn({ go, google }) {
  const { login } = useEvents();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!email.trim() || !password) { setError('กรอกอีเมลและรหัสผ่าน'); return; }
    setBusy(true);
    const r = await login(normEmail(email), password);
    setBusy(false);
    if (r.verify) go('verify', { email: r.email, retryAfter: r.retryAfter, note: 'บัญชีนี้ยังไม่ได้ยืนยันอีเมล เราส่งรหัสไปให้แล้ว' });
    else if (!r.ok) setError(r.error);
  }

  return (
    <>
      <h2>เข้าสู่ระบบ</h2>
      <p className="lf-sub">ใช้บัญชีอีเมลมหาวิทยาลัย @silpakorn.edu</p>
      {google}
      <form onSubmit={submit} noValidate>
        <Banner>{error}</Banner>
        <Field id="li-email" label="อีเมล" icon="ti-mail">
          <input id="li-email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} placeholder="username@silpakorn.edu" autoComplete="username" autoFocus />
        </Field>
        <Field id="li-pass" label="รหัสผ่าน" icon="ti-lock"
          aside={<button type="button" className="lf-link" onClick={() => go('forgot', { email: normEmail(email) })}>ลืมรหัสผ่าน?</button>}>
          <PasswordInput id="li-pass" value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} autoComplete="current-password" placeholder="รหัสผ่าน" />
        </Field>
        <button type="submit" className="lf-submit" disabled={busy}>{busy ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}</button>
      </form>
      <p className="lf-switch">นักศึกษายังไม่มีบัญชี? <button type="button" onClick={() => go('register')}>สมัครสมาชิก</button></p>
    </>
  );
}

function Register({ go, google }) {
  const { registerAccount } = useEvents();
  const [f, setF] = useState({ name: '', email: '', studentId: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setF((x) => ({ ...x, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: '' })); setServerError(''); };

  function check() {
    const e = {};
    if (!f.name.trim()) e.name = 'กรอกชื่อ-นามสกุล';
    if (!EMAIL_RE.test(normEmail(f.email))) e.email = 'ใช้อีเมลของมหาวิทยาลัย @silpakorn.edu';
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
    const r = await registerAccount({ name: f.name.trim(), email: normEmail(f.email), password: f.password, studentId: f.studentId.trim() });
    setBusy(false);
    if (r.ok) go('verify', { email: r.email, retryAfter: r.retryAfter });
    else setServerError(r.error);
  }

  const pwLen = f.password.length;
  return (
    <>
      <h2>สมัครสมาชิก</h2>
      <p className="lf-sub">สำหรับนักศึกษามหาวิทยาลัยศิลปากร · ต้องยืนยันอีเมล @silpakorn.edu ก่อนใช้งาน</p>
      {google}
      <form onSubmit={submit} noValidate>
        <Banner>{serverError}</Banner>
        <Field id="rg-name" label="ชื่อ-นามสกุล" icon="ti-user" error={errors.name}>
          <input id="rg-name" value={f.name} onChange={set('name')} placeholder="เช่น สมชาย ใจดี" autoComplete="name" aria-invalid={!!errors.name} />
        </Field>
        <Field id="rg-email" label="อีเมลมหาวิทยาลัย" icon="ti-mail" error={errors.email}>
          <input id="rg-email" type="email" value={f.email} onChange={set('email')} placeholder="username@silpakorn.edu" autoComplete="email" aria-invalid={!!errors.email} />
        </Field>
        <Field id="rg-sid" label="รหัสนักศึกษา" icon="ti-id" error={errors.studentId}>
          <input id="rg-sid" inputMode="numeric" value={f.studentId} onChange={set('studentId')} placeholder="เช่น 670710001" autoComplete="off" aria-invalid={!!errors.studentId} />
        </Field>
        <Field id="rg-pass" label="รหัสผ่าน" icon="ti-lock" error={errors.password}>
          <PasswordInput id="rg-pass" value={f.password} onChange={set('password')} autoComplete="new-password" placeholder="อย่างน้อย 8 ตัวอักษร" invalid={!!errors.password} />
        </Field>
        {pwLen > 0 && !errors.password && (
          <div className={`lf-strength s${pwLen < 8 ? 1 : pwLen < 12 ? 2 : 3}`}><span /><span /><span /><em>{pwLen < 8 ? `อีก ${8 - pwLen} ตัวอักษร` : pwLen < 12 ? 'ใช้ได้' : 'ดีมาก'}</em></div>
        )}
        <Field id="rg-confirm" label="ยืนยันรหัสผ่าน" icon="ti-lock-check" error={errors.confirm}>
          <PasswordInput id="rg-confirm" value={f.confirm} onChange={set('confirm')} autoComplete="new-password" placeholder="พิมพ์รหัสผ่านอีกครั้ง" invalid={!!errors.confirm} />
        </Field>
        <button type="submit" className="lf-submit" disabled={busy}>{busy ? 'กำลังสมัคร...' : 'สมัครและรับรหัสยืนยัน'}</button>
      </form>
      <p className="lf-switch">มีบัญชีแล้ว? <button type="button" onClick={() => go('signin')}>เข้าสู่ระบบ</button></p>
      <p className="lf-hint">บัญชีอาจารย์และผู้จัดกิจกรรมสร้างโดยผู้ดูแลระบบ</p>
    </>
  );
}

/** The code sent to a new sign-up's address. Entering it opens the account and signs in. */
function Verify({ go, ctx }) {
  const { verifyEmail, resendCode } = useEvents();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState(ctx.note || '');
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useCountdown();
  useEffect(() => { setLeft(ctx.retryAfter || 60); }, [ctx.retryAfter, setLeft]);

  async function submit(e) {
    e?.preventDefault();
    if (code.length !== 6) { setError('กรอกรหัส 6 หลักให้ครบ'); return; }
    setBusy(true);
    const r = await verifyEmail(ctx.email, code);
    setBusy(false);
    if (!r.ok) { setError(r.error); setCode(''); }
  }
  useEffect(() => { if (code.length === 6) submit(); /* the last digit sends it */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function resend() {
    setError('');
    const r = await resendCode(ctx.email, 'verify');
    if (r.ok) { setInfo('ส่งรหัสใหม่แล้ว · รหัสเดิมใช้ไม่ได้แล้ว'); setLeft(r.retryAfter); setCode(''); }
    else { setError(r.error); if (r.retryAfter) setLeft(r.retryAfter); }
  }

  return (
    <>
      <div className="lf-icon"><i className="ti ti-mail-opened" /></div>
      <h2>ยืนยันอีเมลของคุณ</h2>
      <p className="lf-sub">เราส่งรหัส 6 หลักไปที่ <strong>{ctx.email}</strong> · รหัสใช้ได้ 15 นาที</p>
      <form onSubmit={submit} noValidate>
        <Banner tone="info">{!error && info}</Banner>
        <Banner>{error}</Banner>
        <CodeInput value={code} onChange={(v) => { setCode(v); setError(''); }} disabled={busy} />
        <button type="submit" className="lf-submit" disabled={busy || code.length !== 6}>{busy ? 'กำลังตรวจสอบ...' : 'ยืนยันและเข้าสู่ระบบ'}</button>
      </form>
      <p className="lf-switch">ไม่ได้รับรหัส? {left > 0
        ? <span className="lf-muted">ส่งรหัสใหม่ได้ในอีก {left} วินาที</span>
        : <button type="button" onClick={resend}>ส่งรหัสใหม่</button>}</p>
      <ul className="lf-tips">
        <li>ดูในโฟลเดอร์ Junk / Spam ของ Outlook ด้วย</li>
        <li>อีเมลผิด? <button type="button" className="lf-link" onClick={() => go('register')}>สมัครใหม่ด้วยอีเมลที่ถูกต้อง</button></li>
      </ul>
      <p className="lf-switch"><button type="button" onClick={() => go('signin')}><i className="ti ti-arrow-left" /> กลับไปหน้าเข้าสู่ระบบ</button></p>
    </>
  );
}

/** Forgot password: the address, then the code mailed to it and a new password. */
function Forgot({ go, ctx }) {
  const { forgotPassword, resetPassword } = useEvents();
  const [email, setEmail] = useState(ctx.email || '');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useCountdown();

  async function send(e) {
    e?.preventDefault();
    if (!EMAIL_RE.test(normEmail(email))) { setError('ใช้อีเมลของมหาวิทยาลัย @silpakorn.edu'); return; }
    setBusy(true);
    const r = await forgotPassword(normEmail(email));
    setBusy(false);
    if (r.ok) { setSent(true); setError(''); setLeft(r.retryAfter); }
    else { setError(r.error); if (r.retryAfter) { setSent(true); setLeft(r.retryAfter); } }
  }

  async function reset(e) {
    e.preventDefault();
    if (code.length !== 6) { setError('กรอกรหัส 6 หลักให้ครบ'); return; }
    if (password.length < 8) { setError('รหัสผ่านใหม่อย่างน้อย 8 ตัวอักษร'); return; }
    if (password !== confirm) { setError('รหัสผ่านทั้งสองช่องไม่ตรงกัน'); return; }
    setBusy(true);
    const r = await resetPassword(normEmail(email), code, password);
    setBusy(false);
    if (!r.ok) setError(r.error);
  }

  return (
    <>
      <div className="lf-icon"><i className="ti ti-key" /></div>
      <h2>ลืมรหัสผ่าน</h2>
      {!sent ? (
        <>
          <p className="lf-sub">กรอกอีเมลของบัญชี เราจะส่งรหัส 6 หลักสำหรับตั้งรหัสผ่านใหม่ไปให้</p>
          <form onSubmit={send} noValidate>
            <Banner>{error}</Banner>
            <Field id="fg-email" label="อีเมล" icon="ti-mail">
              <input id="fg-email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} placeholder="username@silpakorn.edu" autoComplete="username" autoFocus />
            </Field>
            <button type="submit" className="lf-submit" disabled={busy}>{busy ? 'กำลังส่ง...' : 'ส่งรหัส'}</button>
          </form>
        </>
      ) : (
        <>
          <p className="lf-sub">ถ้า <strong>{normEmail(email)}</strong> มีบัญชีในระบบ จะได้รับรหัส 6 หลักภายในไม่กี่นาที</p>
          <form onSubmit={reset} noValidate>
            <Banner>{error}</Banner>
            <CodeInput value={code} onChange={(v) => { setCode(v); setError(''); }} disabled={busy} />
            <Field id="fg-pass" label="รหัสผ่านใหม่" icon="ti-lock">
              <PasswordInput id="fg-pass" value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} autoComplete="new-password" placeholder="อย่างน้อย 8 ตัวอักษร" />
            </Field>
            <Field id="fg-confirm" label="ยืนยันรหัสผ่านใหม่" icon="ti-lock-check">
              <PasswordInput id="fg-confirm" value={confirm} onChange={(e) => { setConfirm(e.target.value); setError(''); }} autoComplete="new-password" placeholder="พิมพ์อีกครั้ง" />
            </Field>
            <button type="submit" className="lf-submit" disabled={busy}>{busy ? 'กำลังบันทึก...' : 'ตั้งรหัสผ่านใหม่และเข้าสู่ระบบ'}</button>
          </form>
          <p className="lf-switch">ไม่ได้รับรหัส? {left > 0
            ? <span className="lf-muted">ส่งใหม่ได้ในอีก {left} วินาที</span>
            : <button type="button" onClick={send}>ส่งรหัสใหม่</button>}</p>
        </>
      )}
      <p className="lf-switch"><button type="button" onClick={() => go('signin')}><i className="ti ti-arrow-left" /> กลับไปหน้าเข้าสู่ระบบ</button></p>
    </>
  );
}

// ---------------------------------------------------------------- page

export default function LoginPage() {
  const { session, loginWithGoogle, pushToast } = useEvents();
  const [step, setStep] = useState('signin'); // signin | register | verify | forgot
  const [ctx, setCtx] = useState({});
  const [googleBusy, setGoogleBusy] = useState(false);
  const location = useLocation();
  const go = (next, data = {}) => { setCtx(data); setStep(next); };

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

  function handleGoogleClick() {
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

  // "Continue with Google" leads, as on most sign-in pages — only when it is
  // set up; Google also confirms the address, so no code is needed.
  const google = GOOGLE_CLIENT_ID ? (
    <>
      <button type="button" className="google-btn" onClick={handleGoogleClick} disabled={googleBusy}>
        <GoogleIcon /> {googleBusy ? 'กำลังเข้าสู่ระบบ...' : 'ดำเนินการต่อด้วย Google'}
      </button>
      <div className="lf-divider"><span>หรือใช้อีเมลและรหัสผ่าน</span></div>
    </>
  ) : null;

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
          {step === 'signin' && <SignIn go={go} google={google} />}
          {step === 'register' && <Register go={go} google={google} />}
          {step === 'verify' && <Verify key={ctx.email} go={go} ctx={ctx} />}
          {step === 'forgot' && <Forgot go={go} ctx={ctx} />}
        </div>
      </div>
      <Toast />
    </div>
  );
}
