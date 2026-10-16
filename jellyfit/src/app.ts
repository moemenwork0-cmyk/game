/** Wires session, input, rendering, audio, UI and persistence together. */
import { THEME } from './config/theme';
import { BALANCE } from './config/balance';
import { Loop } from './core/loop';
import { Rng, randomSeed } from './core/rng';
import { HOLD, Session, type PlaceResult } from './game/session';
import { PIECES, place as placeMasks } from './game/rules';
import { graceLeft } from './game/scoring';
import { AudioEngine } from './audio/audio';
import { Sfx } from './audio/sfx';
import { DragController, type DragState } from './input/drag';
import { Renderer } from './render/renderer';
import { Hud } from './ui/hud';
import { ResultsScreen } from './ui/screens/gameover';
import { MenuScreen } from './ui/screens/menu';
import { PauseScreen } from './ui/screens/pause';
import { SettingsScreen } from './ui/screens/settings';
import { LocalStorage, SaveStore, type KeyValueStorage, type Settings } from './meta/save';
import { Haptics } from './platform/haptics';
import type { Platform } from './platform/platform';
import { NonePlatform } from './platform/none';
import { saveLang } from './meta/lang';
import { DebugPanel } from './debug/debugPanel';
import { fitPanels } from './ui/dom';
import { Jello } from './jello/jello';
import { HoldTutorial } from './render/holdTutorial';
import { JelloDirector } from './jello/director';

export interface AppOptions {
  debug: boolean;
  test: boolean;
  storage?: KeyValueStorage;
  /** Portal SDK (CrazyGames); defaults to none. */
  platform?: Platform;
}

export class App {
  readonly root: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly renderer: Renderer;
  readonly drag: DragController;
  readonly audio = new AudioEngine();
  readonly sfx = new Sfx(this.audio);
  readonly haptics = new Haptics();
  readonly hud: Hud;
  readonly results: ResultsScreen;
  readonly menu: MenuScreen;
  readonly pauseUi: PauseScreen;
  readonly settingsUi: SettingsScreen;
  readonly store: SaveStore;
  readonly platform: Platform;
  /** Portal "happy time" already sent for beating the record this game. */
  private recordCheered = false;
  /** Which top-level screen is active. */
  screen: 'menu' | 'game' = 'menu';
  private prefersReduced = false;
  readonly jello: Jello;
  readonly director: JelloDirector;
  readonly tutorial = new HoldTutorial();
  private tipShownThisGame = false;
  private lastFrameNow = 0;
  private pointer: { x: number; y: number; at: number } | null = null;
  readonly loop: Loop;
  session!: Session;
  private debug: DebugPanel | null = null;
  private gameOverShown = false;
  private bestAtStart = 0;
  private frameMs = 16;

