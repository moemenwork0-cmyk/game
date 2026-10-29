// Menus: loading screen, title, garage (car + livery select), settings, pause, results.
import * as THREE from 'three';
import { CAR_SPECS } from '../physics/carspecs.js';
import { LIVERIES, QUALITY, fmt } from '../game/game.js';
import { CarVisual } from '../car/carmodel.js';
import { loaded } from '../core/assets.js';
import { TRACK } from '../world/trackdef.js';

const el = (tag, cls, parent, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; parent?.appendChild(e); return e; };

export const DEFAULT_SETTINGS = {
  quality: 'high', steering: 'buttons', autoGas: false, steerAssist: 0.6, abs: true, tcs: true, crashCam: true,
  haptics: true, volume: 0.9, music: 0.5, laps: 3, opponents: 7, difficulty: 1, car: 'marlin', livery: 0,
};

export function loadSettings() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem('abyss.settings') || '{}'); } catch (_) { s = {}; }
  const out = { ...DEFAULT_SETTINGS, ...s };
  if (!s.quality) out.quality = guessQuality();
  return out;
}
export function saveSettings(s) { try { localStorage.setItem('abyss.settings', JSON.stringify(s)); } catch (_) { /* ignore */ } }

function guessQuality() {
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  const mem = navigator.deviceMemory || 4, cores = navigator.hardwareConcurrency || 4;
  if (!mobile) return 'high';
  if (mem >= 8 && cores >= 8) return 'high';
  if (mem >= 4) return 'medium';
  return 'low';
}

export class Loading {
  constructor(root) {
    this.root = el('div', 'screen loading', root, `
      <div class="logo"><span class="l1">ABYSS</span><span class="l2">RACER</span></div>
      <div class="lbar"><i></i></div>
      <div class="lstage">Diving…</div>
      <div class="ltip">Tip: brushing a barrier at speed costs paint. Hitting it head-on costs the race.</div>`);
    this.bar = this.root.querySelector('.lbar i');
    this.stage = this.root.querySelector('.lstage');
    const tips = [
      'Tip: drift (handbrake) and catch air to fill the nitro gauge.',
      'Tip: sit in another car\'s wake to slipstream — and earn nitro.',
      'Tip: ram a rival hard enough to wreck it for a TAKEDOWN and a big nitro refill.',
      'Tip: the trench is pitch-black. Your headlights are all you have down there.',
      'Tip: lost your rear wing? Expect the back end to get lively at speed.',
      'Tip: the canyon jump needs speed. Lift off and you will swim with the fish.',
    ];
    this.root.querySelector('.ltip').textContent = tips[Math.floor(Math.random() * tips.length)];
  }
  set(p, text) { this.bar.style.transform = `scaleX(${p})`; if (text) this.stage.textContent = text; }
  hide() { this.root.classList.add('out'); setTimeout(() => this.root.remove(), 900); }
}

export class Menus {
  constructor(root, game, settings, onStart) {
    this.root = root; this.g = game; this.s = settings; this.onStart = onStart;
    this.layer = el('div', 'menus', root);
  }

  clear() { this.layer.innerHTML = ''; this.layer.className = 'menus'; }

  btn(parent, label, fn, cls = '') {
    const b = el('button', 'mbtn ' + cls, parent, label);
    b.addEventListener('click', (e) => { e.preventDefault(); this.g.audio?.ui('click'); fn(); });
    return b;
  }

  // ---------------- showcase car in the 3D background ----------------
  setShowcase(id, liveryIdx) {
    const g = this.g;
    if (g.showcase) g.world.scene.remove(g.showcase.visual.group);
    if (g.showcase) g.showcase.visual.dispose();
    const visual = new CarVisual({ id, meta: loaded.carMeta[id], geo: loaded.cars[id], envMap: g.world.env, livery: { ...LIVERIES[liveryIdx], number: 7 }, wheelBank: g.wheelBank });
    const t = g.world.track;
    const k = t.wrap(60);
    const p = t.lateralPoint(k, -2.5);
    visual.group.position.copy(p);
    const T = t.T(k);
    visual.group.rotation.y = Math.atan2(T.x, T.z) + 0.5;
    visual.updateWheels(visual.wheels.map((w) => ({ steer: 0.25 * (w.meta.front ? 1 : 0), spin: 0, offset: 0 })));
    g.world.scene.add(visual.group);
    g.showcase = { visual, state: { pos: p.clone(), fwd: T } };
  }

