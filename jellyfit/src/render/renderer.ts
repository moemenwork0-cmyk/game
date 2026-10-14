/**
 * Draws everything on the single game canvas. The logical board resolves instantly; this class keeps
 * the visual state (appearing blocks, popping blocks, flyers, effects) so input never locks.
 */
import { THEME } from '../config/theme';
import { Rng } from '../core/rng';
import { clamp01, easeOutBack, easeOutCubic, easeOutQuad, lerp } from '../core/tween';
import { PIECES } from '../game/rules';
import type { Session, PlaceResult } from '../game/session';
import type { DragState } from '../input/drag';
import { Background } from './background';
import { renderBoardBase, type BoardBase } from './board';
import { SpriteBank, roundRectPath, type Sprite } from './blockSprites';
import { Camera } from './camera';
import { JellyField } from './jelly';
import { computeLayout, trayPiecePos, type Insets, type Layout } from './layout';
import { Particles } from './particles';
import { FONT, Popups, outlinedText } from './popups';

const C = THEME.clear;

interface Flyer {
  piece: number;
  color: number;
  slot: number;
  kind: 'snap' | 'return';
  fx: number;
  fy: number;
  fcs: number;
  tx: number;
  ty: number;
  tcs: number;
  ftilt: number;
  start: number;
  dur: number;
}

interface Popping {
  i: number;
  color: number;
  showAt: number;
  popAt: number;
  seq: number;
  burst: boolean;
}

interface Sweep {
  row: number;
  col: number;
  start: number;
  color: number;
}

interface Timer {
  at: number;
  fn: () => void;
}

export interface RenderHooks {
  /** A cleared cell bursts; seq is its order in the clear sequence. */
  onCellPop(seq: number, total: number): void;
}