  constructor(opts: AppOptions) {
    this.root = document.getElementById('app')!;
    this.canvas = document.getElementById('game') as HTMLCanvasElement;
    this.platform = opts.platform ?? new NonePlatform();
    this.store = new SaveStore(opts.storage ?? new LocalStorage());
    // The portal's mute wins over the in-game sound toggles.
    this.platform.onMuteChange((m) => this.audio.setMuted(m));
    this.renderer = new Renderer(this.canvas, {
      onCellPop: (seq, total) => {
        if (total > 14 && seq % 2 === 1) return;
        this.sfx.pop(total > 14 ? seq / 2 : seq);
      },
    });
    const jrng = new Rng(randomSeed());
    this.jello = new Jello(jrng, {
      voice: (n, period, pitch) => this.sfx.babble(n, period, pitch),
      sound: (k) => this.sfx.jello(k),
    });
    this.director = new JelloDirector(this.jello, jrng, THEME.jelly);
    this.renderer.jello = this.jello;
    this.renderer.tutorial = this.tutorial;
    this.hud = new Hud(this.root, () => this.pauseGame());
    this.menu = new MenuScreen(
      this.root,
      () => this.startPlaying(),
      () => this.openSettings(),
    );
    this.results = new ResultsScreen(
      this.root,
      () => this.playAgain(),
      () => this.goHome(),
    );
    this.pauseUi = new PauseScreen(
      this.root,
      () => this.resumeGame(),
      () => this.openSettings(),
      () => this.goHome(),
    );
    this.settingsUi = new SettingsScreen(
      this.root,
      () => this.store.data.settings,
      (k, v) => this.applySetting(k, v),
      (l) => {
        // Every screen is rebuilt in the new language: save everything and reload.
        saveLang(l);
        this.persist();
        location.reload();
      },
    );
    this.loop = new Loop((dt, now) => this.frame(dt, now));
    this.drag = new DragController(this.canvas, {
      layout: () => this.renderer.lay,
      now: () => this.loop.now,
      pickable: (slot) => {
        if (this.session.gameOver || !this.inputOpen()) return null;
        const t = this.session.item(slot);
        return t ? { piece: t.piece, color: t.color } : null;
      },
      trayPose: (slot) => this.renderer.trayPose(slot, this.session.item(slot)!.piece, this.loop.now),
      canPlace: (slot, r, c) => this.session.canPlace(slot, r, c),
      previewLines: (slot, r, c) => {
        const b = this.session.board;
        const out = placeMasks(b.lo, b.hi, this.session.item(slot)!.piece, r, c);
        return { rows: out.rows, cols: out.cols };
      },
      onPick: (d) => this.onPick(d),
      onDrop: (d, r, c) => this.onDrop(d, r, c),
      onReturn: (d) => this.onReturn(d),
      heldAt: (x, y) => this.heldAt(x, y),
      overJello: (d) => this.overJello(d),
      onGiveJello: (d) => this.onGiveJello(d),
    });

    this.prefersReduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.applySettings();

    if (opts.debug || opts.test) this.debug = new DebugPanel(this, opts.debug);
    this.bindGlobal();
  }

  start(): void {
    this.onResize();
    const cur = this.store.data.current;
    let resumed = false;
    if (cur && !cur.gameOver) {
      try {
        this.session = Session.restore(cur);
        resumed = !this.session.gameOver;
      } catch {
        resumed = false;
      }
    }
    if (!resumed) this.session = this.newSession();
    this.bestAtStart = this.store.data.best;
    this.renderer.session = this.session;
    this.renderer.newGame(this.loop.now);
    this.hud.setScore(this.session.score, this.loop.now, true);
    this.hud.setBest(this.store.data.best);
    this.syncCombo();
    this.persist();
    this.showMenu();
    this.loop.start();
  }

  // ---------------------------------------------------------------------------
  // Screens

  private inputOpen(): boolean {
    return this.screen === 'game' && !this.pauseUi.visible && !this.settingsUi.visible && !this.results.visible;
  }

  showMenu(): void {
    this.platform.gameplayStop();
    this.drag.cancel();
    this.tutorial.stop(this.loop.now);
    this.screen = 'menu';
    this.renderer.mode = 'menu';
    this.hud.setVisible(false);
    this.pauseUi.hide();
    this.results.hide();
    const s = this.session;
    const resumable = !s.gameOver && s.stats.placements > 0;
    this.menu.show(this.store.data.best, resumable);
    this.placeMenuJello();
    this.director.menu(this.store.data.best);
  }

  /** Jello stands on top of the logo on the home screen. */
  private placeMenuJello(): void {
    const logo = this.menu.root.querySelector('.logo-word.w1') as HTMLElement | null;
    const L = this.renderer.lay;
    const R = Math.max(40, Math.min(66, Math.min(L.w, L.h) * 0.12));
    if (!logo) {
      this.renderer.menuJello = { x: L.w / 2, ground: L.h * 0.3, R };
      return;
    }
    const r = logo.getBoundingClientRect();
    const fs = parseFloat(getComputedStyle(logo).fontSize) || 100;
    this.renderer.menuJello = { x: r.left + r.width * 0.38, ground: r.top + fs * 0.2, R };
  }

  startPlaying(): void {
    this.audio.unlock();
    this.sfx.click();
    if (this.session.gameOver) this.resetSession();
    const resumed = this.session.stats.placements > 0;
    this.menu.hide();
    this.screen = 'game';
    this.renderer.mode = 'game';
    this.hud.setVisible(true);
    this.hud.setBest(this.store.data.best);
    this.renderer.dealt(this.loop.now);
    this.director.gameStart(false, this.bestAtStart, resumed);
    this.syncHeld();
    this.platform.gameplayStart();
  }

