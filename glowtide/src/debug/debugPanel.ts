import { el } from '../ui/dom';

export interface DebugStats {
  fps: number;
  frameMs: number;
  critters: number;
  particles: number;
  timeScale: number;
  tide: number;
  voices: number;
  invincible: boolean;
  dpr: number;
}

/** Debug overlay (only created with ?debug=1). */
export class DebugPanel {
  readonly root = el('div', 'debug');
  private readonly text = el('div');
  private frames = 0;
  private acc = 0;
  private worst = 0;
  private fps = 0;
  private frameMs = 0;

  constructor() {
    this.root.append(this.text);
  }

  frame(realDt: number, read: () => DebugStats): void {
    this.frames++;
    this.acc += realDt;
    this.worst = Math.max(this.worst, realDt);
    if (this.acc < 0.25) return;
    this.fps = this.frames / this.acc;
    this.frameMs = (this.acc / this.frames) * 1000;
    const s = read();
    this.text.textContent =
      `fps ${this.fps.toFixed(0)}  avg ${this.frameMs.toFixed(1)}ms  worst ${(this.worst * 1000).toFixed(1)}ms\n` +
      `critters ${s.critters}  particles ${s.particles}  voices ${s.voices}\n` +
      `timeScale ${s.timeScale.toFixed(2)}  tide ${s.tide}  dpr ${s.dpr}\n` +
      `invincible ${s.invincible ? 'on' : 'off'}\n` +
      `K kill all  I invincible\nN skip tide  S spawn 50`;
    this.frames = 0;
    this.acc = 0;
    this.worst = 0;
  }
}
