import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useEvents } from '../../hooks/useEvents';
import { formatThaiDate } from '../../utils/dateFormat';

// Where an online attendee lands after opening the check-in link the organizer
// shows in the online room (/checkin/<event>?d=<day>&k=<key>). Opening it is
// the whole action: the page checks them in for that day and says how it went.
export default function SelfCheckinPage() {
  const { eventId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { selfCheckin } = useEvents();
  const [result, setResult] = useState(null); // null while checking, then { ok, ... }
  const sent = useRef(false);
  const date = params.get('d') || '';
  const key = params.get('k') || '';

  useEffect(() => {
    if (sent.current) return; // once per visit, also under React's double effect run in development
    sent.current = true;
    selfCheckin(eventId, date, key).then(setResult);
  }, [eventId, date, key, selfCheckin]);

  return (
    <div className="wrap" style={{ maxWidth: 560 }}>
      <div className="selfci-card">
        {!result && (
          <>
            <div className="selfci-icon wait"><i className="ti ti-loader-2" /></div>
            <h2>กำลังเช็คชื่อ...</h2>
          </>
        )}
        {result?.ok && (
          <>
            <div className="selfci-icon ok"><i className="ti ti-circle-check" /></div>
            <h2>เช็คชื่อสำเร็จ</h2>
            <p className="selfci-title">{result.title}</p>
            <p>
              บันทึกการเข้าร่วม{result.daysTotal > 1 ? `วันที่ ${result.dayNo} ` : ''}({formatThaiDate(result.date)}) แล้ว
              {result.daysTotal > 1 && <><br />เข้าร่วมแล้ว {result.attended} จาก {result.daysTotal} วัน · ต้องเข้าร่วมครบทุกวันจึงจะได้รับเกียรติบัตร</>}
            </p>
          </>
        )}
        {result && !result.ok && (
          <>
            <div className="selfci-icon fail"><i className="ti ti-alert-triangle" /></div>
            <h2>เช็คชื่อไม่สำเร็จ</h2>
            {result.title && <p className="selfci-title">{result.title}</p>}
            <p>{result.error}</p>
          </>
        )}
        {result && (
          <button className="btn btn-primary" onClick={() => navigate('/my-registrations')}>
            <i className="ti ti-list-check" /> ไปที่การลงทะเบียนของฉัน
          </button>
        )}
      </div>
    </div>
  );
}
