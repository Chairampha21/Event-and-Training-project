import React from 'react';

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
 * the user's dept text.
 */
export default function StudentDeptFields({ idPrefix, value, onChange }) {
  const { year, major } = parseStudentDept(value);
  const [picked, setPicked] = React.useState(false);
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
