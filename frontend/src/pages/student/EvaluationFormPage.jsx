import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useEvents } from '../../hooks/useEvents';
import { EVAL_QUESTIONS } from '../../data/evalQuestions';

export default function EvaluationFormPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { evById, submitEvaluation } = useEvents();
  const ev = evById(eventId);
  const [scores, setScores] = useState({});
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!ev) {
    return <div className="wrap"><div className="empty-state">ไม่พบกิจกรรมนี้</div></div>;
  }

  const allRated = EVAL_QUESTIONS.every((q) => scores[q.k]);

  async function handleSubmit() {
    if (!allRated) return;
    setSubmitting(true);
    try {
      await submitEvaluation(ev.id, scores);
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

        {EVAL_QUESTIONS.map((q) => (
          <div className="ev-q" key={q.k}>
            <div className="ev-q-label">{q.label}</div>
            <div className="ev-stars">
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`ev-star${scores[q.k] >= v ? ' on' : ''}`}
                  onClick={() => setScores((s) => ({ ...s, [q.k]: v }))}
                >
                  <i className={`ti ${scores[q.k] >= v ? 'ti-star-filled' : 'ti-star'}`} />
                </button>
              ))}
            </div>
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
