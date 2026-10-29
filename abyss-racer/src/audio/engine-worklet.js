// Engine synthesiser (AudioWorklet). A firing-pulse model of a piston engine:
//   crank phase -> per-cylinder combustion pulses (amplitude ~ load, cycle-to-cycle variation, uneven
//   cross-plane firing for V8s) -> exhaust pipe waveguide (feedback comb with loss) + muffler/body formants,
//   plus intake roar, valvetrain tick, gear whine, turbo whistle and over-run pops & crackles.
// Parameters arrive via port messages: {rpm, load, throttle, turbo, gain, cut}.

class Biquad {
  constructor() { this.b0 = 1; this.b1 = 0; this.b2 = 0; this.a1 = 0; this.a2 = 0; this.x1 = 0; this.x2 = 0; this.y1 = 0; this.y2 = 0; }
  bandpass(f, q, sr) {
    const w = 2 * Math.PI * Math.min(f, sr * 0.45) / sr, a = Math.sin(w) / (2 * q), c = Math.cos(w), n = 1 + a;
    this.b0 = a / n; this.b1 = 0; this.b2 = -a / n; this.a1 = -2 * c / n; this.a2 = (1 - a) / n;
  }
  lowpass(f, q, sr) {
    const w = 2 * Math.PI * Math.min(f, sr * 0.45) / sr, a = Math.sin(w) / (2 * q), c = Math.cos(w), n = 1 + a;
    this.b0 = (1 - c) / 2 / n; this.b1 = (1 - c) / n; this.b2 = (1 - c) / 2 / n; this.a1 = -2 * c / n; this.a2 = (1 - a) / n;
  }
  highpass(f, q, sr) {
    const w = 2 * Math.PI * Math.min(f, sr * 0.45) / sr, a = Math.sin(w) / (2 * q), c = Math.cos(w), n = 1 + a;
    this.b0 = (1 + c) / 2 / n; this.b1 = -(1 + c) / n; this.b2 = (1 + c) / 2 / n; this.a1 = -2 * c / n; this.a2 = (1 - a) / n;
  }
  run(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

const PRESETS = {
  // cylinders, firing offsets (fraction of the 720° cycle), pipe delay (ms), formants [f, q, gain], character
  v8cross: { cyl: 8, offsets: [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875], uneven: 0.045, pipe: 3.4, fb: 0.62,
    formants: [[115, 1.4, 1.0], [380, 2.5, 0.55], [1250, 3.0, 0.22], [2900, 4, 0.08]], intake: 0.18, rough: 0.16, turbo: 1, crackle: 1 },
  v12: { cyl: 12, offsets: [...Array(12).keys()].map((i) => i / 12), uneven: 0.0, pipe: 2.5, fb: 0.55,
    formants: [[170, 1.6, 0.8], [620, 2.8, 0.6], [1900, 3.5, 0.35], [4200, 5, 0.12]], intake: 0.28, rough: 0.06, turbo: 0, crackle: 0.5 },
  v10: { cyl: 10, offsets: [...Array(10).keys()].map((i) => i / 10), uneven: 0.012, pipe: 2.0, fb: 0.6,
    formants: [[210, 1.5, 0.7], [880, 2.6, 0.65], [2400, 3.2, 0.4], [5200, 5, 0.16]], intake: 0.32, rough: 0.09, turbo: 0, crackle: 1.2 },
};

class EngineProcessor extends AudioWorkletProcessor {
  constructor(opts) {
    super();
    const p = PRESETS[opts.processorOptions?.preset] || PRESETS.v8cross;
    this.p = p;
    this.sr = sampleRate;
    this.rpm = 900; this.load = 0; this.throttle = 0; this.turbo = 0; this.gain = 0; this.cut = 0;
    this.tRpm = 900; this.tLoad = 0; this.tGain = 0; this.tTurbo = 0;
    this.phase = 0;              // 0..1 over a full 4-stroke cycle (720°)
    this.nextIdx = 0;
    this.cylGain = p.offsets.map(() => 0.85 + Math.random() * 0.3);
    this.pulses = [];            // active combustion pulses {t, amp, len}
    this.pipeLen = Math.round(p.pipe * 1e-3 * this.sr);
    this.pipe = new Float32Array(4096); this.pw = 0; this.pipeLP = 0;
    this.formants = p.formants.map(([f, q, g]) => { const b = new Biquad(); b.bandpass(f, q, this.sr); return { b, g }; });
    this.intakeBP = new Biquad(); this.intakeBP.bandpass(900, 0.8, this.sr);
    this.hp = new Biquad(); this.hp.highpass(28, 0.7, this.sr);
    this.lowShelf = new Biquad(); this.lowShelf.lowpass(9000, 0.7, this.sr);
    this.turboPh = 0; this.whinePh = 0;
    this.pops = []; this.lastLoad = 0; this.overrun = 0;
    this.noiseLP = 0;
    this.port.onmessage = (e) => {
      const d = e.data;
      if (d.rpm != null) this.tRpm = d.rpm;
      if (d.load != null) this.tLoad = d.load;
      if (d.throttle != null) this.throttle = d.throttle;
      if (d.turbo != null) this.tTurbo = d.turbo;
      if (d.gain != null) this.tGain = d.gain;
      if (d.cut != null) this.cut = d.cut;
      if (d.pop) this.spawnPops(d.pop);
    };
  }

  spawnPops(n) {
    for (let i = 0; i < n; i++) this.pops.push({ t: -Math.floor(Math.random() * this.sr * 0.6), amp: 0.4 + Math.random() * 0.9, len: Math.floor(this.sr * (0.004 + Math.random() * 0.012)) });
  }

  process(_, outputs) {
    const out = outputs[0][0];
    if (!out) return true;
    const p = this.p, sr = this.sr, n = out.length;
    for (let i = 0; i < n; i++) {
      // parameter smoothing
      this.rpm += (this.tRpm - this.rpm) * 0.0016;
      this.load += (this.tLoad - this.load) * 0.004;
      this.gain += (this.tGain - this.gain) * 0.002;
      this.turbo += (this.tTurbo - this.turbo) * 0.0004;
      const rpm = Math.max(300, this.rpm);
      const cycleHz = rpm / 120;         // full 4-stroke cycles per second
      const prev = this.phase;
      this.phase += cycleHz / sr;
      if (this.phase >= 1) this.phase -= 1;
      // fire cylinders whose offset we crossed
      const offs = p.offsets;
      for (let c = 0; c < offs.length; c++) {
        let o = offs[c] + (c % 2 ? p.uneven : -p.uneven);
        o = (o + 1) % 1;
        const crossed = prev <= this.phase ? (o > prev && o <= this.phase) : (o > prev || o <= this.phase);
        if (crossed) {
          const ld = this.cut > 0 ? 0.05 : this.load;
          const varAmt = p.rough * (1.4 - ld) * (rpm < 1500 ? 1.8 : 1);
          let amp = this.cylGain[c] * (0.22 + ld * 0.95) * (1 + (Math.random() - 0.5) * 2 * varAmt);
          // misfire-ish lope at idle
          if (rpm < 1300 && Math.random() < 0.03) amp *= 0.3;
          const len = Math.max(8, Math.floor(sr * (0.0009 + 0.0022 * (1 - Math.min(1, rpm / 9000)))));
          this.pulses.push({ t: 0, amp, len });
        }
      }
      // combustion excitation
      let ex = 0;
      for (let k = this.pulses.length - 1; k >= 0; k--) {
        const pu = this.pulses[k];
        const x = pu.t / pu.len;
        // sharp pressure rise + noisy decay
        const env = x < 0.12 ? x / 0.12 : Math.exp(-(x - 0.12) * 4.2);
        ex += pu.amp * env * (0.75 + 0.5 * (Math.random() - 0.5)) ;
        pu.t++;
        if (pu.t > pu.len * 3) this.pulses.splice(k, 1);
      }
      // over-run pops & crackles
      let pop = 0;
      for (let k = this.pops.length - 1; k >= 0; k--) {
        const q = this.pops[k];
        q.t++;
        if (q.t < 0) continue;
        const x = q.t / q.len;
        pop += q.amp * Math.exp(-x * 3) * (Math.random() * 2 - 1) * (x < 1 ? 1 : 0.3);
        if (x > 4) this.pops.splice(k, 1);
      }
      ex += pop * 1.4;
      // exhaust pipe waveguide (comb with lossy feedback) -> standing-wave tone of the pipe
      const d = this.pipeLen;
      const rd = (this.pw - d + 4096) & 4095;
      this.pipeLP += (this.pipe[rd] - this.pipeLP) * 0.45;
      const pipeOut = ex + this.pipeLP * p.fb;
      this.pipe[this.pw] = pipeOut;
      this.pw = (this.pw + 1) & 4095;
      // muffler / body formants
      let y = 0;
      for (const f of this.formants) y += f.b.run(pipeOut) * f.g;
      y += pipeOut * 0.18;
      // intake roar: noise gated by the firing pulses, louder with load and revs
      const nz = Math.random() * 2 - 1;
      const intake = this.intakeBP.run(nz) * (0.1 + ex * 0.6) * p.intake * (0.3 + this.load) * Math.min(1.5, rpm / 4000);
      y += intake;
      // gear / supercharger whine and turbo whistle
      this.whinePh += (rpm / 60 * 3.1) / sr; if (this.whinePh > 1) this.whinePh -= 1;
      y += Math.sin(this.whinePh * 6.2832) * 0.012 * Math.min(1, rpm / 6000);
      if (p.turbo) {
        const tf = 1800 + this.turbo * 5200;
        this.turboPh += tf / sr; if (this.turboPh > 1) this.turboPh -= 1;
        this.noiseLP += (nz - this.noiseLP) * 0.3;
        y += (Math.sin(this.turboPh * 6.2832) * 0.035 + this.noiseLP * 0.02) * this.turbo * this.turbo;
      }
      // saturation for grit, DC/rumble filter, gentle top cut
      y = this.hp.run(y);
      y = Math.tanh(y * 1.6) * 0.8;
      y = this.lowShelf.run(y);
      out[i] = y * this.gain;
    }
    // over-run detection: sudden lift at high revs -> crackles
    if (this.lastLoad > 0.6 && this.tLoad < 0.15 && this.rpm > 4200 && p.crackle) this.spawnPops(Math.floor((2 + Math.random() * 6) * p.crackle));
    this.lastLoad = this.tLoad;
    for (let c = 1; c < outputs[0].length; c++) outputs[0][c].set(out);
    return true;
  }
}

registerProcessor('abyss-engine', EngineProcessor);
