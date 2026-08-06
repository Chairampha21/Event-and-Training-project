import React, { useEffect, useMemo, useState } from 'react';
import { useEvents } from '../../hooks/useEvents';
import { ROLE_LABEL } from '../../utils/constants';
import { toBuddhistYear } from '../../utils/dateFormat';
import { fileToDataUrl } from '../../utils/fileToDataUrl';
import { downloadDataUrl, downloadAllImages } from '../../utils/downloadImage';
import Modal, { ModalHead } from '../../components/Modal';

// คลังโปสเตอร์กิจกรรม — แทนที่แบบฟอร์ม SAR ยาวเดิม ตามที่ผู้จัดกิจกรรมแจ้งว่า
// สิ่งที่ใช้จริงมีแค่โปสเตอร์กิจกรรมกับโปสเตอร์สรุปข่าว ให้อาจารย์ดูและโหลดได้ทั้งหมด
export default function SarReportPage() {
  const { events, session, pushToast, getSar, saveSar } = useEvents();
  const doneEvents = useMemo(() => events.filter((e) => e.listed && e.status === 'done'), [events]);

  const years = useMemo(() => {
    const set = new Set(doneEvents.filter((e) => e.dateStart).map((e) => e.dateStart.slice(0, 4)));
    return [...set].sort((a, b) => b - a);
  }, [doneEvents]);

  const [yearFilter, setYearFilter] = useState('');
  const [search, setSearch] = useState('');
  const [sarByEvent, setSarByEvent] = useState({});
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState(null);
  const [preview, setPreview] = useState(null); // { url, title }
  const [downloadingAll, setDownloadingAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all(doneEvents.map((ev) => getSar(ev.id).then((sar) => [ev.id, sar]))).then((entries) => {
      if (!cancelled) { setSarByEvent(Object.fromEntries(entries)); setLoading(false); }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneEvents.map((e) => e.id).join(',')]);

  const q = search.trim().toLowerCase();
  const filtered = doneEvents.filter((ev) => {
    if (q && !ev.title.toLowerCase().includes(q)) return false;
    if (yearFilter && ev.dateStart?.slice(0, 4) !== yearFilter) return false;
    return true;
  });

  async function onUploadRecap(ev, file) {
    setUploadingId(ev.id);
    try {
      const dataUrl = await fileToDataUrl(file);
      const sar = await saveSar(ev.id, { recap_poster: dataUrl });
      setSarByEvent((s) => ({ ...s, [ev.id]: sar }));
      pushToast('อัปโหลดโปสเตอร์สรุปข่าวแล้ว', ev.title.slice(0, 30));
    } catch (err) {
      pushToast('อัปโหลดไม่สำเร็จ', err.message, 'warn');
    } finally {
      setUploadingId(null);
    }
  }

  async function onRemoveRecap(ev) {
    setUploadingId(ev.id);
    try {
      const sar = await saveSar(ev.id, { recap_poster: '' });
      setSarByEvent((s) => ({ ...s, [ev.id]: sar }));
    } catch (err) {
      pushToast('ลบไม่สำเร็จ', err.message, 'warn');
    } finally {
      setUploadingId(null);
    }
  }

  async function handleDownloadAll() {
    const items = [];
    filtered.forEach((ev) => {
      const safeTitle = ev.title.replace(/[\\/:*?"<>|]/g, '').slice(0, 40);
      if (ev.poster) items.push({ url: ev.poster, filename: `${safeTitle} - โปสเตอร์กิจกรรม.png` });
      const recap = sarByEvent[ev.id]?.recap_poster_url;
      if (recap) items.push({ url: recap, filename: `${safeTitle} - โปสเตอร์สรุปข่าว.png` });
    });
    if (items.length === 0) {
      pushToast('ไม่มีรูปให้ดาวน์โหลด', 'ยังไม่มีโปสเตอร์ในรายการที่กรองอยู่', 'warn');
      return;
    }
    setDownloadingAll(true);
    await downloadAllImages(items);
    setDownloadingAll(false);
  }

  return (
    <div>
      <div className="page-header">
        <div className="ph-inner">
          <div>
            <div className="crumbs"><i className="ti ti-clipboard-text" /> {ROLE_LABEL[session.role]} <i className="ti ti-chevron-right" /> SAR</div>
            <h1>คลังโปสเตอร์กิจกรรม (SAR)</h1>
            <p>รวมโปสเตอร์กิจกรรมและโปสเตอร์สรุปข่าวของกิจกรรมที่จัดเสร็จสิ้นแล้ว ดูและดาวน์โหลดได้ทั้งหมด</p>
          </div>
          <div className="ph-actions">
            <button className="btn btn-accent" onClick={handleDownloadAll} disabled={downloadingAll}>
              <i className="ti ti-download" /> {downloadingAll ? 'กำลังดาวน์โหลด...' : 'ดาวน์โหลดทั้งหมด'}
            </button>
          </div>
        </div>
      </div>

      <div className="wrap tight">
        <div className="report-filter">
          <div className="field rf-search">
            <label>ค้นหากิจกรรม</label>
            <div className="with-icon"><i className="ti ti-search" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="พิมพ์ชื่อกิจกรรมเพื่อค้นหา..." />
            </div>
          </div>
          <div className="field rf-year">
            <label>ปีที่จัด</label>
            <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
              <option value="">ทุกปี</option>
              {years.map((y) => <option key={y} value={y}>{toBuddhistYear(Number(y))}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <p style={{ fontSize: 13, color: 'var(--c4-60)' }}>กำลังโหลด...</p>
        ) : filtered.length === 0 ? (
          <div className="empty-state">ไม่พบกิจกรรมที่ตรงเงื่อนไข</div>
        ) : (
          <div className="sar-gallery">
            {filtered.map((ev) => {
              const recap = sarByEvent[ev.id]?.recap_poster_url;
              const busy = uploadingId === ev.id;
              return (
                <div className="sar-g-card" key={ev.id}>
                  <div className="sar-g-head">
                    <div className="sar-g-title">{ev.title}</div>
                    <div className="sar-g-meta"><i className="ti ti-calendar-event" /> {ev.date}</div>
                  </div>
                  <div className="sar-g-imgs">
                    <div className="sar-g-slot">
                      <div className="sar-g-slot-label">โปสเตอร์กิจกรรม</div>
                      <div className="sar-g-thumb">
                        {ev.poster ? (
                          <img src={ev.poster} alt="โปสเตอร์กิจกรรม" onClick={() => setPreview({ url: ev.poster, title: `${ev.title} · โปสเตอร์กิจกรรม` })} />
                        ) : (
                          <div className="sar-g-empty"><i className="ti ti-photo-off" /> ไม่มีโปสเตอร์</div>
                        )}
                      </div>
                      <div className="sar-g-actions">
                        <button type="button" disabled={!ev.poster} onClick={() => downloadDataUrl(ev.poster, `${ev.title.slice(0, 40)} - โปสเตอร์กิจกรรม.png`)}>
                          <i className="ti ti-download" /> โหลด
                        </button>
                      </div>
                    </div>
                    <div className="sar-g-slot">
                      <div className="sar-g-slot-label">โปสเตอร์สรุปข่าว</div>
                      <div className="sar-g-thumb" onClick={() => { if (!recap && !busy) document.getElementById(`sar-recap-${ev.id}`).click(); }}>
                        <input
                          type="file"
                          id={`sar-recap-${ev.id}`}
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadRecap(ev, f); e.target.value = ''; }}
                        />
                        {recap ? (
                          <img src={recap} alt="โปสเตอร์สรุปข่าว" onClick={() => setPreview({ url: recap, title: `${ev.title} · โปสเตอร์สรุปข่าว` })} />
                        ) : (
                          <div className="sar-g-empty"><i className="ti ti-upload" /> {busy ? 'กำลังอัปโหลด...' : 'อัปโหลดรูป'}</div>
                        )}
                      </div>
                      <div className="sar-g-actions">
                        {recap ? (
                          <>
                            <button type="button" onClick={() => downloadDataUrl(recap, `${ev.title.slice(0, 40)} - โปสเตอร์สรุปข่าว.png`)}><i className="ti ti-download" /> โหลด</button>
                            <button type="button" onClick={() => onRemoveRecap(ev)} disabled={busy}><i className="ti ti-trash" /> ลบ</button>
                          </>
                        ) : (
                          <button type="button" onClick={() => document.getElementById(`sar-recap-${ev.id}`).click()} disabled={busy}>
                            <i className="ti ti-upload" /> เลือกไฟล์
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal open={!!preview} onClose={() => setPreview(null)} size="lg">
        <ModalHead eyebrow="ตัวอย่างโปสเตอร์" icon="ti-photo" title={preview?.title || ''} onClose={() => setPreview(null)} />
        <div className="modal-body" style={{ padding: 0, maxHeight: '72vh', overflow: 'hidden', display: 'flex', justifyContent: 'center' }}>
          {preview && <img src={preview.url} alt={preview.title} style={{ display: 'block', maxWidth: '100%', maxHeight: '72vh', width: 'auto', height: 'auto', objectFit: 'contain' }} />}
        </div>
      </Modal>
    </div>
  );
}
