import React, { useMemo } from 'react';
import { useEvents } from '../../hooks/useEvents';
import { EVAL_QUESTIONS } from '../../data/evalQuestions';
import EvalResultChart from '../../components/EvalResultChart';
import { ROLE_LABEL } from '../../utils/constants';

// Deterministic mock aggregate score per event (no per-response storage exists yet —
// swap for a real average once evaluation answers are persisted per submission).
function mockAvg(eventId, qIndex) {
  const seed = (eventId * 7 + qIndex * 13) % 9;
  return 3.9 + seed * 0.11;
}

export default function EvaluationsPage() {
  const { events, session } = useEvents();
  const evaluated = useMemo(() => events.filter((e) => e.listed && (e.status === 'done')), [events]);

  return (
    <div>
      <div className="page-header">
        <div className="ph-inner">
          <div>
            <div className="crumbs"><i className="ti ti-chart-bar" /> {ROLE_LABEL[session.role]} <i className="ti ti-chevron-right" /> แบบประเมิน</div>
            <h1>ผลประเมินกิจกรรม</h1>
            <p>สรุปผลคะแนนแบบประเมินที่ผู้เข้าร่วมกรอกหลังจบกิจกรรม แยกตามรายกิจกรรม</p>
          </div>
        </div>
      </div>

      <div className="wrap tight">
        <div className="section-head">
          <div><div className="sh-title">ผลประเมินกิจกรรม <span className="count">{evaluated.length}</span></div><div className="sh-sub">สรุปคะแนนเฉลี่ยรายด้าน จากแบบประเมินหลังกิจกรรมจบ</div></div>
        </div>

        {evaluated.length === 0 ? (
          <div className="empty-state">ยังไม่มีกิจกรรมที่จัดเสร็จสิ้นและมีผลประเมิน</div>
        ) : (
          <div className="eval-cards">
            {evaluated.map((ev) => {
              const data = EVAL_QUESTIONS.map((q, i) => ({ label: q.label, avg: mockAvg(ev.id, i) }));
              const overall = data.reduce((a, r) => a + r.avg, 0) / data.length;
              return (
                <div className="eval-item-card" key={ev.id}>
                  <div className="eval-item-head">
                    <div>
                      <div className="eval-item-title">{ev.title}</div>
                      <div className="eval-item-sub">{ev.date} · {ev.reg} ผู้เข้าร่วม</div>
                    </div>
                    <div className="eval-item-score">
                      <div className="n">{overall.toFixed(1)}</div>
                      <div className="l">คะแนนเฉลี่ยรวม / 5</div>
                    </div>
                  </div>
                  <EvalResultChart data={data} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
