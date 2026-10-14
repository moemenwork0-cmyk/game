/**
 * Jello, the mascot: a soft-body jelly with a face, arms and a voice.
 * This file holds his state, physics, moods, actions and speech. jelloDraw.ts renders him.
 */
import type { Rng } from '../core/rng';
import { Spring } from '../core/spring';
import { clamp, clamp01 } from '../core/tween';

export type Mood = 'neutral' | 'happy' | 'excited' | 'worried' | 'sad' | 'sleepy' | 'dizzy' | 'love' | 'surprised' | 'proud';
export type EyeStyle = 'normal' | 'happy' | 'closed' | 'star' | 'spiral' | 'heart' | 'wide';
export type MouthStyle = 'smile' | 'grin' | 'o' | 'wavy' | 'frown' | 'tongue';

export interface Face {
  eyes: EyeStyle;
  mouth: MouthStyle;
  /** -1 angry (inner down) … 0 none … 1 worried (inner up). */
  brows: number;
  blush: number;
}

const MOOD_FACE: Record<Mood, Face> = {
  neutral: { eyes: 'normal', mouth: 'smile', brows: 0, blush: 0.6 },
  happy: { eyes: 'normal', mouth: 'grin', brows: 0, blush: 0.9 },
  excited: { eyes: 'star', mouth: 'grin', brows: 0, blush: 1 },
  worried: { eyes: 'wide', mouth: 'wavy', brows: 0.8, blush: 0.2 },
  sad: { eyes: 'normal', mouth: 'frown', brows: 0.9, blush: 0.2 },
  sleepy: { eyes: 'closed', mouth: 'o', brows: 0, blush: 0.5 },
  dizzy: { eyes: 'spiral', mouth: 'tongue', brows: 0, blush: 0.6 },
  love: { eyes: 'heart', mouth: 'grin', brows: 0, blush: 1 },
  surprised: { eyes: 'wide', mouth: 'o', brows: -0.01, blush: 0.4 },
  proud: { eyes: 'happy', mouth: 'grin', brows: 0, blush: 1 },
};

export type FxKind = 'sweat' | 'tear' | 'zzz' | 'sparkle' | 'heart' | 'note';

export interface Fx {
  kind: FxKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  rot: number;
}

export interface Speech {
  words: string[];
  text: string;
  start: number;
  wordMs: number;
  end: number;
  syllables: number;
  period: number;
}

export type Action = 'none' | 'spin' | 'shake' | 'wave' | 'cheer' | 'dance' | 'dizzy' | 'melt';

export interface JelloHooks {
  /** Babble voice for a line: n syllables spaced `periodMs`, pitch multiplier by mood. */
  voice(syllables: number, periodMs: number, pitch: number): void;
  sound(kind: 'squish' | 'giggle' | 'jump' | 'land' | 'aww' | 'snore' | 'pop'): void;
}

export class Jello {
  // Placement (CSS px): feet centre and body half-width.
  x = 0;
  ground = 0;
  R = 40;
  visible = true;
  reducedMotion = false;
  talkEnabled = true;

  // Soft body.
  readonly sx = new Spring(1, 190, 9);
  readonly sy = new Spring(1, 190, 9);
  readonly lean = new Spring(0, 120, 8);
  readonly rot = new Spring(0, 140, 12);
  readonly m2 = new Spring(0, 260, 5);
  readonly m3 = new Spring(0, 300, 6);
  readonly tuft = new Spring(0, 90, 5);
  readonly armL = new Spring(0.55, 160, 11);
  readonly armR = new Spring(0.55, 160, 11);
  readonly lookX = new Spring(0, 90, 14);
  readonly lookY = new Spring(0, 90, 14);
  readonly mouthOpen = new Spring(0, 400, 26);
  readonly smile = new Spring(0.6, 200, 20);
  readonly brows = new Spring(0, 160, 18);
  /** Poke dent: angle on the outline and depth. */
  pokeAngle = 0;
  readonly poke = new Spring(0, 220, 9);
  // Vertical jump (px above ground, positive = up).
  jumpH = 0;
  jumpV = 0;
  airborne = false;
  spinAmount = 0;
  private spinStart = 0;
  private spinDur = 0;
  shakeX = 0;
  /** Scale-in for entrance pops. */
  appear = 1;
  private appearStart = -1;