  title() {
    this.clear();
    this.layer.classList.add('title');
    el('div', 'logo big', this.layer, '<span class="l1">ABYSS</span><span class="l2">RACER</span><small>DEEP-SEA GRAND PRIX</small>');
    const col = el('div', 'mcol', this.layer);
    this.btn(col, 'RACE', () => this.garage(), 'primary');
    this.btn(col, 'SETTINGS', () => this.settings(() => this.title()));
    this.btn(col, 'HOW TO PLAY', () => this.help());
    el('div', 'foot', this.layer, 'Abyssal Circuit · 2.5 km · sunken city · reef · kelp · canyon jump · wreck · trench');
    if (!this.g.showcase) this.setShowcase(this.s.car, this.s.livery);
  }

  help() {
    this.clear();
    const box = el('div', 'panel', this.layer);
    el('h2', '', box, 'HOW TO PLAY');
    el('div', 'help', box, `
      <p><b>Touch:</b> ◀ ▶ steer (or tilt your phone — Settings), <b>GAS</b> / <b>BRAKE</b> on the right. Hold <b>BRAKE</b> when stopped to reverse.
      <b>DRIFT</b> is the handbrake. <b>NITRO</b> fires the hydro-jet.</p>
      <p><b>Keyboard:</b> arrows / WASD, Space handbrake, Shift nitro, C camera, R reset, Esc pause. Gamepads work too.</p>
      <p><b>Nitro</b> fills when you drift, fly, slipstream, near-miss and take rivals down.</p>
      <p><b>Damage is real:</b> panels crumple where you hit, wings and mirrors tear off, wheels can be ripped away,
      steering goes out of true and a broken engine loses power. Wreck a rival for a <b>TAKEDOWN</b>.</p>
      <p>Finish ${TRACK.laps} laps ahead of seven rivals. Stay on the road in the trench — it is a long way down.</p>`);
    this.btn(box, 'BACK', () => this.title());
  }

  garage() {
    this.clear();
    this.layer.classList.add('garage');
    const ids = Object.keys(CAR_SPECS);
    let idx = Math.max(0, ids.indexOf(this.s.car));
    let liv = this.s.livery;
    const info = el('div', 'gpanel', this.layer);
    const render = () => {
      const id = ids[idx], sp = CAR_SPECS[id];
      info.innerHTML = '';
      el('div', 'gname', info, sp.name);
      el('div', 'gtag', info, sp.tagline);
      const st = el('div', 'gstats', info);
      for (const [k, label] of [['speed', 'TOP SPEED'], ['accel', 'ACCELERATION'], ['grip', 'GRIP'], ['armor', 'TOUGHNESS']]) {
        el('div', 'gstat', st, `<label>${label}</label><i><b style="transform:scaleX(${sp.stats[k]})"></b></i>`);
      }
      el('div', 'gspec', info, `${sp.drive} · ${sp.mass} kg · ${Math.round(Math.max(...sp.torque.map((t) => t[1])))} N·m · ${sp.gears.length}-speed`);
      const sw = el('div', 'gswatch', info);
      LIVERIES.forEach((L, i) => {
        const d = el('div', 'sw' + (i === liv ? ' on' : ''), sw);
        d.style.background = `linear-gradient(135deg, #${new THREE.Color(L.paint).getHexString()} 60%, #${new THREE.Color(L.accent).getHexString()} 60%)`;
        d.addEventListener('click', () => { liv = i; this.g.audio?.ui('click'); this.setShowcase(ids[idx], liv); render(); });
      });
      const nav = el('div', 'gnav', info);
      this.btn(nav, '◀', () => { idx = (idx + ids.length - 1) % ids.length; this.setShowcase(ids[idx], liv); render(); });
      this.btn(nav, '▶', () => { idx = (idx + 1) % ids.length; this.setShowcase(ids[idx], liv); render(); });
      const row = el('div', 'mrow', info);
      this.btn(row, 'BACK', () => this.title());
      this.btn(row, 'START RACE', () => {
        this.s.car = ids[idx]; this.s.livery = liv; saveSettings(this.s);
        this.clear();
        this.onStart(ids[idx], LIVERIES[liv]);
      }, 'primary');
    };
    this.setShowcase(ids[idx], liv);
    render();
  }

