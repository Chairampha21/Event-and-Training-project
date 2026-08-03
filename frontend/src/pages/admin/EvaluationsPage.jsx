import React, { useEffect, useMemo, useState } from 'react';
import { useEvents } from '../../hooks/useEvents';
import EvalResultChart from '../../components/EvalResultChart';
import { ROLE_LABEL } from '../../utils/constants';

export default function EvaluationsPage() {
  const { events, session, getEvaluationResults } = useEvents();
  const evaluated = useMemo(() => events.filter((e) => e.listed && (e.status === 'done')), [events]);
  const [resultsByEvent, setResultsByEvent] = useState({});

  useEffect(() => {
    let cancelled = false;
    Promise.all(evaluated.map((ev) => getEvaluationResults(ev.id).then((results) => [ev.id, results]))).then((entries) => {
      if (!cancelled) setResultsByEvent(Object.fromEntries(entries));
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evaluated.map((e) => e.id).join(',')]);

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
              const results = resultsByEvent[ev.id] || [];
              const data = results.map((r) => ({ label: r.label, avg: r.avg_score || 0 }));
              const responded = results.reduce((max, r) => Math.max(max, r.response_count || 0), 0);
              const overall = data.length ? data.reduce((a, r) => a + r.avg, 0) / data.length : 0;
              return (
                <div className="eval-item-card" key={ev.id}>
                  <div className="eval-item-head">
                    <div>
                      <div className="eval-item-title">{ev.title}</div>
                      <div className="eval-item-sub">{ev.date} · {responded} คนทำแบบประเมิน จาก {ev.reg} ผู้เข้าร่วม</div>
                    </div>
                    <div className="eval-item-score">
                      <div className="n">{overall.toFixed(1)}</div>
                      <div className="l">คะแนนเฉลี่ยรวม / 5</div>
                    </div>
                  </div>
                  {responded > 0 ? <EvalResultChart data={data} /> : <p style={{ fontSize: 13, color: 'var(--c4-60)' }}>ยังไม่มีผู้ทำแบบประเมินสำหรับกิจกรรมนี้</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
