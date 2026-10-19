/* مشوار — التطبيق
   الشاشات: الرئيسية ← تخطيط المشوار ← التفاصيل والسعر ← العروض ← الرحلة ← التقييم
   + حسابي (المشاوير السابقة، الأماكن، الدفع، الإعدادات، المساعدة، عن التطبيق) */
(function () {
  'use strict';
  const D = MW.data, M = MW.map, R = MW.rides, I = MW.icon, F = MW.fill, P = MW.pic;
  const app = document.getElementById('app');
  const sheet = document.getElementById('sheet');
  const sheetBody = document.getElementById('sheetBody');
  const topbar = document.getElementById('topbar');
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  // ---------- تنسيق ----------
  const AR = '٠١٢٣٤٥٦٧٨٩';
  const ar = (v) => String(v).replace(/\d/g, (d) => AR[d]);
  const num = (v, dec) => ar(dec ? Number(v).toFixed(dec) : Math.round(v)).replace('.', '٫');
  const egp = (v) => num(v) + ' ج.م';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clock = (d) => new Date(d).toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit' });
  const mins = (n) => (n === 1 ? 'دقيقة' : n === 2 ? 'دقيقتين' : n <= 10 ? num(n) + ' دقايق' : num(n) + ' دقيقة');
  const minsUnit = (n) => (n === 1 ? 'دقيقة' : n === 2 ? 'دقيقتين' : n <= 10 ? 'دقايق' : 'دقيقة');
  const firstName = (n) => String(n || '').trim().split(/\s+/)[0];
  function dayLabel(t) {
    const d = new Date(t), now = new Date();
    const strip = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((strip(now) - strip(d)) / 864e5);
    if (diff === 0) return 'النهارده';
    if (diff === 1) return 'امبارح';
    return d.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  const norm = (s) => String(s).replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase();
  const carColor = (hex) => ({ '#F4F4F6': 'white', '#1B1C1F': 'black', '#C9CCD2': 'silver', '#7D8088': 'grey', '#26324A': 'navy', '#A3261E': 'red', '#CDBFA6': 'beige' }[String(hex).toUpperCase()] || 'white');

  // ---------- التخزين ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem('mishwar.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('mishwar.' + k, JSON.stringify(v)); } catch (e) { /* التخزين مش متاح */ } },
  };
  const placeById = (id) => (id === 'me' ? D.me : D.places.find((p) => p.id === id));
  const settings = Object.assign({ dark: false, notif: true, sound: true, share: false }, store.get('settings', {}));
  const profile = Object.assign({ name: 'أحمد محمد', phone: '+20 100 123 4567' }, store.get('profile', {}));
  let trips = store.get('trips2', null) || seedTrips();
  const saveTrips = () => store.set('trips2', trips);
  const myAvatar = (size) => MW.avatar(profile.name, 0, size, 'man_beard');

  function seedTrips() {
    const day = 864e5, now = Date.now();
    const at = (daysAgo, h, m) => { const d = new Date(now - daysAgo * day); d.setHours(h, m, 0, 0); return d.getTime(); };
    const Pl = (id) => { const p = placeById(id); return { id: p.id, title: p.title, sub: p.sub, i: p.i, j: p.j, img: p.img }; };
    return [
      { id: 's1', sample: true, at: at(1, 21, 40), from: Pl('citystars'), to: Pl('home'), km: 6.4, min: 18, price: 70, tip: 10, rating: 5, tags: ['سواقة هادية', 'عربية نضيفة'],
        driver: { name: 'كريم حسن', seed: 2, face: 'man_curly_hair', rating: 4.93, trips: 3120, car: { model: 'هيونداي إلنترا', color: 'أسود', hex: '#1B1C1F' }, plate: { letters: 'رسع', digits: '٤٨٣٢' } } },
      { id: 's2', sample: true, at: at(3, 8, 15), from: Pl('home'), to: Pl('work'), km: 9.1, min: 24, price: 85, tip: 0, rating: 4, tags: ['في المعاد'],
        driver: { name: 'عمر خالد', seed: 4, face: 'man', rating: 4.81, trips: 1460, car: { model: 'كيا سيراتو', color: 'فضي', hex: '#C9CCD2' }, plate: { letters: 'طبن', digits: '٧١٥٩' } } },
      { id: 's3', sample: true, at: at(6, 17, 5), from: Pl('work'), to: Pl('airport'), km: 14.7, min: 33, price: 120, tip: 20, rating: 5, tags: ['ذوق ومحترم', 'عارف الطرق'],
        driver: { name: 'يوسف طارق', seed: 1, face: 'man_office_worker', rating: 4.97, trips: 4210, car: { model: 'تويوتا كورولا', color: 'أبيض', hex: '#F4F4F6' }, plate: { letters: 'ملق', digits: '٢٦٠٤' } } },
    ];
  }

  // ---------- الحالة ----------
  const S = {
    screen: 'home', pickup: D.me, dest: null, field: 'dest',
    est: null, price: 0, base: 0,
    req: null, offers: [], sel: null,
    trip: null, view: null, userMoved: false,
  };

  // ---------- الورقة السفلية ----------
  function setSheet(html, modes) {
    const from = sheet.offsetHeight;
    sheet.classList.remove('tall', 'mid', 'away', 'deep');
    (modes || '').split(' ').filter(Boolean).forEach((m) => sheet.classList.add(m));
    sheetBody.innerHTML = html;
    const to = sheet.offsetHeight;
    if (from && Math.abs(from - to) > 2) sheet.animate([{ height: from + 'px' }, { height: to + 'px' }], { duration: 480, easing: 'cubic-bezier(.2,.8,.2,1)' });
    sheetBody.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }

  function morphSheet(fn) {
    const from = sheet.offsetHeight;
    fn();
    const to = sheet.offsetHeight;
    if (Math.abs(from - to) > 2) sheet.animate([{ height: from + 'px' }, { height: to + 'px' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }

  let refitT = 0;
  function updateInsets() {
    const h = sheet.classList.contains('away') ? 0 : sheet.getBoundingClientRect().height;
    app.style.setProperty('--sheet-h', Math.round(h) + 'px');
    const padTop = parseFloat(getComputedStyle(topbar).paddingTop) || 12;
    const top = topbar.classList.contains('hide') ? padTop : padTop + 60;
    M.setInsets(top, Math.max(0, h - 26));
    placeCenterPin();
    clearTimeout(refitT);
    refitT = setTimeout(() => { if (!S.userMoved && S.view) S.view(550); }, 140);
  }
  new ResizeObserver(updateInsets).observe(sheet);
  new ResizeObserver(updateInsets).observe(app);

  function setView(fn) {
    S.view = fn;
    S.userMoved = false;
    setTimeout(() => fn(950), 30);
  }

  function showTopbar(on) { topbar.classList.toggle('hide', !on); updateInsets(); }
  function showFab(on) { $('#fab').classList.toggle('hide', !on); }
  function showSkip(on) { $('#skipBtn').classList.toggle('hide', !on); }

  // ---------- علامات الخريطة ----------
  function meMarker(on) {
    if (on) M.setMarker('me', Object.assign({ html: '<div class="me-dot"><i></i></div>' }, M.nodeXY(D.me.i, D.me.j)));
    else M.removeMarker('me');
  }

  const tagPin = (text) => '<div class="tag"><span class="ti">' + F('pin', 16) + '</span>' + text + '</div>';
  const tagSq = (text) => '<div class="tag"><span class="ti sq">' + F('square', 14) + '</span>' + text + '</div>';

  function placeMarkers(pickupLabel, destLabel) {
    const a = M.nodeXY(S.pickup.i, S.pickup.j), b = M.nodeXY(S.dest.i, S.dest.j);
    M.setMarker('pickup', { x: a.x, y: a.y, anchor: 'bottom', z: 7, html: '<div class="pin">' + (pickupLabel ? tagPin(pickupLabel) : '') + '<div class="pin-dot"></div></div>' });
    M.setMarker('dest', { x: b.x, y: b.y, anchor: 'bottom', z: 7, html: '<div class="pin">' + (destLabel ? tagSq(destLabel) : '') + '<div class="pin-sq"></div></div>' });
  }

  function clearTripMarks() {
    M.removeMarker('pickup', 'dest', 'radar', 'driver', 'dchip');
    M.removeMarkersWhere((id) => id.indexOf('ocar-') === 0 || id.indexOf('ochip-') === 0);
    M.clearRoute();
  }

  // ---------- الرئيسية ----------
  function homeHTML() {
    const hr = new Date().getHours();
    const hi = hr < 12 ? 'صباح الخير' : 'مساء الخير';
    const quick = [placeById('home'), placeById('work')].concat(D.recentIds.slice(0, 2).map(placeById));
    return '' +
      '<div class="sheet-title on-glass"><h2 class="hello">' + hi + '، ' + esc(firstName(profile.name)) + '!' + P('waving_hand', 28) + '</h2></div>' +
      '<button class="card ride-card" data-action="open-plan">' +
        '<span class="txt"><b>عربية</b><small>اطلب مشوار لأي مكان، واختار الكابتن اللي يعجبك</small><span class="eta"><i></i>كابتن على بُعد ٣ دقايق</span></span>' +
        MW.car('white', 190) +
      '</button>' +
      '<button class="search" data-action="open-plan">' + I('search', 22) + '<span>رايح فين؟</span><span class="when">' + I('clock', 14) + 'دلوقتي</span></button>' +
      '<div class="shortcuts">' + quick.map((p) =>
        '<button class="shortcut" data-action="quick-dest" data-id="' + p.id + '">' + P(p.img, 34) + '<b>' + esc(p.title) + '</b></button>').join('') +
      '</div>';
  }

  function goHome() {
    cleanupRide();
    S.screen = 'home';
    S.pickup = D.me;
    S.dest = null;
    S.field = 'dest';
    clearTripMarks();
    meMarker(true);
    M.setAmbient(true, { i: D.me.i, j: D.me.j });
    $('#centerPin').hidden = true;
    showTopbar(true);
    showFab(true);
    showSkip(false);
    setSheet(homeHTML(), 'deep');
    const me = M.nodeXY(D.me.i, D.me.j);
    setView((d) => M.flyTo(me.x, me.y, 0.42, d));
  }

  function cleanupRide() {
    if (S.req) { S.req.cancel(); S.req = null; }
    if (S.trip) { S.trip.api.cancel(); S.trip = null; }
    S.offers = [];
    S.sel = null;
  }

  // ---------- تخطيط المشوار ----------
  function planHTML() {
    return '' +
      '<div class="sheet-title"><h2>خطط لمشوارك</h2></div>' +
      '<div class="card route-card">' +
        '<div class="rail">' + F('pin', 18) + '<span class="line"></span><span class="sq">' + F('square', 16) + '</span></div>' +
        '<div class="field' + (S.field === 'pickup' ? ' active' : '') + '" data-field="pickup"><input id="pickupInput" aria-label="من" autocomplete="off" enterkeyhint="search" value="' + esc(S.pickup ? S.pickup.title : '') + '" placeholder="هتركب منين؟"></div>' +
        '<hr>' +
        '<div class="field' + (S.field === 'dest' ? ' active' : '') + '" data-field="dest"><input id="destInput" aria-label="إلى" autocomplete="off" enterkeyhint="search" value="' + esc(S.dest ? S.dest.title : '') + '" placeholder="الوجهة"></div>' +
        '<button class="add" data-action="swap" aria-label="بدّل نقطة الركوب والوجهة">' + I('swap', 17) + '</button>' +
      '</div>' +
      '<div class="scroll" id="placeScroll"><ul class="rows"><li><button class="row" data-action="pick-on-map">' + P('world_map', 38) + '<span class="t"><b>حدد على الخريطة</b><small>حرّك الدبوس لحد المكان بالظبط</small></span>' + I('chevron', 18) + '</button></li></ul><div id="placeList"></div></div>';
  }

  function openPlan(field) {
    S.screen = 'plan';
    S.field = field || 'dest';
    clearTripMarks();
    meMarker(true);
    showTopbar(false);
    showFab(false);
    $('#centerPin').hidden = true;
    setSheet(planHTML(), 'tall');
    renderPlaces('');
    const inp = $(S.field === 'pickup' ? '#pickupInput' : '#destInput');
    setTimeout(() => { try { inp.focus({ preventScroll: true }); } catch (e) { inp.focus(); } }, 420);
  }

  function placeRow(p) {
    let km = '';
    if (S.pickup && S.field === 'dest' && p.id !== S.pickup.id) km = '<span class="km">' + num(R.estimate(S.pickup, p).km, 1) + ' كم</span>';
    return '<li><button class="row" data-action="choose-place" data-id="' + p.id + '">' + P(p.img, 38) +
      '<span class="t"><b>' + esc(p.title) + '</b><small>' + esc(p.sub) + '</small></span>' + km + '</button></li>';
  }

  function renderPlaces(q) {
    const list = $('#placeList');
    if (!list) return;
    const all = (S.field === 'pickup' ? [D.me] : []).concat(D.places);
    q = norm(q.trim());
    let html = '';
    if (q) {
      const hits = all.filter((p) => norm(p.title + ' ' + p.sub).indexOf(q) !== -1);
      html = hits.length ? '<ul class="rows">' + hits.map(placeRow).join('') + '</ul>'
        : '<div class="empty-note">مفيش نتايج للبحث ده، جرّب تحدد المكان على الخريطة</div>';
    } else {
      const saved = all.filter((p) => p.saved || p.id === 'me');
      const recent = D.recentIds.map(placeById);
      const rest = all.filter((p) => !p.saved && p.id !== 'me' && D.recentIds.indexOf(p.id) === -1);
      html = '<div class="list-title">أماكنك</div><ul class="rows">' + saved.map(placeRow).join('') + '</ul>' +
        '<div class="list-title">آخر مشاويرك</div><ul class="rows">' + recent.map(placeRow).join('') + '</ul>' +
        '<div class="list-title">أماكن مشهورة</div><ul class="rows">' + rest.map(placeRow).join('') + '</ul>';
    }
    list.innerHTML = html;
  }

  function setField(f) {
    S.field = f;
    $$('.route-card .field').forEach((el) => el.classList.toggle('active', el.dataset.field === f));
  }

  function choosePlace(p) {
    if (S.field === 'pickup') {
      if (S.dest && S.dest.id === p.id) return toast('نقطة الركوب لازم تكون غير الوجهة', 'information');
      S.pickup = p;
      $('#pickupInput').value = p.title;
      if (!S.dest) { setField('dest'); $('#destInput').focus(); renderPlaces(''); return; }
    } else {
      if (S.pickup && S.pickup.id === p.id) return toast('اختار وجهة غير مكان الركوب', 'information');
      S.dest = p;
      $('#destInput').value = p.title;
      if (!S.pickup) { setField('pickup'); $('#pickupInput').focus(); renderPlaces(''); return; }
    }
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    openPreview();
  }

  // ---------- تحديد على الخريطة ----------
  function placeCenterPin() { $('#centerPin').style.top = M.visibleCenterY() + 'px'; }

  function pickHTML() {
    return '' +
      '<div class="sheet-title"><h2>' + (S.field === 'pickup' ? 'حدد مكان الركوب' : 'حدد وجهتك') + '</h2><p>حرّك الخريطة لحد ما الدبوس ييجي على المكان</p></div>' +
      '<div class="card pay">' + P('round_pushpin', 30) + '<span><b id="pickTitle" style="font-weight:500">…</b><small id="pickSub"></small></span></div>' +
      '<div class="cta-row"><button class="round" data-action="cancel-pick" aria-label="رجوع">' + I('back', 22) + '</button><button class="btn btn-primary" data-action="confirm-pick">تأكيد المكان</button></div>';
  }

  function startPick() {
    S.screen = 'pick';
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    showTopbar(false);
    setSheet(pickHTML());
    $('#centerPin').hidden = false;
    placeCenterPin();
    S.view = null;
    const base = S.field === 'pickup' ? S.pickup : (S.dest || D.me);
    const p = M.nodeXY(base.i, base.j);
    M.flyTo(p.x + 140, p.y - 120, 0.5, 700);
    setTimeout(updatePickAddress, 760);
  }

  function pickedPlace() {
    const c = M.center();
    const n = M.nearestNode(c.x, c.y);
    const desc = M.describeNode(n, D.districts);
    return { id: 'map-' + n.i + '-' + n.j, title: desc.title, sub: desc.sub, i: n.i, j: n.j, img: 'round_pushpin' };
  }

  function updatePickAddress() {
    if (S.screen !== 'pick') return;
    const p = pickedPlace();
    const t = $('#pickTitle'), s = $('#pickSub');
    if (t) { t.textContent = p.title; s.textContent = p.sub; }
  }

  M.onDrag(() => {
    S.userMoved = true;
    if (S.screen === 'pick') $('#centerPin').classList.add('lift');
  });
  M.onMoveEnd(() => {
    $('#centerPin').classList.remove('lift');
    updatePickAddress();
  });

  function confirmPick() {
    const p = pickedPlace();
    const other = S.field === 'pickup' ? S.dest : S.pickup;
    if (other && other.i === p.i && other.j === p.j) return toast('المكان ده هو نفسه ' + (S.field === 'pickup' ? 'الوجهة' : 'مكان الركوب'), 'information');
    $('#centerPin').hidden = true;
    if (S.field === 'pickup') S.pickup = p; else S.dest = p;
    if (S.pickup && S.dest) openPreview();
    else openPlan(S.pickup ? 'dest' : 'pickup');
  }

  // ---------- تفاصيل المشوار والسعر ----------
  function previewHTML() {
    const e = S.est;
    return '' +
      '<div class="card option">' + MW.car('white', 96) +
        '<span class="t"><b>عربية مشوار</b><small><span>' + I('clock', 14) + mins(e.min) + '</span><span>' + F('person', 14) + num(4) + '</span><span>' + num(e.km, 1) + ' كم</span></small></span>' +
        '<span class="price"><strong id="optPrice">' + egp(S.price) + '</strong><em id="priceNote">السعر المقترح</em></span>' +
      '</div>' +
      '<div class="card route-mini"><div class="rail">' + F('pin', 15) + '<span class="line"></span>' + F('square', 13) + '</div>' +
        '<div class="stop"><small>من</small><b>' + esc(S.pickup.title) + '</b></div>' +
        '<div class="stop"><small>إلى</small><b>' + esc(S.dest.title) + '</b></div></div>' +
      '<div class="card stepper"><span class="t"><b>اقترح سعرك</b><small>الكباتن هيبعتوا عروضهم على السعر ده</small></span>' +
        '<span class="ctl"><button data-action="price-up" aria-label="زوّد السعر">' + I('plus', 16) + '</button><output id="priceVal">' + num(S.price) + '</output><button data-action="price-down" aria-label="قلّل السعر">' + I('minus', 16) + '</button></span></div>' +
      '<button class="card pay" data-action="payment-modal">' + P('dollar_banknote', 30) + '<span>كاش<small>هتدفع للكابتن في آخر المشوار</small></span>' + I('chevron', 18) + '</button>' +
      '<div class="cta-row"><button class="round" data-action="back-plan" aria-label="رجوع">' + I('back', 22) + '</button>' +
        '<button class="btn btn-primary" data-action="request">اطلب عربية</button></div>';
  }

  function openPreview() {
    S.screen = 'preview';
    S.est = R.estimate(S.pickup, S.dest);
    S.base = S.est.price;
    S.price = S.est.price;
    clearTripMarks();
    meMarker(S.pickup.id === 'me');
    M.setAmbient(true, { i: S.pickup.i, j: S.pickup.j });
    showTopbar(true);
    showFab(true);
    $('#centerPin').hidden = true;
    M.drawRoute('trip', S.est.pts, 'main');
    placeMarkers(S.pickup.id === 'me' ? 'موقعك' : esc(S.pickup.title), 'توصل خلال <b>' + mins(S.est.min) + '</b>');
    setSheet(previewHTML());
    setView((d) => M.fit(S.est.pts, { dur: d, pad: 72, extraTop: 50 }));
  }

  function adjustPrice(step) {
    const min = Math.max(25, Math.round(S.base * 0.85 / 5) * 5), max = Math.round(S.base * 1.6 / 5) * 5;
    const next = Math.min(max, Math.max(min, S.price + step));
    if (next === S.price) return toast(step < 0 ? 'ده أقل سعر ممكن للمشوار ده' : 'ده أعلى سعر ممكن', 'information');
    S.price = next;
    $('#priceVal').textContent = num(S.price);
    $('#optPrice').textContent = egp(S.price);
    const d = S.price - S.base;
    $('#priceNote').textContent = d === 0 ? 'السعر المقترح' : d > 0 ? 'عروض أسرع' : 'ممكن ياخد وقت';
    $('#priceVal').animate([{ transform: 'translateY(' + (step > 0 ? 8 : -8) + 'px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 260, easing: 'ease-out' });
  }

  // ---------- العروض ----------
  const skeletonRow = '<div class="skeleton"><i style="width:84px;height:44px;border-radius:14px"></i><span style="flex:1;display:flex;flex-direction:column;gap:8px"><i style="width:60%;height:12px"></i><i style="width:40%;height:10px"></i></span><i style="width:56px;height:16px"></i></div>';

  function searchingHTML() {
    return '' +
      '<div class="offers-head"><div class="sheet-title"><h2 id="offTitle">بندوّر لك على كابتن</h2><p id="offSub">طلبك وصل للكباتن اللي حواليك</p></div><span class="spinner" aria-hidden="true"></span></div>' +
      '<div class="scroll"><div id="offers">' + skeletonRow + skeletonRow + skeletonRow + '</div></div>' +
      '<button class="card pay" data-action="payment-modal">' + P('dollar_banknote', 30) + '<span>كاش · سعرك ' + egp(S.price) + '</span>' + I('chevron', 18) + '</button>' +
      '<div class="cta-row"><button class="round" data-action="cancel-request" aria-label="إلغاء الطلب">' + I('x', 20) + '</button>' +
        '<button class="btn btn-primary" id="offerCta" data-action="accept-sel" disabled>مستنيين العروض…</button></div>';
  }

  function requestRide() {
    S.screen = 'searching';
    S.offers = [];
    S.sel = null;
    meMarker(false);
    const a = M.nodeXY(S.pickup.i, S.pickup.j);
    M.removeMarker('pickup');
    M.setMarker('radar', { x: a.x, y: a.y, html: '<div class="radar"><span></span><span></span><span></span><b></b></div>' });
    M.drawRoute('trip', S.est.pts, 'ghost');
    setSheet(searchingHTML(), 'mid');
    setView((d) => M.flyTo(a.x, a.y, 0.5, d));
    const req = R.requestRide({ pickup: S.pickup, dest: S.dest, price: S.price });
    S.req = req;
    req.on('offer', addOffer);
    req.on('offer-expired', (o) => removeOffer(o.id, true));
  }

  function offerHTML(o) {
    const d = o.driver, diff = o.price - S.price;
    return '<button class="offer' + (S.sel === o.id ? ' sel' : '') + '" data-offer="' + o.id + '" data-action="select-offer" data-id="' + o.id + '">' +
      '<span class="media">' + MW.car(carColor(d.car.hex), 92) + MW.avatar(d.name, d.seed, 30, d.face) + '</span>' +
      '<span class="t"><b>' + esc(d.name) + '</b>' +
        '<small><span>' + I('clock', 13) + mins(o.eta) + '</span><span>' + MW.starIcon(13) + num(d.rating, 2) + '</span></small>' +
        '<span class="model">' + esc(d.car.model) + ' · ' + esc(d.car.color) + '</span></span>' +
      '<span class="price"><strong>' + egp(o.price) + '</strong>' + (diff > 0 ? '<em>+' + num(diff) + ' عن سعرك</em>' : '<em class="same">نفس سعرك</em>') + '</span>' +
      '<span class="offer-timer"><i style="animation-duration:' + Math.max(0, o.ttl - (Date.now() - o.at)) + 'ms"></i></span>' +
      '</button>';
  }

  function updateOffersUI() {
    const n = S.offers.length;
    const t = $('#offTitle'), sub = $('#offSub'), cta = $('#offerCta');
    if (!t) return;
    t.textContent = n ? (n === 1 ? 'وصلك عرض' : n === 2 ? 'وصلك عرضين' : 'وصلك ' + num(n) + ' عروض') : 'بندوّر لك على كابتن';
    sub.textContent = n ? 'اختار الكابتن اللي يناسبك · كل عرض متاح ٣٠ ثانية' : 'طلبك وصل للكباتن اللي حواليك';
    const o = S.offers.find((x) => x.id === S.sel);
    cta.disabled = !o;
    cta.innerHTML = o ? 'اختار ' + esc(firstName(o.driver.name)) + ' <small>· ' + egp(o.price) + '</small>' : 'مستنيين العروض…';
    $$('#offers .offer').forEach((el) => el.classList.toggle('sel', el.dataset.offer === S.sel));
  }

  function addOffer(o) {
    if (S.screen !== 'searching') return;
    S.offers.unshift(o);
    if (!S.sel) S.sel = o.id;
    morphSheet(() => {
      $$('#offers .skeleton').forEach((el) => el.remove());
      $('#offers').insertAdjacentHTML('afterbegin', offerHTML(o));
      updateOffersUI();
    });
    const p = M.pointAt(o.approachPts, 0);
    M.setMarker('ocar-' + o.id, { x: p.x, y: p.y, angle: p.angle, cls: 'mk-car', html: MW.carTop(carColor(o.driver.car.hex)) });
    M.setMarker('ochip-' + o.id, { x: p.x, y: p.y, anchor: 'bottom', z: 5, html: '<div class="chip-car"><i></i>' + mins(o.eta) + '</div>' });
    fitOffers();
    if (settings.notif && navigator.vibrate) { try { navigator.vibrate(30); } catch (e) { /* */ } }
  }

  function fitOffers() {
    const pts = [M.nodeXY(S.pickup.i, S.pickup.j)].concat(S.offers.map((o) => M.pointAt(o.approachPts, 0)));
    S.view = (d) => M.fit(pts, { dur: d, pad: 60, maxS: 0.55, extraTop: 30 });
    if (!S.userMoved) S.view(800);
  }

  function removeOffer(id, expired) {
    S.offers = S.offers.filter((o) => o.id !== id);
    if (S.sel === id) S.sel = S.offers.length ? S.offers[0].id : null;
    M.removeMarker('ocar-' + id, 'ochip-' + id);
    const card = $('[data-offer="' + id + '"]');
    if (card) {
      card.classList.add('out');
      setTimeout(() => morphSheet(() => {
        card.remove();
        if (!S.offers.length && $('#offers')) $('#offers').innerHTML = skeletonRow + skeletonRow;
        updateOffersUI();
      }), 330);
    }
    if (expired && S.screen === 'searching') toast('عرض انتهى وقته', 'hourglass_not_done');
    if (S.offers.length) fitOffers();
  }

  function cancelRequest() {
    if (S.req) { S.req.cancel(); S.req = null; }
    toast('اتلغى الطلب', 'cross_mark');
    openPreview();
  }

  // ---------- الرحلة ----------
  const PHASES = ['accepted', 'coming', 'arrived', 'ontrip'];

  function acceptOffer(id) {
    const offer = S.offers.find((o) => o.id === id);
    if (!offer || !S.req) return;
    const api = S.req.accept(id);
    S.req = null;
    S.offers = [];
    S.sel = null;
    M.removeMarker('radar');
    M.removeMarkersWhere((k) => k.indexOf('ocar-') === 0 || k.indexOf('ochip-') === 0);
    M.setAmbient(false);
    S.trip = { api: api, offer: offer, phase: 'accepted', eta: offer.eta, chat: [], startedAt: Date.now() };
    api.on('phase', (e) => applyPhase(e.phase)).on('update', onTripUpdate).on('completed', onCompleted);
    openTrip();
  }

  function tripHTML() {
    const o = S.trip.offer, d = o.driver;
    return '' +
      '<div class="trip-head"><div class="sheet-title"><h2 id="tTitle"></h2><p id="tSub"></p></div>' +
        '<div class="eta-pill" id="tEta"><b>' + num(o.eta) + '</b><small>' + minsUnit(o.eta) + '</small></div></div>' +
      '<div class="steps" id="tSteps"><i></i><i></i><i></i><i></i></div>' +
      '<div class="scroll"><div class="stack" style="padding-bottom:4px">' +
        '<div class="card driver-card">' +
          '<div class="driver-top">' + MW.avatar(d.name, d.seed, 54, d.face) +
            '<span class="t"><b>' + esc(d.name) + '</b><small>' + MW.starIcon(13) + num(d.rating, 2) + ' · ' + num(d.trips) + ' مشوار</small></span>' + MW.plate(d.plate) + '</div>' +
          '<div class="driver-car">' + MW.car(carColor(d.car.hex), 118) + '<span class="t"><b>' + esc(d.car.model) + '</b><small>لون ' + esc(d.car.color) + ' · دوّر على اللوحة</small></span></div>' +
        '</div>' +
        '<div class="card pin-row" id="tPin">' + P('locked', 30) + '<span>رمز المشوار، قوله للكابتن لما تركب</span><b>' + S.trip.api.pin + '</b></div>' +
        '<div class="actions">' +
          '<button class="act" data-action="call">' + P('telephone_receiver', 32) + 'اتصال</button>' +
          '<button class="act" data-action="chat">' + P('speech_balloon', 32) + 'رسالة</button>' +
          '<button class="act" data-action="share">' + P('link', 32) + 'مشاركة</button>' +
          '<button class="act" data-action="safety">' + P('shield', 32) + 'الأمان</button>' +
        '</div>' +
        '<div class="card route-mini"><div class="rail">' + F('pin', 15) + '<span class="line"></span>' + F('square', 13) + '</div>' +
          '<div class="stop"><small>من</small><b>' + esc(S.pickup.title) + '</b></div>' +
          '<div class="stop"><small>إلى</small><b>' + esc(S.dest.title) + '</b></div></div>' +
        '<div class="card pay">' + P('dollar_banknote', 30) + '<span>' + egp(o.price) + '<small>كاش · هتدفع في آخر المشوار</small></span></div>' +
        '<button class="btn btn-text btn-danger" id="tCancel" data-action="cancel-trip">إلغاء المشوار</button>' +
      '</div></div>';
  }

  function openTrip() {
    S.screen = 'trip';
    showTopbar(true);
    showFab(true);
    showSkip(true);
    setSheet(tripHTML(), 'mid');
    placeMarkers('', '');
    applyPhase('accepted');
    toast('تمام! ' + firstName(S.trip.offer.driver.name) + ' جاي لك', 'check_mark_button');
  }

  function applyPhase(phase) {
    const t = S.trip;
    if (!t) return;
    t.phase = phase;
    const d = t.offer.driver, first = firstName(d.name);
    const texts = {
      accepted: ['تم تأكيد المشوار', first + ' قبل مشوارك وبيتحرك دلوقتي'],
      coming: ['الكابتن في الطريق ليك', 'استناه في ' + S.pickup.title],
      arrived: ['الكابتن وصل ومستنيك', 'قول للكابتن رمز المشوار وانت راكب'],
      ontrip: ['في الطريق لـ ' + S.dest.title, 'اربط الحزام واستمتع بالمشوار'],
    }[phase];
    const tt = $('#tTitle');
    if (!tt) return;
    tt.textContent = texts[0];
    $('#tSub').textContent = texts[1];
    [tt, $('#tSub')].forEach((el) => el.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: 'ease-out' }));
    const idx = PHASES.indexOf(phase);
    $$('#tSteps i').forEach((el, k) => { el.className = k < idx ? 'done' : k === idx ? 'now' : ''; el.style.setProperty('--p', 0); });
    const badge = $('#tEta');
    badge.classList.toggle('done', phase === 'arrived');
    if (phase === 'arrived') badge.innerHTML = '<b>' + I('check', 22) + '</b><small>وصل</small>';
    const pk = M.nodeXY(S.pickup.i, S.pickup.j);
    if (phase === 'accepted') {
      const p0 = M.pointAt(t.offer.approachPts, 0);
      setView((dd) => M.fit([p0, pk], { dur: dd, pad: 90, maxS: 0.6, extraTop: 50 }));
    }
    if (phase === 'coming') {
      const pts = t.offer.approachPts;
      setView((dd) => M.fit(pts.concat([pk]), { dur: dd, pad: 80, maxS: 0.6, extraTop: 50 }));
    }
    if (phase === 'arrived') {
      M.removeMarker('dchip');
      M.clearRoute('approach');
      toast(first + ' وصل! ' + d.car.model + ' ' + d.car.color, 'round_pushpin');
      if (settings.notif && navigator.vibrate) { try { navigator.vibrate([40, 60, 40]); } catch (e) { /* */ } }
    }
    if (phase === 'ontrip') {
      const c = $('#tCancel'); if (c) c.hidden = true;
      const pin = $('#tPin'); if (pin) morphSheet(() => pin.remove());
      M.removeMarker('pickup');
      M.clearRoute('approach');
      const est = t.api.estimate;
      setView((dd) => M.fit(est.pts, { dur: dd, pad: 70, extraTop: 50 }));
      toast('بدأ المشوار، رحلة سعيدة', 'chequered_flag');
    }
  }

  function onTripUpdate(u) {
    const t = S.trip;
    if (!t) return;
    M.setMarker('driver', { x: u.pos.x, y: u.pos.y, angle: u.pos.angle, cls: 'mk-driver', html: MW.carTop(carColor(t.offer.driver.car.hex)) });
    if (u.phase === 'coming' || u.phase === 'accepted') {
      M.setMarker('dchip', { x: u.pos.x, y: u.pos.y, anchor: 'bottom', z: 9, html: '<div style="margin-bottom:30px">' + tagSq('يوصل خلال <b>' + mins(u.eta) + '</b>') + '</div>' });
      if (u.remaining && u.remaining.length > 1) M.drawRoute('approach', u.remaining, 'approach');
      M.drawRoute('trip', t.api.estimate.pts, 'ghost');
    } else if (u.phase === 'ontrip') {
      if (u.remaining && u.remaining.length > 1) M.drawRoute('trip', u.remaining, 'main');
      M.setMarker('dchip', { x: u.pos.x, y: u.pos.y, anchor: 'bottom', z: 9, html: '<div style="margin-bottom:30px">' + tagSq('توصل خلال <b>' + mins(u.eta) + '</b>') + '</div>' });
    }
    if (u.eta !== t.eta && u.phase !== 'arrived') {
      t.eta = u.eta;
      const b = $('#tEta');
      if (b) b.innerHTML = '<b>' + num(u.eta) + '</b><small>' + minsUnit(u.eta) + '</small>';
    }
    const now = $('#tSteps i.now');
    if (now) now.style.setProperty('--p', u.progress.toFixed(3));
  }

  function onCompleted(sum) {
    const t = S.trip;
    showSkip(false);
    closeAllPages();
    closeModal();
    t.summary = sum;
    const dst = M.nodeXY(S.dest.i, S.dest.j);
    M.clearRoute();
    M.removeMarker('dchip');
    setView((d) => M.flyTo(dst.x, dst.y, 0.55, d));
    setTimeout(() => showRating(t), 700);
  }

  // ---------- التقييم ----------
  const TAGS_GOOD = ['سواقة هادية', 'عربية نضيفة', 'في المعاد', 'ذوق ومحترم', 'عارف الطرق', 'تكييف ممتاز'];
  const TAGS_BAD = ['سواقة سريعة', 'العربية مش نضيفة', 'اتأخر', 'خد طريق أطول', 'التكييف', 'التعامل'];
  const WORDS = ['', 'وحش', 'مش أحسن حاجة', 'كويس', 'كويس جداً', 'ممتاز!'];
  let rate = null;

  function showRating(t) {
    const d = t.offer.driver, sum = t.summary;
    rate = { stars: 0, tags: [], tip: 0, trip: t };
    const scr = document.createElement('div');
    scr.className = 'rate-screen';
    scr.id = 'rateScreen';
    scr.innerHTML = '<div class="rate-card"><div class="page-body">' +
      '<div class="rate-top">' + P('party_popper', 74) + '<h2>وصلت بالسلامة</h2><p>' + esc(S.dest.title) + ' · <b>' + egp(sum.price) + '</b> كاش</p></div>' +
      '<div class="card sum3"><div><b>' + num(sum.km, 1) + ' كم</b><small>المسافة</small></div><div><b>' + mins(sum.min) + '</b><small>المدة</small></div><div><b>' + egp(sum.price) + '</b><small>الأجرة</small></div></div>' +
      '<div class="card rate-box">' + MW.avatar(d.name, d.seed, 64, d.face) + '<b>إيه رأيك في مشوارك مع ' + esc(firstName(d.name)) + '؟</b>' +
        '<div class="stars" role="radiogroup" aria-label="التقييم">' + [1, 2, 3, 4, 5].map((n) => '<button class="star-btn" data-action="star" data-n="' + n + '" aria-label="' + num(n) + ' من ٥">' + P('star', 38) + '</button>').join('') + '</div>' +
        '<div class="rate-word" id="rateWord">اختار من ١ لـ ٥ نجوم</div>' +
        '<div class="chips" id="rateTags" hidden></div>' +
      '</div>' +
      '<span class="sub-title">إكرامية للكابتن (اختياري)</span>' +
      '<div class="tips">' + [0, 5, 10, 20].map((v) => '<button class="chip' + (v === 0 ? ' on' : '') + '" data-action="tip" data-v="' + v + '">' + (v ? egp(v) : 'بدون') + '</button>').join('') + '</div>' +
      '<textarea class="comment" id="rateComment" placeholder="عاوز تقول حاجة للكابتن؟ (اختياري)"></textarea>' +
      '<button class="btn btn-primary" id="rateSubmit" data-action="submit-rating" disabled>إرسال التقييم</button>' +
      '<button class="btn btn-text" data-action="skip-rating">مش دلوقتي</button>' +
      '</div></div>';
    app.appendChild(scr);
    sheet.classList.add('away');
    showTopbar(false);
    showFab(false);
    updateInsets();
  }

  function setStars(n) {
    rate.stars = n;
    $$('#rateScreen .star-btn').forEach((b) => b.classList.toggle('on', Number(b.dataset.n) <= n));
    $('#rateWord').textContent = WORDS[n];
    const tags = n >= 4 ? TAGS_GOOD : TAGS_BAD;
    rate.tags = rate.tags.filter((x) => tags.indexOf(x) !== -1);
    const box = $('#rateTags');
    box.hidden = false;
    box.innerHTML = tags.map((x) => '<button class="chip' + (rate.tags.indexOf(x) !== -1 ? ' on' : '') + '" data-action="tag" data-t="' + x + '">' + x + '</button>').join('');
    $('#rateSubmit').disabled = false;
  }

  function finishRating(submit) {
    const t = rate.trip, d = t.offer.driver;
    trips.unshift({
      id: 't' + Date.now(), at: t.startedAt,
      from: { id: S.pickup.id, title: S.pickup.title, sub: S.pickup.sub, i: S.pickup.i, j: S.pickup.j, img: S.pickup.img },
      to: { id: S.dest.id, title: S.dest.title, sub: S.dest.sub, i: S.dest.i, j: S.dest.j, img: S.dest.img },
      km: t.summary.km, min: t.summary.min, price: t.summary.price,
      tip: submit ? rate.tip : 0, rating: submit ? rate.stars : 0, tags: submit ? rate.tags : [],
      comment: submit ? ($('#rateComment').value || '').trim() : '',
      driver: { name: d.name, seed: d.seed, face: d.face, rating: d.rating, trips: d.trips, car: d.car, plate: d.plate },
    });
    saveTrips();
    const scr = $('#rateScreen');
    scr.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300 }).onfinish = () => scr.remove();
    S.trip = null;
    rate = null;
    goHome();
    setTimeout(() => toast(submit ? 'شكراً! تقييمك بيساعدنا نحسّن مشوار' : 'المشوار اتسجل في مشاويرك', 'glowing_star'), 400);
  }

  // ---------- نوافذ ----------
  let modalClose = null;
  function openModal(html) {
    closeModal(true);
    const root = $('#modalRoot');
    root.innerHTML = '<div class="modal-back" data-action="close-modal"></div><div class="modal" role="dialog" aria-modal="true">' + html + '</div>';
    modalClose = () => {
      const m = $('.modal', root), b = $('.modal-back', root);
      if (!m) return;
      m.classList.add('closing'); b.classList.add('closing');
      setTimeout(() => { if (root.contains(m)) root.innerHTML = ''; }, 240);
    };
    return $('.modal', root);
  }
  function closeModal(instant) {
    if (instant) { $('#modalRoot').innerHTML = ''; modalClose = null; return; }
    if (modalClose) modalClose();
    modalClose = null;
  }

  let confirmFn = null;
  function confirmBox(o) {
    confirmFn = o.onOk;
    openModal(P(o.pic || 'information', 64, 'm-pic') + '<h3>' + o.title + '</h3><p>' + o.text + '</p>' +
      '<button class="btn ' + (o.danger ? 'btn-dark' : 'btn-primary') + '" data-action="confirm-ok">' + o.ok + '</button>' +
      '<button class="btn btn-text" data-action="close-modal">' + (o.cancel || 'رجوع') + '</button>');
  }

  const payItems = () => '<div class="card menu">' +
    '<button class="item" data-action="close-modal">' + P('dollar_banknote', 32) + '<span class="t"><b>كاش</b><small>ادفع للكابتن في آخر المشوار</small></span><span class="radio on"></span></button>' +
    '<button class="item" data-action="soon">' + P('credit_card', 32) + '<span class="t"><b>بطاقة بنكية</b><small>فيزا وماستركارد وميزة</small></span><span class="soon">قريباً</span></button>' +
    '<button class="item" data-action="soon">' + P('mobile_phone', 32) + '<span class="t"><b>محفظة إلكترونية</b><small>فودافون كاش وإنستاباي</small></span><span class="soon">قريباً</span></button>' +
    '</div>';

  function paymentModal() {
    openModal('<h3>طريقة الدفع</h3>' + payItems() + '<button class="btn btn-dark" data-action="close-modal">تمام</button>');
  }

  function menuModal() {
    const tile = (pic, label, action, page) => '<button class="card tile" data-action="' + action + '"' + (page ? ' data-page="' + page + '"' : '') + '>' + P(pic, 44) + '<b>' + label + '</b></button>';
    openModal('<h3>القائمة</h3><div class="tiles">' +
      tile('receipt', 'مشاويري', 'open-history') + tile('bookmark', 'أماكني', 'page', 'places') + tile('credit_card', 'الدفع', 'page', 'payment') +
      tile('gear', 'الإعدادات', 'page', 'settings') + tile('red_question_mark', 'المساعدة', 'page', 'help') + tile('information', 'عن مشوار', 'page', 'about') +
      '</div><button class="btn btn-ghost" data-action="open-profile">' + myAvatar(30) + 'حسابي</button>');
  }

  function callModal() {
    const d = S.trip.offer.driver;
    openModal(P('telephone_receiver', 64, 'm-pic') + '<h3>اتصال بـ ' + esc(firstName(d.name)) + '</h3>' +
      '<div class="phone-num">' + d.phone + '</div>' +
      '<p>رقمك بيظهر للكابتن برقم وسيط عشان خصوصيتك. ده رقم تجريبي، الاتصال الحقيقي هيشتغل لما نربط التطبيق.</p>' +
      '<button class="btn btn-primary" data-action="close-modal">تمام</button>');
  }

  const REPLIES = ['تمام يا فندم، أنا جاي في الطريق', 'حاضر، دقايق وأكون عندك', 'تمام، شايف مكانك على الخريطة', 'العفو، في خدمتك'];
  function chatModal() {
    const d = S.trip.offer.driver;
    openModal('<div class="m-head">' + MW.avatar(d.name, d.seed, 46, d.face) + '<span class="t"><b>' + esc(d.name) + '</b><small>' + esc(d.car.model) + ' · ' + esc(d.car.color) + '</small></span><button class="round" data-action="close-modal" aria-label="قفل">' + I('x', 18) + '</button></div>' +
      '<div class="chat" id="chat"></div>' +
      '<div class="quick-replies">' + ['أنا مستنيك قدام البوابة', 'ممكن تيجي أسرع شوية؟', 'شكراً'].map((x) => '<button class="chip" data-action="quick-msg">' + x + '</button>').join('') + '</div>' +
      '<form class="chat-input" id="chatForm"><input id="chatText" autocomplete="off" placeholder="اكتب رسالة…" enterkeyhint="send"><button type="submit" aria-label="ابعت">' + I('send', 20) + '</button></form>');
    renderChat();
  }
  function renderChat() {
    const box = $('#chat');
    if (!box || !S.trip) return;
    const msgs = S.trip.chat;
    box.innerHTML = msgs.length ? msgs.map((m) => '<div class="bubble ' + m.who + '">' + esc(m.text) + '</div>').join('')
      : '<div class="empty-note" style="padding:14px">ابعت رسالة سريعة للكابتن</div>';
    box.scrollTop = box.scrollHeight;
  }
  function sendChat(text) {
    text = String(text || '').trim();
    const t = S.trip;
    if (!text || !t) return;
    t.chat.push({ who: 'me', text: text });
    renderChat();
    setTimeout(() => {
      if (S.trip !== t) return;
      t.chat.push({ who: 'them typing', text: 'بيكتب…' });
      renderChat();
      setTimeout(() => {
        if (S.trip !== t) return;
        t.chat = t.chat.filter((m) => m.who !== 'them typing');
        t.chat.push({ who: 'them', text: REPLIES[(Math.random() * REPLIES.length) | 0] });
        renderChat();
      }, 1300);
    }, 600);
  }

  function safetyModal() {
    openModal(P('shield', 64, 'm-pic') + '<h3>أمانك أولاً</h3><p>الكابتن متراجع بياناته، ورحلتك متابعة لحظة بلحظة.</p>' +
      '<div class="card menu">' +
        '<button class="item" data-action="share">' + P('link', 32) + '<span class="t"><b>شارك تفاصيل الرحلة</b><small>ابعت مكانك لحد بتثق فيه</small></span>' + I('chevron', 18) + '</button>' +
        '<button class="item" data-action="soon">' + P('busts_in_silhouette', 32) + '<span class="t"><b>جهات اتصال الطوارئ</b><small>ضيف ناس تتبلغ لو حصل حاجة</small></span>' + I('chevron', 18) + '</button>' +
        '<button class="item danger" data-action="soon">' + P('police_car_light', 32) + '<span class="t"><b>النجدة ١٢٢</b><small>في حالة الطوارئ بس</small></span>' + I('chevron', 18) + '</button>' +
      '</div><button class="btn btn-dark" data-action="close-modal">تمام</button>');
  }

  function shareTrip() {
    const t = S.trip;
    const txt = t ? 'أنا في مشوار مع ' + t.offer.driver.name + ' (' + t.offer.driver.car.model + ' ' + t.offer.driver.car.color + ') من ' + S.pickup.title + ' لـ ' + S.dest.title : '';
    const done = () => toast('اتنسخت تفاصيل الرحلة، ابعتها لأي حد', 'link');
    try { navigator.clipboard.writeText(txt).then(done, () => toast('تفاصيل الرحلة جاهزة للمشاركة', 'link')); } catch (e) { toast('تفاصيل الرحلة جاهزة للمشاركة', 'link'); }
  }

  // ---------- تنبيهات ----------
  function toast(msg, pic) {
    const root = $('#toastRoot');
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = P(pic || 'check_mark_button', 34) + '<span>' + esc(msg) + '</span>';
    root.appendChild(el);
    while (root.children.length > 2) root.firstElementChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 2600);
  }

  // ---------- الصفحات ----------
  const pageStack = [];
  function pageShell(title, body) {
    return '<header class="page-head"><button class="round" data-action="close-page" aria-label="رجوع">' + I('back', 22) + '</button><h2>' + title + '</h2></header>' +
      '<div class="page-body">' + body + '</div>';
  }
  function openPage(name, arg) {
    closeModal();
    const el = document.createElement('section');
    el.className = 'page';
    el.dataset.page = name;
    el.dataset.arg = arg || '';
    el.innerHTML = PAGES[name](arg);
    $('#pages').appendChild(el);
    el.getBoundingClientRect();
    requestAnimationFrame(() => el.classList.add('in'));
    pageStack.push(el);
  }
  function closePage() {
    const el = pageStack.pop();
    if (!el) return;
    el.classList.remove('in');
    setTimeout(() => el.remove(), 520);
    const prev = pageStack[pageStack.length - 1];
    if (prev) refreshPage(prev);
  }
  function closeAllPages() { while (pageStack.length) closePage(); }
  function refreshPage(el) {
    const body = $('.page-body', el), y = body ? body.scrollTop : 0;
    el.innerHTML = PAGES[el.dataset.page](el.dataset.arg);
    const nb = $('.page-body', el);
    if (nb) nb.scrollTop = y;
  }

  function starsRow(n, size) {
    let s = '';
    for (let k = 1; k <= 5; k++) s += '<span style="opacity:' + (k <= n ? 1 : 0.22) + '">' + MW.starIcon(size || 13) + '</span>';
    return s;
  }

  function tripCard(t) {
    return '<button class="card trip-card" data-action="open-trip" data-id="' + t.id + '">' +
      '<span class="top">' + MW.car(carColor(t.driver.car.hex), 76) +
        '<span class="t"><b>' + esc(t.to.title) + '</b><small>' + dayLabel(t.at) + ' · ' + clock(t.at) + (t.sample ? '<span class="sample-tag">مثال</span>' : '') + '</small></span>' +
        '<strong>' + egp(t.price + (t.tip || 0)) + '</strong></span>' +
      '<span class="foot">من ' + esc(t.from.title) + ' · ' + num(t.km, 1) + ' كم' + (t.rating ? '<span class="stars">' + starsRow(t.rating) + '</span>' : '<span class="stars" style="color:var(--text-3)">من غير تقييم</span>') + '</span>' +
      '</button>';
  }

  const item = (pic, title, sub, action, extra, attrs) => '<button class="item" data-action="' + action + '"' + (attrs || '') + '>' + P(pic, 32) +
    '<span class="t"><b>' + title + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</span>' + (extra || '') + I('chevron', 18) + '</button>';

  const PAGES = {
    profile() {
      const total = trips.reduce((s, t) => s + t.km, 0);
      return pageShell('حسابي',
        '<div class="card hero">' + myAvatar(88) +
          '<h3>' + esc(profile.name) + '</h3><p>' + esc(profile.phone) + '</p>' +
          '<span class="badge">' + MW.starIcon(13) + 'راكب مميز · ٤٫٩٢</span>' +
          '<div class="kpis"><div><b>' + num(trips.length) + '</b><small>مشوار</small></div><div><b>' + num(total) + '</b><small>كيلومتر</small></div><div><b>' + num(trips.filter((t) => t.rating === 5).length) + '</b><small>تقييم ٥ نجوم</small></div></div>' +
        '</div>' +
        '<div class="card menu">' +
          item('receipt', 'مشاويري السابقة', 'كل رحلاتك وإيصالاتها', 'open-history', '<span class="count">' + num(trips.length) + '</span>') +
          item('bookmark', 'الأماكن المحفوظة', 'البيت، الشغل، وأماكنك المفضلة', 'page', '', ' data-page="places"') +
          item('credit_card', 'طرق الدفع', 'كاش', 'page', '', ' data-page="payment"') +
          item('gear', 'الإعدادات', 'الحساب، الوضع الليلي، الإشعارات', 'page', '', ' data-page="settings"') +
        '</div>' +
        '<div class="card menu">' +
          item('red_question_mark', 'المساعدة والدعم', '', 'page', '', ' data-page="help"') +
          item('information', 'عن مشوار', '', 'page', '', ' data-page="about"') +
        '</div>' +
        '<div class="card menu"><button class="item danger" data-action="logout">' + P('door', 32) + '<span class="t"><b>تسجيل الخروج</b></span></button></div>');
    },

    history() {
      const list = trips.slice().sort((a, b) => b.at - a.at);
      if (!list.length) {
        return pageShell('مشاويري السابقة', '<div class="center">' + P('receipt', 72) + '<h3>لسه معملتش مشاوير</h3><p>أول ما تخلص مشوار هيظهر هنا بكل تفاصيله.</p></div>' +
          '<button class="btn btn-primary" data-action="new-ride">اطلب أول مشوار</button>');
      }
      let html = '', last = '';
      for (const t of list) {
        const g = dayLabel(t.at);
        if (g !== last) { html += '<div class="group-title">' + g + '</div>'; last = g; }
        html += tripCard(t);
      }
      return pageShell('مشاويري السابقة', html);
    },

    trip(id) {
      const t = trips.find((x) => x.id === id);
      if (!t) return pageShell('تفاصيل المشوار', '<div class="empty-note">المشوار ده مش موجود</div>');
      const d = t.driver;
      return pageShell('تفاصيل المشوار',
        '<div class="center" style="padding:4px 16px 0">' + MW.car(carColor(d.car.hex), 210) + '<h3>' + esc(t.to.title) + '</h3><p>' + dayLabel(t.at) + ' · ' + clock(t.at) + (t.sample ? ' · مثال' : '') + '</p></div>' +
        '<div class="card route-mini"><div class="rail">' + F('pin', 15) + '<span class="line"></span>' + F('square', 13) + '</div>' +
          '<div class="stop"><small>من</small><b>' + esc(t.from.title) + '</b></div><div class="stop"><small>إلى</small><b>' + esc(t.to.title) + '</b></div></div>' +
        '<div class="card driver-card"><div class="driver-top">' + MW.avatar(d.name, d.seed, 50, d.face) +
          '<span class="t"><b>' + esc(d.name) + '</b><small>' + MW.starIcon(13) + num(d.rating, 2) + ' · ' + esc(d.car.model) + ' ' + esc(d.car.color) + '</small></span>' + MW.plate(d.plate) + '</div></div>' +
        '<div class="card receipt">' +
          '<div class="r"><span>المسافة</span><b>' + num(t.km, 1) + ' كم</b></div>' +
          '<div class="r"><span>المدة</span><b>' + mins(Math.round(t.min)) + '</b></div>' +
          '<div class="r"><span>أجرة المشوار</span><b>' + egp(t.price) + '</b></div>' +
          '<div class="r"><span>إكرامية</span><b>' + (t.tip ? egp(t.tip) : '—') + '</b></div>' +
          '<div class="r"><span>طريقة الدفع</span><b>كاش</b></div>' +
          '<div class="r total"><span>الإجمالي</span><b>' + egp(t.price + (t.tip || 0)) + '</b></div>' +
        '</div>' +
        (t.rating ? '<div class="card rate-box" style="align-items:flex-start"><span class="sub-title" style="padding:0">تقييمك</span><span class="stars" style="color:var(--orange);gap:2px">' + starsRow(t.rating, 22) + '</span>' +
          (t.tags && t.tags.length ? '<div class="chips" style="justify-content:flex-start">' + t.tags.map((x) => '<span class="chip">' + esc(x) + '</span>').join('') + '</div>' : '') +
          (t.comment ? '<p style="color:var(--text-2);font-size:14px">"' + esc(t.comment) + '"</p>' : '') + '</div>' : '') +
        '<button class="btn btn-primary" data-action="repeat-trip" data-id="' + t.id + '">اطلب نفس المشوار تاني</button>' +
        '<button class="btn btn-ghost" data-action="soon">عندي مشكلة في المشوار ده</button>');
    },

    settings() {
      const sw = (key) => '<label class="switch"><input type="checkbox" data-setting="' + key + '"' + (settings[key] ? ' checked' : '') + '><span></span></label>';
      const row = (pic, title, sub, key) => '<div class="item">' + P(pic, 32) + '<span class="t"><b>' + title + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</span>' + sw(key) + '</div>';
      return pageShell('الإعدادات',
        '<div class="group-title">الحساب</div>' +
        '<div class="card menu">' +
          '<label class="item">' + P('av_man_beard', 32) + '<span class="t"><small>الاسم</small><input type="text" id="nameInput" value="' + esc(profile.name) + '" maxlength="40"></span></label>' +
          '<div class="item">' + P('mobile_phone', 32) + '<span class="t"><small>رقم الموبايل</small><b style="direction:ltr;text-align:end">' + esc(profile.phone) + '</b></span></div>' +
        '</div>' +
        '<div class="group-title">التفضيلات</div>' +
        '<div class="card menu">' + row('crescent_moon', 'الوضع الليلي', 'ألوان داكنة مريحة للعين', 'dark') + row('bell', 'الإشعارات', 'العروض وتحديثات الرحلة', 'notif') + row('speaker_high_volume', 'أصوات التطبيق', '', 'sound') + '</div>' +
        '<div class="group-title">الأمان</div>' +
        '<div class="card menu">' + row('link', 'مشاركة الرحلة تلقائياً', 'مع جهات اتصال الطوارئ', 'share') +
          item('busts_in_silhouette', 'جهات اتصال الطوارئ', '', 'soon') + '</div>' +
        '<div class="group-title">البيانات</div>' +
        '<div class="card menu"><button class="item danger" data-action="clear-history">' + P('wastebasket', 32) + '<span class="t"><b>مسح سجل المشاوير</b></span></button></div>' +
        '<p style="text-align:center;color:var(--text-3);font-size:12px;margin-top:6px">مشوار · الإصدار ١٫١ (تجريبي)</p>');
    },

    places() {
      const saved = D.places.filter((p) => p.saved);
      return pageShell('الأماكن المحفوظة',
        '<div class="card menu">' + saved.map((p) => item(p.img, esc(p.title), esc(p.sub), 'ride-to', '', ' data-id="' + p.id + '"')).join('') + '</div>' +
        '<div class="group-title">أماكن بتروحها كتير</div>' +
        '<div class="card menu">' + D.recentIds.map(placeById).map((p) => item(p.img, esc(p.title), esc(p.sub), 'ride-to', '', ' data-id="' + p.id + '"')).join('') + '</div>' +
        '<button class="btn btn-ghost" data-action="soon">' + I('plus', 20) + 'ضيف مكان جديد</button>');
    },

    payment() {
      return pageShell('طرق الدفع', payItems() +
        '<div class="note"><b>الدفع كاش بس دلوقتي.</b> الدفع الإلكتروني هيتفعّل أول ما نربط التطبيق ببوابة الدفع.</div>');
    },

    help() {
      const faq = [
        ['السعر بيتحسب إزاي؟', 'السعر المقترح بيتحسب من المسافة والوقت المتوقع للمشوار. تقدر تزوّده أو تقلّله شوية قبل ما تطلب، والكباتن بيبعتوا عروضهم.'],
        ['إزاي أختار الكابتن؟', 'بعد ما تطلب، العروض بتوصلك واحد ورا التاني وفيها اسم الكابتن وتقييمه والعربية والسعر ووقت الوصول. اختار اللي يناسبك ودوس "اختار".'],
        ['إيه هو رمز المشوار؟', 'رقم من ٤ أرقام بيظهرلك بعد ما تقبل العرض. قوله للكابتن وانت راكب عشان تتأكد إنك في العربية الصح.'],
        ['ينفع ألغي المشوار؟', 'أيوه، تقدر تلغي في أي وقت قبل ما المشوار يبدأ من غير أي رسوم.'],
        ['نسيت حاجة في العربية', 'افتح المشوار من "مشاويري السابقة" ودوس "عندي مشكلة في المشوار ده" وفريق الدعم هيتواصل مع الكابتن.'],
      ];
      return pageShell('المساعدة والدعم',
        '<div class="center" style="padding:8px 16px 4px">' + P('red_question_mark', 64) + '<h3>محتاج مساعدة؟</h3></div>' +
        '<div class="card faq">' + faq.map((f) => '<details><summary>' + f[0] + '</summary><p>' + f[1] + '</p></details>').join('') + '</div>' +
        '<button class="btn btn-primary" data-action="soon">كلّم فريق الدعم</button>');
    },

    about() {
      return pageShell('عن مشوار',
        '<div class="center">' + MW.car('orange', 230) + '<div class="logo" style="font-size:44px">مشوار<i></i></div><p>مشوارك… بأناقة. اطلب عربية، اختار الكابتن اللي يعجبك، ووصل بأمان.</p></div>' +
        '<div class="note"><b>دي نسخة تجريبية.</b> الكباتن والعروض وحركة العربية على الخريطة كلها محاكاة عشان تجرب التطبيق من الأول للآخر. الخطوة الجاية: ربط التطبيق بسيرفر حقيقي وخرائط حقيقية.</div>' +
        '<div class="card menu">' +
          '<div class="item"><span class="t"><b>الإصدار</b></span><span style="color:var(--text-2)">١٫١</span></div>' +
          '<div class="item"><span class="t"><b>الصور الثلاثية الأبعاد</b><small>Microsoft Fluent Emoji (رخصة MIT)</small></span></div>' +
        '</div>');
    },
  };

  // ---------- الأحداث ----------
  const ACTIONS = {
    'open-plan': () => openPlan('dest'),
    'go-home': () => goHome(),
    'quick-dest': (el) => { S.pickup = D.me; S.dest = placeById(el.dataset.id); openPreview(); },
    'choose-place': (el) => { const p = placeById(el.dataset.id); if (p) choosePlace(p); },
    'swap': () => {
      const t = S.pickup; S.pickup = S.dest; S.dest = t;
      $('#pickupInput').value = S.pickup ? S.pickup.title : '';
      $('#destInput').value = S.dest ? S.dest.title : '';
      if (S.pickup && S.dest) openPreview(); else { setField(S.pickup ? 'dest' : 'pickup'); renderPlaces(''); }
    },
    'pick-on-map': () => startPick(),
    'cancel-pick': () => { $('#centerPin').hidden = true; openPlan(S.field); },
    'confirm-pick': () => confirmPick(),
    'back-plan': () => openPlan('dest'),
    'price-up': () => adjustPrice(5),
    'price-down': () => adjustPrice(-5),
    'payment-modal': () => paymentModal(),
    'request': () => requestRide(),
    'cancel-request': () => cancelRequest(),
    'select-offer': (el) => { S.sel = el.dataset.id; updateOffersUI(); },
    'accept-sel': () => { if (S.sel) acceptOffer(S.sel); },
    'cancel-trip': () => confirmBox({
      pic: 'cross_mark', danger: true, title: 'تلغي المشوار؟', text: 'الكابتن في الطريق ليك. لو لغيت دلوقتي مش هيتحسب عليك أي رسوم.',
      ok: 'أيوه، الغي المشوار', cancel: 'لأ، كمّل',
      onOk: () => { toast('اتلغى المشوار', 'cross_mark'); goHome(); },
    }),
    'call': () => callModal(),
    'chat': () => chatModal(),
    'share': () => shareTrip(),
    'safety': () => safetyModal(),
    'quick-msg': (el) => sendChat(el.textContent),
    'skip': () => { if (S.trip) S.trip.api.skip(); },
    'menu': () => menuModal(),
    'recenter': () => {
      S.userMoved = false;
      if (S.view) S.view(700);
      else { const me = M.nodeXY(D.me.i, D.me.j); M.flyTo(me.x, me.y, 0.42, 700); }
    },
    'star': (el) => setStars(Number(el.dataset.n)),
    'tag': (el) => {
      const t = el.dataset.t, k = rate.tags.indexOf(t);
      if (k === -1) rate.tags.push(t); else rate.tags.splice(k, 1);
      el.classList.toggle('on', k === -1);
    },
    'tip': (el) => {
      rate.tip = Number(el.dataset.v);
      $$('#rateScreen .tips .chip').forEach((b) => b.classList.toggle('on', b === el));
    },
    'submit-rating': () => finishRating(true),
    'skip-rating': () => finishRating(false),
    'close-modal': () => closeModal(),
    'confirm-ok': () => { const fn = confirmFn; confirmFn = null; closeModal(); if (fn) fn(); },
    'open-profile': () => openPage('profile'),
    'open-history': () => openPage('history'),
    'open-trip': (el) => openPage('trip', el.dataset.id),
    'page': (el) => openPage(el.dataset.page),
    'close-page': () => closePage(),
    'soon': () => toast('الميزة دي جاية قريب', 'sparkles'),
    'new-ride': () => { closeAllPages(); if (S.screen === 'home') openPlan('dest'); },
    'ride-to': (el) => {
      if (S.trip || S.req) return toast('عندك مشوار شغال دلوقتي', 'information');
      closeAllPages();
      S.pickup = D.me; S.dest = placeById(el.dataset.id);
      setTimeout(openPreview, 200);
    },
    'repeat-trip': (el) => {
      if (S.trip || S.req) return toast('عندك مشوار شغال دلوقتي', 'information');
      const t = trips.find((x) => x.id === el.dataset.id);
      if (!t) return;
      closeAllPages();
      S.pickup = t.from.id === 'me' ? D.me : (placeById(t.from.id) || t.from);
      S.dest = placeById(t.to.id) || t.to;
      setTimeout(openPreview, 200);
    },
    'logout': () => confirmBox({
      pic: 'door', title: 'تسجيل الخروج', text: 'دي نسخة تجريبية من غير حسابات لسه. تسجيل الدخول برقم الموبايل هيتفعّل لما نربط السيرفر.',
      ok: 'تمام', cancel: 'رجوع', onOk: () => {},
    }),
    'clear-history': () => confirmBox({
      pic: 'wastebasket', danger: true, title: 'تمسح سجل المشاوير؟', text: 'كل المشاوير السابقة هتتمسح من على الجهاز ده.',
      ok: 'امسح السجل', onOk: () => { trips = []; saveTrips(); toast('اتمسح سجل المشاوير', 'wastebasket'); pageStack.forEach(refreshPage); },
    }),
  };

  app.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || !app.contains(el)) return;
    const fn = ACTIONS[el.dataset.action];
    if (fn) { e.preventDefault(); fn(el); }
  });

  app.addEventListener('input', (e) => {
    const id = e.target.id;
    if (id === 'destInput' || id === 'pickupInput') {
      setField(id === 'destInput' ? 'dest' : 'pickup');
      renderPlaces(e.target.value);
    }
  });

  app.addEventListener('focusin', (e) => {
    const id = e.target.id;
    if (id === 'destInput' || id === 'pickupInput') {
      const f = id === 'destInput' ? 'dest' : 'pickup';
      if (S.field !== f) { setField(f); renderPlaces(''); }
      e.target.select();
    }
  });

  app.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset && t.dataset.setting) {
      settings[t.dataset.setting] = t.checked;
      store.set('settings', settings);
      if (t.dataset.setting === 'dark') applyTheme();
    }
    if (t.id === 'nameInput') {
      const v = t.value.trim();
      if (!v) { t.value = profile.name; return; }
      profile.name = v;
      store.set('profile', profile);
      if (S.screen === 'home') setSheet(homeHTML(), 'deep');
      toast('اتحفظ الاسم', 'check_mark_button');
    }
  });

  app.addEventListener('submit', (e) => {
    if (e.target.id === 'chatForm') {
      e.preventDefault();
      const inp = $('#chatText');
      sendChat(inp.value);
      inp.value = '';
    }
  });

  app.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.target.id === 'destInput' || e.target.id === 'pickupInput')) {
      const first = $('#placeList .row');
      if (first) first.click();
    }
    if (e.key === 'Escape') {
      if ($('#modalRoot').children.length) closeModal();
      else if (pageStack.length) closePage();
    }
  });

  function applyTheme() {
    document.body.classList.toggle('dark', !!settings.dark);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', settings.dark ? '#1A1B1E' : '#EDEFF0');
  }

  // ---------- البداية ----------
  function boot() {
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
    applyTheme();
    M.init(document.getElementById('map'), D.places, D.districts);
    $('#meBtn').innerHTML = myAvatar(50);
    $('#menuBtn').innerHTML = F('grid', 20);
    $('#locIcon').innerHTML = F('nav', 13) + 'موقعك الحالي';
    $('#fab').innerHTML = I('locate', 21);
    $('#skipBtn').innerHTML = I('forward', 15) + 'تسريع (للتجربة)';
    $('#splashCar').innerHTML = MW.car('white', 230);
    $('#locText').textContent = D.me.sub;
    const me = M.nodeXY(D.me.i, D.me.j);
    M.flyTo(me.x, me.y - 200, 0.3, 0);
    goHome();
    setTimeout(() => $('#splash').classList.add('gone'), 1500);
    setTimeout(() => $('#splash').remove(), 2300);
  }

  boot();
})();
