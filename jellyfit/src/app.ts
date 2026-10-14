/** Wires session, input, rendering, audio, UI and persistence together. */
import { THEME } from './config/theme';
import { BALANCE } from './config/balance';
import { Loop } from './core/loop';
import { randomSeed } from './core/rng';
import { Session, type PlaceResult } from './game/session';
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
import { DebugPanel } from './debug/debugPanel';

export interface AppOptions {
  debug: boolean;
  test: boolean;
  storage?: KeyValueStorage;
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
  /** Which top-level screen is active. */
  screen: 'menu' | 'game' = 'menu';
  private prefersReduced = false;
  readonly loop: Loop;
  session!: Session;
  private debug: DebugPanel | null = null;
  private gameOverShown = false;
  private bestAtStart = 0;
  private frameMs = 16;

  constructor(opts: AppOptions) {
    this.root = document.getElementById('app')!;
    this.canvas = document.getElementById('game') as HTMLCanvasElement;
    this.store = new SaveStore(opts.storage ?? new LocalStorage());
    this.renderer = new Renderer(this.canvas, {
      onCellPop: (seq, total) => {
        if (total > 14 && seq % 2 === 1) return;
        this.sfx.pop(total > 14 ? seq / 2 : seq);
      },
    });
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
    );
    this.loop = new Loop((dt, now) => this.frame(dt, now));
    this.drag = new DragController(this.canvas, {
      layout: () => this.renderer.lay,
      now: () => this.loop.now,
      pickable: (slot) => {
        if (this.session.gameOver || !this.inputOpen()) return null;
        const t = this.session.tray[slot];
        return t ? { piece: t.piece, color: t.color } : null;
      },
      trayPose: (slot) => this.renderer.trayPose(slot, this.session.tray[slot]!.piece, this.loop.now),
      canPlace: (slot, r, c) => this.session.canPlace(slot, r, c),
      previewLines: (slot, r, c) => {
        const b = this.session.board;
        const out = placeMasks(b.lo, b.hi, this.session.tray[slot]!.piece, r, c);
        return { rows: out.rows, cols: out.cols };
      },
      onPick: (d) => this.onPick(d),
      onDrop: (d, r, c) => this.onDrop(d, r, c),
      onReturn: (d) => this.onReturn(d),
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
    this.drag.cancel();
    this.screen = 'menu';
    this.renderer.mode = 'menu';
    this.hud.setVisible(false);
    this.pauseUi.hide();
    this.results.hide();
    const s = this.session;
    const resumable = !s.gameOver && s.stats.placements > 0;
    this.menu.show(this.store.data.best, resumable);
  }

  startPlaying(): void {
    this.audio.unlock();
    this.sfx.click();
    if (this.session.gameOver) this.resetSession();
    this.menu.hide();
    this.screen = 'game';
    this.renderer.mode = 'game';
    this.hud.setVisible(true);
    this.hud.setBest(this.store.data.best);
    this.renderer.dealt(this.loop.now);
  }

  pauseGame(): void {
    if (this.screen !== 'game' || this.results.visible || this.session.gameOver) return;
    this.sfx.click();
    this.drag.cancel();
    this.persist();
    this.pauseUi.show();
  }

  resumeGame(): void {
    this.sfx.click();
    this.pauseUi.hide();
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
    this.audio.sfxOn = s.sfx;
    this.audio.musicOn = s.music;
    this.audio.applyGains();
    this.haptics.enabled = s.haptics;
    this.renderer.reducedMotion = s.reducedMotion || this.prefersReduced;
  }

  /** Fresh session without leaving the current screen. */
  private resetSession(): void {
    this.gameOverShown = false;
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
    this.sfx.pick();
    this.haptics.tick(8);
  }

  private onReturn(d: DragState): void {
    this.renderer.returnPiece(d, this.loop.now);
    this.sfx.boing();
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
    if (res.score > this.store.data.best) {
      this.store.data.best = res.score;
      this.hud.setBest(res.score);
    }
    this.syncCombo();
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
    this.drag.cancel();
    this.renderer.startGameOver(now + delay);
    this.renderer.after(delay, now, () => this.sfx.gameOver());
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
  }

  playAgain(): void {
    this.sfx.click();
    this.results.hide();
    this.resetSession();
    this.screen = 'game';
    this.renderer.mode = 'game';
    this.hud.setVisible(true);
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
    if (this.session.combo > 0) this.syncCombo();
    this.renderer.draw(this.drag.drag);
    this.hud.update(now);
    this.results.update(now);
    this.frameMs += (performance.now() - t0 - this.frameMs) * 0.05;
    this.debug?.update(dt, this.frameMs);
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
    if (this.loop.manual && this.session) this.loop.step(0.001);
  };

  private bindGlobal(): void {
    window.addEventListener('resize', this.onResize);
    window.addEventListener('orientationchange', this.onResize);
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
        this.pauseGame();
        this.persist();
        this.loop.stop();
        this.audio.suspend();
      } else {
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
