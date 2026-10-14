import { el, formatInt, formatTime, PAUSE_ICON } from '../dom';

export interface HudData {
  tide: number;
  timeAlive: number;
  popped: number;
}

/** In-run HUD. Only touches the DOM when a displayed value changes. */
export class Hud {
  readonly root = el('div', 'hud');
  private readonly tide = el('div', 'hud-big');
  private readonly time = el('div', 'hud-small');
  private readonly popped = el('div', 'hud-big');
  private last = { tide: -1, sec: -1, popped: -1 };

  constructor(onPause: () => void) {
    const left = el('div', 'hud-left');
    const lb = el('div', 'hud-block');
    lb.append(this.tide, this.time);
    left.append(lb);

    const right = el('div', 'hud-right');
    const rb = el('div', 'hud-block');
    rb.append(this.popped, el('div', 'hud-small', 'popped'));
    const pause = el('button', 'icon-button interactive');
    pause.type = 'button';
    pause.setAttribute('aria-label', 'Pause');
    pause.innerHTML = PAUSE_ICON;
    pause.addEventListener('click', (e) => {
      e.stopPropagation();
      onPause();
    });
    pause.addEventListener('pointerdown', (e) => e.stopPropagation());
    right.append(rb, pause);
    this.root.append(left, right);
  }

  update(d: HudData): void {
    if (d.tide !== this.last.tide) {
      this.last.tide = d.tide;
      this.tide.textContent = `Tide ${d.tide}`;
    }
    const sec = Math.floor(d.timeAlive);
    if (sec !== this.last.sec) {
      this.last.sec = sec;
      this.time.textContent = formatTime(sec);
    }
    if (d.popped !== this.last.popped) {
      this.last.popped = d.popped;
      this.popped.textContent = formatInt(d.popped);
    }
  }

  setVisible(v: boolean): void {
    this.root.style.display = v ? '' : 'none';
  }
}
