import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './ImageViewer.css';

// Zoom is relative to "fit to screen" (1 = the whole image visible).
const MIN = 1;
const MAX = 5;
const STEP = 1.4; // per button press / keyboard step
const DOUBLE_CLICK_ZOOM = 2.5;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Full-screen viewer with zoom and pan: buttons, mouse wheel, double click,
 * drag, pinch on touch screens, and keyboard (+ − 0, arrows, Esc).
 *
 * Shows either one image (`src`) or any content passed as children — e.g. a
 * certificate template with live text laid over it. Children need `aspect`
 * (width / height) so they can be fitted to the screen. `paper` puts a white
 * sheet behind an image, for transparent PNGs such as a signature.
 */
export default function ImageViewer({ open, src, title, onClose, children, aspect, paper }) {
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [fitWidth, setFitWidth] = useState(null); // children only: width that fits the stage
  const stageRef = useRef(null);
  const imgRef = useRef(null);
  const closeRef = useRef(null);
  const pointers = useRef(new Map());
  const gesture = useRef(null);

  // Keeps the image from being panned off into empty space: it can only move
  // as far as the part that overflows the stage.
  const constrain = useCallback((scale, x, y) => {
    const stage = stageRef.current;
    const img = imgRef.current;
    if (!stage || !img) return { scale, x: 0, y: 0 };
    const maxX = Math.max(0, (img.offsetWidth * scale - stage.clientWidth) / 2);
    const maxY = Math.max(0, (img.offsetHeight * scale - stage.clientHeight) / 2);
    return { scale, x: clamp(x, -maxX, maxX), y: clamp(y, -maxY, maxY) };
  }, []);

  // Zooms to `next`, keeping the point under (clientX, clientY) in place —
  // or the centre of the stage when no point is given (buttons, keyboard).
  const zoomTo = useCallback((next, clientX, clientY) => {
    setView((v) => {
      const scale = clamp(next, MIN, MAX);
      const rect = stageRef.current?.getBoundingClientRect();
      const px = rect && clientX !== undefined ? clientX - (rect.left + rect.width / 2) : 0;
      const py = rect && clientY !== undefined ? clientY - (rect.top + rect.height / 2) : 0;
      const ratio = scale / v.scale;
      return constrain(scale, px - (px - v.x) * ratio, py - (py - v.y) * ratio);
    });
  }, [constrain]);

  const zoomBy = useCallback((factor, cx, cy) => {
    setView((v) => {
      const scale = clamp(v.scale * factor, MIN, MAX);
      const rect = stageRef.current?.getBoundingClientRect();
      const px = rect && cx !== undefined ? cx - (rect.left + rect.width / 2) : 0;
      const py = rect && cy !== undefined ? cy - (rect.top + rect.height / 2) : 0;
      const ratio = scale / v.scale;
      return constrain(scale, px - (px - v.x) * ratio, py - (py - v.y) * ratio);
    });
  }, [constrain]);

  const reset = useCallback(() => setView({ scale: 1, x: 0, y: 0 }), []);

  // Open/close: start fitted, lock page scroll, move focus in and hand it back.
  useEffect(() => {
    if (!open) return undefined;
    reset();
    const previouslyFocused = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [open, src, reset]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      const pan = 60;
      if (e.key === 'Escape') onClose();
      else if (e.key === '+' || e.key === '=') zoomBy(STEP);
      else if (e.key === '-' || e.key === '_') zoomBy(1 / STEP);
      else if (e.key === '0') reset();
      else if (e.key === 'ArrowLeft') setView((v) => constrain(v.scale, v.x + pan, v.y));
      else if (e.key === 'ArrowRight') setView((v) => constrain(v.scale, v.x - pan, v.y));
      else if (e.key === 'ArrowUp') setView((v) => constrain(v.scale, v.x, v.y + pan));
      else if (e.key === 'ArrowDown') setView((v) => constrain(v.scale, v.x, v.y - pan));
      else return;
      // Handled here — don't let a modal underneath also react (e.g. close on Esc).
      e.preventDefault();
      e.stopPropagation();
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, onClose, zoomBy, reset, constrain]);

  // Wheel zoom needs a non-passive listener so the page behind doesn't scroll.
  useEffect(() => {
    const stage = stageRef.current;
    if (!open || !stage) return undefined;
    function onWheel(e) {
      e.preventDefault();
      zoomBy(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
    }
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, [open, zoomBy]);

  useEffect(() => {
    if (!open) return undefined;
    const onResize = () => setView((v) => constrain(v.scale, v.x, v.y));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open, constrain]);

  // An <img> fits itself with max-width/max-height; custom content has no
  // intrinsic size, so work out the largest box of its aspect ratio that fits.
  useEffect(() => {
    if (!open || !children || !aspect) return undefined;
    function fit() {
      const stage = stageRef.current;
      if (!stage) return;
      const cs = getComputedStyle(stage);
      const w = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const h = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      setFitWidth(Math.max(80, Math.floor(Math.min(w, h * aspect))));
    }
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [open, children, aspect]);

  if (!open || (!src && !children)) return null;

  function pinchState() {
    const [a, b] = [...pointers.current.values()];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
  }

  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      gesture.current = { type: 'pinch', ...pinchState(), scale: view.scale };
    } else {
      gesture.current = { type: 'pan', startX: e.clientX, startY: e.clientY, x: view.x, y: view.y, moved: false };
      setDragging(true);
    }
  }

  function onPointerMove(e) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;
    if (g.type === 'pinch' && pointers.current.size === 2) {
      const now = pinchState();
      zoomTo(g.scale * (now.dist / g.dist), now.cx, now.cy);
    } else if (g.type === 'pan') {
      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;
      if (Math.abs(dx) + Math.abs(dy) > 4) g.moved = true;
      setView((v) => constrain(v.scale, g.x + dx, g.y + dy));
    }
  }

  function onPointerUp(e) {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    // A click on the empty area around the image (not a drag) closes the viewer.
    // The image itself ignores pointer events, so test against its on-screen box.
    if (g?.type === 'pan' && !g.moved && pointers.current.size === 0) {
      const r = imgRef.current?.getBoundingClientRect();
      const onImage = r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!onImage) onClose();
    }
    gesture.current = null;
    setDragging(false);
  }

  function onDoubleClick(e) {
    if (view.scale > 1.01) reset();
    else zoomTo(DOUBLE_CLICK_ZOOM, e.clientX, e.clientY);
  }

  const zoomed = view.scale > 1.01;
  const pct = Math.round(view.scale * 100);

  return createPortal(
    <div className="iv" role="dialog" aria-modal="true" aria-label={title || 'ดูภาพ'}>
      <div className="iv-top">
        <span className="iv-title"><i className="ti ti-photo" /> {title}</span>
        <button type="button" className="iv-btn" ref={closeRef} onClick={onClose} aria-label="ปิด" title="ปิด (Esc)"><i className="ti ti-x" /></button>
      </div>

      <div
        className={`iv-stage${zoomed ? ' zoomed' : ''}${dragging && zoomed ? ' dragging' : ''}`}
        ref={stageRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
      >
        {children ? (
          <div
            ref={imgRef}
            className="iv-content"
            style={{ width: fitWidth ?? undefined, visibility: fitWidth ? undefined : 'hidden', transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transition: dragging ? 'none' : undefined }}
          >
            {children}
          </div>
        ) : (
          <img
            ref={imgRef}
            src={src}
            alt={title || ''}
            draggable={false}
            className={paper ? 'paper' : undefined}
            style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transition: dragging ? 'none' : undefined }}
          />
        )}
      </div>

      <div className="iv-bar">
        <button type="button" className="iv-btn" onClick={() => zoomBy(1 / STEP)} disabled={view.scale <= MIN} aria-label="ซูมออก" title="ซูมออก (−)"><i className="ti ti-minus" /></button>
        <span className="iv-pct" aria-live="polite">{pct}%</span>
        <button type="button" className="iv-btn" onClick={() => zoomBy(STEP)} disabled={view.scale >= MAX} aria-label="ซูมเข้า" title="ซูมเข้า (+)"><i className="ti ti-plus" /></button>
        <span className="iv-sep" />
        <button type="button" className="iv-btn text" onClick={reset} disabled={!zoomed} title="พอดีจอ (0)"><i className="ti ti-arrows-minimize" /> พอดีจอ</button>
      </div>
      <div className="iv-hint">เลื่อนล้อเมาส์หรือดับเบิลคลิกเพื่อซูม · ลากเพื่อเลื่อนภาพ</div>
    </div>,
    document.body,
  );
}