  /** `notify` is false when the tab was hidden: the portal tracks focus itself. */
  pauseGame(notify = true): void {
    if (this.screen !== 'game' || this.results.visible || this.session.gameOver) return;
    if (notify) this.platform.gameplayStop();
    this.tutorial.stop(this.loop.now);
    this.sfx.click();
    this.drag.cancel();
    this.persist();
    this.pauseUi.show();
  }

  resumeGame(): void {
    this.sfx.click();
    this.pauseUi.hide();
    this.director.resume();
    this.platform.gameplayStart();
  }

  goHome(): void {
    this.sfx.click();
    this.persist();
    if (this.session.gameOver) this.resetSession();
    this.showMenu();
  }

  openSettings(): void {
    this.sfx.click();
    this.settingsUi.show();
  }

  private applySetting(k: keyof Settings, v: boolean): void {
    this.store.data.settings[k] = v;
    this.store.save();
    this.applySettings();
    this.sfx.click();
  }

  private applySettings(): void {
    const s = this.store.data.settings;
    this.audio.setMuted(this.platform.isMuted());
    this.audio.sfxOn = s.sfx;
    this.audio.musicOn = s.music;
    this.audio.applyGains();
    this.haptics.enabled = s.haptics;
    this.renderer.reducedMotion = s.reducedMotion || this.prefersReduced;
    this.jello.reducedMotion = this.renderer.reducedMotion;
    this.jello.talkEnabled = s.jello;
  }

  /** Fresh session without leaving the current screen. */
  private resetSession(): void {
    this.gameOverShown = false;
    this.recordCheered = false;
    this.tipShownThisGame = false;
    this.tutorial.stop(this.loop.now);
    this.session = this.newSession();
    this.bestAtStart = this.store.data.best;
    this.renderer.session = this.session;
    this.renderer.newGame(this.loop.now);
    this.hud.setScore(0, this.loop.now, true);
    this.hud.setBest(this.store.data.best);
    this.syncCombo();
    this.persist();
  }

  private newSession(): Session {
    return new Session({
      seed: randomSeed(),
      mercyGuarantee: this.store.data.gamesPlayed < BALANCE.generator.mercyGames,
    });
  }

  // ---------------------------------------------------------------------------
  // Input callbacks

  private onPick(d: DragState): void {
    this.audio.unlock();
    this.haptics.lastWasTouch = d.touch;
    this.renderer.pickedUp(d.slot);
    if (d.slot === HOLD) {
      this.jello.give();
      this.director.takenBack();
    } else this.director.pick();
    this.sfx.pick();
    this.haptics.tick(8);
  }

  private onReturn(d: DragState): void {
    this.renderer.returnPiece(d, this.loop.now);
    this.sfx.boing();
    if (d.slot === HOLD) {
      // Back into Jello's hand when the flight lands.
      const held = this.session.held;
      this.renderer.after(240, this.loop.now, () => {
        if (held && this.session.held === held) this.jello.take(held.piece, held.color);
      });
      this.director.heldBack();
    }
  }

  // ---------------------------------------------------------------------------
  // Jello holds a piece

  /** HOLD if (x, y) is on the piece in Jello's hand. */
  private heldAt(x: number, y: number): number {
    const held = this.session.held;
    if (!held || !this.jello.holding || this.screen !== 'game') return -1;
    const p = PIECES[held.piece];
    const h = this.renderer.holdPose(held.piece);
    const hw = Math.max((p.w * h.cs) / 2, 26) + 10;
    const hh = Math.max((p.h * h.cs) / 2, 26) + 10;
    return Math.abs(x - h.cx) <= hw && Math.abs(y - h.cy) <= hh ? HOLD : -1;
  }

