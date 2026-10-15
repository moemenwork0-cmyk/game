/**
 * Jello, the mascot: a soft-body jelly with a face, arms, feet and a voice.
 * This file holds his state, physics, moods, actions, idle repertoire and speech.
 * jelloDraw.ts renders him.
 */
import type { Rng } from '../core/rng';
import { Spring } from '../core/spring';
import { clamp, clamp01 } from '../core/tween';

export type Mood = 'neutral' | 'happy' | 'excited' | 'worried' | 'sad' | 'sleepy' | 'dizzy' | 'love' | 'surprised' | 'proud' | 'cool';
export type EyeStyle = 'normal' | 'happy' | 'closed' | 'star' | 'spiral' | 'heart' | 'wide' | 'squint';
export type MouthStyle = 'cat' | 'smile' | 'grin' | 'o' | 'wavy' | 'frown' | 'tongue' | 'yawn';

export interface Face {
  eyes: EyeStyle;
  mouth: MouthStyle;
  /** -1 angry (inner down) … 0 none … 1 worried (inner up). */
  brows: number;
  blush: number;
}

const MOOD_FACE: Record<Mood, Face> = {
  neutral: { eyes: 'normal', mouth: 'cat', brows: 0, blush: 0.7 },
  happy: { eyes: 'normal', mouth: 'grin', brows: 0, blush: 1 },
  excited: { eyes: 'star', mouth: 'grin', brows: 0, blush: 1 },
  worried: { eyes: 'wide', mouth: 'wavy', brows: 0.8, blush: 0.3 },
  sad: { eyes: 'normal', mouth: 'frown', brows: 0.9, blush: 0.3 },
  sleepy: { eyes: 'closed', mouth: 'o', brows: 0, blush: 0.6 },
  dizzy: { eyes: 'spiral', mouth: 'tongue', brows: 0, blush: 0.6 },
  love: { eyes: 'heart', mouth: 'grin', brows: 0, blush: 1 },
  surprised: { eyes: 'wide', mouth: 'o', brows: -0.01, blush: 0.5 },
  proud: { eyes: 'happy', mouth: 'grin', brows: 0, blush: 1 },
  cool: { eyes: 'normal', mouth: 'smile', brows: 0, blush: 0.7 },
};

export type FxKind = 'sweat' | 'tear' | 'zzz' | 'sparkle' | 'heart' | 'note' | 'bubble';

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

export type Action =
  | 'none'
  | 'shake'
  | 'wave'
  | 'cheer'
  | 'dance'
  | 'dizzy'
  | 'melt'
  | 'peek'
  | 'wiggle'
  | 'tilt'
  | 'yawn'
  | 'hum'
  | 'blow'
  | 'look';

export type SoundKind = 'squish' | 'giggle' | 'jump' | 'land' | 'aww' | 'snore' | 'pop' | 'boing' | 'purr' | 'bubble' | 'hum' | 'yawn' | 'glasses';

export interface JelloHooks {
  /** Babble voice for a line: n syllables spaced `periodMs`, pitch multiplier by mood. */
  voice(syllables: number, periodMs: number, pitch: number): void;
  sound(kind: SoundKind): void;
}

export type RGB = [number, number, number];

export class Jello {
  // Placement (CSS px): feet centre and body half-width.
  x = 0;
  ground = 0;
  R = 40;
  visible = true;
  reducedMotion = false;
  talkEnabled = true;
  /** 'lively' on the home screen, 'calm' in game (fewer, smaller idle moves). */
  idleStyle: 'lively' | 'calm' = 'lively';

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
  readonly glassesY = new Spring(-1, 170, 13);
  readonly offX = new Spring(0, 160, 14);
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
  /** 0..1 how closed the right eye is (wink). */
  wink = 0;
  private winkUntil = 0;
  crowned = false;
  crownPop = 0;
  glasses = false;

  // Colour: body tint (absorbs the colour of cleared jelly).
  tint: RGB | null = null;
  tintAmount = 0;
  private tintStart = 0;
  private tintDur = 0;

