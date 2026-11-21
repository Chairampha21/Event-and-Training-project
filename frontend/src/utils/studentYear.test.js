import { academicYearBE, studentYearFromId } from './studentYear';

test('academic year starts in June', () => {
  expect(academicYearBE(new Date(2026, 10, 21))).toBe(2569); // Nov 2026
  expect(academicYearBE(new Date(2027, 2, 1))).toBe(2569);   // Mar 2027: still 2569
  expect(academicYearBE(new Date(2027, 5, 1))).toBe(2570);   // Jun 2027
});

test('year of study from the student ID', () => {
  const nov2026 = new Date(2026, 10, 21);
  expect(studentYearFromId('670710001', nov2026)).toBe('3');
  expect(studentYearFromId('690710001', nov2026)).toBe('1');
  expect(studentYearFromId('640710001', nov2026)).toBe('6');
  expect(studentYearFromId('670710001', new Date(2027, 2, 1))).toBe('3');
  expect(studentYearFromId('670710001', new Date(2027, 6, 1))).toBe('4');
  expect(studentYearFromId('700710001', nov2026)).toBe('');  // not admitted yet
  expect(studentYearFromId('550710001', nov2026)).toBe('');  // 15th year: not a student ID
  expect(studentYearFromId('6707', nov2026)).toBe('');
  expect(studentYearFromId('', nov2026)).toBe('');
});