  settings(back) {
    this.clear();
    const box = el('div', 'panel settings', this.layer);
    el('h2', '', box, 'SETTINGS');
    const s = this.s;
    const grid = el('div', 'sgrid', box);
    const opt = (label, key, options, after) => {
      el('label', '', grid, label);
      const row = el('div', 'sopts', grid);
      for (const [val, text] of options) {
        const b = el('button', 'sopt' + (s[key] === val ? ' on' : ''), row, text);
        b.addEventListener('click', () => { s[key] = val; saveSettings(s); this.g.audio?.ui('click'); row.querySelectorAll('.sopt').forEach((x) => x.classList.remove('on')); b.classList.add('on'); after?.(val); });
      }
    };
    const slider = (label, key, after) => {
      el('label', '', grid, label);
      const r = el('input', 'srange', grid);
      r.type = 'range'; r.min = 0; r.max = 1; r.step = 0.05; r.value = s[key];
      r.addEventListener('input', () => { s[key] = Number(r.value); saveSettings(s); after?.(); });
    };
    opt('Graphics', 'quality', Object.entries(QUALITY).map(([k, q]) => [k, q.name]), () => { this.reloadNote.style.display = 'block'; });
    opt('Steering', 'steering', [['buttons', 'Buttons'], ['tilt', 'Tilt']], (v) => { this.g.input.mode = v; this.g.hud?.applyControlMode(); });
    opt('Auto-accelerate', 'autoGas', [[false, 'Off'], [true, 'On']], (v) => { this.g.input.autoGas = v; this.g.hud?.applyControlMode(); });
    opt('Steering assist', 'steerAssist', [[0, 'Off'], [0.35, 'Low'], [0.6, 'Medium'], [0.9, 'High']], (v) => { if (this.g.player) this.g.player.v.assist.steer = v; });
    opt('ABS', 'abs', [[false, 'Off'], [true, 'On']], (v) => { if (this.g.player) this.g.player.v.assist.abs = v; });
    opt('Traction control', 'tcs', [[false, 'Off'], [true, 'On']], (v) => { if (this.g.player) this.g.player.v.assist.tcs = v; });
    opt('Opponents', 'difficulty', [[0.6, 'Easy'], [1, 'Normal'], [1.35, 'Hard']]);
    opt('Crash camera', 'crashCam', [[false, 'Off'], [true, 'On']]);
    opt('Vibration', 'haptics', [[false, 'Off'], [true, 'On']]);
    slider('Sound volume', 'volume', () => this.g.audio?.setVolume(s.volume, s.music));
    slider('Music volume', 'music', () => this.g.audio?.setVolume(s.volume, s.music));
    this.reloadNote = el('div', 'snote', box, 'Graphics change applies after restarting the game.');
    this.reloadNote.style.display = 'none';
    const row = el('div', 'mrow', box);
    this.btn(row, 'BACK', back, 'primary');
  }

  pause() {
    const g = this.g;
    if (g.paused || g.state !== 'race') return;
    g.paused = true;
    g.audio?.pause(true);
    this.clear();
    this.layer.classList.add('dim');
    const box = el('div', 'panel', this.layer);
    el('h2', '', box, 'PAUSED');
    const col = el('div', 'mcol', box);
    this.btn(col, 'RESUME', () => this.resume(), 'primary');
    this.btn(col, 'RESTART', () => { this.resume(); this.onStart(this.s.car, LIVERIES[this.s.livery]); });
    this.btn(col, 'SETTINGS', () => this.settings(() => { this.g.paused = false; this.pause(); }));
    this.btn(col, 'QUIT TO MENU', () => { this.resume(); g.toMenu(); });
  }

  resume() { this.clear(); this.g.paused = false; this.g.audio?.pause(false); }

  results(res, player) {
    this.clear();
    this.layer.classList.add('dim');
    const box = el('div', 'panel results', this.layer);
    const pi = res.findIndex((r) => r.e === player);
    el('h2', '', box, pi === 0 ? 'VICTORY' : `FINISHED P${pi + 1}`);
    const tbl = el('div', 'rtable', box);
    el('div', 'rrow head', tbl, '<span>POS</span><span>DRIVER</span><span>CAR</span><span>TIME</span><span>BEST LAP</span>');
    res.forEach((r, i) => {
      el('div', 'rrow' + (r.e === player ? ' me' : ''), tbl,
        `<span>${i + 1}</span><span>${r.e.name}</span><span>${CAR_SPECS[r.e.id].name}</span><span>${r.e.finished ? fmt(r.time) : '+' + fmt(Math.max(0, r.time - res[0].time))}</span><span>${fmt(r.best)}</span>`);
    });
    el('div', 'rstats', box, `Takedowns: <b>${player.takedowns}</b> · Hull: <b>${Math.round(player.v.health * 100)}%</b>`);
    const row = el('div', 'mrow', box);
    this.btn(row, 'MENU', () => this.g.toMenu());
    this.btn(row, 'RACE AGAIN', () => this.onStart(this.s.car, LIVERIES[this.s.livery]), 'primary');
  }
}
