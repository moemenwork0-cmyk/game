/**
 * Renders Jello: soft-body outline, glossy translucent jelly with drifting inner bubbles, kawaii face
 * (sparkly eyes with lashes, cat mouth, blush), arms, feet, tuft, crown, sunglasses, fx and his
 * speech bubble.
 */
import { clamp01, easeOutBack } from '../core/tween';
import { roundRectPath } from '../render/blockSprites';
import { FONT } from '../render/popups';
import type { EyeStyle, Fx, Jello, RGB } from './jello';

const INK = '#1B1538';
const N = 64;
const ptsX = new Float32Array(N);
const ptsY = new Float32Array(N);

const BASE: RGB = [255, 111, 153];

interface Palette {
  top: string;
  mid: string;
  low: string;
  bottom: string;
  edge: string;
  foot: string;
}

function mixRgb(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
const css = (c: RGB, a = 1): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const light = (c: RGB, p: number): RGB => mixRgb(c, [255, 255, 255], p);
const dark = (c: RGB, p: number): RGB => mixRgb(c, [0, 0, 0], p);

function palette(j: Jello): Palette {
  const c = j.tint && j.tintAmount > 0 ? mixRgb(BASE, j.tint, j.tintAmount) : BASE;
  return {
    top: css(light(c, 0.5)),
    mid: css(light(c, 0.08)),
    low: css(dark(c, 0.06)),
    bottom: css(dark(c, 0.18)),
    edge: css(dark(c, 0.38)),
    foot: css(dark(c, 0.12)),
  };
}

/** Builds the body outline in local coordinates (origin = feet centre, y up = negative). */
function outline(j: Jello): { bottom: number } {
  const R = j.R;
  const hh = j.H / 2;
  const n = 2.6;
  const flat = 0.8;
  const bottom = hh * (flat + (1 - flat) * 0.35);
  const m2 = j.m2.x;
  const m3 = j.m3.x;
  const dent = j.poke.x;
  for (let i = 0; i < N; i++) {
    const th = (i / N) * Math.PI * 2;
    const c = Math.cos(th);
    const s = Math.sin(th);
    let px = Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * R;
    let py = Math.sign(s) * Math.pow(Math.abs(s), 2 / n) * hh;
    // Mochi gumdrop: wider towards the bottom, flattened seat.
    px *= 1 + 0.15 * (py / hh);
    if (py > hh * flat) py = hh * flat + (py - hh * flat) * 0.35;
    let d = th - j.pokeAngle;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    const f = 1 + m2 * 0.05 * Math.cos(2 * th) + m3 * 0.04 * Math.sin(3 * th + 0.6) - dent * Math.exp(-(d * d) / 0.18);
    ptsX[i] = px * f;
    ptsY[i] = py * f - bottom;
  }
  return { bottom };
}

function bodyPath(ctx: CanvasRenderingContext2D, dy = 0): void {
  ctx.beginPath();
  const mx = (ptsX[N - 1] + ptsX[0]) / 2;
  const my = (ptsY[N - 1] + ptsY[0]) / 2 + dy;
  ctx.moveTo(mx, my);
  for (let i = 0; i < N; i++) {
    const nx = ptsX[(i + 1) % N];
    const ny = ptsY[(i + 1) % N];
    ctx.quadraticCurveTo(ptsX[i], ptsY[i] + dy, (ptsX[i] + nx) / 2, (ptsY[i] + ny) / 2 + dy);
  }
  ctx.closePath();
}

function star(ctx: CanvasRenderingContext2D, r: number, rot = 0): void {
  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = rot - Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 === 0 ? r : r * 0.45;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
}

function heart(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.beginPath();
  ctx.moveTo(0, s * 0.35);
  ctx.bezierCurveTo(-s * 1.1, -s * 0.35, -s * 0.45, -s * 1.05, 0, -s * 0.45);
  ctx.bezierCurveTo(s * 0.45, -s * 1.05, s * 1.1, -s * 0.35, 0, s * 0.35);
  ctx.closePath();
}

function drawEye(
  ctx: CanvasRenderingContext2D,
  style: EyeStyle,
  x: number,
  y: number,
  R: number,
  closed: number,
  now: number,
  side: number,
): void {
  const w = R * 0.27;
  const h = R * 0.36;
  ctx.save();
  ctx.translate(x, y);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  if (style === 'happy' || ((style === 'normal' || style === 'wide') && closed > 0.85)) {
    ctx.lineWidth = R * 0.09;
    ctx.beginPath();
    if (style === 'happy') ctx.arc(0, h * 0.28, w * 0.85, Math.PI * 1.12, Math.PI * 1.88);
    else ctx.arc(0, -h * 0.05, w * 0.85, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  } else if (style === 'closed') {
    ctx.lineWidth = R * 0.08;
    ctx.beginPath();
    ctx.arc(0, -h * 0.1, w * 0.8, Math.PI * 0.2, Math.PI * 0.8);
    ctx.stroke();
  } else if (style === 'squint') {
    // > <
    ctx.lineWidth = R * 0.085;
    ctx.beginPath();
    ctx.moveTo(-side * w * 0.6, -h * 0.4);
    ctx.lineTo(side * w * 0.55, 0);
    ctx.lineTo(-side * w * 0.6, h * 0.4);
    ctx.stroke();
  } else if (style === 'star') {
    ctx.rotate(Math.sin(now / 160) * 0.15);
    star(ctx, w * 1.3);
    ctx.fillStyle = '#FFD84A';
    ctx.fill();
    ctx.lineWidth = R * 0.05;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(-w * 0.3, -w * 0.35, w * 0.18, 0, Math.PI * 2);
    ctx.fill();
  } else if (style === 'heart') {
    const pulse = 1 + 0.12 * Math.sin(now / 120);
    ctx.scale(pulse, pulse);
    heart(ctx, w * 1.2);
    ctx.fillStyle = '#E8174F';
    ctx.fill();
    ctx.lineWidth = R * 0.05;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
  } else if (style === 'spiral') {
    ctx.rotate((now / 140) * side);
    ctx.lineWidth = R * 0.05;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 5; a += 0.25) {
      const rr = (a / (Math.PI * 5)) * w * 1.15;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.stroke();
  } else {
    // Big sparkly kawaii eye.
    const s = style === 'wide' ? 1.16 : 1;
    const open = 1 - closed;
    ctx.save();
    ctx.scale(s, s * Math.max(0.08, open));
    const g = ctx.createLinearGradient(0, -h, 0, h);
    g.addColorStop(0, '#1C1238');
    g.addColorStop(0.55, '#2E2163');
    g.addColorStop(1, '#6A55D0');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
    ctx.fill();
    if (open > 0.5) {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(-w * 0.28, -h * 0.36, w * 0.42, h * 0.3, -0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(w * 0.38, h * 0.36, w * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(w * 0.42, -h * 0.5, w * 0.09, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    // Two little lashes at the outer corner.
    if (open > 0.6 && style === 'normal') {
      ctx.lineWidth = R * 0.05;
      for (let k = 0; k < 2; k++) {
        const a = -0.55 - k * 0.42;
        const bx = side * Math.cos(a) * w * 0.98;
        const by = Math.sin(a) * h * 0.98;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + side * R * 0.09, by - R * 0.07);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

function drawMouth(ctx: CanvasRenderingContext2D, j: Jello, x: number, y: number, R: number, now: number): void {
  const f = j.face();
  const open = Math.max(0, j.mouthOpen.x);
  const smile = j.smile.x;
  const talking = j.talking();
  const w = R * (0.32 + 0.12 * Math.max(0, smile) + 0.06 * open);
  ctx.save();
  ctx.translate(x, y);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = R * 0.07;
  if (f.mouth === 'wavy' && !talking) {
    ctx.beginPath();
    for (let k = 0; k <= 16; k++) {
      const t = k / 16;
      ctx.lineTo(-w / 2 + w * t, Math.sin(t * Math.PI * 3 + now / 90) * R * 0.045);
    }
    ctx.stroke();
  } else if (f.mouth === 'cat' && !talking && open < 0.1) {
    // Cute ω mouth.
    const cw = R * 0.32;
    ctx.beginPath();
    ctx.moveTo(-cw / 2, -R * 0.02);
    ctx.quadraticCurveTo(-cw / 4, R * 0.13, 0, -R * 0.005);
    ctx.quadraticCurveTo(cw / 4, R * 0.13, cw / 2, -R * 0.02);
    ctx.stroke();
  } else if (open < 0.08) {
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.quadraticCurveTo(0, smile * R * 0.26, w / 2, 0);
    ctx.stroke();
  } else {
    const top = smile * R * 0.06;
    const depth = R * (0.08 + 0.42 * open) + Math.max(0, smile) * R * 0.08;
    const round = (f.mouth === 'o' || f.mouth === 'yawn') && !talking;
    const path = (): void => {
      ctx.beginPath();
      if (round) ctx.ellipse(0, depth * 0.35, R * (f.mouth === 'yawn' ? 0.2 : 0.13), depth * 0.55, 0, 0, Math.PI * 2);
      else {
        ctx.moveTo(-w / 2, 0);
        ctx.quadraticCurveTo(0, top, w / 2, 0);
        ctx.quadraticCurveTo(w * 0.42, depth, 0, depth);
        ctx.quadraticCurveTo(-w * 0.42, depth, -w / 2, 0);
      }
      ctx.closePath();
    };
    path();
    ctx.fillStyle = '#5B1230';
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#FF7FA0';
    ctx.beginPath();
    ctx.ellipse(0, depth * 1.02, w * 0.34, depth * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();
    if (smile > 0.5 && !round) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(-w * 0.3, top * 0.5 - R * 0.02, w * 0.6, R * 0.07);
    }
    ctx.restore();
    path();
    ctx.lineWidth = R * 0.055;
    ctx.stroke();
    if (f.mouth === 'tongue' && !talking) {
      ctx.fillStyle = '#FF7FA0';
      ctx.beginPath();
      ctx.ellipse(w * 0.12, depth * 0.95, R * 0.11, R * 0.13, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = R * 0.04;
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawArm(ctx: CanvasRenderingContext2D, P: Palette, R: number, sx: number, sy: number, rot: number, len: number): void {
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(rot);
  const th = R * 0.34;
  const g = ctx.createLinearGradient(0, 0, 0, len);
  g.addColorStop(0, P.mid);
  g.addColorStop(1, P.low);
  ctx.fillStyle = g;
  roundRectPath(ctx, -th / 2, -th * 0.2, th, len + th * 0.2, th / 2);
  ctx.fill();
  ctx.strokeStyle = P.edge;
  ctx.lineWidth = Math.max(1.4, R * 0.05);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.ellipse(-th * 0.15, len * 0.4, th * 0.13, len * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawTuft(ctx: CanvasRenderingContext2D, P: Palette, R: number, topY: number, angle: number): void {
  ctx.save();
  ctx.translate(0, topY + R * 0.14);
  ctx.rotate(angle);
  const h = R * 0.66;
  const w = R * 0.44;
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.bezierCurveTo(-w * 0.6, -h * 0.55, -w * 0.05, -h * 0.9, w * 0.42, -h);
  ctx.bezierCurveTo(w * 0.12, -h * 0.68, w * 0.62, -h * 0.4, w / 2, 0);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -h, 0, 0);
  g.addColorStop(0, P.top);
  g.addColorStop(1, P.mid);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = P.edge;
  ctx.lineWidth = Math.max(1.4, R * 0.05);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(-w * 0.05, -h * 0.55, w * 0.08, h * 0.16, 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCrown(ctx: CanvasRenderingContext2D, R: number, topY: number, pop: number, now: number): void {
  const s = pop < 1 ? easeOutBack(pop, 2.4) : 1;
  ctx.save();
  ctx.translate(R * 0.34, topY - R * 0.02 + Math.sin(now / 300) * R * 0.03);
  ctx.rotate(0.28);
  ctx.scale(s, s);
  const w = R * 0.72;
  const h = R * 0.48;
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.lineTo(-w / 2, -h * 0.75);
  ctx.lineTo(-w / 4, -h * 0.35);
  ctx.lineTo(0, -h);
  ctx.lineTo(w / 4, -h * 0.35);
  ctx.lineTo(w / 2, -h * 0.75);
  ctx.lineTo(w / 2, 0);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -h, 0, 0);
  g.addColorStop(0, '#FFF0A0');
  g.addColorStop(1, '#F7B500');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1.4, R * 0.05);
  ctx.strokeStyle = '#7A4A00';
  ctx.stroke();
  ctx.fillStyle = '#FF4F7E';
  ctx.beginPath();
  ctx.arc(0, -h * 0.35, R * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawGlasses(ctx: CanvasRenderingContext2D, R: number, eyeY: number, fx: number, drop: number): void {
  ctx.save();
  ctx.translate(fx, eyeY + drop * R * 1.8);
  ctx.rotate(-0.04);
  const lw = R * 0.6;
  const lh = R * 0.46;
  ctx.lineJoin = 'round';
  // Temples.
  ctx.strokeStyle = INK;
  ctx.lineWidth = R * 0.07;
  ctx.beginPath();
  ctx.moveTo(-R * 0.36 - lw / 2, -lh * 0.2);
  ctx.lineTo(-R * 0.98, -lh * 0.4);
  ctx.moveTo(R * 0.36 + lw / 2, -lh * 0.2);
  ctx.lineTo(R * 0.98, -lh * 0.4);
  ctx.stroke();
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(s * R * 0.36, 0);
    roundRectPath(ctx, -lw / 2, -lh / 2, lw, lh, lh * 0.45);
    const g = ctx.createLinearGradient(0, -lh / 2, 0, lh / 2);
    g.addColorStop(0, '#2B2B4A');
    g.addColorStop(1, '#0B0B18');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = R * 0.06;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = R * 0.05;
    ctx.beginPath();
    ctx.moveTo(-lw * 0.28, -lh * 0.05);
    ctx.lineTo(-lw * 0.05, -lh * 0.3);
    ctx.stroke();
    ctx.restore();
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = R * 0.07;
  ctx.beginPath();
  ctx.moveTo(-R * 0.36 + lw / 2, -lh * 0.15);
  ctx.quadraticCurveTo(0, -lh * 0.45, R * 0.36 - lw / 2, -lh * 0.15);
  ctx.stroke();
  ctx.restore();
}

function note(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.beginPath();
  ctx.ellipse(-s * 0.25, s * 0.45, s * 0.32, s * 0.24, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(s * 0.02, -s * 0.6, s * 0.12, s * 1.05);
  ctx.beginPath();
  ctx.moveTo(s * 0.14, -s * 0.6);
  ctx.quadraticCurveTo(s * 0.6, -s * 0.4, s * 0.45, 0);
  ctx.quadraticCurveTo(s * 0.45, -s * 0.3, s * 0.14, -s * 0.3);
  ctx.fill();
}

function drawFx(ctx: CanvasRenderingContext2D, fx: readonly Fx[]): void {
  for (const p of fx) {
    const t = p.age / p.life;
    const a = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(p.x, p.y);
    if (p.kind === 'sweat' || p.kind === 'tear') {
      const s = p.size;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.bezierCurveTo(s * 0.7, -s * 0.2, s * 0.7, s * 0.6, 0, s * 0.6);
      ctx.bezierCurveTo(-s * 0.7, s * 0.6, -s * 0.7, -s * 0.2, 0, -s);
      ctx.fillStyle = p.kind === 'sweat' ? '#9FE3FF' : '#7CC8FF';
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.arc(-s * 0.18, s * 0.05, s * 0.16, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'zzz') {
      ctx.rotate(p.rot);
      ctx.font = `800 ${p.size * (0.8 + t * 0.6)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = p.size * 0.2;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = INK;
      ctx.strokeText('z', 0, 0);
      ctx.fillStyle = '#CFE0FF';
      ctx.fillText('z', 0, 0);
    } else if (p.kind === 'heart') {
      ctx.rotate(p.rot);
      heart(ctx, p.size);
      ctx.fillStyle = '#FF5C8A';
      ctx.fill();
      ctx.lineWidth = p.size * 0.18;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
    } else if (p.kind === 'note') {
      ctx.rotate(p.rot);
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = INK;
      ctx.lineWidth = p.size * 0.22;
      ctx.lineJoin = 'round';
      ctx.save();
      note(ctx, p.size);
      ctx.restore();
      ctx.fillStyle = '#FFE27A';
      note(ctx, p.size * 0.92);
    } else if (p.kind === 'bubble') {
      const grow = clamp01(p.age / 0.4);
      const r = p.size * (0.3 + 0.7 * grow) * (t > 0.92 ? 1 + (t - 0.92) * 4 : 1);
      ctx.globalAlpha = t > 0.92 ? a * (1 - (t - 0.92) / 0.08) : a;
      ctx.fillStyle = 'rgba(255,170,200,0.22)';
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = Math.max(1.2, r * 0.1);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.ellipse(-r * 0.35, -r * 0.4, r * 0.22, r * 0.12, -0.6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.rotate(p.rot + t * 3);
      star(ctx, p.size * (1 - t * 0.5));
      ctx.fillStyle = '#FFE27A';
      ctx.fill();
      ctx.lineWidth = p.size * 0.15;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

export function drawJello(ctx: CanvasRenderingContext2D, j: Jello, now: number): void {
  if (!j.visible || j.appear <= 0.001) return;
  const R = j.R;
  const P = palette(j);
  const x0 = j.x + j.shakeX + j.offX.x;

  // Ground shadow.
  const lift = clamp01(j.jumpH / (R * 3));
  ctx.save();
  ctx.fillStyle = `rgba(4,8,30,${0.34 * (1 - lift * 0.6)})`;
  ctx.beginPath();
  ctx.ellipse(x0, j.ground + R * 0.03, R * 1.08 * j.sx.x * (1 - lift * 0.35) * j.appear, R * 0.2 * (1 - lift * 0.3), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const { bottom } = outline(j);
  ctx.save();
  ctx.translate(x0, j.ground - j.jumpH);
  ctx.scale(j.appear, j.appear);
  const cy = -j.H * 0.45;
  ctx.translate(0, cy);
  ctx.rotate(j.rot.x);
  ctx.translate(0, -cy);
  ctx.transform(1, 0, -j.lean.x, 1, 0, 0);

  // Feet (not squashed with the body; they dangle when airborne).
  const dangle = j.airborne ? R * 0.1 : 0;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(s * R * 0.42 * j.sx.x, R * 0.02 + dangle, R * 0.27, R * 0.17, s * (j.airborne ? 0.25 : 0), 0, Math.PI * 2);
    ctx.fillStyle = P.foot;
    ctx.fill();
    ctx.strokeStyle = P.edge;
    ctx.lineWidth = Math.max(1.4, R * 0.05);
    ctx.stroke();
  }

  ctx.scale(j.sx.x, j.sy.x);

  let topY = 0;
  for (let i = 0; i < N; i++) topY = Math.min(topY, ptsY[i]);
  const bodyMidY = -bottom;
  const shoulderY = bodyMidY + R * 0.3;
  const peek = j.action === 'peek';

  // Behind the body: tuft and arms.
  drawTuft(ctx, P, R, topY, j.tuft.x);
  if (!peek) {
    drawArm(ctx, P, R, -R * 0.88, shoulderY, j.armL.x, R * 0.5);
    drawArm(ctx, P, R, R * 0.88, shoulderY, -j.armR.x, R * 0.5);
  }

  // Body.
  bodyPath(ctx);
  const g = ctx.createLinearGradient(0, topY, 0, 0);
  g.addColorStop(0, P.top);
  g.addColorStop(0.4, P.mid);
  g.addColorStop(0.82, P.low);
  g.addColorStop(1, P.bottom);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // Translucent core glow.
  const core = ctx.createRadialGradient(0, bodyMidY + R * 0.3, 0, 0, bodyMidY + R * 0.3, R * 1.1);
  core.addColorStop(0, 'rgba(255,225,236,0.5)');
  core.addColorStop(1, 'rgba(255,225,236,0)');
  ctx.fillStyle = core;
  ctx.fillRect(-R * 2, topY, R * 4, -topY + 2);
  // Little bubbles drifting up inside the jelly.
  for (let k = 0; k < 5; k++) {
    const sp = 0.07 + k * 0.017;
    const ph = (now / 1000) * sp + k * 0.23;
    const u = ph - Math.floor(ph);
    const bx = Math.sin(k * 2.1 + now / 900) * R * 0.55;
    const by = -u * (-topY * 0.92) - R * 0.05;
    const br = R * (0.045 + (k % 3) * 0.025);
    ctx.globalAlpha = Math.sin(u * Math.PI) * 0.9;
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = Math.max(1, R * 0.018);
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // Bottom rim shade and a top-left rim light.
  ctx.lineWidth = R * 0.24;
  ctx.strokeStyle = 'rgba(150,20,70,0.26)';
  bodyPath(ctx, R * 0.09);
  ctx.stroke();
  ctx.lineWidth = R * 0.12;
  const rim = ctx.createLinearGradient(-R, topY, R * 0.4, bodyMidY);
  rim.addColorStop(0, 'rgba(255,255,255,0.55)');
  rim.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.strokeStyle = rim;
  bodyPath(ctx);
  ctx.stroke();
  ctx.restore();
  // Outline.
  bodyPath(ctx);
  ctx.lineWidth = Math.max(1.6, R * 0.055);
  ctx.strokeStyle = P.edge;
  ctx.stroke();
  // Window-shaped specular highlight + dot.
  ctx.save();
  ctx.translate(-R * 0.46, topY + j.H * 0.25);
  ctx.rotate(-0.55);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.ellipse(0, 0, R * 0.25, R * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.arc(-R * 0.12, topY + j.H * 0.13, R * 0.055, 0, Math.PI * 2);
  ctx.fill();

  // Face.
  const f = j.face();
  const fx = j.lookX.x * R * 0.16;
  const fy = j.lookY.x * R * 0.1;
  const eyeY = bodyMidY - R * 0.1 + fy;
  if (f.blush > 0) {
    for (const s of [-1, 1]) {
      const bx = s * R * 0.62 + fx * 0.8;
      const by = eyeY + R * 0.32;
      const bg = ctx.createRadialGradient(bx, by, 0, bx, by, R * 0.2);
      bg.addColorStop(0, `rgba(255,70,120,${0.55 * f.blush})`);
      bg.addColorStop(1, 'rgba(255,70,120,0)');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.ellipse(bx, by, R * 0.2, R * 0.13, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Eyes (hidden once the sunglasses are on).
  if (j.glassesY.x < -0.25) {
    drawEye(ctx, f.eyes, -R * 0.36 + fx, eyeY, R, j.blink, now, -1);
    drawEye(ctx, j.wink > 0.5 && f.eyes === 'normal' ? 'happy' : f.eyes, R * 0.36 + fx, eyeY, R, j.blink, now, 1);
  }
  const b = j.brows.x;
  if (Math.abs(b) > 0.05 && j.glassesY.x < -0.6) {
    ctx.strokeStyle = INK;
    ctx.lineCap = 'round';
    ctx.lineWidth = R * 0.07;
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(s * R * 0.36 + fx, eyeY - R * 0.4 - Math.abs(b) * R * 0.04);
      ctx.rotate(s * b * 0.45);
      ctx.beginPath();
      ctx.moveTo(-R * 0.12, 0);
      ctx.lineTo(R * 0.12, 0);
      ctx.stroke();
      ctx.restore();
    }
  }
  drawMouth(ctx, j, fx * 0.7, eyeY + R * 0.38, R, now);
  if (j.glassesY.x > -0.98) drawGlasses(ctx, R, eyeY, fx, j.glassesY.x);

  // Hands over the eyes (peek), drawn in front of the face.
  if (peek) {
    const len = R * 0.82;
    drawArm(ctx, P, R, -R * 0.86, shoulderY, -j.armL.x - 0.22, len);
    drawArm(ctx, P, R, R * 0.86, shoulderY, j.armR.x + 0.22, len);
  }

  if (j.crowned) drawCrown(ctx, R, topY, clamp01((now - j.crownPop) / 450), now);
  ctx.restore();

  drawFx(ctx, j.fx);
}

/**
 * Speech bubble beside Jello. `side` -1 = bubble to his left, 1 = to his right.
 * Words appear one by one while he talks. Clamped inside [minX, maxX].
 */
export function drawBubble(ctx: CanvasRenderingContext2D, j: Jello, now: number, side: -1 | 1, minX: number, maxX: number, fontSize: number): void {
  const s = j.speech;
  if (!s || !j.visible) return;
  const t = now - s.start;
  const outT = s.end - now;
  const shown = Math.min(s.words.length, 1 + Math.floor(t / s.wordMs));
  const pop = clamp01(t / 220);
  const scale = (pop < 1 ? easeOutBack(pop, 2.6) : 1) * (outT < 160 ? Math.max(0, outT / 160) : 1);
  if (scale <= 0.01) return;

  ctx.save();
  ctx.font = `800 ${fontSize}px ${FONT}`;
  ctx.direction = 'rtl';
  const full = ctx.measureText(s.text).width;
  const padX = fontSize * 0.8;
  const w = Math.min(full + padX * 2, maxX - minX);
  const h = fontSize * 2;
  const headY = j.ground - j.jumpH - j.H * 0.72;
  const gap = j.R * 1.3;
  let x = side < 0 ? j.x - gap - w : j.x + gap;
  x = Math.max(minX, Math.min(maxX - w, x));
  const y = headY - h / 2;
  const tailX = side < 0 ? x + w : x;
  const ox = side < 0 ? x + w : x;
  const wob = pop < 1 ? Math.sin(pop * Math.PI * 2) * 0.06 : 0;
  ctx.translate(ox, headY);
  ctx.scale(scale, scale);
  ctx.rotate(wob * -side);
  ctx.translate(-ox, -headY);

  const lw = Math.max(2.5, fontSize * 0.14);
  // Drop.
  ctx.fillStyle = 'rgba(8,14,44,0.35)';
  roundRectPath(ctx, x, y + fontSize * 0.22, w, h, h * 0.45);
  ctx.fill();
  // Tail (outlined) then body (outlined) so the seam disappears.
  const tip = tailX - side * fontSize * 0.85;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(tailX, headY - fontSize * 0.35);
  ctx.lineTo(tip, headY + fontSize * 0.3);
  ctx.lineTo(tailX, headY + fontSize * 0.42);
  ctx.closePath();
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = INK;
  ctx.lineWidth = lw;
  ctx.stroke();
  roundRectPath(ctx, x, y, w, h, h * 0.45);
  ctx.stroke();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(tailX, headY - fontSize * 0.35);
  ctx.lineTo(tip, headY + fontSize * 0.3);
  ctx.lineTo(tailX, headY + fontSize * 0.42);
  ctx.closePath();
  ctx.fill();
  // Soft shading at the bottom of the bubble.
  ctx.save();
  roundRectPath(ctx, x, y, w, h, h * 0.45);
  ctx.clip();
  ctx.fillStyle = 'rgba(120,150,230,0.16)';
  ctx.fillRect(x, y + h * 0.72, w, h * 0.3);
  ctx.restore();

  const words = s.words.slice(0, shown).join(' ');
  ctx.fillStyle = '#1C2350';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(words, x + w - padX, headY + fontSize * 0.06, w - padX * 2);
  ctx.restore();
}
