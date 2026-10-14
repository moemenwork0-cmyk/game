/** Damped spring toward a target, semi-implicit Euler with substeps for stability. */
export class Spring {
  x: number;
  v = 0;
  constructor(
    public target: number,
    public stiffness: number,
    public damping: number,
  ) {
    this.x = target;
  }

  step(dt: number): number {
    const n = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      this.v += (-this.stiffness * (this.x - this.target) - this.damping * this.v) * h;
      this.x += this.v * h;
    }
    return this.x;
  }

  settled(eps = 1e-3): boolean {
    return Math.abs(this.x - this.target) < eps && Math.abs(this.v) < eps;
  }
}
