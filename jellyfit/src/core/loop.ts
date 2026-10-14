/**
 * Frame loop with a clamped delta. In manual mode (screenshots/tests) time only advances via step().
 */
export class Loop {
  /** Game clock in ms. */
  now = 0;
  private raf = 0;
  private last = 0;
  private running = false;
  manual = false;

  constructor(private readonly frame: (dt: number, now: number) => void) {}

  start(): void {
    if (this.running || this.manual) return;
    this.running = true;
    this.last = performance.now();
    const tick = (t: number): void => {
      if (!this.running) return;
      const dt = Math.min(0.1, Math.max(0, (t - this.last) / 1000));
      this.last = t;
      this.now += dt * 1000;
      this.frame(dt, this.now);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  setManual(on: boolean): void {
    this.manual = on;
    if (on) this.stop();
    else this.start();
  }

  /** Advances the clock by ms in 1/60 s frames (manual mode). */
  step(ms: number): void {
    let left = ms;
    while (left > 0) {
      const d = Math.min(left, 1000 / 60);
      left -= d;
      this.now += d;
      this.frame(d / 1000, this.now);
    }
  }
}
