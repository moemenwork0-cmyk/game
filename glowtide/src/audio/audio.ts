const MAX_VOICES = 24;

type AudioContextCtor = typeof AudioContext;

/**
 * Owns the AudioContext and buses (master → music, sfx). The context is created on the first
 * user gesture; until then every play call is a silent no-op.
 */
export class AudioEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  sfx: GainNode | null = null;
  music: GainNode | null = null;
  private voices = 0;
  private noise: AudioBuffer | null = null;
  private sfxVolume = 0.8;
  private musicVolume = 0.6;
  private muted = false;

  /** Call from a user-gesture handler. Safe to call repeatedly. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const w = window as unknown as {
          AudioContext?: AudioContextCtor;
          webkitAudioContext?: AudioContextCtor;
        };
        const Ctor = w.AudioContext ?? w.webkitAudioContext;
        if (!Ctor) return;
        const ctx = new Ctor();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.knee.value = 12;
        comp.ratio.value = 4;
        comp.attack.value = 0.004;
        comp.release.value = 0.2;
        comp.connect(ctx.destination);
        const master = ctx.createGain();
        master.gain.value = this.muted ? 0 : 1;
        master.connect(comp);
        const sfx = ctx.createGain();
        sfx.gain.value = this.sfxVolume;
        sfx.connect(master);
        const music = ctx.createGain();
        music.gain.value = this.musicVolume;
        music.connect(master);
        this.ctx = ctx;
        this.master = master;
        this.sfx = sfx;
        this.music = music;
        this.noise = makeNoise(ctx);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch (err) {
      console.warn('Audio unavailable', err);
      this.ctx = null;
    }
  }

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  get now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  get noiseBuffer(): AudioBuffer | null {
    return this.noise;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx)
      this.master.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.02);
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  /** Reserves a voice until `source` ends. Returns false when the voice cap is reached. */
  claimVoice(source: AudioScheduledSourceNode): boolean {
    if (this.voices >= MAX_VOICES) return false;
    this.voices++;
    source.onended = () => {
      this.voices--;
    };
    return true;
  }

  get voiceCount(): number {
    return this.voices;
  }
}

function makeNoise(ctx: AudioContext): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * 1);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}
