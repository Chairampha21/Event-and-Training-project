import { downloadXlsx, STYLE, colName } from './xlsxExport';
import { formatThaiDate, todayIso } from './dateFormat';
import { academicYearBE } from './studentYear';
import { fullNameTh } from './personName';
import { parseStudentDept } from '../components/common/StudentDeptFields';

// Laid out the way university activity transcripts usually are: the document
// title and issuer, the student's details in two columns, the activities
// grouped by academic year with a count per year, a summary by category, and
// a note on where the document came from with a line for whoever certifies it.

// What a finished registration counts as.
function resultOf(r) {
  if (r.status === 'certified') return 'ได้รับเกียรติบัตร';
  if (r.evaluated || !r.issueCert) return 'เข้าร่วมแล้ว';
  return 'เข้าร่วมแล้ว (รอทำแบบประเมิน)';
}

// Columns of the activity table (width in Excel character units).
const COLS = [
  { label: 'ลำดับ', width: 7 },
  { label: 'ชื่อกิจกรรม', width: 54 },
  { label: 'ประเภท', width: 20 },
  { label: 'วันที่จัด', width: 20 },
  { label: 'สถานที่', width: 44 },
  { label: 'ผลการเข้าร่วม', width: 22 },
  { label: 'รหัสเกียรติบัตร', width: 18 },
];

// A row tall enough for its longest wrapped cell (Thai text runs about
// 1.2 characters per width unit; 18 points a line).
function fitHeight(cells) {
  let lines = 1;
  cells.forEach((cell, i) => {
    if (!cell || cell.v === undefined || cell.v === null) return;
    const per = Math.max(1, Math.floor(COLS[i].width * 1.2));
    lines = Math.max(lines, Math.ceil(String(cell.v).length / per));
  });
  return Math.max(22, lines * 18 + 4);
}

/**
 * Downloads the student's activity transcript as an Excel file: every event
 * they took part in (attended or certified), grouped by academic year, oldest
 * first. `certificates` (myCertificates) gives each certificate's code.
 */
