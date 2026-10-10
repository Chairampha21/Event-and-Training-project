// The fixed wording of a certificate, following the department's own printed
// certificates. Kept in one place so the on-screen certificate, the preview in
// the create-event form and the printed page always say the same thing.

export const CERT_DEPT = 'ภาควิชาคอมพิวเตอร์';
export const CERT_ORG = 'คณะวิทยาศาสตร์ มหาวิทยาลัยศิลปากร';
export const CERT_LEAD_IN = 'ขอมอบประกาศนียบัตรฉบับนี้ไว้เพื่อแสดงว่า';
export const CERT_PLACE = ['ณ ภาควิชาคอมพิวเตอร์ คณะวิทยาศาสตร์', 'มหาวิทยาลัยศิลปากร วิทยาเขตพระราชวังสนามจันทร์'];

/**
 * "ได้เข้ารับการอบรม หัวข้อ" for trainings, with wording that still reads
 * correctly for the other kinds of event the system runs.
 */
export function certAchievement(category) {
  const c = category || '';
  if (c.includes('แข่งขัน')) return 'ได้เข้าร่วมการแข่งขัน';
  if (c.includes('อบรม') || c === '') return 'ได้เข้ารับการอบรม หัวข้อ';
  return 'ได้เข้าร่วมกิจกรรม';
}
