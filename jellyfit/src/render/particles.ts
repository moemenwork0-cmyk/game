/** Pooled particles (droplets, ring splashes, sparkles). Max 500 (spec 9.4). */
import { THEME } from '../config/theme';
import type { Rng } from '../core/rng';

const easeOut = (t: number): number => 1 - (1 - t) * (1 - t) * (1 - t);

const enum PKind {
  Droplet = 0,
  Ring = 1,
  Sparkle = 2,
}

interface P {
  alive: boolean;
  kind: PKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  color: number;
  rot: number;
}

export class Particles {
  private pool: P[] = [];
  private cursor = 0;
  count = 0;
  /** Adaptive quality can lower this. */
  budget = THEME.clear.maxParticles;
  gravity = 1500;

  constructor() {
    for (let i = 0; i < THEME.clear.maxParticles; i++) {
      this.pool.push({ alive: false, kind: PKind.Droplet, x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 1, size: 1, color: 0, rot: 0 });
    }
  }

  private alloc(): P | null {
    if (this.count >= this.budget) return null;
    for (let k = 0; k < this.pool.length; k++) {
      const p = this.pool[(this.cursor + k) % this.pool.length];
      if (!p.alive) {
        this.cursor = (this.cursor + k + 1) % this.pool.length;
        p.alive = true;
        p.age = 0;
        p.rot = 0;
        this.count++;
        return p;
      }
    }
    return null;
  }

  clear(): void {
    for (const p of this.pool) p.alive = false;
    this.count = 0;
  }

  /** Jelly burst: droplets + ring at (x, y) in CSS px, sized relative to cell size cs. */
  burst(x: number, y: number, cs: number, color: number, rng: Rng): void {
    const C = THEME.clear;
    const n = C.dropletsMin + rng.int(C.dropletsMax - C.dropletsMin + 1);
    for (let k = 0; k < n; k++) {
      const p = this.alloc();
      if (!p) break;
      const a = rng.next() * Math.PI * 2;
      const sp = cs * rng.range(2.4, 5.5);
      p.kind = PKind.Droplet;
      p.x = x + Math.cos(a) * cs * 0.15;
      p.y = y + Math.sin(a) * cs * 0.15;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp - cs * 2.2;
      p.life = C.dropletLifeMs / 1000 * rng.range(0.85, 1.2);
      p.size = cs * rng.range(0.14, 0.28);
      p.color = color;
    }
    const r = this.alloc();
    if (r) {
      r.kind = PKind.Ring;
      r.x = x;
      r.y = y;
      r.vx = r.vy = 0;
      r.life = C.ringLifeMs / 1000;
      r.size = cs;
      r.color = color;
    }
  }

  sparkle(x: number, y: number, cs: number, rng: Rng, n = 3): void {
    for (let k = 0; k < n; k++) {
      const p = this.alloc();
      if (!p) return;
      const a = rng.next() * Math.PI * 2;
      const sp = cs * rng.range(0.5, 2.2);
      p.kind = PKind.Sparkle;
      p.x = x + rng.range(-0.4, 0.4) * cs;
      p.y = y + rng.range(-0.4, 0.4) * cs;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp - cs * 0.8;
      p.life = rng.range(0.35, 0.7);
      p.size = cs * rng.range(0.1, 0.2);
      p.color = 0;
      p.rot = rng.next() * Math.PI;
    }
  }

  update(dt: number): void {
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.alive = false;
        this.count--;
        continue;
      }
      if (p.kind === PKind.Droplet) {
        p.vy += this.gravity * dt;
        p.vx *= Math.pow(0.4, dt);
      } else if (p.kind === PKind.Sparkle) {
        p.vy += this.gravity * 0.15 * dt;
        p.rot += dt * 3;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  draw(ctx: CanvasRenderingContext2D, droplets: HTMLCanvasElement[], colors: readonly string[]): void {
    for (const p of this.pool) {
      if (!p.alive) continue;
      const t = p.age / p.life;
      if (p.kind === PKind.Droplet) {
        const s = p.size * (1 - 0.5 * t);
        ctx.globalAlpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
        ctx.drawImage(droplets[p.color], p.x - s / 2, p.y - s / 2, s, s);
      } else if (p.kind === PKind.Ring) {
        ctx.globalAlpha = 0.45 * (1 - t) * (1 - t);
        ctx.strokeStyle = colors[p.color];
        ctx.lineWidth = Math.max(1, p.size * 0.08 * (1 - t));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.2 + 0.38 * easeOut(t)), 0, Math.PI * 2);
        ctx.stroke();
      } else {
        const s = p.size * (1 - t);
        ctx.globalAlpha = 1 - t;
        ctx.fillStyle = '#fff';
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.beginPath();
        for (let k = 0; k < 4; k++) {
          const a = (k * Math.PI) / 2;
          ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s);
          ctx.lineTo(Math.cos(a + Math.PI / 4) * s * 0.3, Math.sin(a + Math.PI / 4) * s * 0.3);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }
}
