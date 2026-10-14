import { BALANCE } from '../config/balance';
import { Pool } from '../core/pool';

export type EffectKind = 'burst';

/** A visual shockwave ring. Gameplay damage is applied instantly by the world when it spawns. */
export class Effect {
  kind: EffectKind = 'burst';
  x = 0;
  y = 0;
  radius = 0;
  age = 0;
  life = 0;
  color = 0;
}

const BURST_RING_LIFE = 0.38;

export class Effects {
  readonly list: Effect[] = [];
  private readonly pool = new Pool(() => new Effect(), 32);

  clear(): void {
    for (const e of this.list) this.pool.release(e);
    this.list.length = 0;
  }

  addBurst(x: number, y: number, radius: number, color: number): void {
    if (this.list.length >= BALANCE.limits.maxEffects) return;
    const e = this.pool.acquire();
    e.kind = 'burst';
    e.x = x;
    e.y = y;
    e.radius = radius;
    e.color = color;
    e.age = 0;
    e.life = BURST_RING_LIFE;
    this.list.push(e);
  }

  update(dt: number): void {
    const list = this.list;
    let w = 0;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      e.age += dt;
      if (e.age < e.life) list[w++] = e;
      else this.pool.release(e);
    }
    list.length = w;
  }
}