export function downloadActivityTranscript(session, regs, certificates = []) {
  const done = regs
    .filter((r) => (r.status === 'attended' || r.status === 'certified') && !r.cancelled)
    .sort((a, b) => (a.dateStart || '').localeCompare(b.dateStart || ''));
  const codeOf = Object.fromEntries((certificates || []).map((c) => [c.event_id, c.cert_code]));
  const { major } = parseStudentDept(session.dept);
  const certified = done.filter((r) => r.status === 'certified').length;
  const academicYear = (iso) => (iso ? academicYearBE(new Date(`${iso}T12:00:00`)) : 0);

  const rows = [];
  const merges = [];
  const add = (row, mergeSpans = []) => {
    rows.push(row);
    const r = rows.length;
    mergeSpans.forEach(([from, to]) => merges.push(`${colName(from)}${r}:${colName(to)}${r}`));
  };
  const blank = (height = 10) => add({ height, cells: [] });
  const fullWidth = (v, s, height) => add({ height, cells: [{ v, s }, ...COLS.slice(1).map(() => ({ s }))] }, [[0, COLS.length - 1]]);

  // Title and issuer.
  fullWidth('ทรานสคริปต์กิจกรรมนักศึกษา', STYLE.title, 28);
  fullWidth('Student Activity Transcript', STYLE.centerPlain, 18);
  fullWidth('ภาควิชาคอมพิวเตอร์ คณะวิทยาศาสตร์ มหาวิทยาลัยศิลปากร', STYLE.subtitle, 20);
  blank(12);

  // Student details: two label/value pairs a row (labels A:B / E, values C:D / F:G).
  const info = [
    ['ชื่อ–นามสกุล', fullNameTh(session), 'รหัสนักศึกษา', session.student_id || '-'],
    ['สาขาวิชา', major || '-', 'ภาควิชา', 'ภาควิชาคอมพิวเตอร์ คณะวิทยาศาสตร์'],
    ['เข้าร่วมกิจกรรม', `${done.length} กิจกรรม`, 'ได้รับเกียรติบัตร', `${certified} ใบ`],
  ];
  info.forEach(([k1, v1, k2, v2]) => add({
    height: 22,
    cells: [{ v: k1, s: STYLE.label }, { s: STYLE.label }, { v: v1, s: STYLE.text }, { s: STYLE.text }, { v: k2, s: STYLE.label }, { v: v2, s: STYLE.text }, { s: STYLE.text }],
  }, [[0, 1], [2, 3], [5, 6]]));
  blank(12);

  // Activities, one block per academic year.
  add({ height: 26, cells: COLS.map((c) => ({ v: c.label, s: STYLE.head })) });
  if (done.length === 0) {
    add({ height: 24, cells: [{ v: 'ยังไม่มีกิจกรรมที่เข้าร่วม', s: STYLE.center }, ...COLS.slice(1).map(() => ({ s: STYLE.center }))] }, [[0, COLS.length - 1]]);
  }
  const years = [...new Set(done.map((r) => academicYear(r.dateStart)))];
  let n = 0;
  years.forEach((ay) => {
    const list = done.filter((r) => academicYear(r.dateStart) === ay);
    add({ height: 22, cells: [{ v: `ปีการศึกษา ${ay || '-'}`, s: STYLE.section }, ...COLS.slice(1).map(() => ({ s: STYLE.section }))] }, [[0, COLS.length - 1]]);
    list.forEach((r) => {
      n += 1;
      const cells = [
        { v: n, s: STYLE.center },
        { v: r.title, s: STYLE.left },
        { v: r.cat || '-', s: STYLE.left },
        { v: r.date || formatThaiDate(r.dateStart), s: STYLE.left },
        { v: r.place || '-', s: STYLE.left },
        { v: resultOf(r), s: STYLE.center },
        { v: codeOf[r.eid] || '-', s: STYLE.center },
      ];
      add({ height: fitHeight(cells), cells });
    });
    const yearCerts = list.filter((r) => r.status === 'certified').length;
    add({ height: 22, cells: [{ v: `รวมปีการศึกษา ${ay || '-'}`, s: STYLE.totalLeft }, { s: STYLE.totalLeft }, { s: STYLE.totalLeft }, { s: STYLE.totalLeft }, { s: STYLE.totalLeft },
      { v: `${list.length} กิจกรรม`, s: STYLE.total }, { v: `${yearCerts} ใบ`, s: STYLE.total }] }, [[0, 4]]);
  });
  blank(16);

  // Summary by category.
  const byCat = {};
  done.forEach((r) => {
    const c = r.cat || 'อื่น ๆ';
    byCat[c] = byCat[c] || { n: 0, cert: 0 };
    byCat[c].n += 1;
    if (r.status === 'certified') byCat[c].cert += 1;
  });
  add({ height: 22, cells: [{ v: 'สรุปตามประเภทกิจกรรม', s: STYLE.label }] }, [[0, 2]]);
  add({ height: 24, cells: [{ v: 'ประเภทกิจกรรม', s: STYLE.head }, { s: STYLE.head }, { v: 'เข้าร่วม (กิจกรรม)', s: STYLE.head }, { v: 'เกียรติบัตร (ใบ)', s: STYLE.head }] }, [[0, 1]]);
  Object.entries(byCat).forEach(([c, v]) => add({ height: 22, cells: [{ v: c, s: STYLE.left }, { s: STYLE.left }, { v: v.n, s: STYLE.center }, { v: v.cert, s: STYLE.center }] }, [[0, 1]]));
  add({ height: 22, cells: [{ v: 'รวมทั้งหมด', s: STYLE.totalLeft }, { s: STYLE.totalLeft }, { v: done.length, s: STYLE.total }, { v: certified, s: STYLE.total }] }, [[0, 1]]);
  blank(20);

  // Where it came from, and a line to certify it.
  add({ height: 30, cells: [{ v: `ออกจากระบบ CPSU ETMS เมื่อ ${formatThaiDate(todayIso())} · นับเฉพาะกิจกรรมที่เข้าร่วมแล้ว (เช็คอินครบ) ไม่รวมกิจกรรมที่ขาดหรือถูกยกเลิก · ตรวจสอบเกียรติบัตรได้จากรหัสเกียรติบัตร`, s: STYLE.note }] }, [[0, 4]]);
  blank(24);
  const sign = (v) => add({ height: 22, cells: [null, null, null, null, null, { v, s: STYLE.centerPlain }] }, [[5, 6]]);
  sign('ลงชื่อ ......................................................... ผู้รับรอง');
  sign('(.........................................................)');
  sign('ตำแหน่ง .........................................................');
  sign('วันที่ ........ / ........ / ........');

  downloadXlsx(`ทรานสคริปต์กิจกรรม-${session.student_id || session.name}`, [{
    name: 'ทรานสคริปต์กิจกรรม',
    cols: COLS.map((c) => c.width),
    rows,
    merges,
    landscape: true,
  }]);
}
