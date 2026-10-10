import React from 'react';

// Common allergens offered as one-tap choices; anything else goes in the text box.
export const COMMON_ALLERGENS = ['อาหารทะเล', 'กุ้ง / ปู', 'ถั่วลิสง', 'นมวัว', 'ไข่', 'แป้งสาลี (กลูเตน)'];
export const DIET_OPTIONS = ['มังสวิรัติ', 'เจ', 'ฮาลาล', 'ไม่ทานเนื้อวัว', 'ไม่ทานเนื้อหมู'];

export const EMPTY_DIETARY = { hasAllergy: null, allergens: [], other: '', diet: '' };

/** True once the answers are complete enough to register with. */
export function dietaryComplete(v) {
  if (v.hasAllergy === null) return false;
  return v.hasAllergy === false || v.allergens.length > 0 || v.other.trim() !== '';
}

/** Turns the answers into the two short texts stored with the registration. */
export function dietaryPayload(v) {
  const allergy = v.hasAllergy ? [...v.allergens, v.other.trim()].filter(Boolean).join(', ') : '';
  return { foodAllergy: allergy, dietaryPref: v.diet };
}

/**
 * Food questions shown while registering for an event that serves food.
 * Allergies come first and separately from dietary preferences — an allergy
 * is a safety matter, a preference is not — and the allergy question must be
 * answered either way ("no" is an answer; silence is not).
 */
export default function DietaryQuestions({ value, onChange }) {
  const set = (patch) => onChange({ ...value, ...patch });
  const toggleAllergen = (a) => set({ allergens: value.allergens.includes(a) ? value.allergens.filter((x) => x !== a) : [...value.allergens, a] });

  return (
    <fieldset className="diet">
      <legend><i className="ti ti-tools-kitchen-2" /> อาหารในกิจกรรม</legend>

      <div className="diet-q">คุณแพ้อาหารหรือไม่? <span className="req">*</span></div>
      <div className="diet-yn" role="radiogroup" aria-label="คุณแพ้อาหารหรือไม่">
        <label className={value.hasAllergy === false ? 'on' : ''}>
          <input type="radio" name="diet-allergy" checked={value.hasAllergy === false} onChange={() => set({ hasAllergy: false, allergens: [], other: '' })} /> ไม่แพ้
        </label>
        <label className={value.hasAllergy === true ? 'on' : ''}>
          <input type="radio" name="diet-allergy" checked={value.hasAllergy === true} onChange={() => set({ hasAllergy: true })} /> แพ้อาหาร
        </label>
      </div>

      {value.hasAllergy && (
        <div className="diet-detail">
          <div className="diet-sub">แพ้อะไรบ้าง (เลือกได้หลายอย่าง)</div>
          <div className="diet-chips">
            {COMMON_ALLERGENS.map((a) => {
              const on = value.allergens.includes(a);
              return <button type="button" key={a} className={on ? 'on' : ''} aria-pressed={on} onClick={() => toggleAllergen(a)}><i className={`ti ${on ? 'ti-check' : 'ti-plus'}`} /> {a}</button>;
            })}
          </div>
          <input
            type="text"
            className="diet-text"
            value={value.other}
            maxLength={150}
            onChange={(e) => set({ other: e.target.value })}
            placeholder="อื่น ๆ หรือรายละเอียดเพิ่มเติม เช่น แพ้รุนแรง ต้องแยกภาชนะ"
            aria-label="อาหารที่แพ้อื่น ๆ หรือรายละเอียดเพิ่มเติม"
          />
        </div>
      )}

      <label className="diet-pref">
        <span>ข้อจำกัดด้านอาหาร <small>(ไม่บังคับ)</small></span>
        <select value={value.diet} onChange={(e) => set({ diet: e.target.value })}>
          <option value="">ไม่มี</option>
          {DIET_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </label>

      <p className="diet-privacy"><i className="ti ti-lock" /> ใช้เพื่อจัดเตรียมอาหารเท่านั้น · เห็นเฉพาะคุณและผู้จัดกิจกรรมนี้</p>
    </fieldset>
  );
}
