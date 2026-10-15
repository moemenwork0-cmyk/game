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

  // ---------------------------------------------------------------------------
  // Jello's voice

  /** Cute babble: one short vowel-like blip per syllable, pitch wandering around a base. */
  babble(syllables: number, periodMs: number, pitch = 1): void {
    const a = this.a;
    if (!a.ready()) return;
    const ctx = a.ctx!;
    const base = 560 * pitch;
    let prev = 1;
    for (let k = 0; k < syllables; k++) {
      const t0 = ctx.currentTime + (k * periodMs) / 1000;
      // Gentle melody: random walk with a lift on the last syllable.
      prev = Math.min(1.35, Math.max(0.78, prev * (0.9 + Math.random() * 0.22)));
      const f = base * prev * (k === syllables - 1 ? 1.12 : 1);
      const dur = (periodMs / 1000) * 0.72;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f * 1.06, t0);
      osc.frequency.exponentialRampToValueAtTime(f * 0.94, t0 + dur);
      // Vowel-ish formant.
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 900 + Math.random() * 900;
      bp.Q.value = 1.2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.16, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(bp).connect(g).connect(a.sfx);
      const sine = ctx.createOscillator();
      sine.frequency.setValueAtTime(f, t0);
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.0001, t0);
      g2.gain.exponentialRampToValueAtTime(0.05, t0 + 0.012);
      g2.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      sine.connect(g2).connect(a.sfx);
      a.track(osc);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
      sine.start(t0);
      sine.stop(t0 + dur + 0.02);
    }
  }

  jello(kind: 'squish' | 'giggle' | 'jump' | 'land' | 'aww' | 'snore' | 'pop' | 'boing' | 'purr' | 'bubble' | 'hum' | 'yawn' | 'glasses' | 'catch' | 'stretch'): void {
    if (this.a.playFile(`jello-${kind}`)) return;
    switch (kind) {
      case 'squish':
        this.tone('sine', [320, 560, 240], 0.16, 0.2, 0.004, 0.06);
        this.noise(0.05, 900, 0.08, 0, 1.4);
        break;
      case 'giggle':
        [0, 1, 2, 3].forEach((k) => this.tone('triangle', [760 + k * 70, 690 + k * 70], 0.05, 0.08, 0.004, 0.04, 0.05 + k * 0.075, 18));
        break;
      case 'jump':
        this.tone('sine', [380, 820], 0.12, 0.08, 0.004, 0.05);
        break;
      case 'land':
        this.tone('sine', [210, 120], 0.08, 0.12, 0.003, 0.05);
        break;
      case 'aww':
        this.tone('triangle', [560, 470, 360], 0.5, 0.1, 0.02, 0.2, 0, 9);
        break;
      case 'snore':
        this.noise(0.6, 380, 0.05, 0, 2, 220, 'lowpass');
        break;
      case 'pop':
        this.tone('sine', [300, 900], 0.09, 0.12, 0.003, 0.08);
        break;
      case 'boing':
        this.tone('sine', [180, 520, 260, 420, 300], 0.42, 0.18, 0.004, 0.12, 0, 22);
        this.tone('triangle', [360, 900], 0.12, 0.06, 0.004, 0.08);
        break;
      case 'purr':
        this.tone('sine', [140, 150, 138, 152], 0.7, 0.09, 0.05, 0.2, 0, 14);
        this.noise(0.7, 260, 0.05, 0, 3, 200, 'lowpass');
        break;
      case 'bubble':
        this.tone('sine', [500, 1200], 0.18, 0.07, 0.01, 0.08, 0, 30);
        break;
      case 'hum':
        [0, 4, 7, 4, 9].forEach((n, k) => this.tone('sine', [523.25 * Math.pow(2, n / 12)], 0.2, 0.055, 0.02, 0.12, k * 0.24, 6));
        break;
      case 'yawn':
        this.tone('triangle', [420, 640, 300], 0.9, 0.08, 0.08, 0.3, 0, 7);
        break;
      case 'catch':
        this.tone('sine', [260, 640], 0.1, 0.16, 0.003, 0.06);
        this.tone('triangle', [900, 1300], 0.07, 0.07, 0.003, 0.08, 0.06);
        break;
      case 'stretch':
        this.tone('sine', [300, 700], 0.22, 0.09, 0.01, 0.08, 0, 12);
        break;
      case 'glasses':
        this.tone('sine', [1400, 1900], 0.06, 0.08, 0.002, 0.08);
        this.tone('sine', [2100], 0.12, 0.06, 0.002, 0.2, 0.08);
        break;
    }
  }
}
