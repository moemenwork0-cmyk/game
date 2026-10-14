/** Screen shake that decays over a fixed duration (spec 9.4). */
export class Camera {
  x = 0;
  y = 0;
  private amp = 0;
  private start = 0;
  private dur = 1;
  enabled = true;

  shake(px: number, now: number, durMs: number): void {
    if (!this.enabled || px <= 0) return;
    if (px >= this.current(now)) {
      this.amp = px;
      this.start = now;
      this.dur = durMs;
    }
  }

  private current(now: number): number {
    const t = (now - this.start) / this.dur;
    return t >= 1 ? 0 : this.amp * (1 - t) * (1 - t);
  }

  update(now: number): void {
    const a = this.current(now);
    if (a <= 0.01) {
      this.x = this.y = 0;
      return;
    }
    const t = now / 1000;
    this.x = a * Math.sin(t * 91.7) * Math.cos(t * 13.1);
    this.y = a * Math.cos(t * 83.3) * Math.sin(t * 17.9 + 1);
  }
}
