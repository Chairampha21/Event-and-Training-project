import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useEvents } from '../../hooks/useEvents';

export default function EvaluationFormPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { evById, submitEvaluation, getEventEvalQuestions } = useEvents();
  const ev = evById(eventId);
  const [customValues, setCustomValues] = useState({});
  const [customQuestions, setCustomQuestions] = useState([]);
  const [loadingCustom, setLoadingCustom] = useState(true);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!ev) return;
    let cancelled = false;
    getEventEvalQuestions(ev.id).then((qs) => {
      if (!cancelled) { setCustomQuestions(qs); setLoadingCustom(false); }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ev?.id]);

  if (!ev) {
    return <div className="wrap"><div className="empty-state">ไม่พบกิจกรรมนี้</div></div>;
  }

  const customComplete = customQuestions.every((q) => !q.required || (customValues[q.id] ?? '') !== '');
  const allRated = !loadingCustom && customComplete;

  async function handleSubmit() {
    if (!allRated) return;
    setSubmitting(true);
    try {
      await submitEvaluation(ev.id, {}, customValues);
      navigate('/my-registrations');
    } catch {
      setSubmitting(false);
    }
  }

  return (
    <div className="wrap" style={{ maxWidth: 720 }}>
      <div className="section-head">
        <div>
          <div className="sh-title"><i className="ti ti-clipboard-check" style={{ color: 'var(--c1)' }} /> แบบประเมินกิจกรรม</div>
          <div className="sh-sub">{ev.title}</div>
        </div>
      </div>

      <div className="form-card">
        <div className="eval-banner">
          <i className="ti ti-info-circle" />
          กรุณาทำแบบประเมินให้ครบทุกข้อ ระบบจะปลดล็อกเกียรติบัตรให้โดยอัตโนมัติเมื่อส่งแบบประเมินสำเร็จ
        </div>

        {customQuestions.length === 0 && !loadingCustom && (
          <p style={{ fontSize: 13, color: 'var(--c4-60)' }}>กิจกรรมนี้ยังไม่มีคำถามแบบประเมิน กดส่งเพื่อรับเกียรติบัตรได้เลย</p>
        )}

        {customQuestions.map((q) => (
          <div className="ev-q" key={q.id}>
            <div className="ev-q-label">{q.label} {q.required && <span className="req">*</span>}</div>
            {q.type === 'choice' ? (
              <div className="ev-choices">
                {(q.options || []).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className={`ev-choice-opt${customValues[q.id] === opt ? ' on' : ''}`}
                    onClick={() => setCustomValues((v) => ({ ...v, [q.id]: opt }))}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              <div className="ev-stars">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`ev-star${customValues[q.id] >= v ? ' on' : ''}`}
                    onClick={() => setCustomValues((cv) => ({ ...cv, [q.id]: v }))}
                  >
                    <i className={`ti ${customValues[q.id] >= v ? 'ti-star-filled' : 'ti-star'}`} />
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        <div className="ev-q">
          <div className="ev-q-label">ข้อเสนอแนะเพิ่มเติม (ไม่บังคับ)</div>
          <textarea
            className="eval-textarea"
            placeholder="สิ่งที่ประทับใจ หรือสิ่งที่อยากให้ปรับปรุงครั้งต่อไป..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>
      </div>

      <div className="form-actions">
        <span className="fa-left"><i className="ti ti-shield-check" /> คำตอบของคุณจะถูกเก็บเป็นความลับ</span>
        <div className="fa-right">
          <button className="btn btn-outline" onClick={() => navigate(-1)}>ยกเลิก</button>
          <button className={`btn btn-primary${allRated ? '' : ' disabled'}`} disabled={!allRated || submitting} onClick={handleSubmit}>
            <i className="ti ti-send" /> {submitting ? 'กำลังส่ง...' : 'ส่งแบบประเมิน & รับเกียรติบัตร'}
          </button>
        </div>
      </div>
    </div>
  );
}
