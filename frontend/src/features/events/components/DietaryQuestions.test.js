import { dietaryFromProfile, allergyText } from './DietaryQuestions';

test('an empty profile leaves the question unanswered; "ไม่แพ้" answers no', () => {
  expect(dietaryFromProfile('')).toEqual({ hasAllergy: null, allergens: [], other: '' });
  expect(dietaryFromProfile('ไม่แพ้')).toMatchObject({ hasAllergy: false, fromProfile: 'ไม่แพ้' });
  expect(dietaryFromProfile(' - ').hasAllergy).toBe(false);
  expect(dietaryFromProfile('ไม่มี').hasAllergy).toBe(false);
});

test('common allergens become ticked chips, the rest goes in the text box', () => {
  const a = dietaryFromProfile('แพ้กุ้ง');
  expect(a.hasAllergy).toBe(true);
  expect(a.allergens).toEqual(['กุ้ง']);
  expect(a.other).toBe('');
  expect(a.fromProfile).toBe('แพ้กุ้ง');

  const b = dietaryFromProfile('แพ้กุ้งรุนแรง, ถั่วลิสง, มังสวิรัติ');
  expect(b.allergens).toEqual(['กุ้ง', 'ถั่วลิสง']);
  expect(b.other).toBe('แพ้กุ้งรุนแรง, มังสวิรัติ');

  expect(dietaryFromProfile('แพ้ไข่และนมวัว\nแพ้ปูนา').allergens).toEqual(['นมวัว', 'ไข่', 'ปู']);
  expect(dietaryFromProfile('กุ้ง ปู').allergens).toEqual(['กุ้ง', 'ปู']);
  expect(dietaryFromProfile('ปลาร้า')).toMatchObject({ allergens: [], other: 'ปลาร้า' });
});

test('what the profile saves reads back as the same chips', () => {
  const text = allergyText(['แป้งสาลี (กลูเตน)', 'นมวัว', 'กุ้ง'], ' แพ้รุนแรง ');
  expect(text).toBe('กุ้ง, นมวัว, แป้งสาลี (กลูเตน), แพ้รุนแรง');
  expect(dietaryFromProfile(text)).toMatchObject({ allergens: ['กุ้ง', 'นมวัว', 'แป้งสาลี (กลูเตน)'], other: 'แพ้รุนแรง' });
  expect(dietaryFromProfile('แพ้นมวัว').other).toBe('');
  expect(dietaryFromProfile('อาหารทะเล').allergens).toEqual(['อาหารทะเล']);
});
