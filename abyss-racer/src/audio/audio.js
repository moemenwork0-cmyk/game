// Audio engine: buses + glue compressor + underwater convolution reverb, synthesised engine voices
// (player + nearest rivals, spatialised with doppler), tyres, road / water rush, scraping, boost jet,
// modal-synthesis impact library (metal crunch, glass, debris, sand, wood), ambience (drone, bubbles,
// whale song, sonar), UI and countdown, and a small generative score.
import workletUrl from './engine-worklet.js?url';

const PRESET_FOR = { marlin: 'v8cross', orca: 'v12', barracuda: 'v10' };

function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

export class AudioEngine {
  constructor(settings) {
    this.s = settings;
    this.ready = false;
    this.voices = [];
    this.impactBank = {};
    this.lastImpact = 0;
  }

  async unlock() {
    if (this.ctx) { if (this.ctx.state !== 'running') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC({ latencyHint: 'interactive' });
    const sr = ctx.sampleRate;
    // ---- bus graph ----
    this.master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.18;
    this.masterLP = ctx.createBiquadFilter(); this.masterLP.type = 'lowpass'; this.masterLP.frequency.value = 20000;
    this.master.connect(this.masterLP).connect(comp).connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.connect(this.master);
    this.music = ctx.createGain(); this.music.connect(this.master);
    this.amb = ctx.createGain(); this.amb.connect(this.master);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.makeIR(3.2, sr);
    this.reverbIn = ctx.createGain(); this.reverbIn.gain.value = 1;
    const revOut = ctx.createGain(); revOut.gain.value = 0.55;
    this.reverbIn.connect(this.reverb).connect(revOut).connect(this.master);
    this.setVolume(this.s.volume, this.s.music);
    this.noiseBuf = this.makeNoise(2, sr);
    this.buildImpacts(sr);
    try {
      await ctx.audioWorklet.addModule(workletUrl);
      this.worklet = true;
    } catch (e) { this.worklet = false; }
    this.buildLoops();
    this.startAmbience();
    this.ready = true;
    if (this.unlockPendingRace && this.game) { this.unlockPendingRace = false; this.startRace(this.game); }
    else if (this.pendingMenu !== false) this.menuMusic(true);
  }

  setVolume(v, m) {
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
    this.music.gain.setTargetAtTime(m * 0.55, this.ctx.currentTime, 0.05);
  }
  suspend() { this.ctx?.suspend(); }
  resume() { this.ctx?.resume(); }
  pause(on) {
    if (!this.ctx) return;
    this.sfx.gain.setTargetAtTime(on ? 0 : 1, this.ctx.currentTime, 0.05);
    this.masterLP.frequency.setTargetAtTime(on ? 900 : 20000, this.ctx.currentTime, 0.08);
  }
  slowMo(on) {
    if (!this.ctx) return;
    this.slow = on;
    this.masterLP.frequency.setTargetAtTime(on ? 1400 : 20000, this.ctx.currentTime, on ? 0.03 : 0.3);
    this.reverbIn.gain.setTargetAtTime(on ? 2.5 : 1, this.ctx.currentTime, 0.1);
  }

  makeNoise(sec, sr) {
    const b = this.ctx.createBuffer(1, sr * sec, sr), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  /** Underwater-ish room: dense, dark, long tail with slow modulation. */
  makeIR(sec, sr) {
    const len = Math.floor(sr * sec), b = this.ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 2.1) * (t < 0.01 ? t / 0.01 : 1);
        const k = 0.08 + 0.5 * Math.exp(-t * 1.5);   // darker as it decays
        lp += ((Math.random() * 2 - 1) - lp) * k;
        d[i] = lp * env * 0.9;
      }
    }
    return b;
  }

  // ------------------------------------------------------------ impact library
  buildImpacts(sr) {
    const mk = (sec, fn) => {
      const b = this.ctx.createBuffer(1, Math.floor(sr * sec), sr);
      fn(b.getChannelData(0), sr);
      // normalise
      const d = b.getChannelData(0); let m = 0; for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i]));
      for (let i = 0; i < d.length; i++) d[i] /= m || 1;
      return b;
    };
    const modal = (d, sr, r, modes, decayScale = 1, start = 0, amp = 1) => {
      for (let m = 0; m < modes.length; m++) {
        const [f0, dec, a] = modes[m];
        const ph = r() * 6.28;
        for (let i = start; i < d.length; i++) {
          const t = (i - start) / sr;
          const e = Math.exp(-t / (dec * decayScale));
          if (e < 1e-4) break;
          const f = f0 * (1 - 0.06 * (1 - Math.exp(-t * 8)));   // slight pitch sag as metal bends
          d[i] += Math.sin(ph + 2 * Math.PI * f * t) * e * a * amp;
        }
      }
    };
    const noiseBurst = (d, sr, r, start, dur, amp, lpK = 0.5) => {
      let lp = 0;
      const n = Math.floor(dur * sr);
      for (let i = 0; i < n && start + i < d.length; i++) {
        lp += ((r() * 2 - 1) - lp) * lpK;
        d[start + i] += lp * amp * Math.exp(-i / (n * 0.3));
      }
    };
    const thump = (d, sr, f0, f1, dec, amp) => {
      let ph = 0;
      for (let i = 0; i < d.length; i++) {
        const t = i / sr;
        const f = f1 + (f0 - f1) * Math.exp(-t * 18);
        ph += 2 * Math.PI * f / sr;
        const e = Math.exp(-t / dec);
        if (e < 1e-4) break;
        d[i] += Math.sin(ph) * e * amp * Math.min(1, t * 400);
      }
    };
    const metal = (seed, sec, heavy) => mk(sec, (d, sr) => {
      const r = rng(seed);
      thump(d, sr, heavy ? 140 : 190, heavy ? 42 : 60, heavy ? 0.22 : 0.12, heavy ? 1.6 : 0.9);
      noiseBurst(d, sr, r, 0, 0.03, 1.4, 0.9);
      const modes = [];
      for (let i = 0; i < 16; i++) modes.push([180 + r() * r() * 4200, 0.04 + r() * (heavy ? 0.5 : 0.3), 0.15 + r() * 0.5]);
      modal(d, sr, r, modes, 1, 0, 0.35);
      // crumple: a cloud of micro-impacts over the first few hundred ms
      const grains = heavy ? 70 : 30;
      for (let g = 0; g < grains; g++) {
        const st = Math.floor(sr * (r() ** 2) * (heavy ? 0.45 : 0.25));
        noiseBurst(d, sr, r, st, 0.003 + r() * 0.012, 0.5 * (1 - st / (sr * 0.5)), 0.6 + r() * 0.4);
      }
      // rattling debris tail
      for (let g = 0; g < (heavy ? 18 : 6); g++) {
        const st = Math.floor(sr * (0.15 + r() * (sec - 0.3)));
        modal(d, sr, r, [[1200 + r() * 4000, 0.02 + r() * 0.05, 1]], 1, st, 0.12 * (1 - st / d.length));
      }
    });
    const glass = (seed) => mk(1.2, (d, sr) => {
      const r = rng(seed);
      noiseBurst(d, sr, r, 0, 0.02, 1, 0.95);
      for (let g = 0; g < 90; g++) {
        const st = Math.floor(sr * (r() ** 1.6) * 0.9);
        modal(d, sr, r, [[2500 + r() * 7000, 0.01 + r() * 0.04, 1]], 1, st, 0.35 * (1 - st / d.length));
      }
    });
    const sand = (seed) => mk(0.8, (d, sr) => {
      const r = rng(seed);
      thump(d, sr, 110, 38, 0.18, 1.5);
      noiseBurst(d, sr, r, 0, 0.35, 0.6, 0.05);
      for (let g = 0; g < 40; g++) noiseBurst(d, sr, r, Math.floor(sr * r() * 0.5), 0.004, 0.15, 0.3);
    });
    const wood = (seed) => mk(0.7, (d, sr) => {
      const r = rng(seed);
      thump(d, sr, 160, 70, 0.08, 0.8);
      noiseBurst(d, sr, r, 0, 0.02, 0.8, 0.7);
      const modes = [];
      for (let i = 0; i < 8; i++) modes.push([220 + r() * 900, 0.02 + r() * 0.08, 0.3 + r() * 0.6]);
      modal(d, sr, r, modes, 1, 0, 0.5);
    });
    const shift = () => mk(0.12, (d, sr) => {
      const r = rng(5);
      thump(d, sr, 180, 90, 0.025, 0.7);
      noiseBurst(d, sr, r, 0, 0.012, 0.6, 0.8);
      modal(d, sr, r, [[1800, 0.02, 0.4], [3100, 0.015, 0.3]], 1, 0, 0.4);
    });
    const blowoff = () => mk(0.7, (d, sr) => {
      let lp = 0, bp1 = 0, bp2 = 0;
      for (let i = 0; i < d.length; i++) {
        const t = i / sr;
        const f = 3500 * Math.exp(-t * 3) + 600;
        const k = Math.min(0.99, 2 * Math.PI * f / sr);
        lp += ((Math.random() * 2 - 1) - lp) * k;
        bp1 += (lp - bp1) * 0.5; bp2 = lp - bp1;
        d[i] = bp2 * Math.exp(-t * 5) * Math.min(1, t * 200);
      }
    });
    this.impactBank = {
      metalS: [metal(1, 0.9, false), metal(2, 0.9, false), metal(3, 0.9, false)],
      metalH: [metal(11, 1.8, true), metal(12, 1.8, true), metal(13, 1.8, true)],
      glass: [glass(21), glass(22)],
      sand: [sand(31), sand(32)],
      wood: [wood(41), wood(42)],
      shift: shift(),
      blowoff: blowoff(),
    };
  }

  play(buf, { gain = 1, rate = 1, pos = null, reverb = 0.3, bus = this.sfx, lp = 0 } = {}) {
    if (!this.ready) return null;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate * (this.slow ? 0.5 : 1);
    const g = ctx.createGain(); g.gain.value = gain;
    let node = src;
    if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; node.connect(f); node = f; }
    node.connect(g);
    if (pos && this.listener) {
      const p = ctx.createPanner();
      p.panningModel = 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = 6; p.rolloffFactor = 1.1; p.maxDistance = 400;
      p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z;
      g.connect(p); p.connect(bus);
      if (reverb) { const r = ctx.createGain(); r.gain.value = reverb; p.connect(r); r.connect(this.reverbIn); }
    } else {
      g.connect(bus);
      if (reverb) { const r = ctx.createGain(); r.gain.value = reverb; g.connect(r); r.connect(this.reverbIn); }
    }
    src.start();
    return src;
  }

  impact(strength, pos, type = 'wall', near = true) {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    if (now - this.lastImpact < 0.045 && strength < 0.6) return;
    this.lastImpact = now;
    const B = this.impactBank;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const p = near ? null : pos;
    const g = 0.25 + strength * 1.1;
    if (type === 'sand' || type === 'land') {
      this.play(pick(B.sand), { gain: g * 1.2, rate: 0.85 + Math.random() * 0.3, pos: p, reverb: 0.35 });
      if (type === 'land' && strength > 0.4) this.play(pick(B.metalS), { gain: g * 0.5, rate: 0.7, pos: p, reverb: 0.3 });
      return;
    }
    if (type === 'prop') { this.play(pick(B.wood), { gain: g, rate: 0.8 + Math.random() * 0.4, pos: p, reverb: 0.4 }); return; }
    const heavy = strength > 0.35 || type === 'wreck';
    this.play(pick(heavy ? B.metalH : B.metalS), { gain: g, rate: 0.85 + Math.random() * 0.3 - strength * 0.15, pos: p, reverb: 0.25 + strength * 0.4 });
    if (strength > 0.55 || type === 'wreck' || type === 'part') this.play(pick(B.glass), { gain: g * 0.55, rate: 0.9 + Math.random() * 0.2, pos: p, reverb: 0.3 });
    if (type === 'wreck') this.play(pick(B.metalH), { gain: 1.3, rate: 0.6, pos: p, reverb: 0.8 });
  }

  // ------------------------------------------------------------ continuous loops
  loopNoise(type, freq, q, gain = 0) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = gain;
    src.connect(f).connect(g).connect(this.sfx);
    src.start(0, Math.random() * 1.5);
    return { src, f, g };
  }

  buildLoops() {
    this.tire = this.loopNoise('bandpass', 1100, 7);
    this.tire2 = this.loopNoise('bandpass', 2300, 9);
    this.road = this.loopNoise('lowpass', 220, 0.8);
    this.rush = this.loopNoise('bandpass', 700, 0.6);
    this.gravel = this.loopNoise('bandpass', 420, 1.2);
    this.scrape = this.loopNoise('bandpass', 2600, 4);
    this.jet = this.loopNoise('lowpass', 900, 1.5);
    // scrape and tyres also feed the reverb a little
    for (const l of [this.tire, this.scrape, this.jet]) { const r = this.ctx.createGain(); r.gain.value = 0.25; l.g.connect(r).connect(this.reverbIn); }
  }

  makeEngineVoice(preset) {
    const ctx = this.ctx;
    let node, set;
    if (this.worklet) {
      node = new AudioWorkletNode(ctx, 'abyss-engine', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1], processorOptions: { preset } });
      set = (m) => node.port.postMessage(m);
    } else {
      // fallback: two sawtooth oscillators through a formant filter
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(); o1.type = 'sawtooth'; o2.type = 'square';
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1200; f.Q.value = 3;
      const g = ctx.createGain(); g.gain.value = 0;
      o1.connect(f); o2.connect(f); f.connect(g); o1.start(); o2.start();
      node = g;
      set = (m) => {
        if (m.rpm != null) { const hz = m.rpm / 60 * 4; o1.frequency.setTargetAtTime(hz, ctx.currentTime, 0.03); o2.frequency.setTargetAtTime(hz * 0.5, ctx.currentTime, 0.03); f.frequency.setTargetAtTime(600 + (m.load ?? 0) * 2400, ctx.currentTime, 0.05); }
        if (m.gain != null) g.gain.setTargetAtTime(m.gain * 0.25, ctx.currentTime, 0.05);
      };
    }
    const out = ctx.createGain(); out.gain.value = 1;
    node.connect(out);
    return { node, out, set, preset };
  }

  startRace(game) {
    this.game = game;
    this.pendingMenu = false;
    if (!this.ready) { this.unlockPendingRace = true; }
    this.menuMusic(false);
    this.disposeVoices();
    if (!this.ready) return;
    const ctx = this.ctx;
    // player engine: dry + a little reverb (it is "in the cabin": not underwater-filtered)
    const pv = game.player;
    this.player = this.makeEngineVoice(PRESET_FOR[pv.id]);
    this.player.out.gain.value = 1;
    this.player.out.connect(this.sfx);
    const r = ctx.createGain(); r.gain.value = 0.18; this.player.out.connect(r).connect(this.reverbIn);
    // rival voices: a pool of 3 spatialised, underwater-filtered engines
    this.rivals = [];
    for (let i = 0; i < 3; i++) {
      const id = ['marlin', 'orca', 'barracuda'][i];
      const v = this.makeEngineVoice(PRESET_FOR[id]);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
      const p = ctx.createPanner(); p.panningModel = 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = 7; p.rolloffFactor = 1.3; p.maxDistance = 300;
      v.out.connect(lp).connect(p).connect(this.sfx);
      const rv = ctx.createGain(); rv.gain.value = 0.35; p.connect(rv).connect(this.reverbIn);
      v.panner = p; v.preset = PRESET_FOR[id]; v.car = null;
      this.rivals.push(v);
    }
    this.listener = ctx.listener;
    this.raceMusic(true);
  }

  disposeVoices() {
    for (const v of [this.player, ...(this.rivals || [])]) { if (v) { v.set({ gain: 0 }); setTimeout(() => { try { v.out.disconnect(); v.node.disconnect(); } catch (_) { /* ignore */ } }, 300); } }
    this.player = null; this.rivals = [];
  }

  toMenu() {
    this.disposeVoices();
    if (!this.ready) return;
    for (const l of [this.tire, this.tire2, this.road, this.rush, this.gravel, this.scrape, this.jet]) l.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
    this.raceMusic(false);
    this.menuMusic(true);
  }

  update(dt, game) {
    if (!this.ready || !this.player || !game.player) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const cam = game.camera;
    // listener at the camera
    const L = ctx.listener, f = cam.getWorldDirection(this._dir || (this._dir = cam.position.clone()));
    if (L.positionX) {
      L.positionX.value = cam.position.x; L.positionY.value = cam.position.y; L.positionZ.value = cam.position.z;
      L.forwardX.value = f.x; L.forwardY.value = f.y; L.forwardZ.value = f.z; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
    }
    const slow = game.timeScale < 1 ? 0.55 : 1;
    const v = game.player.v;
    // ---- player engine ----
    let load = v.throttle * (v.revCut ? 0.2 : 1);
    if (v.shiftT > 0) load = 0.05;
    const gridRev = game.race?.state === 'countdown' ? game.input.throttle : 0;
    const rpm = (gridRev > 0 ? v.spec.idle + gridRev * (v.spec.redline - v.spec.idle) * 0.85 : v.rpm) * slow;
    this.player.set({ rpm, load: Math.max(load, gridRev), gain: v.engineOn && !v.wrecked ? 0.62 : 0, turbo: Math.min(1, load * v.rpm / 6000), cut: v.revCut ? 1 : 0 });
    if (v.revCut && Math.random() < 0.15) this.player.set({ pop: 1 });
    while (v.shiftEvents.length) {
      const e = v.shiftEvents.shift();
      this.play(this.impactBank.shift, { gain: 0.45, rate: e === 'up' ? 1 : 0.8, reverb: 0.1 });
      if (e === 'up' && this.player.preset === 'v8cross' && v.throttle > 0.7) this.play(this.impactBank.blowoff, { gain: 0.3, rate: 1, reverb: 0.2 });
      if (e === 'up') this.player.set({ pop: 2 });
    }
    // lift-off blow-off valve
    if (this.player.preset === 'v8cross' && this.prevThr > 0.8 && v.throttle < 0.2 && v.rpm > 4000) this.play(this.impactBank.blowoff, { gain: 0.45, reverb: 0.25 });
    this.prevThr = v.throttle;
    // ---- tyres / surfaces ----
    let slip = 0, loose = 0, ground = 0;
    for (const w of v.wheels) {
      if (!w.contact) continue;
      ground++;
      const isLoose = w.surf === 2 || w.surf === 1;
      if (isLoose) loose += 1; else slip = Math.max(slip, w.slipVel);
    }
    const spd = v.speed;
    const sq = ground ? Math.max(0, Math.min(1, (slip - 3) / 12)) : 0;
    this.tire.g.gain.setTargetAtTime(sq * 0.55, t, 0.04);
    this.tire.f.frequency.setTargetAtTime((900 + sq * 600 + Math.sin(t * 13) * 60) * slow, t, 0.05);
    this.tire2.g.gain.setTargetAtTime(sq * sq * 0.3, t, 0.05);
    this.tire2.f.frequency.setTargetAtTime((2100 + sq * 500 + Math.sin(t * 9) * 120) * slow, t, 0.05);
    this.road.g.gain.setTargetAtTime(ground ? Math.min(0.5, spd / 70) * (loose ? 1.4 : 0.8) : 0, t, 0.08);
    this.gravel.g.gain.setTargetAtTime(ground ? Math.min(0.5, spd / 40) * (loose / 4) : 0, t, 0.06);
    this.rush.g.gain.setTargetAtTime(Math.min(0.42, (spd / 80) ** 2 * 0.42) + (v.airborne > 0 ? 0.08 : 0), t, 0.1);
    this.rush.f.frequency.setTargetAtTime((380 + spd * 12) * slow, t, 0.1);
    this.scrape.g.gain.setTargetAtTime(Math.min(0.7, (v.scrapeLevel || 0) * 0.7), t, 0.03);
    this.scrape.f.frequency.setTargetAtTime(1800 + Math.random() * 2400, t, 0.02);
    this.jet.g.gain.setTargetAtTime(v.boost ? 0.55 : 0, t, v.boost ? 0.05 : 0.25);
    this.jet.f.frequency.setTargetAtTime(v.boost ? 1400 : 400, t, 0.3);
    // ---- rival engines: assign the pool to the nearest rivals ----
    const others = game.race.entrants.filter((e) => !e.isPlayer).map((e) => ({ e, d: e.v.pos.distanceTo(cam.position) })).sort((a, b) => a.d - b.d).slice(0, this.rivals.length);
    this.rivals.forEach((voice, i) => {
      const o = others[i];
      if (!o || o.d > 160) { voice.set({ gain: 0 }); return; }
      const c = o.e.v;
      voice.panner.positionX.setTargetAtTime(c.pos.x, t, 0.02); voice.panner.positionY.setTargetAtTime(c.pos.y, t, 0.02); voice.panner.positionZ.setTargetAtTime(c.pos.z, t, 0.02);
      // doppler from relative radial speed
      const rel = c.pos.clone().sub(cam.position); const dist = rel.length() || 1; rel.multiplyScalar(1 / dist);
      const vr = c.linvel.clone().sub(v.linvel).dot(rel);
      const dop = Math.max(0.7, Math.min(1.4, 343 / (343 + vr)));
      voice.set({ rpm: c.rpm * dop * slow, load: c.throttle, gain: c.engineOn && !c.wrecked ? 0.5 : 0, turbo: c.throttle });
    });
  }

  // ------------------------------------------------------------ ambience & UI
  startAmbience() {
    const ctx = this.ctx;
    // deep drone: two slowly breathing filtered noise beds + sub hum
    const a = this.loopNoise('lowpass', 120, 0.9, 0); a.g.disconnect(); a.g.connect(this.amb); a.g.gain.value = 0.35;
    const b = this.loopNoise('bandpass', 340, 0.7, 0); b.g.disconnect(); b.g.connect(this.amb); b.g.gain.value = 0.07;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = 60; lfo.connect(lg).connect(a.f.frequency); lfo.start();
    const hum = ctx.createOscillator(); hum.frequency.value = 41; const hg = ctx.createGain(); hg.gain.value = 0.05; hum.connect(hg).connect(this.amb); hum.start();
    this.amb.gain.value = 0.7;
    // occasional bubbles, whale song, sonar
    const tick = () => {
      if (!this.ctx) return;
      const r = Math.random();
      if (r < 0.55) this.bubbleBurst(1 + Math.floor(Math.random() * 6));
      else if (r < 0.7) this.whale();
      else if (r < 0.78) this.sonar();
      setTimeout(tick, 2500 + Math.random() * 6000);
    };
    setTimeout(tick, 3000);
  }

  bubbleBurst(n) {
    const ctx = this.ctx, t0 = ctx.currentTime;
    for (let i = 0; i < n; i++) {
      const t = t0 + Math.random() * 0.6;
      const o = ctx.createOscillator(), g = ctx.createGain();
      const f = 300 + Math.random() * 900;
      o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 2.4, t + 0.05);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      o.connect(g).connect(this.amb); const r = ctx.createGain(); r.gain.value = 0.6; g.connect(r).connect(this.reverbIn);
      o.start(t); o.stop(t + 0.1);
    }
  }

  whale() {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 700; f1.Q.value = 5;
    const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 1200;
    const g = ctx.createGain();
    const base = 140 + Math.random() * 120, dur = 2.5 + Math.random() * 2;
    o.frequency.setValueAtTime(base, t);
    o.frequency.exponentialRampToValueAtTime(base * (1.8 + Math.random()), t + dur * 0.45);
    o.frequency.exponentialRampToValueAtTime(base * 0.8, t + dur);
    f1.frequency.setValueAtTime(500, t); f1.frequency.linearRampToValueAtTime(1100, t + dur * 0.5); f1.frequency.linearRampToValueAtTime(600, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09, t + 0.6); g.gain.linearRampToValueAtTime(0.0, t + dur);
    o.connect(f1).connect(f2).connect(g);
    g.connect(this.amb); const r = ctx.createGain(); r.gain.value = 1.6; g.connect(r).connect(this.reverbIn);
    o.start(t); o.stop(t + dur + 0.1);
  }

  sonar() {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.frequency.value = 1180;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    o.connect(g); g.connect(this.amb); const r = ctx.createGain(); r.gain.value = 2.0; g.connect(r).connect(this.reverbIn);
    o.start(t); o.stop(t + 1.3);
  }

  ui(kind) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(1500, t); o.frequency.exponentialRampToValueAtTime(700, t + 0.05);
    g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(g).connect(this.sfx); o.start(t); o.stop(t + 0.08);
  }

  beep(kind) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const f = kind === 2 ? 1320 : kind === 3 ? 990 : kind === 4 ? 1568 : 660;
    const dur = kind === 2 ? 0.7 : kind === 4 ? 1.2 : 0.25;
    for (const mul of [1, 2.01]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f * mul;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(mul === 1 ? 0.22 : 0.06, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.sfx); const r = ctx.createGain(); r.gain.value = 0.4; g.connect(r).connect(this.reverbIn);
      o.start(t); o.stop(t + dur + 0.05);
    }
  }

  // ------------------------------------------------------------ generative score
  menuMusic(on) {
    if (!this.ready) { this.pendingMenu = on; return; }
    if (this.menuSeq) { clearInterval(this.menuSeq); this.menuSeq = null; }
    if (!on) return;
    const ctx = this.ctx;
    const chords = [[57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 67], [52, 55, 59, 64]];   // Am7 Fmaj7 G Em
    let i = 0;
    const play = () => {
      const t = ctx.currentTime;
      const ch = chords[i++ % chords.length];
      ch.forEach((n, j) => this.pad(440 * 2 ** ((n - 69) / 12), t + j * 0.04, 7.5, 0.05));
      this.pad(440 * 2 ** ((ch[0] - 12 - 69) / 12), t, 7.5, 0.07, 'sine');
      // a few slow arpeggio notes
      for (let k = 0; k < 4; k++) this.pluck(440 * 2 ** ((ch[(k * 2) % 4] + 12 - 69) / 12), t + 1 + k * 1.6, 0.04);
    };
    play();
    this.menuSeq = setInterval(play, 7000);
  }

  raceMusic(on) {
    if (this.raceSeq) { clearInterval(this.raceSeq); this.raceSeq = null; }
    if (!on || !this.ready) return;
    const ctx = this.ctx;
    const bpm = 124, step = 60 / bpm / 4;
    const bass = [45, 45, 57, 45, 45, 57, 45, 48, 41, 41, 53, 41, 43, 43, 55, 47];
    let n = 0, next = ctx.currentTime + 0.1;
    this.raceSeq = setInterval(() => {
      while (next < ctx.currentTime + 0.25) {
        const s = n % 64, bar = Math.floor(n / 16) % 4;
        const note = bass[(s % 16)] + (bar === 2 ? -4 : bar === 3 ? -2 : 0);
        if (s % 2 === 0) this.bassNote(440 * 2 ** ((note - 69) / 12), next, step * 1.6);
        if (s % 4 === 0) this.kick(next);
        if (s % 8 === 4) this.snareish(next);
        if (s % 2 === 1) this.hat(next);
        n++; next += step;
      }
    }, 100);
  }

  pad(freq, t, dur, amp, type = 'sawtooth') {
    const ctx = this.ctx;
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(); o1.type = o2.type = type;
    o1.frequency.value = freq; o2.frequency.value = freq * 1.004;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 0.5;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp, t + 2.2); g.gain.linearRampToValueAtTime(0, t + dur);
    o1.connect(f); o2.connect(f); f.connect(g).connect(this.music);
    const r = ctx.createGain(); r.gain.value = 0.8; g.connect(r).connect(this.reverbIn);
    o1.start(t); o2.start(t); o1.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
  }
  pluck(freq, t, amp) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = freq;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.5);
    o.connect(g).connect(this.music); const r = ctx.createGain(); r.gain.value = 1.2; g.connect(r).connect(this.reverbIn);
    o.start(t); o.stop(t + 2.6);
  }
  bassNote(freq, t, dur) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 6;
    f.frequency.setValueAtTime(1400, t); f.frequency.exponentialRampToValueAtTime(180, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0, t); g.gain.linearRampToValueAtTime(0.09, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(this.music); o.start(t); o.stop(t + dur + 0.02);
  }
  kick(t) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.32, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g).connect(this.music); o.start(t); o.stop(t + 0.32);
  }
  snareish(t) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.8;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    s.connect(f).connect(g).connect(this.music); const r = ctx.createGain(); r.gain.value = 0.7; g.connect(r).connect(this.reverbIn);
    s.start(t, Math.random()); s.stop(t + 0.2);
  }
  hat(t) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.03, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    s.connect(f).connect(g).connect(this.music); s.start(t, Math.random()); s.stop(t + 0.06);
  }
}
