export type PointerType = 'mouse' | 'touch' | 'pen';

export interface PointerHandlers {
  down(cssX: number, cssY: number, type: PointerType): void;
  move(cssX: number, cssY: number): void;
  up(cancelled: boolean): void;
}

/**
 * Unified mouse/touch/pen input via Pointer Events. Tracks a single active pointer;
 * extra simultaneous touches are ignored. Coordinates are CSS pixels relative to the element.
 */
export class PointerInput {
  private activeId: number | null = null;
  enabled = true;

  constructor(
    private readonly el: HTMLElement,
    private readonly handlers: PointerHandlers,
  ) {
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onCancel);
    el.addEventListener('lostpointercapture', this.onCancel);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  get isDown(): boolean {
    return this.activeId !== null;
  }

  /** Forget the active pointer (for example when the game pauses mid-drag). */
  reset(): void {
    if (this.activeId !== null) {
      const id = this.activeId;
      this.activeId = null;
      try {
        if (this.el.hasPointerCapture(id)) this.el.releasePointerCapture(id);
      } catch {
        // Capture may already be gone.
      }
    }
  }

  private local(e: PointerEvent): [number, number] {
    const rect = this.el.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  }

  private readonly onDown = (e: PointerEvent): void => {
    if (!this.enabled || this.activeId !== null) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    this.activeId = e.pointerId;
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      // Some browsers refuse capture for synthetic events; dragging still works.
    }
    const [x, y] = this.local(e);
    const type: PointerType =
      e.pointerType === 'touch' ? 'touch' : e.pointerType === 'pen' ? 'pen' : 'mouse';
    this.handlers.down(x, y, type);
  };

  private readonly onMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.activeId) return;
    e.preventDefault();
    const [x, y] = this.local(e);
    this.handlers.move(x, y);
  };

  private readonly onUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.activeId) return;
    e.preventDefault();
    const [x, y] = this.local(e);
    this.handlers.move(x, y);
    this.activeId = null;
    this.handlers.up(false);
  };

  private readonly onCancel = (e: PointerEvent): void => {
    if (e.pointerId !== this.activeId) return;
    this.activeId = null;
    this.handlers.up(true);
  };
}
