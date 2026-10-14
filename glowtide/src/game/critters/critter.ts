import type { Linkable } from '../chain';

export type CritterType = 'drifter';

let nextUid = 1;

/** Shared critter state. Pooled: `reset` fully reinitializes an instance before reuse. */
export class Critter implements Linkable {
  id = 0;
  type: CritterType = 'drifter';
  alive = false;
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  radius = 0;
  baseSpeed = 0;
  speedMult = 1;
  hp = 1;
  damage = 1;
  glow = 1;
  color = 0;
  prism = false;

  /** 0 → 1 while emerging from the deep. */
  emerge = 0;
  wobbleFreq = 1;
  wobblePhase = 0;
  age = 0;

  linked = false;
  /** Could legally be added to the current chain (drives the affordance pulse). */
  candidate = false;
  /** Queued to pop after a chain release; frozen and no longer interactive. */
  popping = false;

  blinkTimer = 0;
  blinkLeft = 0;

  reset(): void {
    this.id = nextUid++;
    this.alive = true;
    this.vx = 0;
    this.vy = 0;
    this.prism = false;
    this.emerge = 0;
    this.age = 0;
    this.linked = false;
    this.candidate = false;
    this.popping = false;
    this.blinkLeft = 0;
  }

  /** Can be hit-tested, linked and damaged. */
  get interactive(): boolean {
    return this.alive && !this.popping;
  }
}