  /** A tray piece is over Jello (or his hand): dropping gives it to him. */
  private overJello(d: DragState): boolean {
    if (d.slot === HOLD || this.screen !== 'game') return false;
    const j = this.jello;
    const jx = j.x;
    const jy = j.ground - j.H * 0.5;
    if (Math.hypot(d.cx - jx, d.cy - jy) < j.R * 1.9) return true;
    if (j.hit(d.px, d.py)) return true;
    const held = this.session.held;
    if (held) {
      const h = this.renderer.holdPose(held.piece);
      if (Math.hypot(d.cx - h.cx, d.cy - h.cy) < j.R * 1.4) return true;
    }
    return false;
  }

  private onGiveJello(d: DragState): void {
    const now = this.loop.now;
    const res = this.session.hold(d.slot);
    if (!res) {
      this.onReturn(d);
      return;
    }
    const held = this.session.held!;
    if (res.swapped) this.renderer.flyHoldToSlot(res.swapped.piece, res.swapped.color, d.slot, now);
    this.renderer.flyToHold(held.piece, held.color, d.cx, d.cy, d.cs, d.tilt.x, now);
    this.jello.take(held.piece, held.color);
    this.haptics.tick(14);
    const first = !this.store.data.tips.hold;
    this.store.data.tips.hold = true;
    this.tutorial.stop(now);
    this.director.gave(!!res.swapped, first);
    if (res.newDeal) this.renderer.after(160, now, () => this.renderer.dealt(this.loop.now));
    this.persist();
  }

  /** Shows the "give me a piece" tip at a good moment for players who never used it. */
  private maybeHoldTip(now: number): void {
    const s = this.session;
    const tips = this.store.data.tips;
    if (tips.hold || tips.holdShown >= 3 || this.tipShownThisGame || s.gameOver || s.held) return;
    if (this.screen !== 'game' || s.stats.placements < 3) return;
    const stuck = s.tray.some((t, i) => t && !s.fits[i]);
    if (!stuck && s.stats.placements < 9) return;
    let slot = s.tray.findIndex((t, i) => t && !s.fits[i]);
    if (slot < 0) slot = s.tray.findIndex((t) => t);
    if (slot < 0) return;
    this.tipShownThisGame = true;
    tips.holdShown++;
    this.store.save();
    // Let the placement animation finish first.
    this.renderer.after(650, now, () => {
      if (this.session !== s || s.gameOver || s.held || !s.tray[slot] || this.screen !== 'game') return;
      this.tutorial.begin(slot, this.loop.now, this.director.holdTip());
    });
  }

  /** Makes Jello's hand match the session (resumed game, new game). */
  private syncHeld(): void {
    const h = this.session.held;
    if (h) this.jello.holdQuietly(h.piece, h.color);
    else this.jello.give();
  }

  private onDrop(d: DragState, r: number, c: number): void {
    const res = this.session.place(d.slot, r, c);
    if (!res) {
      this.onReturn(d);
      return;
    }
    this.applyPlacement(res, d);
  }

  /** Visual/audio/persistence side of a placement. Also used by debug hooks. */
  applyPlacement(res: PlaceResult, d: DragState | null): void {
    const now = this.loop.now;
    this.renderer.placed(res, d, now);
    this.sfx.drop();
    this.haptics.tick(12);
    const land = d ? THEME.drag.snapMs : 0;
    if (res.lines > 0) {
      this.renderer.after(land, now, () => {
        this.sfx.chord(res.lines);
        if (res.combo >= 2) this.sfx.combo(res.combo - 1);
        if (res.perfect) {
          this.sfx.perfect();
          this.renderer.flash(this.loop.now);
        }
      });
    }
    this.hud.setScore(res.score, now);
    if (res.perfect) this.platform.happytime();
    if (!this.recordCheered && this.bestAtStart > 0 && res.score > this.bestAtStart) {
      this.recordCheered = true;
      this.platform.happytime();
    }
    if (res.score > this.store.data.best) {
      this.store.data.best = res.score;
      this.hud.setBest(res.score);
    }
    this.syncCombo();
    this.director.placed(res, this.session.board.fill(), this.store.data.best);
    if (this.tutorial.active) this.tutorial.stop(now);
    const s = this.session;
    if (!res.gameOver && s.held && s.heldFits && !s.fits.some((f) => f)) this.director.onlyHeldFits();
    this.maybeHoldTip(now);
    if (res.newDeal) this.renderer.after(land + 120, now, () => this.renderer.dealt(this.loop.now));
    if (res.gameOver) this.beginGameOver(land + (res.lines > 0 ? 450 : 200));
    this.persist();
  }

