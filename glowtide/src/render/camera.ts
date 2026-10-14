import { BALANCE } from '../config/balance';

/** Trauma-based screen shake: offset = trauma² × max offset, trauma decays linearly. */
export class Camera {
  trauma = 0;
  offsetX = 0;
  offsetY = 0;
  enabled = true;

  addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  reset(): void {
    this.trauma = 0;
    this.offsetX = this.offsetY = 0;
  }

  update(realDt: number): void {
    this.trauma = Math.max(0, this.trauma - BALANCE.feel.shakeDecayPerSec * realDt);
    if (!this.enabled || this.trauma <= 0) {
      this.offsetX = this.offsetY = 0;
      return;
    }
    const mag = this.trauma * this.trauma * BALANCE.feel.shakeMaxOffsetPx;
    this.offsetX = (Math.random() * 2 - 1) * mag;
    this.offsetY = (Math.random() * 2 - 1) * mag;
  }
}
