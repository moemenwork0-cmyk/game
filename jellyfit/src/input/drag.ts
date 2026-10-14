/**
 * Drag and drop (spec 5). Pointer Events cover mouse, touch and pen.
 * Positions are CSS px. The drawn piece is described by its centre and its current cell size.
 */
import { THEME } from '../config/theme';
import { Spring } from '../core/spring';
import { clamp, easeOutBack, smoothing, clamp01, lerp } from '../core/tween';
import { PIECES } from '../game/rules';
import type { Layout } from '../render/layout';

const D = THEME.drag;

export interface DragState {
  slot: number;
  piece: number;
  color: number;
  pointerId: number;
  touch: boolean;
  /** Pointer position. */
  px: number;
  py: number;
  /** Drawn piece centre and cell size. */
  cx: number;
  cy: number;
  cs: number;
  fromCs: number;
  start: number;
  vx: number;
  vy: number;
  tilt: Spring;
  stretch: Spring;
  /** Stretch direction (unit). */
  dirX: number;
  dirY: number;
  target: { r: number; c: number } | null;
  previewRows: number;
  previewCols: number;
}

export interface DragHost {
  layout(): Layout;
  now(): number;
  /** Piece in a slot if it can be picked up now. */
  pickable(slot: number): { piece: number; color: number } | null;
  /** Current drawn centre and cell size of the tray piece. */
  trayPose(slot: number): { cx: number; cy: number; cs: number };
  canPlace(slot: number, r: number, c: number): boolean;
  /** Rows/cols bitmasks a placement would complete. */
  previewLines(slot: number, r: number, c: number): { rows: number; cols: number };
  onPick(d: DragState): void;
  onDrop(d: DragState, r: number, c: number): void;
  onReturn(d: DragState): void;
}

export class DragController {
  drag: DragState | null = null;
  enabled = true;

