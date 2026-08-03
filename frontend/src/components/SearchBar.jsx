import React from 'react';
import './SearchBar.css';

const DEFAULT_PILLS = [{ key: 'all', label: 'ทั้งหมด', icon: 'ti-grid-dots' }];

export function HeroSearch({ query, onQueryChange, onSearch }) {
  return (
    <div className="search-bar">
      <div className="search-input">
        <i className="ti ti-search" />
        <input
          type="text"
          placeholder="ค้นหากิจกรรมหรือการอบรม เช่น Python, AI, Cybersecurity, Hackathon..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onSearch(); }}
        />
      </div>
      <button className="btn-search" onClick={onSearch}><i className="ti ti-search" /> ค้นหา</button>
    </div>
  );
}

export default function SearchBar({ pills, pillFilter, onPillChange, statusFilter, onStatusChange, hideStatus, sortBy, onSortChange }) {
  const list = pills || DEFAULT_PILLS;
  return (
    <div className="filter-section">
      <div className="filter-bar">
        <span className="filter-label"><i className="ti ti-filter" /> หมวดหมู่</span>
        <div className="filter-pills">
          {list.map((p) => (
            <button key={p.key} className={`pill${pillFilter === p.key ? ' active' : ''}`} onClick={() => onPillChange(p.key)}>
              <i className={`ti ${p.icon}`} /> {p.label}
            </button>
          ))}
        </div>
        <div className="right-tools">
          {!hideStatus && (
            <label className="facet-select"><i className="ti ti-circle-dot" />
              <select value={statusFilter} onChange={(e) => onStatusChange(e.target.value)}>
                <option value="all">ทุกสถานะ</option>
                <option value="open">เปิดรับสมัคร</option>
                <option value="full">เต็มแล้ว</option>
                <option value="done">สิ้นสุดแล้ว</option>
              </select>
            </label>
          )}
          <label className="facet-select"><i className="ti ti-arrows-sort" />
            <select value={sortBy} onChange={(e) => onSortChange(e.target.value)}>
              <option value="soon">เร็วที่สุดก่อน</option>
              <option value="seats">ที่นั่งเหลือมาก</option>
              <option value="name">ชื่อ ก–ฮ</option>
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}
