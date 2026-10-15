/**
 * Jello's director: turns game events into reactions and lines, with cooldowns so he stays charming
 * instead of chatty. Pure reaction logic; the app calls these hooks.
 */
import type { Rng } from '../core/rng';
import type { PlaceResult } from '../game/session';
import { fmtNum } from '../config/strings';
import { Jello, type RGB } from './jello';
import { LineBag, type LineKey } from './lines';

/** 0 = small talk (needs a quiet gap), 1 = reaction, 2 = big moment (always speaks). */
type Priority = 0 | 1 | 2;
const GAP: Record<Priority, number> = { 0: 7000, 1: 2600, 2: 0 };

const DANGER_FILL = 0.7;
const COMEBACK_FILL = 0.45;

export class JelloDirector {
  private bag: LineBag;
  private lastSpeech = -1e9;
  private lastInput = 0;
  private taps: number[] = [];
  private inDanger = false;
  private crownedThisGame = false;
  private idleSaid = false;
  private asleep = false;
  private bestAtStart = 0;
  private screen: 'menu' | 'game' = 'menu';
  private greeted = false;

  private colors: RGB[];

  constructor(
    readonly jello: Jello,
    private readonly rng: Rng,
    jellyHex: readonly string[] = [],
  ) {
    this.bag = new LineBag(rng);
    this.colors = jellyHex.map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)] as RGB);
  }

  private get now(): number {
    return this.jello.now;
  }

  private say(key: LineKey, p: Priority, vars?: Record<string, string>, mood?: Parameters<Jello['say']>[1]): boolean {
    const j = this.jello;
    const sinceEnd = this.now - Math.max(this.lastSpeech, j.speech ? j.speech.end : -1e9);
    if (p < 2 && (j.speech || sinceEnd < GAP[p])) return false;
    j.say(this.bag.pick(key, vars), mood);
    this.lastSpeech = this.now;
    return true;
  }

  private touch(): void {
    this.lastInput = this.now;
    this.idleSaid = false;
    if (this.asleep) {
      this.asleep = false;
      this.jello.setBaseMood(this.inDanger ? 'worried' : 'neutral');
      this.jello.feel('surprised', 900);
      this.jello.hop(0.5);
      this.say('wake', 2);
    }
  }

  // ---------------------------------------------------------------------------
  // Screens

  menu(best: number): void {
    this.screen = 'menu';
    this.jello.idleStyle = 'lively';
    this.inDanger = false;
    this.asleep = false;
    const j = this.jello;
    j.reset();
    j.crown(false);
    j.pop();
    this.lastInput = this.now;
    j.after(380, () => {
      j.act('wave', 1400);
      j.feel('happy', 1600);
      if (best > 0 && this.rng.chance(0.5)) this.say('greetBest', 2, { best: fmtNum(best) });
      else this.say('greet', 2);
    });
    this.greeted = true;
  }

  gameStart(again: boolean, best: number, resumed = false): void {
    this.screen = 'game';
    this.jello.idleStyle = 'calm';
    this.bestAtStart = best;
    this.inDanger = false;
    this.crownedThisGame = false;
    this.asleep = false;
    const j = this.jello;
    j.reset();
    j.crown(false);
    j.pop();
    this.lastInput = this.now;
    j.after(300, () => {
      j.hop(0.7);
      j.feel('happy', 1400);
      this.say(resumed ? 'resume' : again ? 'again' : 'start', 2);
    });
  }

  resume(): void {
    this.touch();
    this.jello.hop(0.4);
    this.say('resume', 1);
  }

  // ---------------------------------------------------------------------------
  // Play events

  pick(): void {
    this.touch();
  }

  placed(res: PlaceResult, fill: number, best: number): void {
    this.touch();
    const j = this.jello;
    // One placement = at most one line: keep the most important candidate.
    let want: { key: LineKey; p: Priority; mood?: Parameters<Jello['say']>[1] } | null = null;
    const consider = (key: LineKey, p: Priority, mood?: Parameters<Jello['say']>[1]): void => {
      if (!want || p >= want.p) want = { key, p, mood };
    };

    if (res.perfect) {
      j.feel('love', 2600);
      j.hop(1.3, true);
      j.burst('heart', 10);
      j.act('cheer', 1600);
      consider('perfect', 2);
    } else if (res.lines >= 4) {
      j.feel('excited', 2000);
      j.hop(1.3, true);
      j.burst('sparkle', 12);
      j.act('cheer', 1400);
      consider('lines4', 2);
    } else if (res.lines === 3) {
      j.feel('excited', 1800);
      j.hop(1.1, true);
      j.burst('sparkle', 8);
      j.act('cheer', 1100);
      consider('lines3', 1);
    } else if (res.lines === 2) {
      j.feel('happy', 1500);
      j.hop(0.8);
      j.burst('sparkle', 5);
      consider('lines2', 1);
    } else if (res.lines === 1) {
      j.feel('happy', 1000);
      j.hop(0.45);
      j.burst('sparkle', 2);
    } else {
      // A small nod for every placement keeps him attentive.
      j.squash(0.12);
    }

    // Jello soaks up the colour of what was cleared.
    if (res.lines > 0 && res.cleared.length) {
      const c = this.colors[res.cleared[(res.cleared.length / 2) | 0].color];
      if (c) j.absorb(c, 1000 + res.lines * 150);
    }

    // Sunglasses while the combo is hot.
    if (res.combo >= 5 && !j.glasses) {
      j.setGlasses(true);
      j.setBaseMood('cool');
      consider('cool', 1);
    } else if (res.combo === 0 && j.glasses) {
      j.setGlasses(false);
      if (j.base === 'cool') j.setBaseMood(this.inDanger ? 'worried' : 'neutral');
    }

    // Combo hype.
    if (res.lines > 0 && res.combo >= 3) {
      if (j.action === 'none') j.act('dance', 1300);
      if (res.combo === 3) consider('combo3', 1);
      else if (res.combo === 5) consider('combo5', 1, 'excited');
      else if (res.combo === 8) consider('combo8', 2, 'excited');
    }

    // Danger and comebacks.
    if (!this.inDanger && fill >= DANGER_FILL && !res.gameOver) {
      this.inDanger = true;
      j.setBaseMood('worried');
      j.act('shake', 700);
      consider('danger', 1);
    } else if (this.inDanger && fill >= 0.8 && res.lines === 0 && !res.gameOver && j.action === 'none') {
      // Too scary to watch: hands over the eyes.
      j.act('peek', 1700);
      consider('peek', 0);
    } else if (this.inDanger && fill <= COMEBACK_FILL) {
      this.inDanger = false;
      j.setBaseMood('neutral');
      j.feel('love', 2200);
      j.hop(1, true);
      j.burst('heart', 6);
      consider('comeback', 2);
    } else if (this.inDanger && fill < DANGER_FILL - 0.08) {
      this.inDanger = false;
      j.setBaseMood('neutral');
    }

    // New best during play (only when there was a real record to beat).
    if (!this.crownedThisGame && this.bestAtStart >= 300 && res.score > this.bestAtStart) {
      this.crownedThisGame = true;
      j.crown(true);
      j.feel('proud', 2600);
      j.act('cheer', 1400);
      j.burst('sparkle', 10);
      consider('newBest', 2);
    }
    const w = want as { key: LineKey; p: Priority; mood?: Parameters<Jello['say']>[1] } | null;
    if (w) this.say(w.key, w.p, undefined, w.mood);
    void best;
  }

  gameOver(score: number, best: number, newBest: boolean): void {
    const j = this.jello;
    this.inDanger = false;
    j.setGlasses(false);
    if (newBest && score > 0) {
      j.setBaseMood('proud');
      j.crown(true);
      j.act('cheer', 1800);
      j.hop(1, true);
      j.burst('sparkle', 12);
      this.say('gameOverBest', 2);
      return;
    }
    j.setBaseMood('sad');
    j.act('melt', 1e9);
    j.hooksSound('aww');
    const close = best > 0 && score >= best * 0.8;
    this.say(close ? 'gameOverClose' : 'gameOver', 2);
  }

  /** Player tapped Jello. */
  tap(x: number, y: number): void {
    const j = this.jello;
    const wasAsleep = this.asleep;
    this.touch();
    j.pokeAt(x, y);
    if (wasAsleep) return;
    const now = this.now;
    this.taps = this.taps.filter((t) => now - t < 2200);
    this.taps.push(now);
    if (this.taps.length >= 5) {
      this.taps.length = 0;
      j.act('dizzy', 1900);
      j.feel('dizzy', 1900);
      j.express({ eyes: 'spiral' }, 1900);
      this.say('dizzy', 2);
      return;
    }
    const r = this.rng.next();
    if (r < 0.35) j.hop(0.55);
    else if (r < 0.55) j.act('wave', 900);
    j.express({ eyes: this.rng.chance(0.5) ? 'happy' : 'wide', mouth: this.rng.chance(0.5) ? 'grin' : 'o' }, 650);
    j.hooksSound('giggle');
    // Talk on taps, but not every single one.
    if (!j.speech && this.rng.chance(0.75)) this.say('tap', 1);
  }

  /** Finger pressed on Jello. */
  grab(x: number): void {
    this.touch();
    this.jello.grab(x);
  }

  drag(x: number, dx: number, dy: number): void {
    this.lastInput = this.now;
    this.jello.drag(x, dx, dy);
  }

  /** Finger released: a tap, a stretchy boing, or a pet. */
  release(x: number, y: number): void {
    const j = this.jello;
    const kind = j.release();
    if (kind === 'tap') {
      this.tap(x, y);
    } else if (kind === 'boing') {
      j.feel('happy', 1400);
      j.express({ eyes: 'happy', mouth: 'grin' }, 900);
      j.hooksSound('giggle');
      this.say('boing', 1);
    } else {
      j.feel('love', 1800);
      j.burst('heart', 6);
      this.say('pet', 1);
    }
  }

  // ---------------------------------------------------------------------------
  // Holding pieces

  gave(swapped: boolean, first: boolean): void {
    this.touch();
    const j = this.jello;
    j.feel('happy', 1400);
    j.express({ eyes: 'happy', mouth: 'grin' }, 700);
    j.burst('sparkle', 4);
    if (first) this.say('holdLearned', 2);
    else this.say(swapped ? 'holdSwap' : 'holdGot', 1);
  }

  takenBack(): void {
    this.touch();
    this.jello.squash(0.15);
    this.say('holdGive', 0);
  }

  heldBack(): void {
    this.say('holdBack', 0);
  }

  /** Only the piece in Jello's hand fits: he waves it around. */
  onlyHeldFits(): void {
    this.jello.toss();
    this.say('holdOnlyFits', 1);
  }

  /** First-time tip: drag a piece to Jello. Keeps the bubble up for a while. */
  holdTip(): string {
    const j = this.jello;
    const text = this.bag.pick('holdTip');
    j.feel('happy', 4500);
    j.act('wave', 1400);
    j.say(text, undefined, 1, 5200);
    this.lastSpeech = this.now;
    return text;
  }

  /** A dragged piece passes close to Jello. */
  nearPiece(): void {
    const j = this.jello;
    if (j.action === 'none' && !j.airborne) {
      j.express({ eyes: 'wide', mouth: 'o' }, 350);
      j.sy.target = 0.94;
    }
  }

  /** Per-frame: idle chatter and falling asleep. */
  update(dragging: boolean): void {
    if (dragging) this.lastInput = this.now;
    const idleMs = this.now - this.lastInput;
    const j = this.jello;
    if (this.screen === 'menu') {
      if (idleMs > 14000 && !this.idleSaid) {
        this.idleSaid = true;
        j.hop(0.6);
        this.say('menuIdle', 0);
      }
      return;
    }
    if (idleMs > 12000 && !this.idleSaid && !this.asleep) {
      this.idleSaid = true;
      this.say('idle', 0);
    }
    if (idleMs > 30000 && !this.asleep && j.action !== 'melt') {
      this.asleep = true;
      j.setBaseMood('sleepy');
    }
  }

  get isGreeted(): boolean {
    return this.greeted;
  }
}
