import type { AudioEngine } from './audio';

/** C-major pentatonic over 2.5 octaves, starting at C4. Node 0 = lowest note. */
const PENTA_SEMITONES = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31];
const C4 = 261.63;

export function pentatonic(index: number): number {
  const i = Math.max(0, Math.min(PENTA_SEMITONES.length - 1, index));
  return C4 * Math.pow(2, PENTA_SEMITONES[i] / 12);
}

/** Synthesized sound effects. Every method is a no-op until audio is unlocked. */
export class Sfx {
  constructor(private readonly a: AudioEngine) {}

  private out(): GainNode | null {
    return this.a.ready ? this.a.sfx : null;
  }

  /** Oscillator with an attack/decay envelope into `dest`. */
  private tone(
    dest: AudioNode,
    type: OscillatorType,
    freq: number,
    start: number,
    dur: number,
    gain: number,
    attack = 0.008,
    freqEnd?: number,
  ): OscillatorNode | null {
    const ctx = this.a.ctx;
    if (!ctx) return null;
    const osc = ctx.createOscillator();
    if (!this.a.claimVoice(osc)) return null;
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (freqEnd !== undefined)
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(gain, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(start);
    osc.stop(start + dur + 0.02);
    return osc;
  }

  private noise(
    dest: AudioNode,
    start: number,
    dur: number,
    gain: number,
    filter: BiquadFilterType,
    f0: number,
    f1: number,
    q = 1,
  ): void {
    const ctx = this.a.ctx;
    const buf = this.a.noiseBuffer;
    if (!ctx || !buf) return;
    const src = ctx.createBufferSource();
    if (!this.a.claimVoice(src)) return;
    src.buffer = buf;
    const bq = ctx.createBiquadFilter();
    bq.type = filter;
    bq.Q.value = q;
    bq.frequency.setValueAtTime(f0, start);
    bq.frequency.exponentialRampToValueAtTime(Math.max(20, f1), start + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(gain, start + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(bq);
    bq.connect(g);
    g.connect(dest);
    src.start(start, Math.random() * 0.5);
    src.stop(start + dur + 0.02);
  }

  /** Signature link note: sine plus a soft triangle an octave up. */
  link(index: number): void {
    const out = this.out();
    if (!out) return;
    const t = this.a.now;
    const f = pentatonic(index);
    this.tone(out, 'sine', f, t, 0.24, 0.22, 0.01);
    this.tone(out, 'triangle', f * 2, t, 0.12, 0.05, 0.01);
  }

  unlink(): void {
    const out = this.out();
    if (!out) return;
    this.tone(out, 'sine', 520, this.a.now, 0.09, 0.08, 0.005, 300);
  }

  snap(): void {
    const out = this.out();
    if (!out) return;
    const t = this.a.now;
    this.noise(out, t, 0.08, 0.18, 'highpass', 3000, 1500, 0.7);
    this.tone(out, 'square', 900, t, 0.05, 0.04, 0.002, 200);
  }

  /** Pop: a pitched pluck (replaying the chain's notes) plus a little filtered noise. */
  pop(index: number): void {
    const out = this.out();
    if (!out) return;
    const t = this.a.now;
    const f = pentatonic(index) * 2;
    this.tone(out, 'triangle', f, t, 0.16, 0.16, 0.003, f * 0.7);
    this.tone(out, 'sine', f * 0.5, t, 0.1, 0.08, 0.003);
    this.noise(out, t, 0.06, 0.07, 'bandpass', 2400, 900, 1.5);
  }

  /** Soft bubble pop for critters killed by effects. */
  softPop(): void {
    const out = this.out();
    if (!out) return;
    const t = this.a.now;
    const f = 500 + Math.random() * 300;
    this.tone(out, 'sine', f, t, 0.08, 0.07, 0.002, f * 1.8);
  }

  /** Final chord; richer for longer chains. */
  chord(length: number): void {
    const out = this.out();
    if (!out) return;
    const t = this.a.now + 0.02;
    const voicing = [0, 4, 7, 9, 12, 16, 19];
    const notes = Math.min(voicing.length, 2 + Math.floor(length / 2));
    const base = C4 / 2;
    for (let i = 0; i < notes; i++) {
      const f = base * Math.pow(2, voicing[i] / 12);
      this.tone(out, 'sine', f, t + i * 0.012, 0.9, 0.09, 0.02);
      if (i % 2 === 0) this.tone(out, 'triangle', f * 2, t + i * 0.012, 0.5, 0.025, 0.02);
    }
  }

  burst(): void {
    const out = this.out();
    if (!out) return;
    const t = this.a.now;
    this.tone(out, 'sine', 130, t, 0.22, 0.32, 0.004, 42);
    this.noise(out, t, 0.25, 0.1, 'lowpass', 2600, 300, 0.8);
  }

  /** Rising charge tone when a chain crosses an effect threshold. */
  charge(): void {
    const out = this.out();
    if (!out) return;
    const t = this.a.now;
    this.tone(out, 'sine', 330, t, 0.3, 0.1, 0.02, 990);
    this.tone(out, 'triangle', 495, t + 0.05, 0.28, 0.04, 0.02, 1485);
  }

  pearlHit(): void {
    const out = this.out();
    const ctx = this.a.ctx;
    if (!out || !ctx) return;
    const t = this.a.now;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    lp.connect(out);
    this.tone(lp, 'square', 92, t, 0.28, 0.22, 0.004, 55);
    this.tone(lp, 'square', 96, t, 0.28, 0.16, 0.004, 57);
  }

  /** A critter bumping the pearl while it is invulnerable. */
  bump(): void {
    const out = this.out();
    if (!out) return;
    this.tone(out, 'sine', 220, this.a.now, 0.1, 0.06, 0.004, 150);
  }

  emptyTap(): void {
    const out = this.out();
    if (!out) return;
    this.tone(out, 'sine', 880, this.a.now, 0.05, 0.025, 0.003, 700);
  }

  runOver(): void {
    const out = this.out();
    if (!out) return;
    const t = this.a.now;
    const motif = [16, 14, 12, 9];
    motif.forEach((st, i) => {
      this.tone(out, 'triangle', C4 * Math.pow(2, st / 12), t + i * 0.22, 0.5, 0.1, 0.02);
    });
  }

  crack(): void {
    const out = this.out();
    if (!out) return;
    const t = this.a.now;
    this.noise(out, t, 0.5, 0.22, 'bandpass', 4000, 600, 0.9);
    this.tone(out, 'sine', 1568, t, 0.7, 0.06, 0.005);
    this.tone(out, 'sine', 2093, t + 0.03, 0.6, 0.04, 0.005);
  }

  uiClick(): void {
    const out = this.out();
    if (!out) return;
    this.tone(out, 'sine', 1400, this.a.now, 0.03, 0.04, 0.002);
  }
}
