import React from 'react';
import { studentYearFromId } from '../../utils/studentYear';

export const MAJORS = ['วิทยาการคอมพิวเตอร์', 'เทคโนโลยีสารสนเทศ'];
const YEARS = ['1', '2', '3', '4'];
const OTHER = '__other';

// Students keep "นักศึกษาชั้นปีที่ 3 · วิทยาการคอมพิวเตอร์" in the one dept field.
// Older rows wrote the major as "วท.บ. คอมพิวเตอร์" / "วท.บ. เทคโนโลยีสารสนเทศ".
export function parseStudentDept(dept) {
  const s = dept || '';
  const year = (s.match(/ชั้นปีที่\s*(\d+)/) || [])[1] || '';
  const major = s.includes('สารสนเทศ') ? MAJORS[1] : s.includes('คอมพิวเตอร์') ? MAJORS[0] : '';
  return { year, major };
}

export function formatStudentDept(year, major) {
  return [year ? `นักศึกษาชั้นปีที่ ${year}` : '', major].filter(Boolean).join(' · ');
}

/**
 * Year (1–4, or "ปีอื่นๆ" with the number typed in) and major (one of the
 * department's two) for a student, read from and written back to `value`,
 * the user's dept text. With `studentId`, the year follows from it (the ID
 * starts with the year the student was admitted): it is filled in when empty
 * or when the ID is changed, and a different choice is pointed out.
 */
export default function StudentDeptFields({ idPrefix, value, onChange, studentId }) {
  const { year, major } = parseStudentDept(value);
  const [picked, setPicked] = React.useState(false);
  const fromId = studentYearFromId(studentId);
  const lastId = React.useRef(studentId);
  React.useEffect(() => {
    // Loading the saved ID (from nothing) isn't a change; typing a new one is.
    const idChanged = !!lastId.current && lastId.current !== studentId;
    lastId.current = studentId;
    if (fromId && fromId !== year && (!year || idChanged)) {
      setPicked(false);
      onChange(formatStudentDept(fromId, major));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromId, studentId]);
  // A year above 4 (e.g. loaded after the first render) always shows as "other".
  const custom = picked || (!!year && !YEARS.includes(year));
  const set = (y, m) => onChange(formatStudentDept(y, m));

  function pickYear(v) {
    if (v === OTHER) { setPicked(true); set(YEARS.includes(year) ? '' : year, major); return; }
    setPicked(false);
    set(v, major);
  }

  return (
    <div className="form-row">
      <div className="field">
        <label htmlFor={`${idPrefix}-year`}>ชั้นปี</label>
        <select id={`${idPrefix}-year`} value={custom ? OTHER : year} onChange={(e) => pickYear(e.target.value)}>
          <option value="" disabled>เลือกชั้นปี</option>
          {YEARS.map((y) => <option key={y} value={y}>ชั้นปีที่ {y}</option>)}
          <option value={OTHER}>ปีอื่นๆ (ระบุ)</option>
        </select>
        {custom && (
          <input
            type="number" className="sd-custom" min={5} max={8} value={year} placeholder="เช่น 5"
            onChange={(e) => set(e.target.value.replace(/\D/g, '').slice(0, 1), major)} aria-label="ระบุชั้นปี"
          />
        )}
        {fromId && (fromId === year
          ? <span className="helper sd-from-id"><i className="ti ti-id" /> ตามรหัสนักศึกษา (เข้าศึกษาปี 25{String(studentId).trim().slice(0, 2)})</span>
          : (
            <span className="helper sd-from-id warn">
              <i className="ti ti-alert-triangle" /> ตามรหัสนักศึกษาควรเป็นชั้นปีที่ {fromId}
              <button type="button" className="sd-use" onClick={() => { setPicked(false); onChange(formatStudentDept(fromId, major)); }}>ใช้ชั้นปีนี้</button>
            </span>
          ))}
      </div>
      <div className="field">
        <label htmlFor={`${idPrefix}-major`}>สาขา</label>
        <select id={`${idPrefix}-major`} value={major} onChange={(e) => set(year, e.target.value)}>
          <option value="" disabled>เลือกสาขา</option>
          {MAJORS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
    </div>
  );
}
