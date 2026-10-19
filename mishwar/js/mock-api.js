/* مشوار — خدمة الرحلات (نسخة تجريبية)
   كل حاجة هنا محاكاة: الكباتن والعروض وحركة العربية.
   التطبيق بيكلم الخدمة دي بس من خلال الدوال اللي تحت (estimate / requestRide / accept / cancel)
   وبيسمع للأحداث (offer / offer-expired / phase / update / completed).
   لما يبقى عندنا سيرفر حقيقي، نكتب ملف بنفس الواجهة دي بيكلم الـ API والـ WebSocket. */
(function () {
  'use strict';
  window.MW = window.MW || {};

  const KM_PER_UNIT = 0.0062;
  const AR = '٠١٢٣٤٥٦٧٨٩';
  const ar = (v) => String(v).replace(/\d/g, (d) => AR[d]);

  const NAMES = ['محمود عادل', 'كريم حسن', 'مصطفى إبراهيم', 'عمر خالد', 'يوسف طارق', 'حسام فتحي',
    'شريف نبيل', 'أحمد سامي', 'إسلام رضا', 'محمد عبد الرحمن', 'طارق منصور', 'هشام جمال'];
  const CARS = [
    { model: 'تويوتا كورولا', color: 'أبيض', hex: '#F4F4F6' },
    { model: 'هيونداي إلنترا', color: 'أسود', hex: '#1B1C1F' },
    { model: 'كيا سيراتو', color: 'فضي', hex: '#C9CCD2' },
    { model: 'نيسان صني', color: 'رمادي', hex: '#7D8088' },
    { model: 'شيفروليه أوبترا', color: 'كحلي', hex: '#26324A' },
    { model: 'سكودا أوكتافيا', color: 'أبيض', hex: '#F4F4F6' },
    { model: 'إم جي ٥', color: 'أحمر', hex: '#A3261E' },
    { model: 'بيجو ٣٠١', color: 'بيج', hex: '#CDBFA6' },
  ];
  const LETTERS = 'أبجدرسصطعفقلمنهوى';

  function emitter() {
    const h = {};
    return {
      on(e, f) { (h[e] || (h[e] = [])).push(f); return this; },
      emit(e, d) { (h[e] || []).slice().forEach((f) => f(d)); },
      clear() { for (const k in h) delete h[k]; },
    };
  }

  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const round5 = (v) => Math.max(25, Math.round(v / 5) * 5);

  function estimate(pickup, dest) {
    const pts = MW.map.route(pickup, dest);
    const len = MW.map.pathLength(pts);
    const km = Math.max(1.4, len * KM_PER_UNIT);
    const min = Math.max(5, Math.round(km / 27 * 60 + 2));
    const price = round5(18 + km * 5.4 + min * 0.85);
    return { pts: pts, km: km, min: min, price: price };
  }

  let seq = 0;
  const usedNames = new Set();

  function makeDriver() {
    let name = pick(NAMES), guard = 0;
    while (usedNames.has(name) && guard++ < 20) name = pick(NAMES);
    usedNames.add(name);
    const car = pick(CARS);
    let letters = '';
    for (let k = 0; k < 3; k++) letters += LETTERS[(Math.random() * LETTERS.length) | 0];
    return {
      id: 'd' + (++seq),
      seed: seq + ((Math.random() * 6) | 0),
      name: name,
      rating: Math.round((4.6 + Math.random() * 0.39) * 100) / 100,
      trips: 300 + ((Math.random() * 4800) | 0),
      years: 1 + ((Math.random() * 6) | 0),
      car: car,
      plate: { letters: letters, digits: ar(100 + ((Math.random() * 9800) | 0)) },
      phone: '+٢٠ ١' + ar((Math.random() * 3) | 0) + ' ' + ar(1000 + ((Math.random() * 8999) | 0)) + ' ' + ar(1000 + ((Math.random() * 8999) | 0)),
    };
  }

  function startNodeNear(p, dist) {
    const S = MW.map.size;
    for (let tries = 0; tries < 30; tries++) {
      const di = ((Math.random() * (dist * 2 + 1)) | 0) - dist;
      const dj = (dist - Math.abs(di)) * (Math.random() < 0.5 ? -1 : 1);
      const n = { i: p.i + di, j: p.j + dj };
      if (n.i < 0 || n.i >= S.cols || n.j < 2 || n.j >= S.rows) continue;
      if (n.i === p.i && n.j === p.j) continue;
      return n;
    }
    return { i: Math.min(S.cols - 1, p.i + 1), j: Math.min(S.rows - 1, p.j + 1) };
  }

  // طلب مشوار: العروض بتوصل واحد ورا التاني
  function requestRide(opts) {
    const ev = emitter();
    const timers = [];
    const offers = new Map();
    let active = true, count = 0;
    usedNames.clear();

    function schedule(ms) {
      timers.push(setTimeout(() => {
        if (!active) return;
        if (offers.size < 4 && count < 9) {
          count++;
          const dist = 1 + ((Math.random() * 3) | 0);
          const start = startNodeNear(opts.pickup, dist);
          const approachPts = MW.map.route(start, opts.pickup);
          const eta = Math.max(2, Math.round(MW.map.pathLength(approachPts) * KM_PER_UNIT / 22 * 60) + 1);
          const r = Math.random();
          const price = r < 0.55 ? opts.price : opts.price + (r < 0.85 ? 5 : 10);
          const offer = { id: 'o' + (++seq), driver: makeDriver(), eta: eta, price: price, start: start, approachPts: approachPts, ttl: 30000, at: Date.now() };
          offers.set(offer.id, offer);
          ev.emit('offer', offer);
          timers.push(setTimeout(() => {
            if (!active || !offers.has(offer.id)) return;
            offers.delete(offer.id);
            ev.emit('offer-expired', offer);
          }, offer.ttl));
        }
        schedule(2600 + Math.random() * 2600);
      }, ms));
    }
    schedule(2400);

    return {
      on: ev.on.bind(ev),
      decline(id) { const o = offers.get(id); offers.delete(id); return o; },
      cancel() { active = false; timers.forEach(clearTimeout); ev.clear(); },
      accept(id) {
        const offer = offers.get(id);
        active = false; timers.forEach(clearTimeout); ev.clear();
        return startTrip(offer, opts);
      },
    };
  }

  // الرحلة: الكابتن جاي ← وصل ← في الطريق ← وصلتوا
  function startTrip(offer, opts) {
    const ev = emitter();
    const est = estimate(opts.pickup, opts.dest);
    const approach = offer.approachPts;
    const approachLen = MW.map.pathLength(approach);
    const tripLen = MW.map.pathLength(est.pts);
    // مدد مضغوطة عشان التجربة تخلص في أقل من دقيقة
    const plan = [
      { phase: 'accepted', ms: 1600 },
      { phase: 'coming', ms: Math.min(16000, Math.max(9000, approachLen * 9)) },
      { phase: 'arrived', ms: 5500 },
      { phase: 'ontrip', ms: Math.min(26000, Math.max(14000, tripLen * 5.5)) },
    ];
    let idx = -1, t0 = 0, raf = 0, stopped = false;
    const pin = ar(1000 + ((Math.random() * 8999) | 0));
    const startedAt = new Date();

    function next() {
      idx++;
      if (idx >= plan.length) {
        stopped = true;
        ev.emit('completed', {
          km: est.km, min: est.min, price: offer.price, startedAt: startedAt, endedAt: new Date(),
        });
        return;
      }
      t0 = performance.now();
      ev.emit('phase', { phase: plan[idx].phase });
    }

    function tick(now) {
      if (stopped) return;
      const step = plan[idx];
      const t = Math.min(1, (now - t0) / step.ms);
      let pos, eta = 0, remaining = null;
      if (step.phase === 'accepted') {
        pos = MW.map.pointAt(approach, 0);
        eta = offer.eta; remaining = approach;
      } else if (step.phase === 'coming') {
        const e = t < 0.08 ? t * t / 0.16 : t - 0.04; // انطلاق ناعم
        const d = Math.min(1, e / 0.96) * approachLen;
        pos = MW.map.pointAt(approach, d);
        remaining = MW.map.slicePath(approach, d);
        eta = Math.max(1, Math.ceil(offer.eta * (1 - t)));
      } else if (step.phase === 'arrived') {
        pos = MW.map.pointAt(est.pts, 0);
        pos.angle = MW.map.pointAt(approach, approachLen).angle;
        remaining = est.pts;
        eta = est.min;
      } else {
        const e = t < 0.06 ? t * t / 0.12 : t - 0.03;
        const d = Math.min(1, e / 0.97) * tripLen;
        pos = MW.map.pointAt(est.pts, d);
        remaining = MW.map.slicePath(est.pts, d);
        eta = Math.max(1, Math.ceil(est.min * (1 - t)));
      }
      ev.emit('update', { phase: step.phase, pos: pos, eta: eta, progress: t, remaining: remaining });
      if (t >= 1) next();
      if (!stopped) raf = requestAnimationFrame(tick);
    }

    setTimeout(() => { next(); raf = requestAnimationFrame(tick); }, 0);

    return {
      on: ev.on.bind(ev),
      offer: offer,
      estimate: est,
      pin: pin,
      cancel() { stopped = true; cancelAnimationFrame(raf); ev.clear(); },
      // للتجربة بس: تسريع المرحلة الحالية
      skip() { if (!stopped && idx >= 0) t0 = performance.now() - plan[idx].ms; },
    };
  }

  MW.rides = { estimate: estimate, requestRide: requestRide, KM_PER_UNIT: KM_PER_UNIT };
})();
