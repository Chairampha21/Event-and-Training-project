import React from 'react';
import { TITLES, STUDENT_TITLES, englishTitleFor, hasThai } from '../../utils/personName';

const OTHER = '__other';

/**
 * Title + Thai name (required) and English title + name (optional). Picking a Thai title fills in the
 * matching English one unless that was typed by hand. `student` offers the
 * student titles first (นาย, นางสาว ...); staff get the academic ones too.
 */
export default function NameFields({ idPrefix, student, titleTh, setTitleTh, name, setName, titleEn, setTitleEn, nameEn, setNameEn }) {
  const known = TITLES.some((t) => t.th === titleTh);
  const base = student ? STUDENT_TITLES : TITLES;
  // A known title outside the short student list (e.g. set by an admin) stays selectable.
  const options = known && !base.some((t) => t.th === titleTh) ? [...base, { th: titleTh }] : base;
  const [custom, setCustom] = React.useState(!!titleTh && !known);
  const select = custom ? OTHER : titleTh;

  function pickTitle(v) {
    if (v === OTHER) { setCustom(true); setTitleTh(''); return; }
    setCustom(false);
    // Follow with the English title when it was empty or the one we suggested before.
    if (!titleEn || titleEn === englishTitleFor(titleTh)) setTitleEn(englishTitleFor(v));
    setTitleTh(v);
  }

  const thaiBad = name.trim() !== '' && !hasThai(name);
  const enBad = nameEn.trim() !== '' && hasThai(nameEn);

  return (
    <div className="name-fields">
      <div className="nf-row">
        <div className="field nf-title">
          <label htmlFor={`${idPrefix}-title`}>คำนำหน้า <span className="req">*</span></label>
          <select id={`${idPrefix}-title`} value={select} onChange={(e) => pickTitle(e.target.value)} aria-invalid={!titleTh.trim()}>
            <option value="" disabled>เลือก</option>
            {options.map((t) => <option key={t.th} value={t.th}>{t.th}</option>)}
            <option value={OTHER}>อื่นๆ (ระบุ)</option>
          </select>
          {custom && (
            <input type="text" className="nf-custom" value={titleTh} onChange={(e) => setTitleTh(e.target.value)} placeholder="เช่น ว่าที่ร้อยตรี" maxLength={40} aria-label="ระบุคำนำหน้า" />
          )}
        </div>
        <div className="field">
          <label htmlFor={`${idPrefix}-name`}>ชื่อ-นามสกุล (ภาษาไทย) <span className="req">*</span></label>
          <input id={`${idPrefix}-name`} type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น สมชาย ใจดี" maxLength={150} aria-invalid={thaiBad} />
          {thaiBad && <span className="field-error" role="alert"><i className="ti ti-alert-circle" /> พิมพ์ชื่อเป็นภาษาไทย · ชื่อภาษาอังกฤษใส่ช่องด้านล่าง</span>}
        </div>
      </div>
      <div className="nf-row">
        <div className="field nf-title">
          <label htmlFor={`${idPrefix}-title-en`}>Title</label>
          <input id={`${idPrefix}-title-en`} type="text" list={`${idPrefix}-titles-en`} value={titleEn} onChange={(e) => setTitleEn(e.target.value)} placeholder="Mr. / Miss" maxLength={40} />
          <datalist id={`${idPrefix}-titles-en`}>
            {[...new Set(TITLES.map((t) => t.en))].map((en) => <option key={en} value={en} />)}
          </datalist>
        </div>
        <div className="field">
          <label htmlFor={`${idPrefix}-name-en`}>ชื่อ-นามสกุล (ภาษาอังกฤษ)</label>
          <input id={`${idPrefix}-name-en`} type="text" value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="e.g. Somchai Jaidee" maxLength={150} aria-invalid={enBad} />
          {enBad
            ? <span className="field-error" role="alert"><i className="ti ti-alert-circle" /> พิมพ์ชื่อเป็นภาษาอังกฤษ</span>
            : <span className="helper">ไม่บังคับ · ใช้กับเกียรติบัตรภาษาอังกฤษ</span>}
        </div>
      </div>
    </div>
  );
}
