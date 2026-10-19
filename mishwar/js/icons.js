/* مشوار — الأيقونات والصور
   رموز بسيطة (سهم رجوع، بحث، +، −) خطية، وكل الباقي صور ثلاثية الأبعاد من js/assets.js */
(function () {
  'use strict';
  window.MW = window.MW || {};

  const P = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    nav: '<path d="M3 11 21 3l-8 18-2-8-8-2z"/>',
    back: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
    forward: '<path d="M19 12H5"/><path d="m11 6-6 6 6 6"/>',
    chevron: '<path d="m15 6-6 6 6 6"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
    message: '<path d="M21 12a8 8 0 0 1-11.8 7L4 20l1.1-4.6A8 8 0 1 1 21 12z"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    star: '<path d="m12 2.8 2.9 5.9 6.5.9-4.7 4.6 1.1 6.4L12 17.6l-5.8 3 1.1-6.4L2.6 9.6l6.5-.9z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    route: '<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H17a3.5 3.5 0 0 0 0-7H7a3.5 3.5 0 0 1 0-7h8.5"/>',
    cash: '<rect x="2" y="6" width="20" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20M6 15h4"/>',
    wallet: '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3"/><path d="M21 9h-5a3 3 0 0 0 0 6h5z"/>',
    sliders: '<path d="M4 6h9M19 6h1M4 12h3M13 12h7M4 18h11M21 18h-1"/><circle cx="16" cy="6" r="2.2"/><circle cx="10" cy="12" r="2.2"/><circle cx="18" cy="18" r="2.2"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
    bookmark: '<path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
    plane: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
    bag: '<path d="M6 7h12l1 14H5z"/><path d="M9 7a3 3 0 0 1 6 0"/>',
    building: '<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>',
    tree: '<path d="M12 22v-6"/><path d="M12 16c-4 0-7-2.5-7-6a7 7 0 0 1 14 0c0 3.5-3 6-7 6z"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 4.9.8c0 1.7-2.4 2.2-2.4 3.7M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    logout: '<path d="M15 21h4a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-4"/><path d="m8 17-5-5 5-5M3 12h12"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    locate: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    swap: '<path d="M8 4v16M4 8l4-4 4 4M16 20V4M12 16l4 4 4-4"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    volume: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/>',
    send: '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/>',
    map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13M12 8S10.5 3 8 3.5 7 8 12 8zM12 8s1.5-5 4-4.5S17 8 12 8z"/>',
    sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
  };

  MW.icon = function (name, size, extra) {
    const s = size || 22;
    return '<svg class="ic' + (extra ? ' ' + extra : '') + '" width="' + s + '" height="' + s +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      (P[name] || '') + '</svg>';
  };

  // رموز مصمتة صغيرة (دبوس الخريطة، مربع الوجهة، النجمة...)
  const F = {
    pin: '<path d="M12 2.5a7 7 0 0 0-7 7c0 5.1 6 11.3 6.3 11.6a1 1 0 0 0 1.4 0C13 20.8 19 14.6 19 9.5a7 7 0 0 0-7-7Zm0 9.6a2.6 2.6 0 1 1 0-5.2 2.6 2.6 0 0 1 0 5.2Z"/>',
    nav: '<path d="M20.6 3.4a1 1 0 0 0-1.1-.2L3.6 10.1a1 1 0 0 0 .1 1.9l6.6 1.7 1.7 6.6a1 1 0 0 0 1.9.1l6.9-15.9a1 1 0 0 0-.2-1.1Z"/>',
    square: '<rect x="5" y="5" width="14" height="14" rx="3.2"/>',
    grid: '<rect x="3" y="3" width="8" height="8" rx="2.4"/><rect x="13" y="3" width="8" height="8" rx="2.4"/><rect x="3" y="13" width="8" height="8" rx="2.4"/><rect x="13" y="13" width="8" height="8" rx="2.4"/>',
    star: '<path d="M11.1 2.9a1 1 0 0 1 1.8 0l2.3 4.8 5.2.7a1 1 0 0 1 .6 1.7l-3.8 3.7.9 5.2a1 1 0 0 1-1.5 1L12 17.6 7.4 20a1 1 0 0 1-1.5-1l.9-5.2L3 10.1a1 1 0 0 1 .6-1.7l5.2-.7z"/>',
    person: '<circle cx="12" cy="8" r="4.2"/><path d="M3.8 20.2C4.6 15.9 8 13.6 12 13.6s7.4 2.3 8.2 6.6a1 1 0 0 1-1 1.2H4.8a1 1 0 0 1-1-1.2Z"/>',
  };
  MW.fill = function (name, size, extra) {
    const s = size || 18;
    return '<svg class="ic' + (extra ? ' ' + extra : '') + '" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' + (F[name] || '') + '</svg>';
  };
  MW.starIcon = function (size) { return MW.fill('star', size); };

  // صور ثلاثية الأبعاد (Microsoft Fluent Emoji 3D، رخصة MIT) بدل الأيقونات الخطية
  MW.pic = function (name, size, cls) {
    const src = (MW.IMG && MW.IMG[name]) || '';
    return '<img class="pic' + (cls ? ' ' + cls : '') + '" src="' + src + '" width="' + size + '" height="' + size + '" alt="" draggable="false">';
  };

  // صور العربيات (متولّدة بـ three.js من tools/car-render.html)
  const CAR_HEX = { '#F4F4F6': 'white', '#1B1C1F': 'black', '#C9CCD2': 'silver', '#7D8088': 'grey', '#26324A': 'navy', '#A3261E': 'red', '#CDBFA6': 'beige' };
  const carKey = (c) => (MW.IMG['car_' + c] ? c : CAR_HEX[String(c).toUpperCase()] || 'white');
  MW.car = function (color, width, cls) {
    return '<img class="car-img' + (cls ? ' ' + cls : '') + '" src="' + MW.IMG['car_' + carKey(color)] + '" style="width:' + (width || 120) + 'px" alt="" draggable="false">';
  };
  MW.carTop = function (color) {
    return '<img class="car-top" src="' + MW.IMG['top_' + carKey(color || 'white')] + '" alt="" draggable="false">';
  };

  // صورة شخصية ثلاثية الأبعاد على خلفية ناعمة
  const AV_BG = [['#FFE3CC', '#FFC08F'], ['#E7E9EE', '#C9CDD6'], ['#FFE9D6', '#FFD0A8'], ['#E5ECE8', '#C3D3CA'], ['#EEE6DD', '#D9C8B6'], ['#E4E7F0', '#C5CBDD']];
  const PEOPLE = ['man', 'man_curly_hair', 'man_office_worker', 'man_bald', 'old_man', 'person', 'person_curly_hair'];
  MW.avatar = function (name, seed, size, who) {
    const k = Math.abs(seed || 0);
    const bg = AV_BG[k % AV_BG.length];
    const face = who || PEOPLE[k % PEOPLE.length];
    return '<span class="avatar" style="--sz:' + (size || 48) + 'px;--a:' + bg[0] + ';--b:' + bg[1] + '" aria-label="' + String(name || '').replace(/"/g, '') + '">' +
      '<img src="' + MW.IMG['av_' + face] + '" alt="" draggable="false"></span>';
  };

  // لوحة أرقام مصرية
  MW.plate = function (p) {
    return '<span class="plate" aria-label="رقم اللوحة"><span class="plate-top">مصر</span><span class="plate-body"><b>' +
      p.letters.split('').join(' ') + '</b><i></i><b>' + p.digits + '</b></span></span>';
  };
})();
