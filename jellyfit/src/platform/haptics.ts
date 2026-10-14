/** Haptics (web: navigator.vibrate where supported). Only fires for touch input. */
export class Haptics {
  enabled = true;
  lastWasTouch = false;

  tick(ms: number): void {
    if (!this.enabled || !this.lastWasTouch) return;
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(ms);
    } catch {
      /* unsupported */
    }
  }
}
