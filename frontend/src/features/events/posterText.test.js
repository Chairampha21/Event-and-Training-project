import { parsePosterText } from './posterText';
const L = (text, h = 20, confidence = 90) => ({ text, confidence, bbox: { y0: 0, y1: h } });
test('next step poster', () => {
  const f = parsePosterText([
    L('NEXT STEP CPSU', 90), L('เส้น ทาง ชีวิต ที่ ต้อง เลือก', 30),
    L('ขอ ให้ นักศึกษา CS,IT ชั้น ปี ที่ 3 ขึ้น ไป'),
    L('วัน พฤหัสบดี ที่ 22 ตุลาคม 2569 16:30 - 19:00 น.'),
    L('ณ ห้อง กระจก อาคาร เรียน รวม วิทยาศาสตร์ ร.วท.1 และ ร.วท.2'),
  ], '2026-10-01');
  expect(f.title).toBe('NEXT STEP CPSU');
  expect(f.days).toEqual([{ date: '2026-10-22', start: '16:30', end: '19:00' }]);
  expect(f.place).toBe('ห้องกระจกอาคารเรียนรวมวิทยาศาสตร์ร.วท.1 และร.วท.2');
  expect(f.attend_mode).toBe('onsite');
});
test('english camp, two-digit year, range, reg deadline, fee, online', () => {
  const f = parsePosterText([
    L('ENGLISH CAMP', 80), L('For Step-Up', 70),
    L('วันจันทร์ที่ 23-24 พ.ย. 68 เวลา 09.00 น. - 16.00 น.'),
    L('รับสมัคร ภายใน วันที่ ๑๕ พฤศจิกายน ๒๕๖๘'),
    L('ค่าลงทะเบียน 1,500 บาท'), L('ผ่าน Zoom https://zoom.us/j/123'),
  ], '2025-11-01');
  expect(f.title).toBe('ENGLISH CAMP For Step-Up');
  expect(f.days.map((d) => d.date)).toEqual(['2025-11-23', '2025-11-24']);
  expect(f.days[0].start).toBe('09:00');
  expect(f.reg_end).toBe('2025-11-15');
  expect(f.fee).toBe(1500);
  expect(f.attend_mode).toBe('online');
  expect(f.online_link).toBe('https://zoom.us/j/123');
});
test('nothing found', () => {
  const f = parsePosterText([L('คุณ ประมาณ', 10)], '2026-01-01');
  expect(f.days).toEqual([]); expect(f.place).toBeNull(); expect(f.fee).toBeNull();
});
