import React, { useState } from 'react';

// Only real web links become clickable — anything else is shown as plain text.
const isWebLink = (url) => /^https?:\/\//i.test(url || '');

/**
 * The online join link of an event, for someone entitled to it (a registered
 * student, the organizer, an admin): open it or copy it. With `locked`, shows
 * instead that the link exists but appears only after registering.
 */
export default function OnlineJoinLink({ url, locked }) {
  const [copied, setCopied] = useState(false);

  if (locked) {
    return (
      <div className="join-link locked">
        <i className="ti ti-lock" />
        <span><strong>ลิงก์เข้าร่วมออนไลน์</strong><small>จะแสดงที่นี่หลังจากลงทะเบียนกิจกรรมนี้สำเร็จ</small></span>
      </div>
    );
  }
  if (!url) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard blocked — the link is still visible to select by hand
    }
  }

  return (
    <div className="join-link">
      <i className="ti ti-broadcast" />
      <span>
        <strong>ลิงก์เข้าร่วมออนไลน์</strong>
        <small className="join-link-url">{url}</small>
      </span>
      <div className="join-link-actions">
        {isWebLink(url) && <a className="btn btn-primary" href={url} target="_blank" rel="noopener noreferrer"><i className="ti ti-external-link" /> เปิดลิงก์</a>}
        <button type="button" className="btn btn-outline" onClick={copy}><i className={`ti ${copied ? 'ti-check' : 'ti-copy'}`} /> {copied ? 'คัดลอกแล้ว' : 'คัดลอก'}</button>
      </div>
    </div>
  );
}
