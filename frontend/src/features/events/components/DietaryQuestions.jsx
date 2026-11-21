import React from 'react';

// Common allergens offered as one-tap choices; anything else goes in the text box.
export const COMMON_ALLERGENS = ['อาหารทะเล', 'กุ้ง', 'ปู', 'ถั่วลิสง', 'นมวัว', 'ไข่', 'แป้งสาลี (กลูเตน)'];

export const EMPTY_DIETARY = { hasAllergy: null, allergens: [], other: '' };

// What the profile stores for "no food allergy" (the profile's ไม่แพ้ button),
// and the ways people wrote it by hand before there was a button.
export const NO_ALLERGY = 'ไม่แพ้';
export const isNoAllergy = (text) => /^(-|–|ไม่มี|ไม่แพ้|ไม่แพ้อาหาร|none|no)$/i.test((text || '').trim());

// How each one-tap allergen is usually written in free text.
const ALLERGEN_WORDS = {
  'อาหารทะเล': /อาหารทะเล|seafood/i,
  'กุ้ง': /กุ้ง|shrimp|prawn/i,
  'ปู': /ปู|crab/i,
  'ถั่วลิสง': /ถั่วลิสง|peanut/i,
  'นมวัว': /นม|lactose|dairy|milk/i,
  'ไข่': /ไข่|egg/i,
  'แป้งสาลี (กลูเตน)': /แป้งสาลี|กลูเตน|gluten|wheat/i,
};

/**
 * Starting answers from the "อาหารที่แพ้" the person keeps on their profile
 * ("แพ้กุ้ง, ถั่วลิสง, แพ้รุนแรง"): common allergens become ticked chips,
 * everything else goes in the text box, and `fromProfile` keeps the original
 * to show where it came from. "ไม่แพ้" → answered no; empty → not answered.
 */
export function dietaryFromProfile(text) {
  const raw = (text || '').trim();
  if (!raw) return EMPTY_DIETARY;
  if (isNoAllergy(raw)) return { hasAllergy: false, allergens: [], other: '', fromProfile: NO_ALLERGY };
  const allergens = [];
  const others = [];
  for (const part of raw.split(/[,\n;]+/).map((p) => p.trim()).filter(Boolean)) {
    const hits = Object.entries(ALLERGEN_WORDS).filter(([, re]) => re.test(part)).map(([a]) => a);
    hits.forEach((a) => { if (!allergens.includes(a)) allergens.push(a); });
    // Keep the words themselves too when they say more than the allergen
    // ("แพ้กุ้งรุนแรง"); a bare chip name ("นมวัว", "แป้งสาลี (กลูเตน)") says nothing more.
    const rest = hits
      .reduce((t, a) => t.split(a).join('').replace(new RegExp(ALLERGEN_WORDS[a].source, 'gi'), ''), part)
      .replace(/แพ้|และ|[\s()]/g, '');
    if (hits.length === 0 || rest.length > 2) others.push(part);
  }
  return { hasAllergy: true, allergens, other: others.join(', ').slice(0, 150), fromProfile: raw };
}

/** The allergens and extra words as one line of text: "กุ้ง, ถั่วลิสง, แพ้รุนแรง". */
export function allergyText(allergens, other) {
  return [...COMMON_ALLERGENS.filter((a) => allergens.includes(a)), (other || '').trim()].filter(Boolean).join(', ');
}

/**
 * The common allergens as one-tap chips plus a box for anything else; used
 * when registering for an event and on the profile, so both write the same words.
 */
export function AllergenPicker({ allergens, other, onChange, otherMax = 150 }) {
  const toggle = (a) => onChange({ allergens: allergens.includes(a) ? allergens.filter((x) => x !== a) : [...allergens, a], other });
  return (
    <>
      <div className="diet-sub">แพ้อะไรบ้าง (เลือกได้หลายอย่าง)</div>
      <div className="diet-chips">
        {COMMON_ALLERGENS.map((a) => {
          const on = allergens.includes(a);
          return <button type="button" key={a} className={on ? 'on' : ''} aria-pressed={on} onClick={() => toggle(a)}><i className={`ti ${on ? 'ti-check' : 'ti-plus'}`} /> {a}</button>;
        })}
      </div>
      <input
        type="text"
        className="diet-text"
        value={other}
        maxLength={otherMax}
        autoComplete="off"
        onChange={(e) => onChange({ allergens, other: e.target.value })}
        placeholder="อื่น ๆ หรือรายละเอียดเพิ่มเติม เช่น แพ้รุนแรง ต้องแยกภาชนะ"
        aria-label="อาหารที่แพ้อื่น ๆ หรือรายละเอียดเพิ่มเติม"
      />
    </>
  );
}

/** True once the answers are complete enough to register with. */
export function dietaryComplete(v) {
  if (v.hasAllergy === null) return false;
  return v.hasAllergy === false || v.allergens.length > 0 || v.other.trim() !== '';
}

/** Turns the answers into the short text stored with the registration. */
export function dietaryPayload(v) {
  const allergy = v.hasAllergy ? allergyText(v.allergens, v.other) : '';
  return { foodAllergy: allergy };
}

/**
 * Food question shown while registering for an event that serves food: only
 * what the person is allergic to, which is a safety matter. It must be
 * answered either way ("no" is an answer; silence is not).
 */
export default function DietaryQuestions({ value, onChange }) {
  const set = (patch) => onChange({ ...value, ...patch });

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

      {value.hasAllergy === false && value.fromProfile && (
        <div className="diet-from-profile" style={{ marginTop: 10 }}>
          <i className="ti ti-user-check" />
          <span>ตามข้อมูลในโปรไฟล์ คุณ<strong>ไม่แพ้อาหาร</strong> · ถ้าไม่ถูกต้องเลือก "แพ้อาหาร" ได้</span>
        </div>
      )}

      {value.hasAllergy && (
        <div className="diet-detail">
          {value.fromProfile && value.fromProfile !== NO_ALLERGY && (
            <div className="diet-from-profile">
              <i className="ti ti-user-check" />
              <span>ตามข้อมูลในโปรไฟล์ คุณแพ้: <strong>{value.fromProfile}</strong> · เลือกเพิ่มหรือพิมพ์รายละเอียดเพิ่มเติมได้</span>
            </div>
          )}
          <AllergenPicker allergens={value.allergens} other={value.other} onChange={set} />
        </div>
      )}

      <p className="diet-privacy"><i className="ti ti-lock" /> ใช้เพื่อจัดเตรียมอาหารเท่านั้น · เห็นเฉพาะคุณและผู้จัดกิจกรรมนี้</p>
    </fieldset>
  );
}