  private syncCombo(): void {
    const s = this.session;
    this.renderer.popups.setCombo(s.combo, graceLeft({ combo: s.combo, sinceClear: s.sinceClear }), this.loop.now);
  }

  // ---------------------------------------------------------------------------
  // Game over

  private beginGameOver(delay: number): void {
    const now = this.loop.now;
    this.platform.gameplayStop();
    this.drag.cancel();
    this.renderer.startGameOver(now + delay);
    const score = this.session.score;
    const newBest = score > this.bestAtStart;
    this.renderer.after(delay, now, () => {
      this.sfx.gameOver();
      this.director.gameOver(score, this.store.data.best, newBest);
    });
    const data = this.store.data;
    data.gamesPlayed++;
    data.current = null;
    this.store.save();
    const panelAt = delay + THEME.gameOver.panelDelayMs;
    this.renderer.after(panelAt, now, () => this.showResults());
  }

  private showResults(): void {
    if (this.gameOverShown) return;
    this.gameOverShown = true;
    const s = this.session;
    this.results.show(
      {
        score: s.score,
        best: this.store.data.best,
        newBest: s.score > this.bestAtStart && s.score > 0,
        lines: s.stats.linesTotal,
        maxCombo: s.stats.maxCombo,
        placements: s.stats.placements,
      },
      this.loop.now,
    );
    fitPanels(this.root);
  }

  playAgain(): void {
    this.sfx.click();
    this.results.hide();
    this.resetSession();
    this.screen = 'game';
    this.renderer.mode = 'game';
    this.hud.setVisible(true);
    this.director.gameStart(true, this.bestAtStart);
    this.syncHeld();
    this.platform.gameplayStart();
  }

  /** Replaces the session (debug/test). */
  setSession(s: Session): void {
    this.drag.cancel();
    this.results.hide();
    this.pauseUi.hide();
    this.menu.hide();
    this.screen = 'game';
    this.renderer.mode = 'game';
    this.hud.setVisible(true);
    this.gameOverShown = false;
    this.session = s;
    this.renderer.session = s;
    this.renderer.newGame(this.loop.now);
    this.hud.setScore(s.score, this.loop.now, true);
    this.syncCombo();
    this.platform.gameplayStart();
  }

  persist(): void {
    this.store.data.current = this.session.gameOver ? null : this.session.snapshot();
    this.store.save();
  }

  // ---------------------------------------------------------------------------
  // Frame + environment

  private frame(dt: number, now: number): void {
    const t0 = performance.now();
    this.drag.update(dt, now);
    this.renderer.update(dt, now);
    this.updateJello(dt, now);
    if (this.session.combo > 0) this.syncCombo();
    this.renderer.draw(this.drag.drag);
    this.hud.update(now);
    this.results.update(now);
    this.frameMs += (performance.now() - t0 - this.frameMs) * 0.05;
    this.debug?.update(dt, this.frameMs);
  }

  private updateJello(dt: number, now: number): void {
    const j = this.jello;
    const d = this.drag.drag;
    j.reach = null;
    if (d) {
      j.lookAt(d.cx, d.cy);
      if (d.toJello) {
        // Hand stretches out to catch it.
        j.reach = { x: d.cx, y: d.cy + (PIECES[d.piece].h * d.cs) / 2 };
        j.express({ eyes: 'wide', mouth: 'grin' }, 120);
      } else if (Math.hypot(d.cx - j.x, d.cy - (j.ground - j.H * 0.5)) < j.R * 2.2) this.director.nearPiece();
    }
    else if (this.pointer && now - this.pointer.at < 2500) j.lookAt(this.pointer.x, this.pointer.y);
    else j.lookFree();
    if (this.tutorial.active) {
      const t = this.tutorial;
      const item = this.session.tray[t.slot];
      if (!item || this.session.gameOver) t.stop(now);
      const scene = item ? this.renderer.tutorialScene(item.piece, t.slot) : null;
      if (scene) {
        const rp = t.reachPoint(scene, now);
        if (rp && !d) {
          j.reach = rp;
          j.lookAt(rp.x, rp.y);
        }
        if (t.landed(this.lastFrameNow, now)) {
          j.grip.x = 0.75;
          j.squash(0.2);
          j.express({ eyes: 'happy', mouth: 'grin' }, 500);
        }
      }
      if (t.done(now)) t.active = false;
    }
    this.lastFrameNow = now;
    if (this.screen === 'menu' && this.menu.visible) this.placeMenuJello();
    j.update(dt, now);
    this.director.update(!!d);
  }

