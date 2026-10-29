// Boot: loading screen -> world -> title / garage -> race -> results. Also exposes debug hooks used by
// the screenshot tooling (window.__abyss).
import { Game } from './game.js';
import { HUD } from '../ui/hud.js';
import { Menus, Loading, loadSettings } from '../ui/menu.js';
import { LIVERIES } from './game.js';
import { AudioEngine } from '../audio/audio.js';

export async function boot(canvas, params) {
  const ui = document.getElementById('ui');
  const loading = new Loading(ui);
  const settings = loadSettings();
  if (params.get('quality')) settings.quality = params.get('quality');
  const game = new Game(canvas, settings);
  window.__abyss = game;
  game.input.mode = settings.steering;
  game.input.autoGas = settings.autoGas;
  game.audio = new AudioEngine(settings);
  try {
    await game.init((p, text) => loading.set(p, text));
  } catch (e) {
    loading.set(1, 'Failed to start: ' + e.message);
    throw e;
  }
  loading.set(1, 'Ready');
  const hud = game.hud = new HUD(ui, game);
  hud.show(false);
  const menus = game.ui = new Menus(ui, game, settings, (car, livery) => startRace(car, livery));
  // first user gesture unlocks audio
  const unlock = () => { game.audio.unlock(); removeEventListener('pointerdown', unlock); removeEventListener('keydown', unlock); };
  addEventListener('pointerdown', unlock); addEventListener('keydown', unlock);

  function startRace(car, livery) {
    menus.clear();
    if (game.showcase) { game.world.scene.remove(game.showcase.visual.group); game.showcase.visual.dispose(); game.showcase = null; }
    game.setupRace(car, livery, settings.opponents);
    game.player.v.assist = { tcs: settings.tcs, abs: settings.abs, steer: settings.steerAssist };
    hud.show(true);
    game.audio.startRace(game);
    game.race.start();
    game.resultsShown = false;
  }
  game.toMenu = () => {
    game.clearRace();
    game.state = 'menu';
    hud.show(false);
    game.audio.toMenu();
    menus.title();
  };
  addEventListener('nativeback', () => { if (game.state === 'race') { if (game.paused) menus.resume(); else menus.pause(); } });
  addEventListener('nativepause', () => { if (game.state === 'race') menus.pause(); game.audio.suspend(); });
  addEventListener('nativeresume', () => game.audio.resume());
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (game.state === 'race') menus.pause(); game.audio.suspend(); } else game.audio.resume(); });
  addEventListener('keydown', (e) => { if ((e.code === 'Escape' || e.code === 'KeyP') && game.state === 'race') { if (game.paused) menus.resume(); else menus.pause(); } });

  menus.title();
  loading.hide();
  // debug / automation hooks
  if (params.get('audio')) await game.audio.unlock();
  if (params.get('race')) {
    startRace(params.get('car') || settings.car, LIVERIES[Number(params.get('livery') ?? settings.livery)]);
    if (params.get('auto')) game.autopilot = true;
    if (params.get('startk')) {
      const t = game.world.track, k0 = Number(params.get('startk'));
      game.race.entrants.forEach((e, i) => {
        const slot = game.race.gridSlot(i);
        const k = t.wrap(k0 + (slot.k - t.N));
        const p = t.lateralPoint(k, i % 2 === 0 ? -3.4 : 3.4).addScaledVector(t.U(k), 0.3);
        const m = new (p.constructor === Object ? Object : window.__THREE.Matrix4)().lookAt(new window.__THREE.Vector3(), t.T(k).negate(), t.U(k));
        e.v.teleport(p, new window.__THREE.Quaternion().setFromRotationMatrix(m));
        e.v.setSpeed(Number(params.get('v0') ?? 30));
        e.k = k; e.started = true; if (e.ai) e.ai.k = k;
      });
      game.race.countdown = 1.01;
    }
    if (params.get('cam')) game.cameraRig.mode = Number(params.get('cam'));
    if (params.get('shotcam')) game.shotCam = params.get('shotcam').split(',').map(Number);
    if (params.get('hidehud')) game.hud.show(false);
    if (params.get('crash')) {
      // debug: fire the player at the barrier (or into a rival) for damage testing
      const T3 = window.__THREE, t = game.world.track, e = game.player, k = t.wrap(Number(params.get('ck') ?? 300));
      const p = t.lateralPoint(k, Number(params.get('clat') ?? 0)).addScaledVector(t.U(k), 0.3);
      const m = new T3.Matrix4().lookAt(new T3.Vector3(), t.T(k).negate(), t.U(k));
      const q = new T3.Quaternion().setFromRotationMatrix(m).multiply(new T3.Quaternion().setFromAxisAngle(new T3.Vector3(0, 1, 0), Number(params.get('cyaw') ?? -0.45)));
      game.race.countdown = 1.01;
      game.simulate(0.05);
      e.v.teleport(p, q); e.v.setSpeed(Number(params.get('cv') ?? 45));
      e.k = k; e.started = true;
      game.crashTest = true;
      if (params.get('victim')) {
        // a rival cruising across the player's path (T-bone / takedown test)
        const vk = t.wrap(k + Number(params.get('vk') ?? 14));
        const ve = game.race.entrants.find((x) => !x.isPlayer);
        const vp = t.lateralPoint(vk, Number(params.get('vlat') ?? 4)).addScaledVector(t.U(vk), 0.3);
        const vm = new T3.Matrix4().lookAt(new T3.Vector3(), t.T(vk).negate(), t.U(vk));
        ve.v.teleport(vp, new T3.Quaternion().setFromRotationMatrix(vm));
        ve.v.setSpeed(Number(params.get('vv') ?? 18));
        ve.k = vk; ve.started = true; if (ve.ai) ve.ai.k = vk;
      }
    }
    if (params.get('sim')) {
      game.simulate(Number(params.get('sim')));
      if (params.get('nitro')) { game.player.nitroOn = true; game.player.nitro = 1; game.simulate(0.5); }
    }
  }

  let last = performance.now();
  let fpsAcc = 0, fpsN = 0, adaptT = 0;
  const loop = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    game.frame(dt);
    // results once the player has finished
    if (game.state === 'race' && game.race?.state === 'finished' && !game.resultsShown && game.time - (game.finishedAt ?? game.time) > 3.5) {
      game.resultsShown = true;
      menus.results(game.race.results(), game.player);
    }
    // dynamic resolution: keep ~55+ fps on phones
    fpsAcc += dt; fpsN++;
    if (fpsAcc > 2 && !window.__still) {
      const fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0;
      adaptT++;
      if (adaptT > 1) {
        const s = game.renderScale;
        if (fps < 46 && s > 0.5) { game.renderScale = Math.max(0.5, s - 0.1); game.resize(); }
        else if (fps > 58 && s < game.q.scale) { game.renderScale = Math.min(game.q.scale, s + 0.05); game.resize(); }
      }
    }
    if (!window.__still) requestAnimationFrame(loop);
  };
  if (params.has('still')) window.__still = true;
  if (window.__still) { game.frame(1 / 60); game.render(); window.__ready = true; return; }
  requestAnimationFrame(loop);
  window.__ready = true;
}
