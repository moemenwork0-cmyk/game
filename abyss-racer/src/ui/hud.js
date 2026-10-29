// In-race HUD: position, laps, timers, speedometer/tachometer, nitro + damage gauges, minimap,
// race messages, countdown and the touch controls.
import { fmt } from '../game/game.js';

const el = (tag, cls, parent, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; parent?.appendChild(e); return e; };

export class HUD {
  constructor(root, game) {
    this.g = game;
    this.root = el('div', 'hud', root);
    // top-left: position + laps + times
    const tl = el('div', 'hud-tl', this.root);
    this.posEl = el('div', 'hud-pos', tl, '<b>1</b><span>/8</span>');
    this.lapEl = el('div', 'hud-lap', tl, 'LAP 1/3');
    this.timeEl = el('div', 'hud-time', tl, '0:00.000');
    this.bestEl = el('div', 'hud-best', tl, 'BEST --:--.---');
    // top-right: minimap
    this.map = el('canvas', 'hud-map', this.root);
    this.map.width = 220; this.map.height = 220;
    this.mapCtx = this.map.getContext('2d');
    this.buildMap();
    // gauge (speed / rpm / gear / nitro / damage)
    const gauge = el('div', 'hud-gauge', this.root);
    this.tach = el('canvas', 'hud-tach', gauge);
    this.tach.width = 300; this.tach.height = 300;
    this.tachCtx = this.tach.getContext('2d');
    this.speedEl = el('div', 'hud-speed', gauge, '0');
    el('div', 'hud-unit', gauge, 'KM/H');
    this.gearEl = el('div', 'hud-gear', gauge, 'N');
    // bars
    const bars = el('div', 'hud-bars', this.root);
    const nb = el('div', 'hud-bar nitro', bars, '<label>NITRO</label><i></i>');
    this.nitroFill = nb.querySelector('i');
    const db = el('div', 'hud-bar dmg', bars, '<label>HULL</label><i></i>');
    this.dmgFill = db.querySelector('i');
    // messages
    this.msg = el('div', 'hud-msg', this.root);
    this.toastEl = el('div', 'hud-toast', this.root);
    this.cd = el('div', 'hud-countdown', this.root);
    this.wrong = el('div', 'hud-wrong', this.root, 'WRONG WAY');
    // controls
    const ctr = el('div', 'controls', this.root);
    this.ctr = ctr;
    const b = (cls, label, name) => { const x = el('div', 'tbtn ' + cls, ctr, label); game.input.bind(x, name); return x; };
    this.steerBtns = [b('left', '<svg viewBox="0 0 24 24"><path d="M15 4 7 12l8 8"/></svg>', 'left'), b('right', '<svg viewBox="0 0 24 24"><path d="m9 4 8 8-8 8"/></svg>', 'right')];
    b('brake', '<span>BRAKE</span>', 'brake');
    b('gas', '<span>GAS</span>', 'gas');
    b('boost', '<span>NITRO</span>', 'boost');
    b('hand', '<span>DRIFT</span>', 'hand');
    this.pauseBtn = el('div', 'tbtn pause', this.root, '<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>');
    this.pauseBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); game.ui?.pause(); });
    this.camBtn = el('div', 'tbtn cam', this.root, '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>');
    this.camBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); game.cameraRig.mode = (game.cameraRig.mode + 1) % 3; });
    this.applyControlMode();
    this.msgT = 0; this.toastT = 0;
  }

  applyControlMode() {
    const tilt = this.g.input.mode === 'tilt';
    this.steerBtns.forEach((b) => { b.style.display = tilt ? 'none' : ''; });
    this.ctr.classList.toggle('autogas', !!this.g.input.autoGas);
  }

  show(on) { this.root.style.display = on ? '' : 'none'; }

  buildMap() {
    const t = this.g.world.track;
    let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
    for (let k = 0; k < t.N; k++) { const x = t.pos[k * 3], z = t.pos[k * 3 + 2]; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
    const s = 190 / Math.max(maxX - minX, maxZ - minZ);
    this.mapT = (x, z) => [110 + (x - (minX + maxX) / 2) * s * -1, 110 + (z - (minZ + maxZ) / 2) * s * -1];
    const c = document.createElement('canvas'); c.width = c.height = 220;
    const g = c.getContext('2d');
    g.lineJoin = 'round';
    const path = () => { g.beginPath(); for (let k = 0; k <= t.N; k += 6) { const [x, y] = this.mapT(t.pos[(k % t.N) * 3], t.pos[(k % t.N) * 3 + 2]); k ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); };
    g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 9; path(); g.stroke();
    g.strokeStyle = 'rgba(190,240,255,0.85)'; g.lineWidth = 4; path(); g.stroke();
    const [sx, sy] = this.mapT(t.pos[0], t.pos[2]);
    g.fillStyle = '#fff'; g.fillRect(sx - 6, sy - 2, 12, 4);
    this.mapBase = c;
  }

  message(title, sub = '', color = '#fff') {
    this.msg.innerHTML = `<b style="color:${color}">${title}</b><span>${sub}</span>`;
    this.msg.classList.remove('show'); void this.msg.offsetWidth; this.msg.classList.add('show');
    this.msgT = 2.6;
  }
  toast(text) {
    this.toastEl.textContent = text;
    this.toastEl.classList.remove('show'); void this.toastEl.offsetWidth; this.toastEl.classList.add('show');
    this.toastT = 1.4;
  }
  countdown(n) {
    this.cd.textContent = n === 0 ? 'GO!' : String(n);
    this.cd.className = 'hud-countdown show' + (n === 0 ? ' go' : '');
    if (n === 0) setTimeout(() => { this.cd.className = 'hud-countdown'; }, 900);
  }

  update(dt, g) {
    const race = g.race, p = g.player, v = p.v;
    this.msgT -= dt; if (this.msgT <= 0) this.msg.classList.remove('show');
    this.toastT -= dt; if (this.toastT <= 0) this.toastEl.classList.remove('show');
    this.posEl.innerHTML = `<b>${p.pos}</b><span>/${race.entrants.length}</span>`;
    this.lapEl.textContent = `LAP ${Math.min(race.laps, p.lap + 1)}/${race.laps}`;
    const now = race.state === 'racing' || race.state === 'finished' ? (p.finished ? p.finishT : race.t - race.raceStart) : 0;
    this.timeEl.textContent = fmt(Math.max(0, now));
    this.bestEl.textContent = 'BEST ' + fmt(p.best);
    const kmh = Math.round(Math.abs(v.vLocal.z) * 3.6);
    this.speedEl.textContent = kmh;
    this.gearEl.textContent = v.reverse ? 'R' : (v.speed < 0.5 && v.throttle < 0.05 ? 'N' : String(v.gear));
    this.nitroFill.style.transform = `scaleX(${p.nitro.toFixed(3)})`;
    this.nitroFill.parentElement.classList.toggle('active', !!p.nitroOn);
    this.nitroFill.parentElement.classList.toggle('ready', p.nitro > 0.3);
    this.dmgFill.style.transform = `scaleX(${Math.max(0, v.health).toFixed(3)})`;
    this.dmgFill.parentElement.classList.toggle('low', v.health < 0.35);
    this.wrong.classList.toggle('show', p.wrongWayT > 1.2);
    this.drawTach(v);
    this.mapAcc = (this.mapAcc || 0) + dt;
    if (this.mapAcc > 1 / 20) { this.mapAcc = 0; this.drawMap(g); }
  }

  drawTach(v) {
    const c = this.tachCtx, W = 300, cx = 150, cy = 150, R = 128;
    c.clearRect(0, 0, W, W);
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    const max = v.spec.limiter + 500;
    c.lineCap = 'round';
    c.lineWidth = 12; c.strokeStyle = 'rgba(255,255,255,0.12)';
    c.beginPath(); c.arc(cx, cy, R, a0, a1); c.stroke();
    const red = a0 + (a1 - a0) * (v.spec.redline / max);
    c.strokeStyle = 'rgba(255,60,40,0.55)';
    c.beginPath(); c.arc(cx, cy, R, red, a1); c.stroke();
    const f = Math.min(1, v.rpm / max);
    const grd = c.createLinearGradient(0, 300, 300, 0);
    grd.addColorStop(0, '#16d9ff'); grd.addColorStop(0.7, '#7cf7ff'); grd.addColorStop(1, '#ff4b2b');
    c.strokeStyle = v.rpm > v.spec.redline ? '#ff4b2b' : grd;
    c.lineWidth = 12;
    c.beginPath(); c.arc(cx, cy, R, a0, a0 + (a1 - a0) * f); c.stroke();
    // ticks
    c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 2;
    for (let r = 0; r <= max; r += 1000) {
      const a = a0 + (a1 - a0) * (r / max);
      c.beginPath(); c.moveTo(cx + Math.cos(a) * (R - 20), cy + Math.sin(a) * (R - 20)); c.lineTo(cx + Math.cos(a) * (R - 10), cy + Math.sin(a) * (R - 10)); c.stroke();
    }
  }

  drawMap(g) {
    const c = this.mapCtx;
    c.clearRect(0, 0, 220, 220);
    c.drawImage(this.mapBase, 0, 0);
    for (const e of g.race.entrants) {
      const [x, y] = this.mapT(e.v.pos.x, e.v.pos.z);
      c.beginPath();
      c.arc(x, y, e.isPlayer ? 7 : 5, 0, Math.PI * 2);
      c.fillStyle = e.isPlayer ? '#ffd23f' : '#' + e.visual.uniforms.uPaint.value.getHexString();
      c.fill();
      c.lineWidth = 2; c.strokeStyle = e.isPlayer ? '#000' : 'rgba(0,0,0,0.7)'; c.stroke();
    }
  }
}
