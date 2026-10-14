export const clamp = (x: number, a: number, b: number): number => (x < a ? a : x > b ? b : x);
export const clamp01 = (x: number): number => clamp(x, 0, 1);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const easeOutQuad = (t: number): number => 1 - (1 - t) * (1 - t);
export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t: number): number => t * t * t;
export const easeInOutSine = (t: number): number => -(Math.cos(Math.PI * t) - 1) / 2;

/** easeOutBack with configurable overshoot constant. */
export function easeOutBack(t: number, s = 1.70158): number {
  const c3 = s + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
}

/** Frame-rate independent smoothing factor for a per-frame (60 FPS) lerp amount. */
export function smoothing(perFrame: number, dt: number): number {
  return 1 - Math.pow(1 - perFrame, dt * 60);
}
