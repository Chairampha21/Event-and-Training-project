// Names as printed on certificates: a title (คำนำหน้า) and the Thai name, and
// optionally an English title and name for English certificates.

// Titles offered in the forms, with the English one each suggests.
export const TITLES = [
  { th: 'นาย', en: 'Mr.' },
  { th: 'นางสาว', en: 'Miss' },
  { th: 'นาง', en: 'Mrs.' },
  { th: 'เด็กชาย', en: 'Master' },
  { th: 'เด็กหญิง', en: 'Miss' },
  { th: 'อ.', en: 'Ajarn' },
  { th: 'อ.ดร.', en: 'Dr.' },
  { th: 'ดร.', en: 'Dr.' },
  { th: 'ผศ.', en: 'Asst. Prof.' },
  { th: 'ผศ.ดร.', en: 'Asst. Prof. Dr.' },
  { th: 'รศ.', en: 'Assoc. Prof.' },
  { th: 'รศ.ดร.', en: 'Assoc. Prof. Dr.' },
  { th: 'ศ.', en: 'Prof.' },
  { th: 'ศ.ดร.', en: 'Prof. Dr.' },
];
// The ones a student signing up picks from (others: "อื่นๆ").
export const STUDENT_TITLES = TITLES.slice(0, 5);

export const englishTitleFor = (th) => TITLES.find((t) => t.th === th)?.en || '';

const NO_SPACE = ['นาย', 'นาง', 'นางสาว', 'เด็กชาย', 'เด็กหญิง'];

/** Thai title + name the way Thai documents write it: "นายสมชาย ใจดี", "ผศ.ดร.สมชาย ใจดี". */
export function joinThai(title, name) {
  const t = (title || '').trim(); const n = (name || '').trim();
  if (!t) return n;
  return NO_SPACE.includes(t) || t.endsWith('.') ? `${t}${n}` : `${t} ${n}`;
}

/** English title + name: "Mr. Somchai Jaidee". */
export function joinEnglish(title, name) {
  return [title, name].map((s) => (s || '').trim()).filter(Boolean).join(' ');
}

export const fullNameTh = (u) => joinThai(u?.title_th, u?.name);
export const fullNameEn = (u) => (u?.name_en ? joinEnglish(u.title_en, u.name_en) : '');

export const hasThai = (s) => /[฀-๿]/.test(s || '');

/** True when the account still needs its title or Thai name (e.g. made through Google). */
export const needsNames = (u) => !!u && (!(u.title_th || '').trim() || !hasThai(u.name));
