import { BALANCE } from '../config/balance';

const P = BALANCE.pearl;

export class Pearl {
  readonly radius = P.radius;
  maxShell: number = P.baseShell;
  shell: number = P.baseShell;
  invuln = 0;
  /** Index of the most recently lost segment and its remaining flash time. */
  flashSegment = -1;
  flashTime = 0;
  /** Seconds since the last hit (drives the hit wobble). */
  hitAge = 99;

  reset(maxShell: number = P.baseShell): void {
    this.maxShell = maxShell;
    this.shell = maxShell;
    this.invuln = 0;
    this.flashSegment = -1;
    this.flashTime = 0;
    this.hitAge = 99;
  }

  /** Applies damage; returns the amount actually lost (0 while invulnerable). */
  hit(amount: number): number {
    if (this.invuln > 0 || this.shell <= 0) return 0;
    const lost = Math.min(amount, this.shell);
    this.shell -= lost;
    this.flashSegment = this.shell;
    this.flashTime = P.segmentFlashTime;
    this.invuln = P.invulnTime;
    this.hitAge = 0;
    return lost;
  }

  update(dt: number): void {
    if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - dt);
    if (this.flashTime > 0) this.flashTime = Math.max(0, this.flashTime - dt);
    this.hitAge += dt;
  }

  get dead(): boolean {
    return this.shell <= 0;
  }
}