  // Face.
  mood: Mood = 'neutral';
  private moodUntil = 0;
  private baseMood: Mood = 'neutral';
  private override: { face: Partial<Face>; until: number } | null = null;
  blink = 0;
  private nextBlink = 0;
  private blinkStart = -1;
  crowned = false;
  crownPop = 0;

  // Actions.
  action: Action = 'none';
  actionStart = 0;
  actionUntil = 0;

  // Look target.
  private target: { x: number; y: number } | null = null;
  private nextGlance = 0;
  private glance = { x: 0, y: 0 };

  // Speech and fx.
  speech: Speech | null = null;
  readonly fx: Fx[] = [];
  private fxTimer = 0;
  now = 0;
  private timers: { at: number; fn: () => void }[] = [];

  constructor(
    private readonly rng: Rng,
    private readonly hooks: JelloHooks,
  ) {}

  /** Runs fn after ms on Jello's clock (works with the manual test clock too). */
  after(ms: number, fn: () => void): void {
    this.timers.push({ at: this.now + ms, fn });
  }

  hooksSound(kind: Parameters<JelloHooks['sound']>[0]): void {
    this.hooks.sound(kind);
  }

  place(x: number, ground: number, R: number): void {
    this.x = x;
    this.ground = ground;
    this.R = R;
  }

  /** Body height for the current half-width. */
  get H(): number {
    return this.R * 2.05;
  }

  hit(px: number, py: number): boolean {
    if (!this.visible) return false;
    const cy = this.ground - this.jumpH - this.H * 0.48;
    const dx = (px - this.x) / (this.R * 1.25);
    const dy = (py - cy) / (this.H * 0.62);
    return dx * dx + dy * dy <= 1;
  }

  // ---------------------------------------------------------------------------
  // Moods and face

  setBaseMood(m: Mood): void {
    this.baseMood = m;
  }

  feel(m: Mood, ms: number): void {
    this.mood = m;
    this.moodUntil = this.now + ms;
  }

  express(face: Partial<Face>, ms: number): void {
    this.override = { face, until: this.now + ms };
  }

  face(): Face {
    const f = { ...MOOD_FACE[this.mood] };
    if (this.override) Object.assign(f, this.override.face);
    return f;
  }

  // ---------------------------------------------------------------------------
  // Motion primitives

  /** Squash (amp > 0) or stretch (amp < 0) with a wobble. */
  squash(amp: number): void {
    this.sy.x = 1 - 0.28 * amp;
    this.sx.x = 1 + 0.22 * amp;
    this.m2.v += 2.2 * amp;
    this.m3.v -= 1.4 * amp;
  }

  hop(height = 1, spin = false): void {
    if (this.reducedMotion) height = Math.min(height, 0.4);
    // Anticipation squash, then launch.
    this.squash(0.35);
    this.jumpV = Math.sqrt(2 * 2600 * this.R * 0.9 * height);
    this.airborne = true;
    this.hooks.sound('jump');
    if (spin && !this.reducedMotion) {
      this.spinStart = this.now;
      this.spinDur = (2 * this.jumpV) / 2600;
      this.spinAmount = this.rng.chance(0.5) ? 1 : -1;
    }
  }

  pokeAt(px: number, py: number): void {
    const cx = this.x;
    const cy = this.ground - this.jumpH - this.H * 0.48;
    this.pokeAngle = Math.atan2(py - cy, px - cx);
    this.poke.x = 0.32;
    this.poke.v = 0;
    this.squash(0.55);
    this.lean.v += clamp((cx - px) / this.R, -1, 1) * 3;
    this.tuft.v += (this.rng.next() - 0.5) * 12;
    this.hooks.sound('squish');
  }

