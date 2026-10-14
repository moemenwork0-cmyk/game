/** Synthesized sound recipes (spec 10). Each checks for a file override first. */
import type { AudioEngine } from './audio';

type Wave = OscillatorType;

/** Major pentatonic steps (semitones) for the clear sequence. */
const PENTA = [0, 2, 4, 7, 9];

export class Sfx {
  constructor(private readonly a: AudioEngine) {}

  private tone(
    type: Wave,
    freqs: number[],
    dur: number,
    gain: number,
    attack = 0.004,
    release = 0.08,
    when = 0,
    vibrato = 0,
  ): void {
    const a = this.a;
    if (!a.ready()) return;
    const ctx = a.ctx!;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freqs[0], t0);
    const seg = dur / Math.max(1, freqs.length - 1);
    for (let k = 1; k < freqs.length; k++) osc.frequency.exponentialRampToValueAtTime(freqs[k], t0 + seg * k);
    if (vibrato > 0) {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = 6;
      lg.gain.value = vibrato;
      lfo.connect(lg).connect(osc.frequency);
      lfo.start(t0);
      lfo.stop(t0 + dur + release);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.setValueAtTime(gain, t0 + Math.max(attack, dur - 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + release);
    osc.connect(g).connect(a.sfx);
    a.track(osc);
    osc.start(t0);
    osc.stop(t0 + dur + release + 0.02);
  }

  private noise(dur: number, freq: number, gain: number, when = 0, q = 1, sweepTo = 0, type: BiquadFilterType = 'bandpass'): void {
    const a = this.a;
    if (!a.ready()) return;
    const ctx = a.ctx!;
    const t0 = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = a.noise();
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t0);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(a.sfx);
    a.track(src);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  pick(): void {
    if (this.a.playFile('pick')) return;
    this.tone('sine', [600, 780], 0.06, 0.15, 0.004, 0.08);
  }

  drop(): void {
    const r = 1 + (Math.random() * 2 - 1) * 0.05;
    if (this.a.playFile('drop', r)) return;
    this.tone('sine', [420 * r, 220 * r], 0.09, 0.3, 0.003, 0.07);
    this.noise(0.005, 2400, 0.25, 0, 0.8);
  }

  boing(): void {
    if (this.a.playFile('boing')) return;
    this.tone('triangle', [300, 380, 260], 0.16, 0.12, 0.006, 0.06);
  }

  /** Per-cell pluck climbing a major pentatonic scale along the clear sequence. */
  pop(seq: number): void {
    const step = PENTA[seq % 5] + 12 * Math.floor(seq / 5);
    const f = 523.25 * Math.pow(2, Math.min(step, 26) / 12);
    if (this.a.playFile('pop', f / 523.25, 0.6)) return;
    this.tone('triangle', [f, f * 0.995], 0.07, 0.12, 0.002, 0.06);
    this.tone('sine', [f * 2], 0.05, 0.05, 0.002, 0.05);
  }

  /** 2 lines = major triad, 3 = add 7th, 4+ = add 9th + shimmer. */
  chord(lines: number): void {
    if (lines < 2) return;
    if (this.a.playFile(`clear${Math.min(lines, 4)}`)) return;
    const root = 392; // G4
    const notes = [0, 4, 7];
    if (lines >= 3) notes.push(11);
    if (lines >= 4) notes.push(14);
    notes.forEach((n, k) => {
      const f = root * Math.pow(2, n / 12);
      this.tone('triangle', [f], 0.32, 0.075, 0.01, 0.35, k * 0.018);
      this.tone('sine', [f * 2], 0.25, 0.03, 0.01, 0.3, k * 0.018);
    });
    if (lines >= 4) {
      [24, 28, 31, 36, 40].forEach((n, k) => this.tone('sine', [root * Math.pow(2, n / 12)], 0.06, 0.035, 0.003, 0.12, 0.08 + k * 0.045));
    }
  }

  /** Rising ding, +1 semitone per combo step. */
  combo(step: number): void {
    const f = 880 * Math.pow(2, Math.min(step, 24) / 12);
    if (this.a.playFile('combo', f / 880)) return;
    this.tone('sine', [f], 0.18, 0.14, 0.004, 0.25, 0, f * 0.012);
    this.tone('sine', [f * 1.5], 0.12, 0.04, 0.004, 0.15, 0.01);
  }

  gameOver(): void {
    if (this.a.playFile('gameover')) return;
    [392, 330, 262].forEach((f, k) => this.tone('triangle', [f, f * 0.985], 0.22, 0.12, 0.01, 0.25, k * 0.2));
  }

  click(): void {
    if (this.a.playFile('click')) return;
    this.noise(0.002 + 0.01, 3500, 0.2, 0, 1.2);
  }

  perfect(): void {
    if (this.a.playFile('perfect')) return;
    [0, 4, 7, 12, 16, 19].forEach((n, k) => this.tone('triangle', [523.25 * Math.pow(2, n / 12)], 0.12, 0.1, 0.004, 0.2, k * 0.07));
    this.noise(0.6, 6000, 0.05, 0.3, 0.7, 12000, 'highpass');
  }
}