  // Pull / pet interaction.
  pulling = false;
  pullX = 0;
  pullY = 0;
  private petTravel = 0;
  private lastPetX = 0;
  private petting = false;

  // Actions.
  action: Action = 'none';
  actionStart = 0;
  actionUntil = 0;
  private nextIdle = 0;

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

  hooksSound(kind: SoundKind): void {
    this.hooks.sound(kind);
  }

  place(x: number, ground: number, R: number): void {
    this.x = x;
    this.ground = ground;
    this.R = R;
  }

  /** Body height for the current half-width. */
  get H(): number {
    return this.R * 1.95;
  }

  hit(px: number, py: number): boolean {
    if (!this.visible) return false;
    const cy = this.ground - this.jumpH - this.H * 0.48;
    const dx = (px - this.x) / (this.R * 1.3);
    const dy = (py - cy) / (this.H * 0.66);
    return dx * dx + dy * dy <= 1;
  }

  // ---------------------------------------------------------------------------
  // Moods and face

  setBaseMood(m: Mood): void {
    this.baseMood = m;
    // A lasting change shows right away unless a short reaction is playing.
    if (this.now >= this.moodUntil) this.mood = m;
  }

  get base(): Mood {
    return this.baseMood;
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
    if (this.pulling) {
      f.eyes = 'squint';
      f.mouth = 'grin';
    }
    if (this.petting) {
      f.eyes = 'happy';
      f.mouth = 'cat';
      f.blush = 1;
    }
    if (this.action === 'yawn') {
      f.eyes = 'closed';
      f.mouth = 'yawn';
    }
    if (this.action === 'blow') f.mouth = 'o';
    if (this.action === 'hum') {
      f.eyes = 'happy';
      f.mouth = 'o';
    }
    return f;
  }

  /** Body briefly takes on another jelly colour, then returns to pink. */
  absorb(color: RGB, ms = 900): void {
    this.tint = color;
    this.tintStart = this.now;
    this.tintDur = ms;
  }

