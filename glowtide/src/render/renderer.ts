import { BALANCE } from '../config/balance';
import { CRITTER_COLORS, PALETTE } from '../config/palette';
import { clamp, easeOutBack, TAU } from '../core/math';
import type { Critter } from '../game/critters/critter';
import type { World } from '../game/world';
import { Background } from './background';
import { Camera } from './camera';
import { Particles } from './particles';
import { EYE_OFFSET_Y, SpriteCache } from './sprites';

const V = BALANCE.view;
const TIER_LABEL: Record<string, string> = { burst: 'Burst', ripple: 'Ripple', surge: 'Surge' };
const SHELL_GAP = 0.07;

export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  readonly sprites = new SpriteCache();
  readonly background = new Background();
  readonly particles = new Particles();
  readonly camera = new Camera();

  cssW = 1;
  cssH = 1;
  dpr = 1;
  /** CSS pixels per world unit. */
  k = 1;
  halfW = 1;
  halfH = 1;
  dprCap: number = V.maxDpr;

  private time = 0;
  private flash = 0;
  private deathAge = -1;

  constructor(readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D canvas unavailable');
    this.ctx = ctx;
  }

  resize(cssW: number, cssH: number, deviceDpr: number): void {
    this.cssW = Math.max(1, cssW);
    this.cssH = Math.max(1, cssH);
    this.dpr = Math.min(deviceDpr || 1, this.dprCap);
    this.k = clamp(Math.min(this.cssW, this.cssH) / V.designSize, V.minScale, V.maxScale);
    this.halfW = this.cssW / this.k / 2;
    this.halfH = this.cssH / this.k / 2;
    this.canvas.width = Math.round(this.cssW * this.dpr);
    this.canvas.height = Math.round(this.cssH * this.dpr);
    this.canvas.style.width = `${this.cssW}px`;
    this.canvas.style.height = `${this.cssH}px`;
    this.sprites.setScale(this.k * this.dpr);
    this.background.resize(
      this.canvas.width,
      this.canvas.height,
      BALANCE.pearl.radius * this.k * this.dpr,
    );
  }

  /** Converts a CSS-pixel position relative to the canvas into world units. */
  toWorldX(cssX: number): number {
    return (cssX - this.cssW / 2) / this.k;
  }

  toWorldY(cssY: number): number {
    return (cssY - this.cssH / 2) / this.k;
  }

  /** Wires world events to particles and shake. */
  attach(world: World): void {
    const P = this.particles;
    const e = world.events;
    e.on('pop', (p) => {
      const hex = CRITTER_COLORS[p.color].hex;
      const n = 10 + Math.floor(Math.random() * 7);
      for (let i = 0; i < n; i++) P.bubble(p.x, p.y, 150, 3.2, 0.6, hex);
      for (let i = 0; i < 5; i++) P.spark(p.x, p.y, 220, 0.35, '#FFFFFF');
      P.ring(p.x, p.y, p.radius * 0.6, p.radius * 2.1, 0.32, hex);
    });
    e.on('kill', (p) => {
      const hex = CRITTER_COLORS[p.color].hex;
      for (let i = 0; i < 8; i++) P.bubble(p.x, p.y, 120, 2.8, 0.5, hex);
      P.ring(p.x, p.y, p.radius * 0.5, p.radius * 1.7, 0.28, hex);
    });
    e.on('burst', () => this.camera.addTrauma(BALANCE.chainEffects.burstShakeTrauma));
    e.on('snap', (p) => {
      for (let i = 0; i < 7; i++) P.spark(p.x, p.y, 160, 0.3, '#FFE9A8');
    });
    e.on('emptyTap', (p) => P.ring(p.x, p.y, 4, 26, 0.35, '#9CC7D9'));
    e.on('link', (p) => P.ring(p.x, p.y, 18, 30, 0.22, '#FFFFFF'));
    e.on('pearlHit', (p) => {
      const hex = CRITTER_COLORS[p.color].hex;
      for (let i = 0; i < 8; i++) P.bubble(p.x, p.y, 90, 2.5, 0.45, hex);
      if (p.lost > 0) {
        this.camera.addTrauma(BALANCE.pearl.hitShakeTrauma);
        for (let i = 0; i < 10; i++) P.spark(p.x, p.y, 200, 0.4, PALETTE.damageFlash);
      }
    });
    e.on('death', () => {
      this.deathAge = 0;
      this.camera.addTrauma(0.6);
    });
    e.on('runEnd', () => {
      this.flash = 1;
      for (let i = 0; i < 40; i++) P.spark(0, 0, 420, 0.9, '#F4F1FF');
      for (let i = 0; i < 24; i++) P.bubble(0, 0, 260, 5, 1.2, '#CDE7F2');
      P.ring(0, 0, 40, 260, 0.8, '#F4F1FF');
    });
  }

  resetRun(): void {
    this.particles.clear();
    this.camera.reset();
    this.flash = 0;
    this.deathAge = -1;
  }

  render(world: World, realDt: number): void {
    const ctx = this.ctx;
    const gameDt = realDt * world.timeScale.value;
    this.time += realDt;
    this.camera.update(realDt);
    this.particles.update(gameDt);
    if (this.deathAge >= 0) this.deathAge += realDt;
    this.flash = Math.max(0, this.flash - realDt * 2.5);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    this.background.draw(ctx, this.time, this.dpr);

    const s = this.dpr * this.k;
    ctx.setTransform(
      s,
      0,
      0,
      s,
      this.dpr * (this.cssW / 2 + this.camera.offsetX),
      this.dpr * (this.cssH / 2 + this.camera.offsetY),
    );

    this.drawEffects(world);
    this.drawPearl(world);
    this.drawRope(world);
    this.drawCritters(world);
    this.particles.draw(ctx);
    this.drawTierLabel(world);

    if (this.flash > 0) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = this.flash * 0.7;
      ctx.fillStyle = '#F4F1FF';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.globalAlpha = 1;
    }
  }

  private drawEffects(world: World): void {
    const ctx = this.ctx;
    for (const e of world.effects.list) {
      const t = e.age / e.life;
      const r = e.radius * (0.25 + 0.75 * (1 - (1 - t) * (1 - t)));
      const fade = 1 - t;
      ctx.strokeStyle = CRITTER_COLORS[e.color].hex;
      ctx.globalAlpha = fade * 0.25;
      ctx.lineWidth = 14 * fade + 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = fade * 0.9;
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(e.x, e.y, r * 0.92, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private drawPearl(world: World): void {
    const ctx = this.ctx;
    const pearl = world.pearl;
    const r = pearl.radius;
    const sprite = this.sprites.pearl(r);
    const wobble = Math.sin(pearl.hitAge * 40) * Math.exp(-pearl.hitAge * 8) * 0.07;
    const breathe = 1 + Math.sin(this.time * 1.6) * 0.012 + wobble;
    const h = sprite.half * breathe;
    ctx.drawImage(sprite.canvas, -h, -h, h * 2, h * 2);

    if (this.deathAge >= 0)
      this.drawCracks(r, Math.min(1, this.deathAge / BALANCE.pearl.deathSlowmoTime));

    // Focus arc (inner ring).
    const fr = r + 7;
    const frac = world.focus / world.focusMax;
    ctx.lineCap = 'round';
    ctx.lineWidth = 4;
    ctx.strokeStyle = frac <= 0.001 ? 'rgba(234,247,255,0.35)' : 'rgba(156,199,217,0.22)';
    ctx.beginPath();
    ctx.arc(0, 0, fr, 0, TAU);
    ctx.stroke();
    if (frac > 0.001) {
      ctx.strokeStyle = world.chain.active ? '#C7F3FF' : '#7FD8F5';
      ctx.globalAlpha = world.chain.active ? 1 : 0.85;
      ctx.beginPath();
      ctx.arc(0, 0, fr, -Math.PI / 2, -Math.PI / 2 + frac * TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Shell segments (outer ring).
    const sr = r + 17;
    const n = pearl.maxShell;
    const seg = TAU / n;
    ctx.lineCap = 'butt';
    ctx.lineWidth = 6;
    for (let i = 0; i < n; i++) {
      const a0 = -Math.PI / 2 + i * seg + SHELL_GAP / 2;
      const a1 = a0 + seg - SHELL_GAP;
      const intact = i < pearl.shell;
      if (intact) {
        ctx.strokeStyle = PALETTE.shellSegment;
        ctx.globalAlpha = 0.9;
      } else if (i === pearl.flashSegment && pearl.flashTime > 0) {
        ctx.strokeStyle = PALETTE.damageFlash;
        ctx.globalAlpha = 0.3 + 0.7 * (pearl.flashTime / BALANCE.pearl.segmentFlashTime);
      } else {
        ctx.strokeStyle = PALETTE.shellSegment;
        ctx.globalAlpha = 0.12;
      }
      ctx.beginPath();
      ctx.arc(0, 0, sr, a0, a1);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private drawCracks(r: number, t: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = '#5B4E9E';
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    const branches = 5;
    for (let b = 0; b < branches; b++) {
      const a = (b / branches) * TAU + 0.4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      const len = r * t;
      for (let j = 1; j <= 4; j++) {
        const d = (len * j) / 4;
        const jitter = (j % 2 === 0 ? 1 : -1) * 0.18;
        ctx.lineTo(Math.cos(a + jitter) * d, Math.sin(a + jitter) * d);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawCritters(world: World): void {
    const ctx = this.ctx;
    const t = this.time;
    const chainColor = world.chain.chainColor;
    const pulseHex = chainColor >= 0 ? CRITTER_COLORS[chainColor].hex : '#FFFFFF';
    const pulse = 0.4 + 0.35 * Math.sin(t * 9);

    for (const c of world.critters) {
      if (!c.alive) continue;
      const sprite = this.sprites.critter(c.color, c.radius);
      let scale = c.emerge < 1 ? Math.max(0.01, easeOutBack(c.emerge)) : 1;
      if (c.popping) scale *= 1.12 + 0.06 * Math.sin(t * 40);
      else if (c.linked) scale *= 1.08;
      const sx = scale * (1 + 0.035 * Math.sin(c.age * 5 + c.wobblePhase));
      const sy = scale * (1 - 0.035 * Math.sin(c.age * 5 + c.wobblePhase));
      const h = sprite.half;
      ctx.globalAlpha = c.emerge;
      ctx.drawImage(sprite.canvas, c.x - h * sx, c.y - h * sy, h * 2 * sx, h * 2 * sy);
      this.drawEyes(c, scale);

      if (c.candidate) {
        ctx.globalAlpha = pulse;
        ctx.strokeStyle = pulseHex;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.radius + 8 + 2 * Math.sin(t * 9), 0, TAU);
        ctx.stroke();
      }
      if (c.linked || c.popping) {
        ctx.globalAlpha = c.popping ? 0.95 : 0.8;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.radius * scale + 5, 0, TAU);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawEyes(c: Critter, scale: number): void {
    const ctx = this.ctx;
    const r = c.radius * scale;
    const shape = CRITTER_COLORS[c.color].shape;
    const cy = c.y + EYE_OFFSET_Y[shape] * r;
    const d = Math.sqrt(c.x * c.x + c.y * c.y) || 1;
    const lx = (-c.x / d) * r * 0.08;
    const ly = (-c.y / d) * r * 0.08;
    const sep = r * 0.34;
    const er = r * 0.2;
    const blink = c.blinkLeft > 0 ? 0.15 : 1;

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(c.x - sep, cy, er, er * blink, 0, 0, TAU);
    ctx.ellipse(c.x + sep, cy, er, er * blink, 0, 0, TAU);
    ctx.fill();
    if (blink < 1) return;
    const pr = er * 0.55;
    ctx.fillStyle = '#0A2C40';
    ctx.beginPath();
    ctx.arc(c.x - sep + lx, cy + ly, pr, 0, TAU);
    ctx.moveTo(c.x + sep + lx + pr, cy + ly);
    ctx.arc(c.x + sep + lx, cy + ly, pr, 0, TAU);
    ctx.fill();
  }

  private drawRope(world: World): void {
    const ctx = this.ctx;
    const nodes = world.chain.nodes;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Chains currently popping: the rope through the nodes still waiting to pop, glowing white.
    for (const b of world.popBatches) {
      for (let i = Math.max(1, b.next); i < b.nodes.length; i++) {
        const a = b.nodes[i - 1];
        const n = b.nodes[i];
        if (!n.alive) continue;
        this.ropeSegment(a.x, a.y, n.x, n.y, '#FFFFFF', 10, 3, 0.9, i);
      }
    }

    if (nodes.length === 0) return;
    const len = nodes.length;
    const charged = world.tier !== 'none';
    const glowW = (12 + len * 0.9) * (charged ? 1.3 : 1);
    const coreW = (2.2 + len * 0.18) * (charged ? 1.3 : 1);
    const alpha = charged ? 1 : 0.85;

    for (let i = 1; i < len; i++) {
      const a = nodes[i - 1];
      const b = nodes[i];
      const hex = b.prism ? '#FFFFFF' : CRITTER_COLORS[b.color].hex;
      this.ropeSegment(a.x, a.y, b.x, b.y, hex, glowW, coreW, alpha, i);
    }

    // Dangling segment from the last node to the pointer.
    const last = nodes[len - 1];
    const p = world.pointer;
    if (!p.down) return;
    if (world.tooFar) {
      const flicker = 0.35 + Math.random() * 0.6;
      this.ropeSegment(
        last.x,
        last.y,
        p.x,
        p.y,
        PALETTE.ropeTooFar,
        glowW * 0.7,
        coreW,
        flicker,
        len,
      );
    } else {
      const hex = last.prism ? '#FFFFFF' : CRITTER_COLORS[last.color].hex;
      this.ropeSegment(last.x, last.y, p.x, p.y, hex, glowW * 0.6, coreW * 0.8, 0.55, len);
    }
  }

  private ropeSegment(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    hex: string,
    glowW: number,
    coreW: number,
    alpha: number,
    seed: number,
  ): void {
    const ctx = this.ctx;
    const dx = bx - ax;
    const dy = by - ay;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const wave = Math.sin(this.time * 7 + seed * 1.3) * Math.min(6, d * 0.06);
    const mx = (ax + bx) / 2 + (-dy / d) * wave;
    const my = (ay + by) / 2 + (dx / d) * wave;
    ctx.strokeStyle = hex;
    ctx.globalAlpha = alpha * 0.32;
    ctx.lineWidth = glowW;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo(mx, my, bx, by);
    ctx.stroke();
    ctx.globalAlpha = alpha;
    ctx.lineWidth = coreW;
    ctx.stroke();
    ctx.strokeStyle = '#FFFFFF';
    ctx.globalAlpha = alpha * 0.6;
    ctx.lineWidth = coreW * 0.4;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  private drawTierLabel(world: World): void {
    if (world.tier === 'none') return;
    const last = world.chain.last;
    if (!last) return;
    const ctx = this.ctx;
    const label = TIER_LABEL[world.tier];
    const bob = Math.sin(this.time * 6) * 2;
    ctx.font = '700 20px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const x = last.x;
    const y = last.y - last.radius - 26 + bob;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#04131F';
    ctx.strokeText(label, x, y);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#FFF4D6';
    ctx.fillText(label, x, y);
  }
}
