import React from 'react';

// Common allergens offered as one-tap choices; anything else goes in the text box.
export const COMMON_ALLERGENS = ['อาหารทะเล', 'กุ้ง / ปู', 'ถั่วลิสง', 'นมวัว', 'ไข่', 'แป้งสาลี (กลูเตน)'];

export const EMPTY_DIETARY = { hasAllergy: null, allergens: [], other: '' };

/** True once the answers are complete enough to register with. */
export function dietaryComplete(v) {
  if (v.hasAllergy === null) return false;
  return v.hasAllergy === false || v.allergens.length > 0 || v.other.trim() !== '';
}

/** Turns the answers into the short text stored with the registration. */
export function dietaryPayload(v) {
  const allergy = v.hasAllergy ? [...v.allergens, v.other.trim()].filter(Boolean).join(', ') : '';
  return { foodAllergy: allergy };
}

/**
 * Food question shown while registering for an event that serves food: only
 * what the person is allergic to, which is a safety matter. It must be
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

      <p className="diet-privacy"><i className="ti ti-lock" /> ใช้เพื่อจัดเตรียมอาหารเท่านั้น · เห็นเฉพาะคุณและผู้จัดกิจกรรมนี้</p>
    </fieldset>
  );
}
