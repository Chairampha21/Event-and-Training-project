import { STYLE, colName } from '../../../utils/xlsxExport';
import { formatThaiDate } from '../../../utils/dateFormat';

// 2026-10-11 -> 11/10/69, the short Buddhist-era date written on the
// department's paper sign-in sheets.
function shortThaiDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${String(Number(y) + 543).slice(-2)}`;
}

/**
 * Sign-in sheets for an event as workbook sheets (see utils/xlsxExport): one
 * sheet per day of the event, each with the day's date over an empty morning
 * and afternoon box per person, to print and have people sign at the door.
 * `people` are roster rows; `noteOf(person)` gives the remark for a row.
 */
export function buildSignInSheets({ ev, days, people, noteOf }) {
  return days.map((day, n) => {
    const time = ev.schedule?.find((s) => s.date === day)?.time || (ev.time && ev.time !== '-' ? ev.time : '');
    const where = ev.placeRaw || '';
    const info = [`วันที่ ${formatThaiDate(day)}`, time && `เวลา ${time}`, where && `สถานที่ ${where}`].filter(Boolean).join('   ');
    const head = (v) => ({ v, s: STYLE.head });
    return {
      name: days.length > 1 ? `วันที่ ${n + 1} (${shortThaiDate(day).replace(/\//g, '-')})` : 'ใบลงชื่อ',
      cols: [7, 15, 32, 20, 20, 26],
      merges: ['A1:F1', 'A2:F2', 'A3:F3', 'A5:A6', 'B5:B6', 'C5:C6', 'D5:E5', 'F5:F6'],
      rows: [
        { height: 26, cells: [{ v: 'ใบลงชื่อผู้เข้าร่วมกิจกรรม', s: STYLE.title }] },
        { height: 40, cells: [{ v: ev.title, s: STYLE.subtitle }] },
        { height: 22, cells: [{ v: info, s: STYLE.subtitle }] },
        { cells: [] },
        { height: 22, cells: [head('ลำดับ'), head('รหัสนักศึกษา'), head('ชื่อ-สกุล'), head(`วันที่ ${shortThaiDate(day)}`), head(''), head('หมายเหตุ')] },
        { height: 22, cells: [head(''), head(''), head(''), head('เช้า'), head('บ่าย'), head('')] },
        ...people.map((p, i) => ({
          height: 30,
          cells: [
            { v: i + 1, s: STYLE.center },
            { v: p.sid, s: STYLE.center },
            { v: p.name, s: STYLE.left },
            { s: STYLE.center },
            { s: STYLE.center },
            { v: noteOf(p), s: STYLE.left },
          ],
        })),
      ],
    };
  });
}

/**
 * The check-in result as one workbook sheet, laid out like the sign-in sheet:
 * the same heading block, then a table with a column per day of the event
 * (✓ = checked in), how many days each person came, and whether that is all
 * of them. `people` are roster rows; `showVia` adds the Onsite/Online column
 * for an event held both ways.
 */
export function buildAttendanceSheet({ ev, days, people, showVia }) {
  const head = (v) => ({ v, s: STYLE.head });
  const fixed = ['ลำดับ', 'รหัสนักศึกษา', 'ชื่อ-สกุล', ...(showVia ? ['รูปแบบ'] : [])];
  const firstDay = fixed.length; // column index of the first day
  const totalCol = firstDay + days.length;
  const lastCol = totalCol + 1;
  const last = colName(lastCol);
  const period = days.length > 1 ? `${formatThaiDate(days[0])} ถึง ${formatThaiDate(days[days.length - 1])} (${days.length} วัน)` : formatThaiDate(days[0]);
  const where = ev.placeRaw ? `สถานที่ ${ev.placeRaw}` : '';
  const info = [`วันที่ ${period}`, where, showVia && 'Onsite + Online'].filter(Boolean).join('   ');
  return [{
    name: 'ผลการเช็คอิน',
    cols: [7, 15, 32, ...(showVia ? [12] : []), ...days.map(() => 13), 12, 14],
    merges: [
      `A1:${last}1`, `A2:${last}2`, `A3:${last}3`,
      ...fixed.map((_, c) => `${colName(c)}5:${colName(c)}6`),
      ...(days.length > 1 ? [`${colName(firstDay)}5:${colName(totalCol - 1)}5`] : []),
      `${colName(totalCol)}5:${colName(totalCol)}6`, `${last}5:${last}6`,
      `A${7 + people.length}:${colName(firstDay - 1)}${7 + people.length}`,
    ],
    rows: [
      { height: 26, cells: [{ v: 'ผลการเช็คอินผู้เข้าร่วมกิจกรรม', s: STYLE.title }] },
      { height: 40, cells: [{ v: ev.title, s: STYLE.subtitle }] },
      { height: 22, cells: [{ v: info, s: STYLE.subtitle }] },
      { cells: [] },
      { height: 22, cells: [...fixed.map(head), head('วันที่เข้าร่วม'), ...days.slice(1).map(() => head('')), head('เข้าร่วม (วัน)'), head('ผล')] },
      { height: 22, cells: [...fixed.map(() => head('')), ...days.map((d) => head(shortThaiDate(d))), head(''), head('')] },
      ...people.map((p, i) => ({
        height: 24,
        cells: [
          { v: i + 1, s: STYLE.center },
          { v: p.sid, s: STYLE.center },
          { v: p.name, s: STYLE.left },
          ...(showVia ? [{ v: p.via === 'online' ? 'Online' : 'Onsite', s: STYLE.center }] : []),
          ...days.map((d) => ({ v: p.days.includes(d) ? '✓' : '-', s: STYLE.center })),
          { v: `${p.days.length}/${days.length}`, s: STYLE.center },
          { v: p.in ? 'ครบ' : 'ไม่ครบ', s: STYLE.center },
        ],
      })),
      {
        height: 24,
        cells: [
          head(`รวมผู้เข้าร่วม (จาก ${people.length} คน)`), ...fixed.slice(1).map(() => head('')),
          ...days.map((d) => ({ v: people.filter((p) => p.days.includes(d)).length, s: STYLE.head })),
          head(''),
          { v: people.filter((p) => p.in).length, s: STYLE.head },
        ],
      },
    ],
  }];
}
