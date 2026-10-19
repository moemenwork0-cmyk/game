/* مشوار — الخريطة
   خريطة مدينة مرسومة بالكود (SVG) عشان التجربة تشتغل من غير إنترنت ومن غير مفاتيح API.
   الواجهة (fit / flyTo / setMarker / drawRoute ...) معمولة بحيث نقدر نبدلها بعدين
   بـ Google Maps أو Mapbox من غير ما نغير باقي التطبيق. */
(function () {
  'use strict';
  window.MW = window.MW || {};

  const NS = 'http://www.w3.org/2000/svg';

  function mulberry(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const rnd = mulberry(20261019);

  // ---------- شبكة الشوارع ----------
  const COLS = 18, ROWS = 18;
  const VX = [], HY = [];
  { let x = 470; for (let i = 0; i < COLS; i++) { VX.push(Math.round(x)); x += 150 + rnd() * 70; } }
  { let y = 250; for (let j = 0; j < ROWS; j++) { HY.push(Math.round(y)); y += 140 + rnd() * 65; } }
  const W = VX[COLS - 1] + 320, H = HY[ROWS - 1] + 280;
  const MAIN_V = new Set([0, 3, 7, 11, 15]);
  const MAIN_H = new Set([2, 6, 10, 14]);
  const ROAD_MAIN = 30, ROAD_MINOR = 16;

  const V_NAMES = ['كورنيش الجاردن', 'شارع القصر العيني', 'شارع محمد فريد', 'شارع بورسعيد', 'شارع الجيش',
    'شارع رمسيس', 'شارع العباسية', 'شارع صلاح سالم', 'شارع النصر', 'شارع مكرم عبيد', 'شارع عباس العقاد',
    'شارع الطيران', 'شارع يوسف عباس', 'شارع الحجاز', 'شارع جسر السويس', 'شارع التسعين', 'شارع الشويفات', 'طريق السويس'];
  const H_NAMES = ['شارع الخليفة المأمون', 'شارع الميرغني', 'شارع العروبة', 'شارع بغداد', 'شارع الثورة',
    'شارع الحرية', 'شارع عمر بن الخطاب', 'شارع أحمد فخري', 'شارع مصطفى النحاس', 'شارع حسن المأمون',
    'شارع ٢٦ يوليو', 'شارع الأزهر', 'شارع مكة', 'شارع الطيران الجديد', 'طريق الأوتوستراد', 'شارع النزهة',
    'شارع الهضبة الوسطى', 'شارع اللاسلكي'];

  const riverC = (y) => 215 + 70 * Math.sin(y / 540 + 0.8);
  const RIVER_HALF = 100;
  const cornicheX = (y) => riverC(y) + RIVER_HALF + 48;

  const inAirport = (x, y) => x > VX[13] + 20 && y < HY[2] - 20;

  function segOpen(i1, j1, i2, j2) {
    if (j1 === j2) return !(j1 < 2 && Math.max(i1, i2) > 13);
    return !(i1 > 13 && Math.min(j1, j2) < 2);
  }

  // المدينة كلها مايلة شوية زي الخرايط الحقيقية
  const ANG = -14 * Math.PI / 180, CX = W / 2, CY = H / 2;
  const COS = Math.cos(ANG), SIN = Math.sin(ANG);
  const rot = (x, y) => ({ x: CX + (x - CX) * COS - (y - CY) * SIN, y: CY + (x - CX) * SIN + (y - CY) * COS });
  const nodeXY = (i, j) => rot(VX[i], HY[j]);

  // ---------- الحالة ----------
  let host, svg, overlay, routeLayer;
  let vw = 1, vh = 1, insetTop = 0, insetBottom = 0;
  const cam = { x: VX[8], y: HY[9], s: 0.42 };
  const MIN_S = 0.09, MAX_S = 1.4;
  let tween = null;
  const markers = new Map();
  const moveEndFns = [];
  const dragFns = [];
  let lastVB = '';

  // ---------- رسم المدينة ----------
  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function buildCity(places, districts) {
    el('rect', { x: -3000, y: -3000, width: W + 6000, height: H + 6000, class: 'm-land' }, svg);
    const g = el('g', { class: 'city', transform: 'rotate(' + (ANG * 180 / Math.PI) + ' ' + CX + ' ' + CY + ')' }, svg);

    // النيل
    let left = '', right = '', prom = '';
    for (let y = -200; y <= H + 200; y += 40) {
      left += (y === -200 ? 'M' : 'L') + (riverC(y) - RIVER_HALF).toFixed(1) + ' ' + y + ' ';
    }
    for (let y = H + 200; y >= -200; y -= 40) right += 'L' + (riverC(y) + RIVER_HALF).toFixed(1) + ' ' + y + ' ';
    el('path', { d: left + right + 'Z', class: 'm-water' }, g);
    for (let y = -200; y <= H + 200; y += 40) prom += (y === -200 ? 'M' : 'L') + (riverC(y) + RIVER_HALF + 14).toFixed(1) + ' ' + y + ' ';
    for (let y = H + 200; y >= -200; y -= 40) prom += 'L' + (cornicheX(y) - 24).toFixed(1) + ' ' + y + ' ';
    el('path', { d: prom + 'Z', class: 'm-park' }, g);

    // جزيرة الزمالك
    const iy = HY[3], ix = riverC(iy);
    el('path', { d: 'M' + (ix - 30) + ' ' + (iy - 260) + 'C' + (ix + 40) + ' ' + (iy - 200) + ' ' + (ix + 45) + ' ' + (iy + 120) + ' ' + (ix + 5) + ' ' + (iy + 300) +
      'C' + (ix - 40) + ' ' + (iy + 160) + ' ' + (ix - 52) + ' ' + (iy - 120) + ' ' + (ix - 30) + ' ' + (iy - 260) + 'Z', class: 'm-park' }, g);

    // البلوكات والمباني
    const parks = new Set(['3,8', '3,9', '4,8', '4,9', '7,5', '12,11', '13,4', '5,15', '9,13', '16,9', '1,12']);
    const lakes = new Set(['14,14']);
    const xs = [null].concat(VX, [W + 300]);
    const ys = [-300].concat(HY, [H + 300]);
    const blocks = el('g', {}, g);
    for (let a = 0; a < xs.length - 1; a++) {
      for (let b = 0; b < ys.length - 1; b++) {
        const i = a - 1, j = b - 1;
        const y0 = ys[b], y1 = ys[b + 1];
        const hwTop = b === 0 ? 0 : (MAIN_H.has(j) ? ROAD_MAIN : ROAD_MINOR) / 2 + 6;
        const hwBot = (MAIN_H.has(j + 1) ? ROAD_MAIN : ROAD_MINOR) / 2 + 6;
        let x0 = xs[a];
        const x1 = xs[a + 1];
        let hwL;
        if (x0 === null) { x0 = Math.max(cornicheX(y0), cornicheX(y1)); hwL = ROAD_MAIN / 2 + 6; }
        else hwL = (MAIN_V.has(i) ? ROAD_MAIN : ROAD_MINOR) / 2 + 6;
        const hwR = a + 1 >= xs.length - 1 ? 0 : (MAIN_V.has(i + 1) ? ROAD_MAIN : ROAD_MINOR) / 2 + 6;
        const bx = x0 + hwL, by = y0 + hwTop, bw = x1 - hwR - bx, bh = y1 - hwBot - by;
        if (bw < 20 || bh < 20) continue;
        if (inAirport(bx + bw / 2, by + bh / 2)) continue;
        const key = i + ',' + j;
        if (parks.has(key)) {
          el('rect', { x: bx, y: by, width: bw, height: bh, rx: 14, class: 'm-park' }, blocks);
          continue;
        }
        if (lakes.has(key)) {
          el('rect', { x: bx, y: by, width: bw, height: bh, rx: 14, class: 'm-park' }, blocks);
          el('ellipse', { cx: bx + bw / 2, cy: by + bh / 2, rx: bw * 0.36, ry: bh * 0.3, class: 'm-water' }, blocks);
          continue;
        }
      }
    }

    // المطار
    const ax = VX[13] + ROAD_MINOR / 2 + 10, ay = -300;
    el('rect', { x: ax, y: ay, width: W + 300 - ax, height: HY[2] - ROAD_MAIN / 2 - 10 - ay, rx: 18, class: 'm-airport' }, g);
    el('rect', { x: VX[14] - 40, y: HY[0] - 30, width: VX[17] - VX[14] + 200, height: 46, rx: 23, class: 'm-runway', transform: 'rotate(-8 ' + VX[15] + ' ' + HY[0] + ')' }, g);
    el('rect', { x: VX[14] + 40, y: HY[1] - 10, width: VX[17] - VX[14] + 120, height: 40, rx: 20, class: 'm-runway', transform: 'rotate(-8 ' + VX[15] + ' ' + HY[1] + ')' }, g);

    // الشوارع: كل الحواف الأول وبعدين الأسفلت عشان التقاطعات تبان نضيفة
    let minor = '', main = '';
    const add = (isMain, d) => { if (isMain) main += d; else minor += d; };
    for (let i = 0; i < COLS; i++) {
      const y0 = i > 13 ? HY[2] : -300;
      add(MAIN_V.has(i), 'M' + VX[i] + ' ' + y0 + 'V' + (H + 300));
    }
    for (let j = 0; j < ROWS; j++) {
      const x1 = j < 2 ? VX[13] : W + 300;
      add(MAIN_H.has(j), 'M' + cornicheX(HY[j]).toFixed(1) + ' ' + HY[j] + 'H' + x1);
    }
    let corn = '';
    for (let y = -300; y <= H + 300; y += 30) corn += (y === -300 ? 'M' : 'L') + cornicheX(y).toFixed(1) + ' ' + y;
    main += corn;
    // كباري على النيل
    const bridges = [2, 10].map((j) => 'M-400 ' + HY[j] + 'H' + cornicheX(HY[j]).toFixed(1)).join('');
    main += bridges;
    // محور مايل
    const diag = 'M' + VX[8] + ' ' + (H + 300) + 'L' + (W + 300) + ' ' + (HY[8] - 80);
    main += diag;

    // خطوط ملونة خفيفة على شوارع مختارة (زي حارات العجل والمواصلات)
    let tint = '';
    [3, 11].forEach((i) => { tint += 'M' + VX[i] + ' ' + HY[2] + 'V' + (H + 300); });
    [6, 14].forEach((j) => { tint += 'M' + cornicheX(HY[j]).toFixed(1) + ' ' + HY[j] + 'H' + (W + 300); });
    tint += diag;
    const roads = el('g', { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
    el('path', { d: minor, class: 'm-road-edge', 'stroke-width': ROAD_MINOR + 4 }, roads);
    el('path', { d: main, class: 'm-road-edge', 'stroke-width': ROAD_MAIN + 4 }, roads);
    el('path', { d: minor, class: 'm-road', 'stroke-width': ROAD_MINOR }, roads);
    el('path', { d: main, class: 'm-road-main', 'stroke-width': ROAD_MAIN }, roads);
    el('path', { d: tint, class: 'm-road-tint', 'stroke-width': 9 }, roads);

    // أسماء الشوارع
    const labels = el('g', { class: 'm-labels' }, g);
    for (let i = 0; i < COLS; i++) {
      if (!MAIN_V.has(i) && i % 2) continue;
      for (let j = 1; j < ROWS - 1; j += 4) {
        const y = (HY[j] + HY[j + 1]) / 2 + (i % 3) * 40;
        if (i > 13 && y < HY[2]) continue;
        const t = el('text', { x: VX[i], y: y, class: MAIN_V.has(i) ? 'm-label m-label-main' : 'm-label', transform: 'rotate(-90 ' + VX[i] + ' ' + y + ')', 'dominant-baseline': 'central', 'text-anchor': 'middle' }, labels);
        t.textContent = V_NAMES[i];
      }
    }
    for (let j = 0; j < ROWS; j++) {
      if (!MAIN_H.has(j) && j % 2) continue;
      for (let i = 1; i < COLS - 1; i += 4) {
        const x = (VX[i] + VX[i + 1]) / 2 + (j % 3) * 30;
        if (j < 2 && x > VX[13]) continue;
        const t = el('text', { x: x, y: HY[j], class: MAIN_H.has(j) ? 'm-label m-label-main' : 'm-label', 'dominant-baseline': 'central', 'text-anchor': 'middle' }, labels);
        t.textContent = H_NAMES[j];
      }
    }
    const ty = HY[13];
    const tn = el('text', { x: cornicheX(ty), y: ty + 90, class: 'm-label m-label-main', transform: 'rotate(-90 ' + cornicheX(ty) + ' ' + (ty + 90) + ')', 'dominant-baseline': 'central', 'text-anchor': 'middle' }, labels);
    tn.textContent = 'كورنيش النيل';
    const nile = el('text', { x: riverC(HY[9]), y: HY[9], class: 'm-water-label', transform: 'rotate(-90 ' + riverC(HY[9]) + ' ' + HY[9] + ')', 'dominant-baseline': 'central', 'text-anchor': 'middle' }, labels);
    nile.textContent = 'نهر النيل';
    const apt = el('text', { x: (VX[14] + VX[16]) / 2 + 60, y: HY[1] + 70, class: 'm-district', 'text-anchor': 'middle' }, labels);
    apt.textContent = 'مطار القاهرة';

    for (const d of districts) {
      const x = VX[0] + (VX[COLS - 1] - VX[0]) * (d.i / (COLS - 1));
      const y = HY[0] + (HY[ROWS - 1] - HY[0]) * (d.j / (ROWS - 1));
      const t = el('text', { x: x, y: y, class: 'm-district', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, labels);
      t.textContent = d.name;
    }

    // نقط الأماكن المعروفة
    const pois = el('g', { class: 'm-pois' }, g);
    for (const p of places) {
      if (p.saved) continue;
      const { x, y } = nodeXY(p.i, p.j);
      el('circle', { cx: x + 26, cy: y - 26, r: 9, class: 'm-poi' }, pois);
      const t = el('text', { x: x + 42, y: y - 26, class: 'm-poi-label', 'dominant-baseline': 'central', 'text-anchor': 'end' }, pois);
      t.textContent = p.title;
    }

    routeLayer = el('g', { class: 'route-layer' }, svg);
  }

  // ---------- الكاميرا ----------
  function visCenterY() { return insetTop + (vh - insetTop - insetBottom) / 2; }

  function viewBox() {
    return { x: cam.x - (vw / 2) / cam.s, y: cam.y - visCenterY() / cam.s, w: vw / cam.s, h: vh / cam.s };
  }

  function project(x, y) {
    const vb = viewBox();
    return { x: (x - vb.x) * cam.s, y: (y - vb.y) * cam.s };
  }

  function clampCam(c) {
    c.s = Math.min(MAX_S, Math.max(MIN_S, c.s));
    c.x = Math.min(W, Math.max(0, c.x));
    c.y = Math.min(H, Math.max(0, c.y));
    return c;
  }

  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  function flyTo(x, y, s, dur) {
    const to = clampCam({ x: x, y: y, s: s || cam.s });
    if (!dur) { tween = null; cam.x = to.x; cam.y = to.y; cam.s = to.s; return; }
    tween = { from: { x: cam.x, y: cam.y, s: cam.s }, to: to, t0: performance.now(), dur: dur };
  }

  function fit(points, opt) {
    opt = opt || {};
    if (!points.length) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of points) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
    const pad = opt.pad != null ? opt.pad : 64;
    const availW = Math.max(60, vw - pad * 2);
    const availH = Math.max(60, vh - insetTop - insetBottom - pad * 2 - (opt.extraTop || 0));
    const bw = Math.max(x1 - x0, 1), bh = Math.max(y1 - y0, 1);
    let s = Math.min(availW / bw, availH / bh);
    s = Math.min(opt.maxS || 0.7, s);
    flyTo((x0 + x1) / 2, (y0 + y1) / 2 - (opt.extraTop || 0) / 2 / s, s, opt.dur == null ? 900 : opt.dur);
  }

  // ---------- العلامات ----------
  function setMarker(id, o) {
    let m = markers.get(id);
    if (!m) {
      const e = document.createElement('div');
      e.className = 'mk ' + (o.cls || '');
      e.innerHTML = o.html || '';
      overlay.appendChild(e);
      m = { el: e, x: 0, y: 0, angle: null, anchor: o.anchor || 'center', z: o.z || 0, scale: !!o.scale };
      if (o.z) e.style.zIndex = o.z;
      markers.set(id, m);
      e.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'ease-out' });
    }
    if (o.x != null) { m.x = o.x; m.y = o.y; }
    if (o.angle != null) m.angle = o.angle;
    if (o.html != null && o.html !== m.html) { m.el.innerHTML = o.html; m.html = o.html; }
    return m.el;
  }

  function removeMarker() {
    for (const id of arguments) {
      const m = markers.get(id);
      if (!m) continue;
      markers.delete(id);
      const e = m.el;
      const a = e.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: 'ease-in' });
      a.onfinish = () => e.remove();
    }
  }

  function removeMarkersWhere(fn) {
    for (const id of Array.from(markers.keys())) if (fn(id)) removeMarker(id);
  }

  function hasMarker(id) { return markers.has(id); }

  // ---------- المسارات ----------
  function route(a, b) {
    const pts = [nodeXY(a.i, a.j)];
    if (a.i === b.i || a.j === b.j) {
      pts.push(nodeXY(b.i, b.j));
    } else {
      const lo = Math.min(a.j, b.j), hi = Math.max(a.j, b.j), mid = (lo + hi) / 2;
      let jm = Array.from(MAIN_H).filter((j) => j >= lo && j <= hi)
        .sort((p, q) => Math.abs(p - mid) - Math.abs(q - mid))[0];
      if (jm === undefined) jm = b.j;
      pts.push(nodeXY(a.i, jm), nodeXY(b.i, jm), nodeXY(b.i, b.j));
    }
    return pts.filter((p, k) => k === 0 || p.x !== pts[k - 1].x || p.y !== pts[k - 1].y);
  }

  function pathLength(pts) {
    let L = 0;
    for (let k = 1; k < pts.length; k++) L += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y);
    return L;
  }

  function pointAt(pts, d) {
    if (pts.length === 1) return { x: pts[0].x, y: pts[0].y, angle: 0, k: 0 };
    let acc = 0;
    for (let k = 1; k < pts.length; k++) {
      const a = pts[k - 1], b = pts[k];
      const L = Math.hypot(b.x - a.x, b.y - a.y);
      if (acc + L >= d || k === pts.length - 1) {
        const t = L ? Math.min(1, Math.max(0, (d - acc) / L)) : 1;
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle: Math.atan2(b.x - a.x, -(b.y - a.y)) * 180 / Math.PI, k: k };
      }
      acc += L;
    }
    return { x: pts[0].x, y: pts[0].y, angle: 0, k: 0 };
  }

  function slicePath(pts, d) {
    const p = pointAt(pts, d);
    return [{ x: p.x, y: p.y }].concat(pts.slice(p.k));
  }

  function toD(pts) { return pts.map((p, k) => (k ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(''); }

  // style: main | approach | ghost
  function drawRoute(id, pts, style) {
    let g = routeLayer.querySelector('[data-id="' + id + '"]');
    if (!g) {
      g = el('g', { 'data-id': id, class: 'rt rt-' + style }, routeLayer);
      el('path', { class: 'rt-casing', 'vector-effect': 'non-scaling-stroke' }, g);
      el('path', { class: 'rt-core', 'vector-effect': 'non-scaling-stroke' }, g);
      g.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 450 });
    }
    const d = toD(pts);
    for (const p of g.children) p.setAttribute('d', d);
    return g;
  }

  function clearRoute(id) {
    if (!id) { routeLayer.innerHTML = ''; return; }
    const g = routeLayer.querySelector('[data-id="' + id + '"]');
    if (g) g.remove();
  }

  // ---------- عربيات رايحة جاية ----------
  const ambient = { on: false, cars: [], zone: { i: 8, j: 9 } };

  function neighbors(n) {
    return [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .map((d) => ({ i: n.i + d[0], j: n.j + d[1] }))
      .filter((m) => m.i >= 0 && m.i < COLS && m.j >= 0 && m.j < ROWS && segOpen(n.i, n.j, m.i, m.j) &&
        Math.abs(m.i - ambient.zone.i) <= 5 && Math.abs(m.j - ambient.zone.j) <= 5);
  }

  function pickNext(cur, prev) {
    const ns = neighbors(cur);
    const fwd = ns.filter((m) => !prev || m.i !== prev.i || m.j !== prev.j);
    const arr = fwd.length ? fwd : ns;
    return arr[(Math.random() * arr.length) | 0] || prev;
  }

  function setAmbient(on, zone) {
    if (zone) ambient.zone = zone;
    ambient.on = on;
    if (on && !ambient.cars.length) {
      for (let k = 0; k < 9; k++) {
        const from = {
          i: Math.max(0, Math.min(COLS - 1, ambient.zone.i - 4 + ((Math.random() * 9) | 0))),
          j: Math.max(2, Math.min(ROWS - 1, ambient.zone.j - 4 + ((Math.random() * 9) | 0))),
        };
        const c = { id: 'amb' + k, color: ['white', 'black', 'white', 'silver'][k % 4], from: from, prev: null, to: null, t: Math.random() * 100, speed: 70 + Math.random() * 60, angle: null };
        c.to = pickNext(from, null);
        if (!c.to) continue;
        ambient.cars.push(c);
      }
    }
    if (!on) {
      for (const c of ambient.cars) removeMarker(c.id);
      ambient.cars = [];
    }
  }

  function stepAmbient(dt) {
    for (const c of ambient.cars) {
      const a = nodeXY(c.from.i, c.from.j), b = nodeXY(c.to.i, c.to.j);
      let L = Math.hypot(b.x - a.x, b.y - a.y);
      c.t += c.speed * dt;
      if (c.t >= L) {
        c.t -= L; c.prev = c.from; c.from = c.to; c.to = pickNext(c.from, c.prev) || c.prev;
      }
      const p = nodeXY(c.from.i, c.from.j), q = nodeXY(c.to.i, c.to.j);
      L = Math.hypot(q.x - p.x, q.y - p.y) || 1;
      const t = Math.min(1, c.t / L);
      const dx = (q.x - p.x) / L, dy = (q.y - p.y) / L;
      const target = Math.atan2(dx, -dy) * 180 / Math.PI;
      c.angle = c.angle == null ? target : turnToward(c.angle, target, dt * 360);
      setMarker(c.id, { x: p.x + (q.x - p.x) * t - dy * 7, y: p.y + (q.y - p.y) * t + dx * 7, angle: c.angle, cls: 'mk-car', html: MW.carTop(c.color) });
    }
  }

  function turnToward(a, b, maxStep) {
    let d = ((b - a + 540) % 360) - 180;
    if (Math.abs(d) <= maxStep) return b;
    return a + Math.sign(d) * maxStep;
  }

  // ---------- الإطار ----------
  let lastT = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    if (tween) {
      const t = Math.min(1, (now - tween.t0) / tween.dur);
      const e = ease(t);
      const f = tween.from, to = tween.to;
      cam.x = f.x + (to.x - f.x) * e;
      cam.y = f.y + (to.y - f.y) * e;
      cam.s = Math.exp(Math.log(f.s) + (Math.log(to.s) - Math.log(f.s)) * e);
      if (t >= 1) { tween = null; moveEndFns.forEach((fn) => fn()); }
    }
    if (ambient.on) stepAmbient(dt);
    const vb = viewBox();
    const vbs = vb.x.toFixed(2) + ' ' + vb.y.toFixed(2) + ' ' + vb.w.toFixed(2) + ' ' + vb.h.toFixed(2);
    if (vbs !== lastVB) { svg.setAttribute('viewBox', vbs); lastVB = vbs; }
    const k = Math.min(1.2, Math.max(0.7, Math.pow(cam.s / 0.42, 0.35)));
    for (const m of markers.values()) {
      const px = (m.x - vb.x) * cam.s, py = (m.y - vb.y) * cam.s;
      let tf = 'translate3d(' + px.toFixed(1) + 'px,' + py.toFixed(1) + 'px,0) translate(-50%,' + (m.anchor === 'bottom' ? '-100%' : '-50%') + ')';
      if (m.angle != null) tf += ' rotate(' + m.angle.toFixed(1) + 'deg) scale(' + k.toFixed(3) + ')';
      m.el.style.transform = tf;
    }
    requestAnimationFrame(frame);
  }

  // ---------- السحب والتكبير ----------
  function bindGestures() {
    const pts = new Map();
    let start = null;
    host.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      host.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      tween = null;
      start = snapshot();
      host.classList.add('dragging');
    });
    host.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const now = snapshot();
      if (!start || !now) return;
      const s = Math.min(MAX_S, Math.max(MIN_S, start.s0 * (now.dist && start.dist ? now.dist / start.dist : 1)));
      cam.s = s;
      // النقطة اللي تحت الصوابع تفضل ثابتة
      cam.x = start.wx - (now.cx - vw / 2) / s;
      cam.y = start.wy - (now.cy - visCenterY()) / s;
      clampCam(cam);
      if (Math.abs(now.cx - start.cx) + Math.abs(now.cy - start.cy) > 4) dragFns.forEach((fn) => fn());
    });
    const end = (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      start = pts.size ? snapshot() : null;
      if (!pts.size) { host.classList.remove('dragging'); moveEndFns.forEach((fn) => fn()); }
    };
    host.addEventListener('pointerup', end);
    host.addEventListener('pointercancel', end);
    host.addEventListener('wheel', (e) => {
      e.preventDefault();
      tween = null;
      const r = host.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const vb = viewBox();
      const wx = vb.x + mx / cam.s, wy = vb.y + my / cam.s;
      cam.s = Math.min(MAX_S, Math.max(MIN_S, cam.s * Math.exp(-e.deltaY * 0.0015)));
      cam.x = wx - (mx - vw / 2) / cam.s;
      cam.y = wy - (my - visCenterY()) / cam.s;
      clampCam(cam);
      clearTimeout(bindGestures.wt);
      bindGestures.wt = setTimeout(() => moveEndFns.forEach((fn) => fn()), 200);
    }, { passive: false });

    function snapshot() {
      if (!pts.size) return null;
      const r = host.getBoundingClientRect();
      const arr = Array.from(pts.values());
      const cx = arr.reduce((s, p) => s + p.x, 0) / arr.length - r.left;
      const cy = arr.reduce((s, p) => s + p.y, 0) / arr.length - r.top;
      const dist = arr.length > 1 ? Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y) : 0;
      const vb = viewBox();
      return { cx: cx, cy: cy, dist: dist, s0: cam.s, wx: vb.x + cx / cam.s, wy: vb.y + cy / cam.s };
    }
  }

  // ---------- أدوات ----------
  function nearestNode(x, y) {
    let bi = 0, bj = 2, bd = Infinity;
    for (let i = 0; i < COLS; i++) {
      for (let j = 0; j < ROWS; j++) {
        if (i > 13 && j < 2) continue;
        const q = nodeXY(i, j);
        const d = Math.hypot(q.x - x, q.y - y);
        if (d < bd) { bd = d; bi = i; bj = j; }
      }
    }
    return { i: bi, j: bj };
  }

  function describeNode(n, districts) {
    let best = districts[0], bd = Infinity;
    for (const d of districts) {
      const dd = Math.hypot(d.i - n.i, d.j - n.j);
      if (dd < bd) { bd = dd; best = d; }
    }
    const street = (n.i + n.j) % 2 ? V_NAMES[n.i] : H_NAMES[n.j];
    const cross = (n.i + n.j) % 2 ? H_NAMES[n.j] : V_NAMES[n.i];
    return { title: street, sub: 'تقاطع ' + cross.replace('شارع ', '') + '، ' + best.name };
  }

  function init(container, places, districts) {
    host = container;
    svg = el('svg', { class: 'map-svg', preserveAspectRatio: 'xMidYMid slice' }, host);
    overlay = document.createElement('div');
    overlay.className = 'map-overlay';
    host.appendChild(overlay);
    buildCity(places, districts);
    const ro = new ResizeObserver(() => { const r = host.getBoundingClientRect(); vw = r.width || 1; vh = r.height || 1; });
    ro.observe(host);
    const r = host.getBoundingClientRect(); vw = r.width || 1; vh = r.height || 1;
    bindGestures();
    requestAnimationFrame(frame);
  }

  MW.map = {
    init: init,
    nodeXY: nodeXY,
    route: route,
    pathLength: pathLength,
    pointAt: pointAt,
    slicePath: slicePath,
    drawRoute: drawRoute,
    clearRoute: clearRoute,
    setMarker: setMarker,
    removeMarker: removeMarker,
    removeMarkersWhere: removeMarkersWhere,
    hasMarker: hasMarker,
    flyTo: flyTo,
    fit: fit,
    setAmbient: setAmbient,
    nearestNode: nearestNode,
    describeNode: describeNode,
    project: project,
    center: () => ({ x: cam.x, y: cam.y }),
    scale: () => cam.s,
    setInsets: (top, bottom) => { insetTop = top; insetBottom = bottom; },
    visibleCenterY: visCenterY,
    onMoveEnd: (fn) => moveEndFns.push(fn),
    onDrag: (fn) => dragFns.push(fn),
    size: { cols: COLS, rows: ROWS },
  };
})();
