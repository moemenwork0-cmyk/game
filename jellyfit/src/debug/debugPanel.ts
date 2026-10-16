/**
 * Debug overlay and keys (spec 18.2), only with ?debug=1. With ?test=1 (screenshots/smoke tests)
 * it exposes window.__jf for deterministic scene setup without showing anything.
 */
import type { App } from '../app';
import { Session } from '../game/session';
import { pieceIndex, PIECES } from '../game/rules';
import { randomSeed } from '../core/rng';
import { slotCenter } from '../render/layout';

export interface TestApi {
  app: App;
  manual(on: boolean): void;
  step(ms: number): void;
  /** Rows of 8 chars: '.' empty, digit = colour. */
  setBoard(rows: string[]): void;
  setTray(ids: (string | null)[], colors?: number[]): void;
  setScore(score: number, combo?: number): void;
  /** Places tray slot at (r, c) through the full visual path (no drag). */
  place(slot: number, r: number, c: number): boolean;
  /** CSS-px centre of a tray slot and of a board cell (for driving the real pointer). */
  slotCenter(slot: number): { x: number; y: number };
  cellCenter(r: number, c: number): { x: number; y: number };
  layout(): unknown;
  /** Pointer position that drops the piece picked at the slot centre with its top-left on (r, c). */
  pointerFor(slot: number, r: number, c: number, touch?: boolean): { x: number; y: number };
  pieceDims(piece: number): { w: number; h: number };
  state(): unknown;
}

declare global {
  interface Window {
    __jf?: TestApi;
  }
}

export class DebugPanel {
  private el: HTMLElement | null = null;
  private fps = 60;

  constructor(
    private readonly app: App,
    visible: boolean,
  ) {
    if (visible) {
      this.el = document.createElement('div');
      this.el.className = 'debug';
      app.root.appendChild(this.el);
      window.addEventListener('keydown', (e) => this.key(e));
    }
    this.installApi();
  }

  private key(e: KeyboardEvent): void {
    const app = this.app;
    const s = app.session;
    switch (e.key.toLowerCase()) {
      case 'd':
        s.deal();
        app.renderer.dealt(app.loop.now);
        break;
      case 'f': {
        for (let i = 0; i < 64; i++) if (!s.board.has(i) && Math.random() < 0.6) s.board.set(i, Math.floor(Math.random() * 7));
        // Avoid leaving full lines on the board.
        for (let r = 0; r < 8; r++) if ([...Array(8).keys()].every((c) => s.board.has(r * 8 + c))) s.board.unset(r * 8 + Math.floor(Math.random() * 8));
        for (let c = 0; c < 8; c++) if ([...Array(8).keys()].every((r) => s.board.has(r * 8 + c))) s.board.unset(Math.floor(Math.random() * 8) * 8 + c);
        s.refresh();
        break;
      }
      case 'x':
        s.board.fromRows(['01234560', '12345601', '23456012', '34560123', '45601234', '56012345', '60123456', '0123456.']);
        s.setTray([pieceIndex('sq3'), pieceIndex('h5'), pieceIndex('v5')]);
        break;
      default:
        return;
    }
    app.persist();
  }

  update(dt: number, frameMs: number): void {
    if (!this.el) return;
    if (dt > 0) this.fps += (1 / dt - this.fps) * 0.05;
    const s = this.app.session;
    const d = s.lastDeal;
    this.el.textContent =
      `fps ${this.fps.toFixed(0)}  frame ${frameMs.toFixed(2)} ms\n` +
      `fill ${(s.board.fill() * 100).toFixed(0)}%  score ${s.score}\n` +
      `zone ${d?.zone ?? '-'}  tier ${d?.tier ?? '-'}  hope ${d?.hope ? 'yes' : 'no'}\n` +
      `solvable ${d?.solvable ?? '-'}  clearPot ${d?.clearPotential ?? '-'}  fit ${d?.fitCount ?? '-'}\n` +
      `combo ${s.combo} (since ${s.sinceClear})  tray ${this.app.trayIds().join(' ')}\n` +
      `keys: D deal  F fill 60%  X game over`;
  }

  private installApi(): void {
    const app = this.app;
    window.__jf = {
      app,
      manual: (on) => app.loop.setManual(on),
      step: (ms) => app.loop.step(ms),
      setBoard: (rows) => {
        const s = new Session({ seed: randomSeed() }, false);
        s.board.fromRows(rows);
        s.deal();
        app.setSession(s);
      },
      setTray: (ids, colors) => {
        app.session.setTray(
          ids.map((id) => (id ? pieceIndex(id) : null)),
          colors,
        );
        app.renderer.dealt(app.loop.now);
      },
      setScore: (score, combo = 0) => {
        app.session.score = score;
        app.session.combo = combo;
        app.hud.setScore(score, app.loop.now, true);
      },
      place: (slot, r, c) => {
        const res = app.session.place(slot, r, c);
        if (res) app.applyPlacement(res, null);
        return !!res;
      },
      slotCenter: (slot) => {
        return slotCenter(app.renderer.lay, slot);
      },
      cellCenter: (r, c) => {
        const L = app.renderer.lay;
        return { x: L.gridX + (c + 0.5) * L.cs, y: L.gridY + (r + 0.5) * L.cs };
      },
      layout: () => app.renderer.lay,
      pointerFor: (slot, r, c, touch = false) => {
        const p0 = slotCenter(app.renderer.lay, slot);
        return app.drag.pointerFor(slot, app.session.item(slot)!.piece, p0.x, p0.y, r, c, touch);
      },
      pieceDims: (piece) => ({ w: PIECES[piece].w, h: PIECES[piece].h }),
      state: () => ({
        score: app.session.score,
        combo: app.session.combo,
        gameOver: app.session.gameOver,
        tray: app.trayIds(),
        board: app.session.board.toRows(),
        pieces: PIECES.length,
      }),
    };
  }
}
