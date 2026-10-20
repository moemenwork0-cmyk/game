/* مشوار — الأيقونات والصور
   أيقونات Phosphor (js/icon-set.js) بثلاث أوزان: duotone للأيقونات جوه المربعات، fill للعلامات الصغيرة،
   bold لأزرار التحكم. العربيات صور 3D من js/assets.js. */
(function () {
  'use strict';
  window.MW = window.MW || {};

  function svg(inner, size, cls) {
    return '<svg class="ic' + (cls ? ' ' + cls : '') + '" width="' + size + '" height="' + size + '" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">' + inner + '</svg>';
  }

  // أيقونة باسمها في Phosphor
  MW.ic = function (name, size, weight, cls) {
    return svg((MW.PH[weight || 'duotone'] || {})[name] || '', size || 22, cls);
  };

  // أسماء مختصرة لأزرار التحكم (وزن bold)
  const CTRL = {
    search: 'magnifying-glass', back: 'arrow-right', forward: 'arrow-left', chevron: 'caret-left', x: 'x',
    plus: 'plus', minus: 'minus', check: 'check', swap: 'arrows-down-up', clock: 'clock', locate: 'crosshair',
    send: 'paper-plane-tilt',
  };
  MW.icon = function (name, size, cls) { return MW.ic(CTRL[name] || name, size || 20, 'bold', cls); };

  // علامات مصمتة صغيرة
  const SQUARE = '<rect x="48" y="48" width="160" height="160" rx="36"/>';
  MW.fill = function (name, size, cls) {
    if (name === 'square') return svg(SQUARE, size || 16, cls);
    const map = { pin: 'map-pin', nav: 'navigation-arrow', grid: 'squares-four', star: 'star', person: 'user' };
    return MW.ic(map[name] || name, size || 16, 'fill', cls);
  };
  MW.starIcon = function (size) { return MW.fill('star', size); };

  // أيقونة جوه مربع ناعم (الشكل الأساسي للأيقونات في التطبيق)
  MW.tile = function (name, opts) {
    opts = opts || {};
    return '<span class="tile-ic' + (opts.tone ? ' ' + opts.tone : '') + '"' + (opts.size ? ' style="--t:' + opts.size + 'px"' : '') + '>' +
      MW.ic(name, opts.icon || 24, opts.weight || 'duotone') + '</span>';
  };

  // صور العربيات (متولّدة بـ three.js من tools/car-render.html)
  const CAR_HEX = { '#F4F4F6': 'white', '#1B1C1F': 'black', '#C9CCD2': 'silver', '#7D8088': 'grey' };
  const carKey = (c) => (MW.IMG['car_' + c] ? c : CAR_HEX[String(c).toUpperCase()] || 'white');
  MW.car = function (color, width, cls) {
    return '<img class="car-img' + (cls ? ' ' + cls : '') + '" src="' + MW.IMG['car_' + carKey(color)] + '" style="width:' + (width || 120) + 'px" alt="" draggable="false">';
  };
  MW.carTop = function (color) {
    return '<img class="car-top" src="' + MW.IMG['top_' + carKey(color || 'white')] + '" alt="" draggable="false">';
  };

  // صورة شخصية بالحروف الأولى (لحد ما الصور الحقيقية تيجي من السيرفر)
  const AV = [['#111111', '#3A3A3A'], ['#E8E8E8', '#CFCFCF', '#111111'], ['#4A4A4A', '#6E6E6E'], ['#262626', '#4F4F4F'], ['#7A7A7A', '#9A9A9A'], ['#1C1C1C', '#444444']];
  MW.avatar = function (name, seed, size, opts) {
    const words = String(name || '').trim().split(/\s+/).filter(Boolean);
    const letters = (words[0] ? words[0][0] : '') + (words.length > 1 ? words[1][0] : '');
    const c = AV[Math.abs(seed || 0) % AV.length];
    const s = size || 48;
    return '<span class="avatar" style="--sz:' + s + 'px;--a:' + c[0] + ';--b:' + c[1] + (c[2] ? ';color:' + c[2] : '') + '" aria-label="' + String(name || '').replace(/"/g, '') + '">' +
      '<span>' + letters.split('').join(' ') + '</span>' +
      (opts && opts.verified ? '<i class="verified">' + MW.ic('seal-check', Math.round(s * 0.36), 'fill') + '</i>' : '') + '</span>';
  };

  // لوحة أرقام مصرية
  MW.plate = function (p) {
    return '<span class="plate" aria-label="رقم اللوحة"><span class="plate-top">مصر</span><span class="plate-body"><b>' +
      p.letters.split('').join(' ') + '</b><i></i><b>' + p.digits + '</b></span></span>';
  };
})();