  constructor(
    private readonly el: HTMLElement,
    private readonly host: DragHost,
  ) {
    el.addEventListener('pointerdown', this.down, { passive: false });
    window.addEventListener('pointermove', this.move, { passive: false });
    window.addEventListener('pointerup', this.up, { passive: false });
    window.addEventListener('pointercancel', this.cancelEvt, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** Slot under a point, or -1. The whole slot (and a margin below) is the hit area. */
  slotAt(x: number, y: number): number {
    const L = this.host.layout();
    if (y < L.trayY - 8 || y > L.trayY + L.trayH + 40) return -1;
    if (x < L.trayX - 12 || x > L.trayX + L.trayW + 12) return -1;
    return clamp(Math.floor((x - L.trayX) / L.slotW), 0, 2);
  }

  private down = (e: PointerEvent): void => {
    if (!this.enabled || this.drag) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const rect = this.el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const slot = this.slotAt(x, y);
    if (slot < 0) return;
    const p = this.host.pickable(slot);
    if (!p) return;
    e.preventDefault();
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      /* capture is best-effort */
    }
    const pose = this.host.trayPose(slot);
    this.drag = {
      slot,
      piece: p.piece,
      color: p.color,
      pointerId: e.pointerId,
      touch: e.pointerType === 'touch',
      px: x,
      py: y,
      cx: pose.cx,
      cy: pose.cy,
      cs: pose.cs,
      fromCs: pose.cs,
      start: this.host.now(),
      vx: 0,
      vy: 0,
      tilt: new Spring(0, D.tiltStiffness, D.tiltDamping),
      stretch: new Spring(0, D.tiltStiffness, D.tiltDamping),
      dirX: 1,
      dirY: 0,
      target: null,
      previewRows: 0,
      previewCols: 0,
    };
    this.host.onPick(this.drag);
    this.evaluate();
  };

  private move = (e: PointerEvent): void => {
    const d = this.drag;
    if (!d || e.pointerId !== d.pointerId) return;
    e.preventDefault();
    const rect = this.el.getBoundingClientRect();
    d.px = e.clientX - rect.left;
    d.py = e.clientY - rect.top;
    this.evaluate();
  };

  private up = (e: PointerEvent): void => {
    const d = this.drag;
    if (!d || e.pointerId !== d.pointerId) return;
    e.preventDefault();
    const rect = this.el.getBoundingClientRect();
    d.px = e.clientX - rect.left;
    d.py = e.clientY - rect.top;
    this.evaluate();
    this.finish();
  };

  private cancelEvt = (e: PointerEvent): void => {
    const d = this.drag;
    if (!d || e.pointerId !== d.pointerId) return;
    this.cancel();
  };

  /** Ends the drag: drop on the target or fly back. */
  finish(): void {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    if (d.target) this.host.onDrop(d, d.target.r, d.target.c);
    else this.host.onReturn(d);
  }

  /** Cancels any drag and returns the piece (resize, pause, game over). */
  cancel(): void {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    this.host.onReturn(d);
  }

  /** Desired centre of the piece for the current pointer. */
  private desired(d: DragState): { x: number; y: number } {
    const L = this.host.layout();
    const p = PIECES[d.piece];
    if (d.touch) return { x: d.px, y: d.py - D.touchLiftCells * L.cs - (p.h * L.cs) / 2 };
    return { x: d.px, y: d.py - D.mouseLiftCells * L.cs };
  }

  /** Finds the snap target and line preview for the current pointer. */
  evaluate(): void {
    const d = this.drag;
    if (!d) return;
    const L = this.host.layout();
    const p = PIECES[d.piece];
    const want = this.desired(d);
    const rawC = (want.x - (p.w * L.cs) / 2 - L.gridX) / L.cs;
    const rawR = (want.y - (p.h * L.cs) / 2 - L.gridY) / L.cs;
    const r0 = Math.round(rawR);
    const c0 = Math.round(rawC);
    const reach = 0.5 + D.snapTolerance;
    let best: { r: number; c: number } | null = null;
    let bestD = Infinity;
    for (let r = r0 - 1; r <= r0 + 1; r++) {
      for (let c = c0 - 1; c <= c0 + 1; c++) {
        const dr = Math.abs(rawR - r);
        const dc = Math.abs(rawC - c);
        if (dr > reach || dc > reach) continue;
        const dist = dr * dr + dc * dc;
        if (dist < bestD && this.host.canPlace(d.slot, r, c)) {
          bestD = dist;
          best = { r, c };
        }
      }
    }
    d.target = best;
    if (best) {
      const pl = this.host.previewLines(d.slot, best.r, best.c);
      d.previewRows = pl.rows;
      d.previewCols = pl.cols;
    } else {
      d.previewRows = d.previewCols = 0;
    }
  }

  update(dt: number, now: number): void {
    const d = this.drag;
    if (!d) return;
    const L = this.host.layout();
    const t = clamp01((now - d.start) / D.pickupMs);
    d.cs = lerp(d.fromCs, L.cs, easeOutBack(t, D.pickupOvershoot));
    const want = this.desired(d);
    const a = smoothing(D.follow, dt);
    const nx = d.cx + (want.x - d.cx) * a;
    const ny = d.cy + (want.y - d.cy) * a;
    if (dt > 0) {
      const k = smoothing(0.35, dt);
      d.vx += ((nx - d.cx) / dt - d.vx) * k;
      d.vy += ((ny - d.cy) / dt - d.vy) * k;
    }
    d.cx = nx;
    d.cy = ny;
    const speed = Math.hypot(d.vx, d.vy);
    const amt = clamp01(speed / D.fullVelocity);
    d.tilt.target = clamp(d.vx / D.fullVelocity, -1, 1) * ((D.maxTiltDeg * Math.PI) / 180);
    d.stretch.target = amt * D.maxStretch;
    if (speed > 30) {
      d.dirX = d.vx / speed;
      d.dirY = d.vy / speed;
    }
    d.tilt.step(dt);
    d.stretch.step(dt);
  }
}
