const BLOCKED = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export type KeyHandler = (code: string, e: KeyboardEvent) => void;

/**
 * Keyboard input. Prevents page scrolling for Space and arrows. Escape is never used for game
 * actions (it exits fullscreen on the host page).
 */
export class KeyboardInput {
  private readonly handlers: KeyHandler[] = [];

  constructor(target: Window = window) {
    target.addEventListener('keydown', (e) => {
      if (BLOCKED.has(e.code) && !isNativeControl(e.target)) e.preventDefault();
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      for (const h of this.handlers) h(e.code, e);
    });
  }

  on(handler: KeyHandler): void {
    this.handlers.push(handler);
  }
}

/** Focused buttons and inputs keep their native Space/arrow behavior (they don't scroll the page). */
function isNativeControl(t: EventTarget | null): boolean {
  return (
    t instanceof HTMLButtonElement ||
    t instanceof HTMLInputElement ||
    t instanceof HTMLTextAreaElement
  );
}