export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  lay!: Layout;
  readonly rng = new Rng(0xbeef);
  readonly sprites = new SpriteBank();
  readonly jelly = new JellyField(this.rng);
  readonly particles = new Particles();
  readonly popups = new Popups();
  readonly camera = new Camera();
  readonly bg = new Background(this.rng);
  private base: BoardBase | null = null;
  private readonly appearAt = new Float64Array(64);
  private flyers: Flyer[] = [];
  private popping: Popping[] = [];
  private sweeps: Sweep[] = [];
  private timers: Timer[] = [];
  private dealStart = -1e9;
  private gameOverAt = -1;
  private flashAt = -1e9;
  reducedMotion = false;
  colors: readonly string[] = THEME.jelly;

  constructor(
    readonly canvas: HTMLCanvasElement,
    private readonly hooks: RenderHooks,
  ) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D is not available');
    this.ctx = ctx;
  }

  resize(w: number, h: number, dpr: number, safe: Insets): void {
    this.lay = computeLayout(w, h, dpr, safe);
    const L = this.lay;
    this.canvas.width = Math.round(w * L.dpr);
    this.canvas.height = Math.round(h * L.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.sprites.build(L.cs * L.dpr, this.colors);
    this.base = renderBoardBase(L);
    this.bg.resize(L);
    // Flyers target positions that no longer exist: finish them now.
    for (const f of this.flyers) f.dur = 0;
  }

  // ---------------------------------------------------------------------------
  // Events

  newGame(now: number): void {
    this.appearAt.fill(0);
    this.flyers.length = 0;
    this.popping.length = 0;
    this.sweeps.length = 0;
    this.timers.length = 0;
    this.particles.clear();
    this.popups.reset();
    this.jelly.reset();
    this.gameOverAt = -1;
    this.dealStart = now;
  }

  dealt(now: number): void {
    this.dealStart = now;
  }

  after(ms: number, now: number, fn: () => void): void {
    this.timers.push({ at: now + ms, fn });
  }

  cellPos(i: number): { x: number; y: number } {
    const L = this.lay;
    return { x: L.gridX + (i & 7) * L.cs, y: L.gridY + (i >> 3) * L.cs };
  }

  /** Centre + cell size of the piece currently resting in (or flying back to) a tray slot. */
  trayPose(slot: number, piece: number, now: number): { cx: number; cy: number; cs: number } {
    const f = this.flyers.find((x) => x.kind === 'return' && x.slot === slot);
    const p = PIECES[piece];
    if (f) {
      const pose = this.flyerPose(f, now);
      return { cx: pose.x + (p.w * pose.cs) / 2, cy: pose.y + (p.h * pose.cs) / 2, cs: pose.cs };
    }
    const tp = trayPiecePos(this.lay, slot, p.w, p.h);
    return { cx: tp.x + (p.w * tp.cs) / 2, cy: tp.y + (p.h * tp.cs) / 2, cs: tp.cs };
  }

  pickedUp(slot: number): void {
    this.flyers = this.flyers.filter((f) => !(f.kind === 'return' && f.slot === slot));
  }

  returnPiece(d: DragState, now: number): void {
    const p = PIECES[d.piece];
    const tp = trayPiecePos(this.lay, d.slot, p.w, p.h);
    this.flyers.push({
      piece: d.piece,
      color: d.color,
      slot: d.slot,
      kind: 'return',
      fx: d.cx - (p.w * d.cs) / 2,
      fy: d.cy - (p.h * d.cs) / 2,
      fcs: d.cs,
      tx: tp.x,
      ty: tp.y,
      tcs: tp.cs,
      ftilt: d.tilt.x,
      start: now,
      dur: THEME.drag.returnMs,
    });
  }

  /** Visuals for a successful placement. */
  placed(res: PlaceResult, d: DragState | null, now: number): void {
    const L = this.lay;
    const p = PIECES[res.piece];
    const snap = d ? THEME.drag.snapMs : 0;
    const tgt = this.cellPos(res.r * 8 + res.c);
    if (d) {
      this.flyers.push({
        piece: res.piece,
        color: res.color,
        slot: res.slot,
        kind: 'snap',
        fx: d.cx - (p.w * d.cs) / 2,
        fy: d.cy - (p.h * d.cs) / 2,
        fcs: d.cs,
        tx: tgt.x,
        ty: tgt.y,
        tcs: L.cs,
        ftilt: d.tilt.x,
        start: now,
        dur: snap,
      });
    }
    const landAt = now + snap;
    const clearedSet = new Set(res.cleared.map((c) => c.i));
    // Any popping cell under the new piece finishes immediately.
    for (const pp of this.popping) if (res.placed.includes(pp.i) && pp.popAt > now) pp.popAt = now;
    for (const i of res.placed) if (!clearedSet.has(i)) this.appearAt[i] = landAt;
    this.after(snap, now, () => this.jelly.placeImpulse(res.placed, this.now, (i) => this.occupiedVisible(i)));

    if (res.lines > 0) {
      // Pop order: nearest to the placed piece first, spreading outward.
      const order = res.cleared
        .map((c) => {
          let dmin = 99;
          for (const q of res.placed) dmin = Math.min(dmin, Math.abs((q >> 3) - (c.i >> 3)) + Math.abs((q & 7) - (c.i & 7)));
          return { c, dmin };
        })
        .sort((a, b) => a.dmin - b.dmin || a.c.i - b.c.i);
      order.forEach(({ c, dmin }, seq) => {
        this.popping.push({
          i: c.i,
          color: c.color,
          showAt: res.placed.includes(c.i) ? landAt : 0,
          popAt: landAt + dmin * C.staggerMs + seq * 2,
          seq,
          burst: false,
        });
      });
      if (res.lines >= 2) {
        for (let r = 0; r < 8; r++) if (res.rows & (1 << r)) this.sweeps.push({ row: r, col: -1, start: landAt, color: res.color });
        for (let c = 0; c < 8; c++) if (res.cols & (1 << c)) this.sweeps.push({ row: -1, col: c, start: landAt, color: res.color });
      }
      const shake = C.shake[Math.min(res.lines, C.shake.length - 1)];
      if (shake > 0 && !this.reducedMotion) this.after(snap + 40, now, () => this.camera.shake(shake, this.now, C.shakeMs));
      // Score popup at the centroid of the cleared cells.
      let sx = 0;
      let sy = 0;
      for (const c of res.cleared) {
        const pos = this.cellPos(c.i);
        sx += pos.x + L.cs / 2;
        sy += pos.y + L.cs / 2;
      }
      sx /= res.cleared.length;
      sy /= res.cleared.length;
      const value = res.lineScore + res.perfectBonus;
      const size = Math.max(22, L.cs * 0.62);
      this.after(snap + 80, now, () => this.popups.score(sx, sy, value, this.now, size));
      if (res.word) {
        const color = this.colors[res.color];
        const word = res.word;
        this.after(snap + 40, now, () => this.popups.showWord(word, darkOutline(color), this.now));
      }
    }
  }

  startGameOver(at: number): void {
    this.gameOverAt = at;
  }

  flash(now: number): void {
    this.flashAt = now;
  }

  private occupiedVisible(i: number): boolean {
    return this.session ? this.session.board.has(i) : false;
  }

  // ---------------------------------------------------------------------------
  // Frame

  session: Session | null = null;
  now = 0;

  update(dt: number, now: number): void {
    this.now = now;
    if (this.timers.length) {
      const due = this.timers.filter((t) => t.at <= now);
      this.timers = this.timers.filter((t) => t.at > now);
      for (const t of due) t.fn();
    }
    this.jelly.breathe = !this.reducedMotion;
    this.jelly.update(dt, now);
    this.particles.update(dt);
    this.camera.enabled = !this.reducedMotion;
    this.camera.update(now);
    this.bg.update(dt, !this.reducedMotion);
    // Popping cells burst.
    const total = this.popping.length;
    for (const pp of this.popping) {
      if (!pp.burst && now >= pp.popAt + C.growMs) {
        pp.burst = true;
        const pos = this.cellPos(pp.i);
        const cs = this.lay.cs;
        this.particles.burst(pos.x + cs / 2, pos.y + cs / 2, cs, pp.color, this.rng);
        this.hooks.onCellPop(pp.seq, total);
      }
    }
    this.popping = this.popping.filter((pp) => !pp.burst);
    this.sweeps = this.sweeps.filter((s) => now - s.start < C.sweepMs);
    this.flyers = this.flyers.filter((f) => now - f.start < f.dur);
  }

  private flyerPose(f: Flyer, now: number): { x: number; y: number; cs: number; tilt: number } {
    const t = f.dur <= 0 ? 1 : clamp01((now - f.start) / f.dur);
    const e = f.kind === 'snap' ? easeOutQuad(t) : easeOutCubic(t);
    return { x: lerp(f.fx, f.tx, e), y: lerp(f.fy, f.ty, e), cs: lerp(f.fcs, f.tcs, e), tilt: f.ftilt * (1 - e) };
  }

  /** Draws a block sprite with its bottom-centre anchored at the cell's bottom-centre. */
  private block(sp: Sprite, x: number, y: number, cs: number, sx = 1, sy = 1, oy = 0): void {
    const dpr = this.lay.dpr;
    const k = (cs * dpr) / sp.s;
    const m = (sp.m / dpr) * k;
    const full = cs + 2 * m;
    this.ctx.drawImage(sp.canvas, x + cs / 2 - (cs / 2 + m) * sx, y + cs + oy - (cs + m) * sy, full * sx, full * sy);
  }

  /** Draws a piece with its top-left at (x, y). */
  private piece(piece: number, color: number, x: number, y: number, cs: number, gray = false): void {
    const sp = (gray ? this.sprites.gray : this.sprites.jelly)[color];
    for (const [r, c] of PIECES[piece].cells) this.block(sp, x + c * cs, y + r * cs, cs);
  }

  /** Draws a piece centred at the origin of the current transform. */
  private pieceCentered(piece: number, color: number, cs: number, shadow: boolean): void {
    const p = PIECES[piece];
    const x0 = (-p.w * cs) / 2;
    const y0 = (-p.h * cs) / 2;
    if (shadow) {
      for (const [r, c] of p.cells) this.block(this.sprites.shadow, x0 + c * cs, y0 + r * cs, cs);
    } else {
      this.piece(piece, color, x0, y0, cs);
    }
  }

  draw(drag: DragState | null): void {
    const s = this.session;
    const L = this.lay;
    const ctx = this.ctx;
    const now = this.now;
    if (!s || !L) return;
    ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    this.bg.draw(ctx);

    ctx.setTransform(L.dpr, 0, 0, L.dpr, this.camera.x * L.dpr, this.camera.y * L.dpr);
    if (this.base) ctx.drawImage(this.base.canvas, L.boardX - this.base.off, L.boardY - this.base.off, this.base.canvas.width / L.dpr, this.base.canvas.height / L.dpr);

    // Clear preview set.
    const prevRows = drag?.target ? drag.previewRows : 0;
    const prevCols = drag?.target ? drag.previewCols : 0;
    const pulse = 1 + THEME.drag.previewPulseScale * (0.5 - 0.5 * Math.cos((now / THEME.drag.previewPulseMs) * Math.PI * 2));

    // Game-over desaturation order.
    let goRank = 0;
    const goStart = this.gameOverAt >= 0 ? this.gameOverAt + THEME.gameOver.textDelayMs : Infinity;

    const b = s.board;
    for (let i = 0; i < 64; i++) {
      if (!b.has(i) || now < this.appearAt[i]) continue;
      const pos = this.cellPos(i);
      const inPreview = (prevRows & (1 << (i >> 3))) !== 0 || (prevCols & (1 << (i & 7))) !== 0;
      let color = b.color[i];
      let scale = this.jelly.breath(i, now);
      if (inPreview && drag) {
        color = drag.color;
        scale *= pulse;
      }
      const gray = now >= goStart + goRank++ * THEME.gameOver.desatStaggerMs;
      const sp = (gray ? this.sprites.gray : this.sprites.jelly)[color];
      this.block(sp, pos.x, pos.y, L.cs, this.jelly.sx[i] * scale, this.jelly.sy[i] * scale, this.jelly.oy[i]);
    }

    // Popping cells (cleared, waiting for their turn in the sequence).
    for (const pp of this.popping) {
      if (now < pp.showAt) continue;
      const pos = this.cellPos(pp.i);
      const t = clamp01((now - pp.popAt) / C.growMs);
      const sc = 1 + (C.growScale - 1) * easeOutCubic(t);
      const sp = this.sprites.jelly[pp.color];
      this.block(sp, pos.x, pos.y - (L.cs * (sc - 1)) / 2, L.cs, sc * this.jelly.sx[pp.i], sc * this.jelly.sy[pp.i]);
      if (t > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.5 * t;
        this.block(sp, pos.x, pos.y - (L.cs * (sc - 1)) / 2, L.cs, sc, sc);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
    }

    // Ghost + line glow.
    if (drag?.target) {
      const p = PIECES[drag.piece];
      ctx.globalAlpha = THEME.drag.ghostAlpha;
      const g = this.cellPos(drag.target.r * 8 + drag.target.c);
      this.piece(drag.piece, drag.color, g.x, g.y, L.cs);
      ctx.globalAlpha = 1;
      if (prevRows || prevCols) this.drawLineGlow(prevRows, prevCols, pulse);
      void p;
    }

    this.drawSweeps(now);
    this.particles.draw(ctx, this.sprites.droplets, this.colors);

    // Tray.
    for (let slot = 0; slot < 3; slot++) {
      const t = s.tray[slot];
      if (!t) continue;
      if (drag && drag.slot === slot) continue;
      if (this.flyers.some((f) => f.kind === 'return' && f.slot === slot)) continue;
      const p = PIECES[t.piece];
      const tp = trayPiecePos(L, slot, p.w, p.h);
      const k = clamp01((now - this.dealStart - slot * THEME.tray.dealStaggerMs) / THEME.tray.dealPopMs);
      const sc = k >= 1 ? 1 : Math.max(0, easeOutBack(k, 2));
      if (sc <= 0) continue;
      const fits = s.fits[slot];
      const cx = tp.x + (p.w * tp.cs) / 2;
      const cy = tp.y + (p.h * tp.cs) / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(sc, sc);
      ctx.globalAlpha = fits ? 1 : THEME.tray.unfitAlpha;
      this.piece(t.piece, t.color, -(p.w * tp.cs) / 2, -(p.h * tp.cs) / 2, tp.cs, !fits);
      ctx.restore();
    }

    // Flyers.
    for (const f of this.flyers) {
      const pose = this.flyerPose(f, now);
      const p = PIECES[f.piece];
      ctx.save();
      ctx.translate(pose.x + (p.w * pose.cs) / 2, pose.y + (p.h * pose.cs) / 2);
      ctx.rotate(pose.tilt);
      this.pieceCentered(f.piece, f.color, pose.cs, false);
      ctx.restore();
    }

    // Dragged piece with shadow, tilt and stretch.
    if (drag) {
      const D = THEME.drag;
      const st = drag.stretch.x;
      const ax = Math.abs(drag.dirX);
      const ay = Math.abs(drag.dirY);
      const sx = 1 + st * ax - st * 0.5 * ay;
      const sy = 1 + st * ay - st * 0.5 * ax;
      const lift = clamp01((now - drag.start) / D.pickupMs);
      ctx.save();
      ctx.translate(drag.cx, drag.cy + D.shadowOffset * lift);
      ctx.rotate(drag.tilt.x);
      ctx.scale(sx, sy);
      ctx.globalAlpha = D.shadowAlpha * lift;
      this.pieceCentered(drag.piece, drag.color, drag.cs, true);
      ctx.restore();
      ctx.save();
      ctx.translate(drag.cx, drag.cy);
      ctx.rotate(drag.tilt.x);
      ctx.scale(sx, sy);
      this.pieceCentered(drag.piece, drag.color, drag.cs, false);
      ctx.restore();
    }

    // Popups and words.
    this.popups.drawScores(ctx, now);
    this.popups.drawWord(ctx, now, L.boardX + L.boardSize / 2, L.boardY + L.boardSize * 0.42, Math.max(34, L.cs * 1.15));
    this.popups.drawCombo(ctx, now, L.boardX + L.boardSize / 2, L.boardY - 2, Math.max(15, Math.min(22, L.cs * 0.36)));

    if (now - this.flashAt < 120) {
      ctx.globalAlpha = 0.6 * (1 - (now - this.flashAt) / 120);
      ctx.fillStyle = '#fff';
      roundRectPath(ctx, L.boardX, L.boardY, L.boardSize, L.boardSize, THEME.layout.frameRadius);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (this.gameOverAt >= 0 && now >= this.gameOverAt) this.drawGameOverText(now);
    ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
  }

  private drawLineGlow(rows: number, cols: number, pulse: number): void {
    const L = this.lay;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const a = 0.1 + 0.12 * ((pulse - 1) / THEME.drag.previewPulseScale);
    const pad = L.cs * 0.04;
    for (let r = 0; r < 8; r++) {
      if (!(rows & (1 << r))) continue;
      const y = L.gridY + r * L.cs;
      const g = ctx.createLinearGradient(0, y, 0, y + L.cs);
      g.addColorStop(0, `rgba(255,255,255,0)`);
      g.addColorStop(0.5, `rgba(255,255,255,${a})`);
      g.addColorStop(1, `rgba(255,255,255,0)`);
      ctx.fillStyle = g;
      roundRectPath(ctx, L.gridX - pad, y - pad, 8 * L.cs + 2 * pad, L.cs + 2 * pad, L.cs * 0.3);
      ctx.fill();
    }
    for (let c = 0; c < 8; c++) {
      if (!(cols & (1 << c))) continue;
      const x = L.gridX + c * L.cs;
      const g = ctx.createLinearGradient(x, 0, x + L.cs, 0);
      g.addColorStop(0, `rgba(255,255,255,0)`);
      g.addColorStop(0.5, `rgba(255,255,255,${a})`);
      g.addColorStop(1, `rgba(255,255,255,0)`);
      ctx.fillStyle = g;
      roundRectPath(ctx, x - pad, L.gridY - pad, L.cs + 2 * pad, 8 * L.cs + 2 * pad, L.cs * 0.3);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawSweeps(now: number): void {
    if (!this.sweeps.length) return;
    const L = this.lay;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const s of this.sweeps) {
      const t = clamp01((now - s.start) / C.sweepMs);
      if (t <= 0) continue;
      const span = 8 * L.cs;
      const head = -0.3 * span + 1.6 * span * easeOutCubic(t);
      const alpha = 0.55 * (1 - t);
      if (s.row >= 0) {
        const y = L.gridY + s.row * L.cs;
        const g = ctx.createLinearGradient(L.gridX + head - L.cs * 2.5, 0, L.gridX + head, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(1, `rgba(255,255,255,${alpha})`);
        ctx.fillStyle = g;
        ctx.fillRect(L.gridX, y, span, L.cs);
      } else {
        const x = L.gridX + s.col * L.cs;
        const g = ctx.createLinearGradient(0, L.gridY + head - L.cs * 2.5, 0, L.gridY + head);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(1, `rgba(255,255,255,${alpha})`);
        ctx.fillStyle = g;
        ctx.fillRect(x, L.gridY, L.cs, span);
      }
    }
    ctx.restore();
  }

  private drawGameOverText(now: number): void {
    const L = this.lay;
    const ctx = this.ctx;
    const t = clamp01((now - this.gameOverAt) / 380);
    ctx.save();
    ctx.globalAlpha = 0.55 * t;
    ctx.fillStyle = '#12082A';
    roundRectPath(ctx, L.boardX, L.boardY, L.boardSize, L.boardSize, THEME.layout.frameRadius);
    ctx.fill();
    ctx.globalAlpha = t;
    ctx.translate(L.boardX + L.boardSize / 2, L.boardY + L.boardSize / 2);
    const sc = easeOutBack(t, 2);
    ctx.scale(sc, sc);
    outlinedText(ctx, 'No space left', 0, 0, Math.max(30, L.cs * 0.9), '#5B1F8A');
    ctx.restore();
  }

  /** Text width helper for UI that draws on canvas. */
  measure(text: string, size: number): number {
    this.ctx.font = `800 ${size}px ${FONT}`;
    return this.ctx.measureText(text).width;
  }
}

/** Outline colour for feedback words: the jelly colour, darkened so white text stays readable. */
function darkOutline(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const k = 0.72;
  return `rgb(${(r * k) | 0},${(g * k) | 0},${(b * k) | 0})`;
}
