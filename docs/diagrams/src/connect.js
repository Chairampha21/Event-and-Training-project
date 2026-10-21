// Draws connectors between boxes of a diagram page into one SVG overlay.
// connect(a, b, {from: 'right', to: 'left', route: 'elbow'|'straight', color,
//   dash, width, start: marker, end: marker, label, labelAt})
// Markers: 'arrow', 'open' (open arrowhead), 'hollow' (generalisation),
// 'one', 'many', 'zeroOne' (crow's foot ends).
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  let svg, defs, root;
  const made = new Set();

  function init() {
    root = document.getElementById('canvas');
    svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'wires');
    svg.setAttribute('width', root.scrollWidth);
    svg.setAttribute('height', root.scrollHeight);
    defs = document.createElementNS(NS, 'defs');
    svg.appendChild(defs);
    root.appendChild(svg);
  }

  function marker(kind, color) {
    const id = `m-${kind}-${color.replace(/[^a-z0-9]/gi, '')}`;
    if (made.has(id)) return `url(#${id})`;
    made.add(id);
    const m = document.createElementNS(NS, 'marker');
    m.setAttribute('id', id);
    m.setAttribute('orient', 'auto-start-reverse');
    m.setAttribute('markerUnits', 'userSpaceOnUse');
    const shapes = {
      arrow: ['0 0 12 12', 11, 6, 12, 12, `<path d="M0,1 L12,6 L0,11 Z" fill="${color}"/>`],
      open: ['0 0 12 12', 11, 6, 12, 12, `<path d="M1,1 L11,6 L1,11" fill="none" stroke="${color}" stroke-width="1.6"/>`],
      hollow: ['0 0 18 18', 17, 9, 18, 18, `<path d="M1,1 L17,9 L1,17 Z" fill="#fff" stroke="${color}" stroke-width="1.6"/>`],
      one: ['0 0 20 20', 19, 10, 20, 20, `<path d="M8,3 V17 M13,3 V17" stroke="${color}" stroke-width="1.6"/>`],
      many: ['0 0 20 20', 19, 10, 20, 20, `<path d="M19,2 L6,10 L19,18 M6,10 H20 M4,3 V17" fill="none" stroke="${color}" stroke-width="1.6"/>`],
      zeroOne: ['0 0 24 20', 23, 10, 24, 20, `<circle cx="6" cy="10" r="4.5" fill="#fff" stroke="${color}" stroke-width="1.6"/><path d="M15,3 V17" stroke="${color}" stroke-width="1.6"/>`],
    };
    const [vb, rx, ry, w, h, body] = shapes[kind];
    m.setAttribute('viewBox', vb);
    m.setAttribute('refX', rx);
    m.setAttribute('refY', ry);
    m.setAttribute('markerWidth', w);
    m.setAttribute('markerHeight', h);
    m.innerHTML = body;
    defs.appendChild(m);
    return `url(#${id})`;
  }

  function anchor(el, side, shift = 0) {
    const r = el.getBoundingClientRect();
    const o = root.getBoundingClientRect();
    const x = r.left - o.left, y = r.top - o.top;
    switch (side) {
      case 'left': return [x, y + r.height / 2 + shift];
      case 'right': return [x + r.width, y + r.height / 2 + shift];
      case 'top': return [x + r.width / 2 + shift, y];
      case 'bottom': return [x + r.width / 2 + shift, y + r.height];
      default: { // nearest point on an ellipse/box edge towards a point
        return [x + r.width / 2, y + r.height / 2];
      }
    }
  }

  // Point where the line from the centre of el towards (tx, ty) leaves el's ellipse.
  function ellipseEdge(el, tx, ty) {
    const r = el.getBoundingClientRect();
    const o = root.getBoundingClientRect();
    const cx = r.left - o.left + r.width / 2, cy = r.top - o.top + r.height / 2;
    const a = r.width / 2, b = r.height / 2;
    const dx = tx - cx, dy = ty - cy;
    const k = 1 / Math.sqrt((dx * dx) / (a * a) + (dy * dy) / (b * b));
    return [cx + dx * k, cy + dy * k];
  }

  function center(el) { return anchor(el, 'center'); }

  window.connect = function (a, b, opt = {}) {
    if (!svg) init();
    if (typeof a === 'string') a = document.getElementById(a);
    if (typeof b === 'string') b = document.getElementById(b);
    if (!a || !b) { console.warn('connect: missing', a, b); return; }
    const color = opt.color || '#55607a';
    let p1, p2;
    if (opt.from === 'edge' || opt.to === 'edge') {
      const ca = center(a), cb = center(b);
      p1 = opt.from === 'edge' ? ellipseEdge(a, ...cb) : anchor(a, opt.from, opt.fromShift);
      p2 = opt.to === 'edge' ? ellipseEdge(b, ...(opt.from === 'edge' ? ca : p1)) : anchor(b, opt.to, opt.toShift);
      if (opt.from === 'edge' && opt.to !== 'edge') p1 = ellipseEdge(a, ...p2);
    } else {
      p1 = anchor(a, opt.from || 'right', opt.fromShift);
      p2 = anchor(b, opt.to || 'left', opt.toShift);
    }
    let d;
    if (opt.via) {
      // Through fixed points; an ellipse end meets the first / last of them.
      const first = opt.via[0], last = opt.via[opt.via.length - 1];
      if (opt.from === 'edge') p1 = ellipseEdge(a, ...first);
      if (opt.to === 'edge') p2 = ellipseEdge(b, ...last);
      d = `M${p1[0]},${p1[1]} ` + opt.via.map((q) => `L${q[0]},${q[1]}`).join(' ') + ` L${p2[0]},${p2[1]}`;
    } else if (opt.route === 'elbow') {
      const horiz = ['left', 'right'].includes(opt.from || 'right');
      if (horiz) {
        const mx = opt.midX != null ? opt.midX : (p1[0] + p2[0]) / 2;
        d = `M${p1[0]},${p1[1]} H${mx} V${p2[1]} H${p2[0]}`;
      } else {
        const my = opt.midY != null ? opt.midY : (p1[1] + p2[1]) / 2;
        d = `M${p1[0]},${p1[1]} V${my} H${p2[0]} V${p2[1]}`;
      }
    } else if (opt.route === 'hv') {
      d = `M${p1[0]},${p1[1]} H${p2[0]} V${p2[1]}`;
    } else if (opt.route === 'vh') {
      d = `M${p1[0]},${p1[1]} V${p2[1]} H${p2[0]}`;
    } else {
      d = `M${p1[0]},${p1[1]} L${p2[0]},${p2[1]}`;
    }
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', opt.width || 1.6);
    if (opt.dash) path.setAttribute('stroke-dasharray', opt.dash);
    if (opt.start) path.setAttribute('marker-start', marker(opt.start, color));
    if (opt.end) path.setAttribute('marker-end', marker(opt.end, color));
    svg.appendChild(path);
    if (opt.label) {
      const t = path.getTotalLength();
      const pt = path.getPointAtLength(t * (opt.labelAt != null ? opt.labelAt : 0.5));
      const g = document.createElementNS(NS, 'g');
      const text = document.createElementNS(NS, 'text');
      text.setAttribute('x', pt.x + (opt.labelDx || 0));
      text.setAttribute('y', pt.y + (opt.labelDy || 0));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('class', 'wire-label');
      text.setAttribute('fill', opt.labelColor || color);
      text.textContent = opt.label;
      g.appendChild(text);
      svg.appendChild(g);
      const bb = text.getBBox();
      const bg = document.createElementNS(NS, 'rect');
      bg.setAttribute('x', bb.x - 5); bg.setAttribute('y', bb.y - 2);
      bg.setAttribute('width', bb.width + 10); bg.setAttribute('height', bb.height + 4);
      bg.setAttribute('rx', 4); bg.setAttribute('fill', opt.labelBg || '#fff');
      g.insertBefore(bg, text);
    }
  };
})();
