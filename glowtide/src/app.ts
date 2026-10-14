import { AudioEngine } from './audio/audio';
import { Sfx } from './audio/sfx';
import { BALANCE } from './config/balance';
import { DEBUG } from './config/config';
import { Loop } from './core/loop';
import { DebugPanel } from './debug/debugPanel';
import { World } from './game/world';
import { KeyboardInput } from './input/keyboard';
import { PointerInput } from './input/pointer';
import { Renderer } from './render/renderer';
import { gameOverScreen } from './ui/screens/gameover';
import { Hud } from './ui/screens/hud';
import { pauseScreen } from './ui/screens/pause';

type AppState = 'playing' | 'paused' | 'over';

/** Top-level controller: owns the loop, the world, the renderer and the screens. */
export class App {
  private readonly world: World;
  private readonly renderer: Renderer;
  private readonly audio = new AudioEngine();
  private readonly sfx = new Sfx(this.audio);
  private readonly loop: Loop;
  private readonly pointer: PointerInput;
  private readonly keyboard = new KeyboardInput();
  private readonly hud: Hud;
  private readonly debug: DebugPanel | null = null;
  private overlay: HTMLElement | null = null;
  private state: AppState = 'playing';
  private firstFrameShown = false;

  constructor(
    private readonly container: HTMLElement,
    private readonly canvas: HTMLCanvasElement,
    private readonly ui: HTMLElement,
    private readonly onFirstFrame: () => void,
  ) {
    this.world = new World(randomSeed());
    this.renderer = new Renderer(canvas);
    this.renderer.attach(this.world);
    this.wireAudio();

    this.hud = new Hud(() => this.pause());
    this.ui.append(this.hud.root);
    if (DEBUG) {
      this.debug = new DebugPanel();
      this.ui.append(this.debug.root);
      // Test hook for automated playtests; debug builds only.
      (window as unknown as Record<string, unknown>).__glowtide = {
        world: this.world,
        renderer: this.renderer,
      };
    }

    this.pointer = new PointerInput(canvas, {
      down: (x, y, type) => {
        if (this.state !== 'playing') return;
        this.world.pointerDown(this.renderer.toWorldX(x), this.renderer.toWorldY(y), type);
      },
      move: (x, y) => this.world.pointerMove(this.renderer.toWorldX(x), this.renderer.toWorldY(y)),
      up: () => this.world.pointerUp(),
    });

    this.loop = new Loop(
      BALANCE.sim.step,
      BALANCE.sim.maxFrameDelta,
      (dt) => this.update(dt),
      (realDt) => this.render(realDt),
    );

    this.world.events.on('runEnd', () => this.showGameOver());

    // Audio may only start from a user gesture.
    const unlock = (): void => this.audio.unlock();
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);

    this.keyboard.on((code) => this.onKey(code));
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => this.resize());
    document.addEventListener('visibilitychange', () => this.onVisibility());
    window.addEventListener('blur', () => {
      if (this.state === 'playing') this.pause();
    });
  }

  start(): void {
    this.resize();
    this.world.reset(randomSeed());
    this.loop.start();
  }

  private resize(): void {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.resize(w, h, window.devicePixelRatio || 1);
    this.world.setView(this.renderer.halfW, this.renderer.halfH);
  }

  private update(dt: number): void {
    if (this.state === 'paused') return;
    this.world.update(dt);
  }

  private render(realDt: number): void {
    const paused = this.state === 'paused';
    this.renderer.render(this.world, paused ? 0 : realDt);
    const s = this.world.stats;
    this.hud.update({ tide: this.world.tide, timeAlive: s.timeAlive, popped: s.popped });
    if (this.debug) {
      this.debug.frame(realDt, () => ({
        fps: 0,
        frameMs: 0,
        critters: this.world.critters.length,
        particles: this.renderer.particles.active,
        timeScale: this.world.timeScale.value,
        tide: this.world.tide,
        voices: this.audio.voiceCount,
        invincible: this.world.invincible,
        dpr: this.renderer.dpr,
      }));
    }
    if (!this.firstFrameShown) {
      this.firstFrameShown = true;
      this.onFirstFrame();
    }
  }

  private wireAudio(): void {
    const e = this.world.events;
    const sfx = this.sfx;
    e.on('link', (p) => sfx.link(p.index));
    e.on('unlink', () => sfx.unlink());
    e.on('snap', () => sfx.snap());
    e.on('tier', () => sfx.charge());
    e.on('pop', (p) => sfx.pop(p.index));
    e.on('chainPopped', (p) => sfx.chord(p.length));
    e.on('kill', () => sfx.softPop());
    e.on('burst', () => sfx.burst());
    e.on('pearlHit', (p) => (p.lost > 0 ? sfx.pearlHit() : sfx.bump()));
    e.on('emptyTap', () => sfx.emptyTap());
    e.on('runEnd', () => {
      sfx.crack();
      sfx.runOver();
    });
  }

  private onKey(code: string): void {
    if (code === 'KeyP') {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
      return;
    }
    if (this.state === 'over' && (code === 'Enter' || code === 'Space')) {
      // The focused "Play again" button also receives the key; guard against a double start.
      return;
    }
    if (DEBUG && this.state === 'playing') {
      if (code === 'KeyK') this.world.debugKillAll();
      else if (code === 'KeyI') this.world.invincible = !this.world.invincible;
      else if (code === 'KeyN') this.world.debugSkipTide();
      else if (code === 'KeyS') this.world.debugSpawn(50);
    }
  }

  private setOverlay(node: HTMLElement | null): void {
    this.overlay?.remove();
    this.overlay = node;
    if (node) this.ui.append(node);
  }

  pause(): void {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.pointer.reset();
    this.world.cancelChain();
    this.sfx.uiClick();
    this.setOverlay(
      pauseScreen({
        onResume: () => this.resume(),
        onRestart: () => this.newRun(),
      }),
    );
  }

  resume(): void {
    if (this.state !== 'paused') return;
    this.sfx.uiClick();
    this.setOverlay(null);
    this.state = 'playing';
  }

  private newRun(): void {
    if (this.state === 'playing') return;
    this.sfx.uiClick();
    this.setOverlay(null);
    this.pointer.reset();
    this.renderer.resetRun();
    this.world.reset(randomSeed());
    this.state = 'playing';
    this.canvas.focus({ preventScroll: true });
  }

  private showGameOver(): void {
    this.state = 'over';
    this.pointer.reset();
    this.setOverlay(gameOverScreen({ ...this.world.stats }, { onPlayAgain: () => this.newRun() }));
  }

  private onVisibility(): void {
    if (document.hidden) {
      this.pause();
      this.loop.stop();
      this.audio.suspend();
    } else {
      this.audio.resume();
      this.loop.start();
    }
  }
}

function randomSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}
