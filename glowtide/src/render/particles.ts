import { BALANCE } from '../config/balance';
import { TAU } from '../core/math';

export type ParticleKind = 'bubble' | 'spark' | 'ring';

export class Particle {
  kind: ParticleKind = 'bubble';
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  age = 0;
  life = 1;
  size = 1;
  /** Ring: final radius. */
  size2 = 0;
  color = '#fff';
  drag = 0;
}

/** Fixed-capacity particle system. Visual only, so it uses Math.random. */
export class Particles {
  private readonly items: Particle[] = [];
  private count = 0;
  cap: number = BALANCE.limits.maxParticles;

  constructor() {
    for (let i = 0; i < BALANCE.limits.maxParticles; i++) this.items.push(new Particle());
  }

  get active(): number {
    return this.count;
  }

  clear(): void {
    this.count = 0;
  }

  private spawn(): Particle | null {
    if (this.count >= this.cap) return null;
    return this.items[this.count++];
  }

  bubble(x: number, y: number, speed: number, size: number, life: number, color: string): void {
    const p = this.spawn();
    if (!p) return;
    const a = Math.random() * TAU;
    const s = speed * (0.4 + Math.random() * 0.6);
    p.kind = 'bubble';
    p.x = x;
    p.y = y;
    p.vx = Math.cos(a) * s;
    p.vy = Math.sin(a) * s - speed * 0.15;
    p.age = 0;
    p.life = life * (0.7 + Math.random() * 0.6);
    p.size = size * (0.5 + Math.random() * 0.8);
    p.color = color;
    p.drag = 3.2;
  }

  spark(x: number, y: number, speed: number, life: number, color: string): void {
    const p = this.spawn();
    if (!p) return;
    const a = Math.random() * TAU;
    const s = speed * (0.5 + Math.random() * 0.5);
    p.kind = 'spark';
    p.x = x;
    p.y = y;
    p.vx = Math.cos(a) * s;
    p.vy = Math.sin(a) * s;
    p.age = 0;
    p.life = life * (0.6 + Math.random() * 0.5);
    p.size = 2 + Math.random() * 1.5;
    p.color = color;
    p.drag = 5;
  }

  ring(x: number, y: number, r0: number, r1: number, life: number, color: string): void {
    const p = this.spawn();
    if (!p) return;
    p.kind = 'ring';
    p.x = x;
    p.y = y;
    p.vx = p.vy = 0;
    p.age = 0;
    p.life = life;
    p.size = r0;
    p.size2 = r1;
    p.color = color;
    p.drag = 0;
  }

  update(dt: number): void {
    const items = this.items;
    let i = 0;
    while (i < this.count) {
      const p = items[i];
      p.age += dt;
      if (p.age >= p.life) {
        // Swap-remove with the last live particle.
        const lastIdx = --this.count;
        items[i] = items[lastIdx];
        items[lastIdx] = p;
        continue;
      }
      const damp = Math.max(0, 1 - p.drag * dt);
      p.vx *= damp;
      p.vy *= damp;
      if (p.kind === 'bubble') p.vy -= 14 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      i++;
    }
  }

  /** Draws in world space; the caller sets the world transform. */
  draw(ctx: CanvasRenderingContext2D): void {
    const items = this.items;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.count; i++) {
      const p = items[i];
      const t = p.age / p.life;
      const fade = 1 - t;
      if (p.kind === 'ring') {
        const r = p.size + (p.size2 - p.size) * (1 - (1 - t) * (1 - t));
        ctx.globalAlpha = fade * 0.8;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3 * fade + 0.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, TAU);
        ctx.stroke();
      } else if (p.kind === 'bubble') {
        ctx.globalAlpha = fade * 0.85;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, TAU);
        ctx.stroke();
      } else {
        ctx.globalAlpha = fade;
        ctx.fillStyle = p.color;
        const s = p.size * (0.5 + fade * 0.5);
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      }
    }
    ctx.restore();
  }
}
