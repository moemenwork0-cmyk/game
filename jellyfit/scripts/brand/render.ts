/**
 * Renders Jello (the game's own procedural drawing) on a transparent canvas, for the Android splash
 * and the loading screen. Driven by scripts/brand.mjs through the Vite dev server.
 */
import { Rng } from '../../src/core/rng';
import { Jello } from '../../src/jello/jello';
import { drawJello } from '../../src/jello/jelloDraw';

declare global {
  interface Window {
    renderJello(size: number): string;
  }
}

window.renderJello = (size: number): string => {
  const c = document.getElementById('c') as HTMLCanvasElement;
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const j = new Jello(new Rng(7), { voice: () => undefined, sound: () => undefined });
  const R = size * 0.27;
  j.reducedMotion = true;
  j.place(size / 2, size * 0.8, R);
  // Settle the springs with a calm, happy face looking at the player.
  j.feel('happy', 1e9);
  let now = 0;
  for (let i = 0; i < 120; i++) {
    now += 1000 / 60;
    j.update(1 / 60, now);
  }
  ctx.clearRect(0, 0, size, size);
  drawJello(ctx, j, now, null);
  return c.toDataURL('image/png');
};
