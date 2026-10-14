import { BALANCE } from '../config/balance';
import { rayToRectEdge, TAU } from '../core/math';
import type { Rng } from '../core/rng';
import { maxGroupSize, spawnInterval, speedMult } from './tides';

const S = BALANCE.spawn;
const PROTO = BALANCE.prototype;

export interface SpawnRequest {
  x: number;
  y: number;
  color: number;
  speedMult: number;
}

/**
 * M1 prototype spawner: endless Drifters. A "virtual tide" advances every
 * `prototype.secondsPerTide` seconds and feeds the real tide formulas, giving a smooth ramp.
 */
export class PrototypeSpawner {
  elapsed = 0;
  private timer = 0;
  private readonly request: SpawnRequest = { x: 0, y: 0, color: 0, speedMult: 1 };
  tideBonus = 0;

  constructor(
    private readonly rng: Rng,
    private readonly spawn: (req: SpawnRequest) => void,
  ) {}

  private openingDone = false;

  reset(): void {
    this.elapsed = 0;
    this.timer = PROTO.openingDelay + spawnInterval(1);
    this.tideBonus = 0;
    this.openingDone = false;
  }

  get tide(): number {
    return 1 + Math.floor(this.elapsed / PROTO.secondsPerTide) + this.tideBonus;
  }

  update(dt: number, halfW: number, halfH: number): void {
    this.elapsed += dt;
    if (!this.openingDone && this.elapsed >= PROTO.openingDelay) {
      this.openingDone = true;
      this.spawnOpening(halfW, halfH);
    }
    this.timer -= dt;
    while (this.timer <= 0) {
      const n = this.tide;
      this.spawnGroup(n, halfW, halfH);
      this.timer += spawnInterval(n);
    }
  }

  /** A same-color trio side by side, entering from the nearest screen edge. */
  private spawnOpening(halfW: number, halfH: number): void {
    const req = this.request;
    req.speedMult = speedMult(1);
    req.color = this.rng.int(0, PROTO.colors - 1);
    // Enter along the short axis so the trio reaches the screen quickly in any orientation.
    const vertical = halfH < halfW;
    const sign = this.rng.chance(0.5) ? 1 : -1;
    const ux = vertical ? 0 : sign;
    const uy = vertical ? sign : 0;
    const d = (vertical ? halfH : halfW) + S.margin;
    for (let i = 0; i < PROTO.openingCount; i++) {
      const offset = (i - (PROTO.openingCount - 1) / 2) * PROTO.openingSpacing;
      req.x = ux * d - uy * offset;
      req.y = uy * d + ux * offset;
      this.spawn(req);
    }
  }

  private spawnGroup(n: number, halfW: number, halfH: number): void {
    const size = this.rng.int(1, maxGroupSize(n));
    const sameColor = this.rng.chance(S.groupSameColorChance);
    const baseColor = this.rng.int(0, PROTO.colors - 1);
    const theta = this.rng.range(0, TAU);
    const req = this.request;
    req.speedMult = speedMult(n);
    for (let i = 0; i < size; i++) {
      const a = theta + (i === 0 ? 0 : this.rng.range(-S.groupAngleJitter, S.groupAngleJitter));
      const ux = Math.cos(a);
      const uy = Math.sin(a);
      const d = rayToRectEdge(ux, uy, halfW + S.margin, halfH + S.margin) + i * S.groupDepthSpacing;
      req.x = ux * d;
      req.y = uy * d;
      req.color = sameColor ? baseColor : this.rng.int(0, PROTO.colors - 1);
      this.spawn(req);
    }
  }
}
