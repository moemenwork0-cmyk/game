/**
 * Fixed-timestep simulation with an accumulator; rendering runs once per animation frame.
 * Frame deltas are clamped so a long stall (tab switch) never causes a spiral of updates.
 */
export class Loop {
  private running = false;
  private rafId = 0;
  private last = 0;
  private acc = 0;

  constructor(
    private readonly step: number,
    private readonly maxDelta: number,
    private readonly update: (dt: number) => void,
    private readonly render: (realDt: number) => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.acc = 0;
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  get isRunning(): boolean {
    return this.running;
  }

  private readonly frame = (now: number): void => {
    if (!this.running) return;
    let delta = (now - this.last) / 1000;
    this.last = now;
    if (delta > this.maxDelta) delta = this.maxDelta;
    if (delta < 0) delta = 0;
    this.acc += delta;
    while (this.acc >= this.step) {
      this.update(this.step);
      this.acc -= this.step;
    }
    this.render(delta);
    this.rafId = requestAnimationFrame(this.frame);
  };
}
