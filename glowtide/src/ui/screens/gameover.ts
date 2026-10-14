import type { RunStats } from '../../game/world';
import { button, el, formatInt, formatTime } from '../dom';

export interface GameOverScreenOpts {
  onPlayAgain: () => void;
}

function stat(value: string, label: string): HTMLElement {
  const s = el('div', 'stat');
  s.append(el('div', 'value', value), el('div', 'label', label));
  return s;
}

export function gameOverScreen(stats: RunStats, opts: GameOverScreenOpts): HTMLElement {
  const overlay = el('div', 'overlay');
  const panel = el('div', 'panel');
  panel.append(el('h2', '', 'The pearl cracked'));
  const grid = el('div', 'stats');
  grid.append(
    stat(formatTime(stats.timeAlive), 'Time survived'),
    stat(String(stats.tideReached), 'Tide reached'),
    stat(formatInt(stats.popped), 'Critters popped'),
    stat(String(stats.longestChain), 'Longest chain'),
  );
  panel.append(grid);
  const buttons = el('div', 'buttons');
  const again = button('Play again', 'btn primary', opts.onPlayAgain);
  buttons.append(again);
  panel.append(buttons);
  overlay.append(panel);
  requestAnimationFrame(() => again.focus({ preventScroll: true }));
  return overlay;
}
