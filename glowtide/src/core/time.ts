import { approach } from './math';

/** Global game time scale that eases linearly toward a target over a given duration. */
export class TimeScale {
  value = 1;
  private target = 1;
  private rate = Infinity;

  /** Ease toward `target`, arriving after `duration` real seconds. */
  setTarget(target: number, duration: number): void {
    if (target === this.target) return;
    this.target = target;
    const delta = Math.abs(target - this.value);
    this.rate = duration > 0 ? delta / duration : Infinity;
  }

  snap(value: number): void {
    this.value = value;
    this.target = value;
  }

  update(realDt: number): void {
    if (this.value === this.target) return;
    this.value =
      this.rate === Infinity ? this.target : approach(this.value, this.target, this.rate * realDt);
  }
}