  act(a: Action, ms: number): void {
    if (this.reducedMotion && (a === 'spin' || a === 'dance' || a === 'dizzy')) ms = Math.min(ms, 400);
    this.action = a;
    this.actionStart = this.now;
    this.actionUntil = this.now + ms;
  }

  pop(): void {
    this.appearStart = this.now;
    this.appear = 0;
    this.hooks.sound('pop');
  }

  lookAt(x: number, y: number): void {
    this.target = { x, y };
  }

  lookFree(): void {
    this.target = null;
  }

  crown(on: boolean): void {
    if (on && !this.crowned) this.crownPop = this.now;
    this.crowned = on;
  }

  // ---------------------------------------------------------------------------
  // Speech

  say(text: string, mood?: Mood, pitch = 1): void {
    if (mood) this.feel(mood, 2400);
    if (!this.talkEnabled) return;
    const words = text.split(/\s+/).filter(Boolean);
    const wordMs = 120;
    // Roughly one babble syllable per two letters, capped.
    const letters = text.replace(/[^؀-ۿa-zA-Z0-9]/g, '').length;
    const syllables = clamp(Math.round(letters / 2.2), 2, 14);
    const period = 92;
    const speakMs = Math.max(words.length * wordMs, syllables * period);
    this.speech = {
      words,
      text,
      start: this.now,
      wordMs,
      syllables,
      period,
      end: this.now + speakMs + Math.max(1300, words.length * 260),
    };
    const moodPitch = this.mood === 'sad' ? 0.82 : this.mood === 'excited' || this.mood === 'proud' ? 1.12 : 1;
    this.hooks.voice(syllables, period, pitch * moodPitch);
  }

  /** True while the mouth is flapping. */
  talking(): boolean {
    const s = this.speech;
    return !!s && this.now - s.start < s.syllables * s.period;
  }

  // ---------------------------------------------------------------------------
  // Fx

  private spawn(kind: FxKind, x: number, y: number, vx: number, vy: number, life: number, size: number): void {
    if (this.fx.length > 40) this.fx.shift();
    this.fx.push({ kind, x, y, vx, vy, age: 0, life, size, rot: this.rng.range(-0.4, 0.4) });
  }

  burst(kind: 'sparkle' | 'heart', n: number): void {
    const cy = this.ground - this.jumpH - this.H * 0.55;
    for (let i = 0; i < n; i++) {
      const a = this.rng.range(-Math.PI, 0);
      const sp = this.R * this.rng.range(1.5, 3.2);
      this.spawn(kind, this.x + Math.cos(a) * this.R * 0.6, cy + Math.sin(a) * this.R * 0.4, Math.cos(a) * sp, Math.sin(a) * sp, this.rng.range(0.6, 1.0), this.R * this.rng.range(0.16, 0.26));
    }
  }

  // ---------------------------------------------------------------------------
  // Update

