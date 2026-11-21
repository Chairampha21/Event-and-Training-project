import { parseStudentDept } from '../components/common/StudentDeptFields';
import { studentYearFromId } from './studentYear';

// Gender as the profile stores it, and how it reads in Thai.
export const GENDER_LABEL = { male: 'ชาย', female: 'หญิง', unspecified: 'ไม่ประสงค์ระบุ' };

const compact = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();
const digits = (s) => (String(s || '').match(/\d+/) || [])[0] || '';

// Does this answer option say the profile's gender?
const GENDER_MATCH = {
  male: (o) => /^(เพศ)?ชาย$|^male$|^ผู้ชาย$/.test(o),
  female: (o) => /^(เพศ)?หญิง$|^female$|^ผู้หญิง$/.test(o),
  unspecified: (o) => o.includes('ไม่') && (o.includes('ระบุ') || o.includes('ประสงค์')),
};

// With no gender set on the profile, a title that says it stands in.
const TITLE_GENDER = { 'นาย': 'male', 'เด็กชาย': 'male', 'นาง': 'female', 'นางสาว': 'female', 'เด็กหญิง': 'female' };
const genderOf = (s) => s.gender || TITLE_GENDER[(s.title_th || '').trim()] || '';

/**
 * The answer a choice question already has in the user's profile, or '' when
 * the profile doesn't say, or doesn't say it in exactly one of the options.
 * Gender questions use the profile's gender (or the title's: นาย, นางสาว...); year and major questions (students
 * only) read the "นักศึกษาชั้นปีที่ 3 · วิทยาการคอมพิวเตอร์" dept text.
 */
export function profileAnswer(question, session) {
  if (!session || question?.type !== 'choice') return '';
  const label = compact(question.label);
  const options = question.options || [];
  let match = null;

  if (label.includes('เพศ') || label.includes('gender')) {
    const test = GENDER_MATCH[genderOf(session)];
    if (test) match = (opt) => test(compact(opt));
  } else if (session.role === 'student') {
    const { major } = parseStudentDept(session.dept);
    // The ID gives this year's class; the dept text may be from an earlier year.
    const year = studentYearFromId(session.student_id) || parseStudentDept(session.dept).year;
    if (label.includes('ชั้นปี') && year) match = (opt) => digits(opt) === year;
    else if (label.includes('สาขา') && major) match = (opt) => parseStudentDept(opt).major === major;
  }
  if (!match) return '';
  const hits = options.filter(match);
  return hits.length === 1 ? hits[0] : '';
}
