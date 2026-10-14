/**
 * WebAudio engine (spec 10): context created on the first gesture, master → SFX/music buses,
 * a compressor on the master and a voice cap. Optional files in public/audio override synth recipes.
 */
import manifest from 'virtual:audio-manifest';

const MAX_VOICES = 24;

export class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  sfx!: GainNode;
  music!: GainNode;
  private voices = 0;
  private noiseBuf: AudioBuffer | null = null;
  private buffers = new Map<string, AudioBuffer>();
  sfxOn = true;
  musicOn = true;
  private muted = false;

  /** Creates or resumes the context. Call from a user gesture. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        const ctx = new Ctor();
        this.ctx = ctx;
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.knee.value = 12;
        comp.ratio.value = 4;
        comp.attack.value = 0.003;
        comp.release.value = 0.2;
        comp.connect(ctx.destination);
        this.master = ctx.createGain();
        this.master.connect(comp);
        this.sfx = ctx.createGain();
        this.sfx.connect(this.master);
        this.music = ctx.createGain();
        this.music.gain.value = 0.35;
        this.music.connect(this.master);
        this.applyGains();
        void this.loadFiles();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.applyGains();
  }

  applyGains(): void {
    if (!this.ctx) return;
    this.master.gain.value = this.muted ? 0 : 1;
    this.sfx.gain.value = this.sfxOn ? 1 : 0;
    this.music.gain.value = this.musicOn ? 0.35 : 0;
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  /** True when a sound may start now (context ready and under the voice cap). */
  ready(): boolean {
    return !!this.ctx && this.ctx.state === 'running' && this.sfxOn && !this.muted && this.voices < MAX_VOICES;
  }

  /** Registers a voice that ends at `end` (context time). */
  track(node: AudioScheduledSourceNode): void {
    this.voices++;
    node.onended = () => {
      this.voices--;
    };
  }

  noise(): AudioBuffer {
    if (!this.noiseBuf) {
      const ctx = this.ctx!;
      const len = Math.floor(ctx.sampleRate * 0.5);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      let seed = 12345;
      for (let i = 0; i < len; i++) {
        seed = (Math.imul(seed, 1103515245) + 12345) | 0;
        d[i] = ((seed >>> 16) & 0x7fff) / 16384 - 1;
      }
      this.noiseBuf = buf;
    }
    return this.noiseBuf;
  }

  /** Plays an override file if one exists in public/audio; returns false if not. */
  playFile(name: string, rate = 1, gain = 1): boolean {
    const buf = this.buffers.get(name);
    if (!buf || !this.ready()) return false;
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(this.sfx);
    this.track(src);
    src.start();
    return true;
  }

  hasFile(name: string): boolean {
    return this.buffers.has(name);
  }

  private async loadFiles(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx) return;
    for (const file of manifest as string[]) {
      try {
        const res = await fetch(`audio/${file}`);
        if (!res.ok) continue;
        const data = await res.arrayBuffer();
        const buf = await ctx.decodeAudioData(data);
        this.buffers.set(file.replace(/\.[a-z0-9]+$/i, ''), buf);
      } catch {
        /* unsupported codec or missing file: the synth recipe stays in use */
      }
    }
  }
}