  update(dt: number, now: number): void {
    this.now = now;
    if (this.timers.length) {
      const due = this.timers.filter((t) => t.at <= now);
      this.timers = this.timers.filter((t) => t.at > now);
      for (const t of due) t.fn();
    }
    if (now > this.moodUntil) this.mood = this.baseMood;
    if (this.override && now > this.override.until) this.override = null;
    if (this.speech && now > this.speech.end) this.speech = null;
    if (this.action !== 'none' && now > this.actionUntil) {
      if (this.action === 'melt') {
        // Melt holds until something else happens; keep it.
        this.actionUntil = now + 1e9;
      } else this.action = 'none';
    }

    // Entrance pop.
    if (this.appearStart >= 0) {
      const t = clamp01((now - this.appearStart) / 420);
      const c = 2.2;
      this.appear = t >= 1 ? 1 : 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
      if (t >= 1) this.appearStart = -1;
    }

    // Jump physics.
    if (this.airborne) {
      this.jumpV -= 2600 * dt;
      this.jumpH += this.jumpV * dt;
      // Stretch while rising.
      this.sy.target = 1 + clamp(this.jumpV / 3000, -0.1, 0.16);
      this.sx.target = 1 - clamp(this.jumpV / 4000, -0.08, 0.12);
      if (this.jumpH <= 0) {
        this.jumpH = 0;
        const impact = clamp(-this.jumpV / 1400, 0.2, 1);
        this.jumpV = 0;
        this.airborne = false;
        this.sx.target = 1;
        this.sy.target = 1;
        this.squash(impact);
        this.tuft.v += impact * 10 * (this.rng.chance(0.5) ? 1 : -1);
        this.hooks.sound('land');
      }
    }
    if (this.spinDur > 0) {
      const t = clamp01((now - this.spinStart) / 1000 / this.spinDur);
      this.rot.x = this.spinAmount * t * Math.PI * 2;
      this.rot.v = 0;
      if (t >= 1 || !this.airborne) {
        this.spinDur = 0;
        this.rot.x = 0;
      }
    }

    this.runAction(dt, now);
    this.idle(now);

    // Blink.
    if (now >= this.nextBlink) {
      this.blinkStart = now;
      this.nextBlink = now + this.rng.range(1800, 4800) * (this.rng.chance(0.15) ? 0.08 : 1);
    }
    const bt = (now - this.blinkStart) / 130;
    this.blink = bt >= 0 && bt <= 1 ? Math.sin(bt * Math.PI) : 0;

    // Look.
    const cx = this.x;
    const cy = this.ground - this.H * 0.55;
    let lx: number;
    let ly: number;
    if (this.target) {
      const dx = this.target.x - cx;
      const dy = this.target.y - cy;
      const d = Math.hypot(dx, dy) || 1;
      const k = clamp(d / (this.R * 3), 0, 1);
      lx = (dx / d) * k;
      ly = (dy / d) * k;
    } else {
      if (now >= this.nextGlance) {
        this.nextGlance = now + this.rng.range(1500, 4200);
        this.glance = this.rng.chance(0.4) ? { x: 0, y: 0 } : { x: this.rng.range(-0.9, 0.9), y: this.rng.range(-0.5, 0.6) };
      }
      lx = this.glance.x;
      ly = this.glance.y;
    }
    this.lookX.target = lx;
    this.lookY.target = ly;

    // Face springs.
    const f = this.face();
    const talking = this.talking();
    let open = 0;
    let smile = 0.6;
    switch (f.mouth) {
      case 'grin':
        open = 0.55;
        smile = 1;
        break;
      case 'o':
        open = 0.7;
        smile = 0;
        break;
      case 'frown':
        open = 0;
        smile = -0.8;
        break;
      case 'tongue':
        open = 0.5;
        smile = 0.6;
        break;
      case 'wavy':
        open = 0;
        smile = 0;
        break;
      default:
        open = 0;
        smile = 0.7;
    }
    if (talking && this.speech) {
      const t = (now - this.speech.start) / this.speech.period;
      open = 0.18 + 0.62 * Math.abs(Math.sin(t * Math.PI));
    }
    if (this.mood === 'sleepy') open = 0.25 + 0.15 * Math.sin(now / 700);
    this.mouthOpen.target = open;
    this.smile.target = smile;
    this.brows.target = f.brows;

    // Mood fx.
    this.fxTimer -= dt;
    if (this.fxTimer <= 0) {
      const R = this.R;
      const top = this.ground - this.jumpH - this.H;
      if (this.mood === 'worried') {
        this.spawn('sweat', this.x + R * 0.82, top + this.H * 0.25, 0, R * 0.5, 0.9, R * 0.22);
        this.fxTimer = 0.9;
      } else if (this.mood === 'sad') {
        for (const s of [-1, 1]) this.spawn('tear', this.x + s * R * 0.38, top + this.H * 0.52, s * R * 0.4, R * 0.3, 0.8, R * 0.14);
        this.fxTimer = 0.45;
      } else if (this.mood === 'sleepy') {
        this.spawn('zzz', this.x + R * 0.7, top + this.H * 0.05, R * 0.35, -R * 0.7, 1.8, R * 0.32);
        this.fxTimer = 1.1;
        this.hooks.sound('snore');
      } else if (this.mood === 'love' || this.mood === 'proud') {
        this.spawn('heart', this.x + this.rng.range(-R, R), top + this.H * 0.1, this.rng.range(-R, R) * 0.4, -R * 1.2, 1.1, R * 0.2);
        this.fxTimer = 0.35;
      } else this.fxTimer = 0.3;
    }
    for (const p of this.fx) {
      p.age += dt;
      if (p.kind === 'tear' || p.kind === 'sweat') p.vy += this.R * 6 * dt;
      else if (p.kind === 'sparkle') {
        p.vx *= Math.pow(0.1, dt);
        p.vy = p.vy * Math.pow(0.1, dt) + this.R * 0.6 * dt;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = this.fx.length - 1; i >= 0; i--) if (this.fx[i].age >= this.fx[i].life) this.fx.splice(i, 1);

    // Tuft lags behind lean and rotation (secondary motion).
    this.tuft.target = -this.lean.x * 1.4 - this.rot.v * 0.02;
    for (const s of [this.sx, this.sy, this.lean, this.rot, this.m2, this.m3, this.tuft, this.armL, this.armR, this.lookX, this.lookY, this.mouthOpen, this.smile, this.brows, this.poke]) {
      s.step(dt);
    }
  }

  private runAction(dt: number, now: number): void {
    const t = (now - this.actionStart) / 1000;
    this.shakeX = 0;
    let armL = 0.55;
    let armR = 0.55;
    // Idle breathing.
    const breath = this.reducedMotion ? 0 : Math.sin(now / 520) * 0.018;
    if (!this.airborne) {
      this.sy.target = 1 + breath;
      this.sx.target = 1 - breath * 0.6;
    }
    this.lean.target = 0;
    switch (this.action) {
      case 'wave':
        armR = 2.5 + Math.sin(t * 14) * 0.45;
        this.lean.target = -0.06;
        break;
      case 'cheer':
        armL = armR = 2.7 + Math.sin(t * 18) * 0.2;
        break;
      case 'dance': {
        const beat = Math.sin(t * 10);
        this.lean.target = beat * 0.2;
        armL = 1.4 + beat * 0.9;
        armR = 1.4 - beat * 0.9;
        if (!this.airborne) this.sy.target = 1 + 0.06 * Math.abs(Math.cos(t * 10));
        break;
      }
      case 'shake':
        this.shakeX = Math.sin(t * 70) * this.R * 0.06 * (this.reducedMotion ? 0 : 1);
        armL = armR = 1.6;
        break;
      case 'dizzy':
        this.lean.target = Math.sin(t * 6) * 0.22;
        armL = 1 + Math.sin(t * 6) * 0.6;
        armR = 1 - Math.sin(t * 6) * 0.6;
        break;
      case 'melt':
        if (!this.airborne) {
          const k = clamp01(t / 0.8);
          this.sy.target = 1 - 0.32 * k;
          this.sx.target = 1 + 0.26 * k;
        }
        armL = armR = 0.15;
        break;
      default:
        break;
    }
    this.armL.target = armL;
    this.armR.target = armR;
    void dt;
  }

  /** Idle micro-behaviours when nothing else is happening. */
  private idle(now: number): void {
    if (this.action !== 'none' || this.airborne) return;
    // Small random tuft flick keeps him alive.
    if (this.rng.next() < 0.004) this.tuft.v += this.rng.range(-6, 6);
    void now;
  }

  /** Clears transient state (new game). */
  reset(): void {
    this.action = 'none';
    this.override = null;
    this.mood = this.baseMood = 'neutral';
    this.speech = null;
    this.fx.length = 0;
    this.crowned = false;
    this.timers.length = 0;
    this.jumpH = 0;
    this.jumpV = 0;
    this.airborne = false;
    this.spinDur = 0;
    this.rot.x = 0;
  }
}