  setGlasses(on: boolean): void {
    if (on === this.glasses) return;
    this.glasses = on;
    this.glassesY.target = on ? 0 : -1;
    if (on) {
      this.glassesY.x = -1.4;
      this.hooks.sound('glasses');
    }
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
    if (this.pulling) return;
    if (this.reducedMotion) height = Math.min(height, 0.4);
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

  // ---- Pull and pet ----

  /** Finger pressed on Jello. */
  grab(px: number): void {
    this.pulling = false;
    this.petting = false;
    this.petTravel = 0;
    this.lastPetX = px;
    this.pullX = this.pullY = 0;
  }

  /** Finger moved while pressed: dx/dy relative to the press point. */
  drag(px: number, dx: number, dy: number): void {
    const R = this.R;
    // Rubbing side to side over him = petting; a clear pull away = stretching.
    this.petTravel += Math.abs(px - this.lastPetX);
    this.lastPetX = px;
    const dist = Math.hypot(dx, dy);
    if (!this.pulling && dist > R * 0.9 && Math.abs(dy) > Math.abs(dx) * 0.6) {
      this.pulling = true;
      this.petting = false;
      this.hooks.sound('squish');
    }
    if (!this.pulling && !this.petting && this.petTravel > R * 2.2 && dist < R * 1.4) {
      this.petting = true;
      this.hooks.sound('purr');
    }
    if (this.pulling) {
      const k = 1 - Math.exp(-dist / (R * 2.2));
      const max = 0.75;
      this.pullX = clamp(dx / (R * 3), -1, 1) * k;
      this.pullY = clamp(dy / (R * 3), -1, 1) * k;
      this.sy.target = 1 + clamp(-this.pullY * max, -0.35, max);
      this.sx.target = 1 - clamp(-this.pullY * 0.35, -0.2, 0.3);
      this.lean.target = clamp(this.pullX * 0.6, -0.45, 0.45);
    }
    if (this.petting && this.rng.next() < 0.08) this.burst('heart', 1);
  }

  /** Finger released. Returns what happened. */
  release(): 'boing' | 'pet' | 'tap' {
    if (this.pulling) {
      const amt = Math.hypot(this.pullX, this.pullY);
      this.pulling = false;
      // Snap back: overshoot the other way.
      this.sy.x = 1 + this.pullY * 0.5;
      this.sx.x = 1 - this.pullY * 0.25;
      this.sy.v = this.pullY * 18;
      this.lean.v = -this.pullX * 9;
      this.m2.v += 6 * amt;
      this.m3.v -= 4 * amt;
      this.tuft.v += 18 * (this.rng.chance(0.5) ? 1 : -1);
      this.pullX = this.pullY = 0;
      this.hooks.sound('boing');
      if (amt > 0.45) this.hop(0.9, true);
      return 'boing';
    }
    if (this.petting) {
      this.petting = false;
      return 'pet';
    }
    return 'tap';
  }

  act(a: Action, ms: number): void {
    if (this.reducedMotion && (a === 'dance' || a === 'dizzy' || a === 'wiggle')) ms = Math.min(ms, 400);
    this.action = a;
    this.actionStart = this.now;
    this.actionUntil = this.now + ms;
    if (a === 'blow') this.after(500, () => this.blowBubble());
    if (a === 'hum') this.hooks.sound('hum');
    if (a === 'yawn') this.hooks.sound('yawn');
  }

  winkAt(): void {
    this.winkUntil = this.now + 420;
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

  talking(): boolean {
    const s = this.speech;
    return !!s && this.now - s.start < s.syllables * s.period;
  }

  // ---------------------------------------------------------------------------
  // Fx

  private spawn(kind: FxKind, x: number, y: number, vx: number, vy: number, life: number, size: number): void {
    if (this.fx.length > 48) this.fx.shift();
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

  private blowBubble(): void {
    const mouthY = this.ground - this.jumpH - this.H * 0.28;
    this.spawn('bubble', this.x + this.R * 0.2, mouthY, this.R * 1.6, -this.R * 0.7, 2.2, this.R * 0.34);
    this.hooks.sound('bubble');
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
      if (this.action === 'melt') this.actionUntil = now + 1e9;
      else this.action = 'none';
    }

    // Entrance pop.
    if (this.appearStart >= 0) {
      const t = clamp01((now - this.appearStart) / 420);
      const c = 2.2;
      this.appear = t >= 1 ? 1 : 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
      if (t >= 1) this.appearStart = -1;
    }

    // Tint fades back to pink.
    if (this.tint) {
      const t = (now - this.tintStart) / this.tintDur;
      this.tintAmount = t < 0.15 ? t / 0.15 : t < 0.6 ? 1 : Math.max(0, 1 - (t - 0.6) / 0.4);
      if (t >= 1) {
        this.tint = null;
        this.tintAmount = 0;
      }
    }

    // Jump physics.
    if (this.airborne) {
      this.jumpV -= 2600 * dt;
      this.jumpH += this.jumpV * dt;
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

    this.runAction(now);
    this.idle(now);

    // Blink and wink.
    if (now >= this.nextBlink) {
      this.blinkStart = now;
      this.nextBlink = now + this.rng.range(1800, 4600) * (this.rng.chance(0.18) ? 0.08 : 1);
    }
    const bt = (now - this.blinkStart) / 130;
    this.blink = bt >= 0 && bt <= 1 ? Math.sin(bt * Math.PI) : 0;
    this.wink += ((now < this.winkUntil ? 1 : 0) - this.wink) * clamp01(dt * 22);

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
    } else if (this.action === 'look') {
      const t = (now - this.actionStart) / 1000;
      lx = Math.sin(t * 3.2) > 0 ? 0.9 : -0.9;
      ly = -0.1;
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
        open = 0.6;
        smile = 0;
        break;
      case 'yawn':
        open = 1;
        smile = 0;
        break;
      case 'frown':
        smile = -0.8;
        break;
      case 'tongue':
        open = 0.5;
        smile = 0.6;
        break;
      case 'wavy':
        smile = 0;
        break;
      default:
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

    this.moodFx(dt);
    this.stepFx(dt);

    // Tuft lags behind lean and rotation (secondary motion).
    this.tuft.target = -this.lean.x * 1.4 - this.rot.v * 0.02;
    for (const s of [this.sx, this.sy, this.lean, this.rot, this.m2, this.m3, this.tuft, this.armL, this.armR, this.lookX, this.lookY, this.mouthOpen, this.smile, this.brows, this.poke, this.glassesY, this.offX]) {
      s.step(dt);
    }
  }

  private moodFx(dt: number): void {
    this.fxTimer -= dt;
    if (this.fxTimer > 0) return;
    const R = this.R;
    const top = this.ground - this.jumpH - this.H;
    if (this.mood === 'worried') {
      this.spawn('sweat', this.x + R * 0.82, top + this.H * 0.25, 0, R * 0.5, 0.9, R * 0.22);
      this.fxTimer = 0.9;
    } else if (this.mood === 'sad') {
      for (const s of [-1, 1]) this.spawn('tear', this.x + s * R * 0.4, top + this.H * 0.55, s * R * 0.4, R * 0.3, 0.8, R * 0.14);
      this.fxTimer = 0.45;
    } else if (this.mood === 'sleepy') {
      this.spawn('zzz', this.x + R * 0.7, top + this.H * 0.05, R * 0.35, -R * 0.7, 1.8, R * 0.32);
      this.fxTimer = 1.1;
      this.hooks.sound('snore');
    } else if (this.mood === 'love' || this.mood === 'proud') {
      this.spawn('heart', this.x + this.rng.range(-R, R), top + this.H * 0.1, this.rng.range(-R, R) * 0.4, -R * 1.2, 1.1, R * 0.2);
      this.fxTimer = 0.35;
    } else if (this.action === 'hum') {
      this.spawn('note', this.x + this.rng.range(-0.2, 0.9) * R, top + this.H * 0.2, R * this.rng.range(0.2, 0.7), -R * 1.1, 1.3, R * 0.3);
      this.fxTimer = 0.32;
    } else this.fxTimer = 0.25;
  }

  private stepFx(dt: number): void {
    for (const p of this.fx) {
      p.age += dt;
      if (p.kind === 'tear' || p.kind === 'sweat') p.vy += this.R * 6 * dt;
      else if (p.kind === 'sparkle') {
        p.vx *= Math.pow(0.1, dt);
        p.vy = p.vy * Math.pow(0.1, dt) + this.R * 0.6 * dt;
      } else if (p.kind === 'bubble') {
        p.vx *= Math.pow(0.4, dt);
        p.x += Math.sin(p.age * 5) * this.R * 0.3 * dt;
      } else if (p.kind === 'note') {
        p.x += Math.sin(p.age * 6) * this.R * 0.6 * dt;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const p = this.fx[i];
      if (p.age >= p.life) {
        if (p.kind === 'bubble') this.hooks.sound('pop');
        this.fx.splice(i, 1);
      }
    }
  }

  private runAction(now: number): void {
    const t = (now - this.actionStart) / 1000;
    this.shakeX = 0;
    let armL = 0.55;
    let armR = 0.55;
    const breath = this.reducedMotion ? 0 : Math.sin(now / 520) * 0.018;
    if (!this.airborne && !this.pulling) {
      this.sy.target = 1 + breath;
      this.sx.target = 1 - breath * 0.6;
      this.lean.target = 0;
    }
    this.offX.target = 0;
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
      case 'wiggle': {
        const w = Math.sin(t * 16);
        this.lean.target = w * 0.12;
        this.offX.target = w * this.R * 0.06;
        armL = 1 + w * 0.5;
        armR = 1 - w * 0.5;
        break;
      }
      case 'tilt':
        this.lean.target = 0.16;
        this.express({ brows: -0.01 }, 120);
        armR = 1.2;
        break;
      case 'yawn': {
        const k = Math.sin(clamp01(t / 1.3) * Math.PI);
        this.sy.target = 1 + 0.12 * k;
        this.sx.target = 1 - 0.06 * k;
        armL = armR = 0.55 + 2.2 * k;
        break;
      }
      case 'hum':
        this.lean.target = Math.sin(t * 5) * 0.1;
        break;
      case 'blow':
        if (!this.airborne) {
          this.sx.target = 1 + 0.05 * Math.sin(clamp01(t / 0.5) * Math.PI);
        }
        break;
      case 'shake':
        this.shakeX = Math.sin(t * 70) * this.R * 0.06 * (this.reducedMotion ? 0 : 1);
        armL = armR = 1.6;
        break;
      case 'peek':
        // Hands over the eyes, peeking now and then.
        armL = armR = 2.35 + (Math.sin(t * 2.4) > 0.6 ? -0.35 : 0);
        this.shakeX = Math.sin(t * 60) * this.R * 0.025;
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
    if (this.pulling) {
      armL = 1.8 - this.pullX;
      armR = 1.8 + this.pullX;
    }
    if (this.petting) {
      this.lean.target = Math.sin(now / 160) * 0.08;
      armL = armR = 1.1;
    }
    this.armL.target = armL;
    this.armR.target = armR;
  }

  /** Idle repertoire when nothing else is happening. */
  private idle(now: number): void {
    if (this.reducedMotion || this.pulling || this.petting) return;
    if (this.action !== 'none' || this.airborne || this.speech) {
      this.nextIdle = Math.max(this.nextIdle, now + 1500);
      return;
    }
    if (this.mood !== this.baseMood || this.baseMood === 'sleepy' || this.baseMood === 'sad' || this.baseMood === 'worried') return;
    if (now < this.nextIdle) {
      if (this.rng.next() < 0.004) this.tuft.v += this.rng.range(-6, 6);
      return;
    }
    const calm = this.idleStyle === 'calm';
    this.nextIdle = now + (calm ? this.rng.range(7000, 13000) : this.rng.range(3200, 6500));
    const pool: [string, number][] = calm
      ? [
          ['wink', 3],
          ['look', 3],
          ['tilt', 2],
          ['tuft', 2],
          ['blow', 1],
          ['hum', 1],
        ]
      : [
          ['wink', 2],
          ['look', 2],
          ['tilt', 2],
          ['wiggle', 2],
          ['bounce', 2],
          ['blow', 2],
          ['hum', 2],
          ['wave', 1],
          ['yawn', 1],
          ['tuft', 1],
        ];
    let total = 0;
    for (const [, w] of pool) total += w;
    let r = this.rng.next() * total;
    let pick = pool[0][0];
    for (const [k, w] of pool) {
      r -= w;
      if (r <= 0) {
        pick = k;
        break;
      }
    }
    switch (pick) {
      case 'wink':
        this.winkAt();
        this.express({ mouth: 'grin' }, 600);
        break;
      case 'look':
        this.act('look', 1600);
        break;
      case 'tilt':
        this.act('tilt', 1300);
        break;
      case 'wiggle':
        this.act('wiggle', 900);
        break;
      case 'bounce':
        this.hop(0.45);
        break;
      case 'blow':
        this.act('blow', 900);
        break;
      case 'hum':
        this.act('hum', 2200);
        break;
      case 'wave':
        this.act('wave', 1200);
        break;
      case 'yawn':
        this.act('yawn', 1400);
        break;
      case 'tuft':
        this.tuft.v += 22 * (this.rng.chance(0.5) ? 1 : -1);
        this.squash(0.15);
        break;
    }
  }

  /** Clears transient state (new game). */
  reset(): void {
    this.action = 'none';
    this.override = null;
    this.mood = this.baseMood = 'neutral';
    this.moodUntil = 0;
    this.speech = null;
    this.fx.length = 0;
    this.crowned = false;
    this.timers.length = 0;
    this.jumpH = 0;
    this.jumpV = 0;
    this.airborne = false;
    this.spinDur = 0;
    this.rot.x = 0;
    this.tint = null;
    this.tintAmount = 0;
    this.pulling = false;
    this.petting = false;
    this.setGlasses(false);
    this.glassesY.x = -1;
  }
}