  private safeInsets(): { top: number; right: number; bottom: number; left: number } {
    const probe = document.getElementById('safe-probe');
    if (!probe) return { top: 0, right: 0, bottom: 0, left: 0 };
    const cs = getComputedStyle(probe);
    return {
      top: parseFloat(cs.paddingTop) || 0,
      right: parseFloat(cs.paddingRight) || 0,
      bottom: parseFloat(cs.paddingBottom) || 0,
      left: parseFloat(cs.paddingLeft) || 0,
    };
  }

  onResize = (): void => {
    this.drag.cancel();
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.resize(w, h, window.devicePixelRatio || 1, this.safeInsets());
    this.hud.layout(this.renderer.lay);
    fitPanels(this.root);
    if (this.screen === 'menu' && this.menu.visible) this.placeMenuJello();
    if (this.loop.manual && this.session) this.loop.step(0.001);
  };

  private bindGlobal(): void {
    window.addEventListener('resize', this.onResize);
    window.addEventListener('orientationchange', this.onResize);
    // Jello: tap, pull (stretch + boing) and pet (rub side to side).
    let jelloPtr: { id: number; x0: number; y0: number } | null = null;
    const local = (e: PointerEvent): { x: number; y: number } => {
      const rect = this.canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    this.canvas.addEventListener('pointerdown', (e) => {
      if (jelloPtr || this.drag.drag || this.pauseUi.visible || this.settingsUi.visible || this.results.visible) return;
      const p = local(e);
      if (!this.jello.hit(p.x, p.y)) return;
      this.audio.unlock();
      jelloPtr = { id: e.pointerId, x0: p.x, y0: p.y };
      this.director.grab(p.x);
    });
    window.addEventListener('pointermove', (e) => {
      if (!jelloPtr || e.pointerId !== jelloPtr.id) return;
      const p = local(e);
      this.director.drag(p.x, p.x - jelloPtr.x0, p.y - jelloPtr.y0);
    });
    const endJello = (e: PointerEvent): void => {
      if (!jelloPtr || e.pointerId !== jelloPtr.id) return;
      const p = local(e);
      jelloPtr = null;
      this.director.release(p.x, p.y);
    };
    window.addEventListener('pointerup', endJello);
    window.addEventListener('pointercancel', endJello);
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const rect = this.canvas.getBoundingClientRect();
      this.pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top, at: this.loop.now };
    });
    const unlock = (): void => this.audio.unlock();
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', (e) => {
      unlock();
      // Space and arrows never scroll the page. Escape is never used.
      if ([' ', 'Spacebar', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown'].includes(e.key)) {
        if (!(e.target instanceof HTMLButtonElement)) e.preventDefault();
      }
      if (e.key === 'Enter' || e.key === ' ') {
        if (e.target instanceof HTMLButtonElement) return;
        if (this.settingsUi.visible) return;
        e.preventDefault();
        if (this.results.visible) this.playAgain();
        else if (this.pauseUi.visible) this.resumeGame();
        else if (this.screen === 'menu') this.startPlaying();
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.drag.cancel();
        this.pauseGame(false);
        this.persist();
        this.loop.stop();
        this.audio.suspend();
      } else {
        // Back to a paused game: that is a break in play.
        if (this.pauseUi.visible) this.platform.gameplayStop();
        this.audio.resume();
        if (!this.loop.manual) this.loop.start();
      }
    });
    window.addEventListener('pagehide', () => this.persist());
  }

  /** Piece ids for debug output. */
  trayIds(): string[] {
    return this.session.tray.map((t) => (t ? PIECES[t.piece].id : '-'));
  }
}
