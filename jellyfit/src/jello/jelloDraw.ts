/** Renders Jello: soft-body outline, glossy jelly shading, face, arms, tuft, crown, fx and speech bubble. */
import { clamp01, easeOutBack } from '../core/tween';
import { roundRectPath } from '../render/blockSprites';
import { FONT } from '../render/popups';
import type { EyeStyle, Fx, Jello } from './jello';

const BODY = { top: '#FFB0C6', mid: '#FF6F99', low: '#EE4C80', bottom: '#D63A6E', edge: '#B32D5D' };
const INK = '#1C1838';
const N = 56;
const ptsX = new Float32Array(N);
const ptsY = new Float32Array(N);

/** Builds the body outline in local coordinates (origin = feet centre, y up = negative). */
function outline(j: Jello): { bottom: number } {
  const R = j.R;
  const hh = j.H / 2;
  const n = 2.5;
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
    // Gumdrop: wider towards the bottom, flattened seat.
    px *= 1 + 0.12 * (py / hh);
    if (py > hh * flat) py = hh * flat + (py - hh * flat) * 0.35;
    let d = th - j.pokeAngle;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    const f = 1 + m2 * 0.05 * Math.cos(2 * th) + m3 * 0.04 * Math.sin(3 * th + 0.6) - dent * Math.exp(-(d * d) / 0.18);
    ptsX[i] = px * f;
    ptsY[i] = py * f - bottom;
  }
  return { bottom };
}

function bodyPath(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  // Smooth closed curve through the points (midpoint quadratic splines).
  const mx = (ptsX[N - 1] + ptsX[0]) / 2;
  const my = (ptsY[N - 1] + ptsY[0]) / 2;
  ctx.moveTo(mx, my);
  for (let i = 0; i < N; i++) {
    const nx = ptsX[(i + 1) % N];
    const ny = ptsY[(i + 1) % N];
    ctx.quadraticCurveTo(ptsX[i], ptsY[i], (ptsX[i] + nx) / 2, (ptsY[i] + ny) / 2);
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

function drawEye(ctx: CanvasRenderingContext2D, style: EyeStyle, x: number, y: number, R: number, blink: number, now: number, side: number): void {
  const w = R * 0.25;
  const h = R * 0.34;
  ctx.save();
  ctx.translate(x, y);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (style === 'happy' || (style === 'normal' && blink > 0.85) || (style === 'wide' && blink > 0.85)) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = R * 0.085;
    ctx.beginPath();
    if (style === 'happy') ctx.arc(0, h * 0.25, w * 0.85, Math.PI * 1.1, Math.PI * 1.9);
    else ctx.arc(0, -h * 0.05, w * 0.85, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  } else if (style === 'closed') {
    ctx.strokeStyle = INK;
    ctx.lineWidth = R * 0.075;
    ctx.beginPath();
    ctx.arc(0, -h * 0.1, w * 0.8, Math.PI * 0.2, Math.PI * 0.8);
    ctx.stroke();
  } else if (style === 'star') {
    ctx.rotate(Math.sin(now / 160) * 0.15);
    star(ctx, w * 1.25);
    ctx.fillStyle = '#FFD84A';
    ctx.fill();
    ctx.lineWidth = R * 0.05;
    ctx.strokeStyle = INK;
    ctx.stroke();
  } else if (style === 'heart') {
    const pulse = 1 + 0.12 * Math.sin(now / 120);
    ctx.scale(pulse, pulse);
    heart(ctx, w * 1.15);
    ctx.fillStyle = '#E8174F';
    ctx.fill();
    ctx.lineWidth = R * 0.045;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
  } else if (style === 'spiral') {
    ctx.rotate((now / 140) * side);
    ctx.strokeStyle = INK;
    ctx.lineWidth = R * 0.05;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 5; a += 0.25) {
      const rr = (a / (Math.PI * 5)) * w * 1.1;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.stroke();
  } else {
    // Glossy kawaii eye.
    const s = style === 'wide' ? 1.18 : 1;
    const open = 1 - blink;
    ctx.scale(s, s * Math.max(0.08, open));
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
    ctx.fill();
    if (open > 0.5) {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(-w * 0.3, -h * 0.38, w * 0.38, h * 0.3, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(w * 0.35, h * 0.35, w * 0.17, 0, Math.PI * 2);
      ctx.fill();
      // Faint coloured bounce light at the bottom of the eye.
      ctx.fillStyle = 'rgba(120,170,255,0.35)';
      ctx.beginPath();
      ctx.ellipse(0, h * 0.62, w * 0.55, h * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawMouth(ctx: CanvasRenderingContext2D, j: Jello, x: number, y: number, R: number, now: number): void {
  const f = j.face();
  const open = Math.max(0, j.mouthOpen.x);
  const smile = j.smile.x;
  const w = R * (0.34 + 0.12 * Math.max(0, smile) + 0.06 * open);
  ctx.save();
  ctx.translate(x, y);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = R * 0.07;
  if (f.mouth === 'wavy' && !j.talking()) {
    ctx.beginPath();
    for (let k = 0; k <= 16; k++) {
      const t = k / 16;
      ctx.lineTo(-w / 2 + w * t, Math.sin(t * Math.PI * 3 + now / 90) * R * 0.045);
    }
    ctx.stroke();
  } else if (open < 0.08) {
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.quadraticCurveTo(0, smile * R * 0.26, w / 2, 0);
    ctx.stroke();
  } else {
    const top = smile * R * 0.06;
    const depth = R * (0.08 + 0.42 * open) + Math.max(0, smile) * R * 0.08;
    const round = f.mouth === 'o' && !j.talking();
    ctx.beginPath();
    if (round) {
      ctx.ellipse(0, depth * 0.35, R * 0.13, depth * 0.55, 0, 0, Math.PI * 2);
    } else {
      ctx.moveTo(-w / 2, 0);
      ctx.quadraticCurveTo(0, top, w / 2, 0);
      ctx.quadraticCurveTo(w * 0.42, depth, 0, depth);
      ctx.quadraticCurveTo(-w * 0.42, depth, -w / 2, 0);
    }
    ctx.closePath();
    const mouthPath = (): void => {
      ctx.beginPath();
      if (round) ctx.ellipse(0, depth * 0.35, R * 0.13, depth * 0.55, 0, 0, Math.PI * 2);
      else {
        ctx.moveTo(-w / 2, 0);
        ctx.quadraticCurveTo(0, top, w / 2, 0);
        ctx.quadraticCurveTo(w * 0.42, depth, 0, depth);
        ctx.quadraticCurveTo(-w * 0.42, depth, -w / 2, 0);
      }
      ctx.closePath();
    };
    ctx.fillStyle = '#5B1230';
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#FF7FA0';
    ctx.beginPath();
    ctx.ellipse(0, depth * 1.02, w * 0.32, depth * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();
    if (smile > 0.5 && !round) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(-w * 0.32, top * 0.5 - R * 0.02, w * 0.64, R * 0.07);
    }
    ctx.restore();
    mouthPath();
    ctx.lineWidth = R * 0.055;
    ctx.stroke();
    if (f.mouth === 'tongue' && !j.talking()) {
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

function drawArm(ctx: CanvasRenderingContext2D, R: number, sx: number, sy: number, angle: number, side: number): void {
  ctx.save();
  ctx.translate(sx, sy);
  // angle 0 = hanging down; positive raises the arm outward.
  ctx.rotate(side * angle);
  const len = R * 0.5;
  const th = R * 0.32;
  const g = ctx.createLinearGradient(0, 0, 0, len);
  g.addColorStop(0, BODY.mid);
  g.addColorStop(1, BODY.low);
  ctx.fillStyle = g;
  roundRectPath(ctx, -th / 2, -th * 0.2, th, len + th * 0.2, th / 2);
  ctx.fill();
  ctx.strokeStyle = BODY.edge;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = Math.max(1.2, R * 0.045);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(-th * 0.15, len * 0.35, th * 0.14, len * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawTuft(ctx: CanvasRenderingContext2D, R: number, topY: number, angle: number): void {
  ctx.save();
  ctx.translate(0, topY + R * 0.12);
  ctx.rotate(angle);
  const h = R * 0.62;
  const w = R * 0.42;
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.bezierCurveTo(-w * 0.55, -h * 0.55, -w * 0.05, -h * 0.85, w * 0.35, -h);
  ctx.bezierCurveTo(w * 0.15, -h * 0.65, w * 0.6, -h * 0.4, w / 2, 0);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -h, 0, 0);
  g.addColorStop(0, BODY.top);
  g.addColorStop(1, BODY.mid);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = BODY.edge;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = Math.max(1.2, R * 0.045);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawCrown(ctx: CanvasRenderingContext2D, R: number, topY: number, pop: number, now: number): void {
  const s = pop < 1 ? easeOutBack(pop, 2.4) : 1;
  ctx.save();
  ctx.translate(R * 0.32, topY - R * 0.05 + Math.sin(now / 300) * R * 0.03);
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
  ctx.lineWidth = Math.max(1.2, R * 0.05);
  ctx.strokeStyle = '#8A5A00';
  ctx.stroke();
  ctx.fillStyle = '#FF4F7E';
  ctx.beginPath();
  ctx.arc(0, -h * 0.35, R * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
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
      ctx.lineWidth = p.size * 0.18;
      ctx.strokeStyle = '#1C1838';
      ctx.strokeText('z', 0, 0);
      ctx.fillStyle = '#CFE0FF';
      ctx.fillText('z', 0, 0);
    } else if (p.kind === 'heart') {
      ctx.rotate(p.rot);
      heart(ctx, p.size);
      ctx.fillStyle = '#FF5C8A';
      ctx.fill();
    } else {
      ctx.rotate(p.rot + t * 3);
      star(ctx, p.size * (1 - t * 0.5));
      ctx.fillStyle = '#FFE27A';
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

export function drawJello(ctx: CanvasRenderingContext2D, j: Jello, now: number): void {
  if (!j.visible || j.appear <= 0.001) return;
  const R = j.R;
  // Ground shadow.
  const lift = clamp01(j.jumpH / (R * 3));
  ctx.save();
  ctx.fillStyle = `rgba(4,8,26,${0.32 * (1 - lift * 0.6)})`;
  ctx.beginPath();
  ctx.ellipse(j.x + j.shakeX, j.ground + R * 0.02, R * 1.05 * j.sx.x * (1 - lift * 0.35) * j.appear, R * 0.2 * (1 - lift * 0.3), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const { bottom } = outline(j);
  ctx.save();
  ctx.translate(j.x + j.shakeX, j.ground - j.jumpH);
  ctx.scale(j.appear, j.appear);
  // Rotate around the body centre, shear for lean, squash anchored at the feet.
  const cy = -j.H * 0.45;
  ctx.translate(0, cy);
  ctx.rotate(j.rot.x);
  ctx.translate(0, -cy);
  ctx.transform(1, 0, -j.lean.x, 1, 0, 0);
  ctx.scale(j.sx.x, j.sy.x);

  let topY = 0;
  for (let i = 0; i < N; i++) topY = Math.min(topY, ptsY[i]);
  const bodyMidY = -bottom;

  // Behind the body: tuft and arms.
  drawTuft(ctx, R, topY, j.tuft.x);
  drawArm(ctx, R, -R * 0.86, bodyMidY + R * 0.28, j.armL.x, 1);
  drawArm(ctx, R, R * 0.86, bodyMidY + R * 0.28, j.armR.x, -1);

  // Body.
  bodyPath(ctx);
  const g = ctx.createLinearGradient(0, topY, 0, 0);
  g.addColorStop(0, BODY.top);
  g.addColorStop(0.42, BODY.mid);
  g.addColorStop(0.82, BODY.low);
  g.addColorStop(1, BODY.bottom);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // Translucent core glow.
  const core = ctx.createRadialGradient(0, bodyMidY + R * 0.25, 0, 0, bodyMidY + R * 0.25, R * 1.1);
  core.addColorStop(0, 'rgba(255,215,228,0.45)');
  core.addColorStop(1, 'rgba(255,215,228,0)');
  ctx.fillStyle = core;
  ctx.fillRect(-R * 2, topY, R * 4, -topY + 2);
  // Bottom rim shade.
  ctx.lineWidth = R * 0.22;
  ctx.strokeStyle = 'rgba(160,30,80,0.28)';
  ctx.translate(0, R * 0.08);
  bodyPath(ctx);
  ctx.stroke();
  ctx.restore();
  // Outline for character readability.
  bodyPath(ctx);
  ctx.lineWidth = Math.max(1.5, R * 0.05);
  ctx.strokeStyle = BODY.edge;
  ctx.globalAlpha = 0.7;
  ctx.stroke();
  ctx.globalAlpha = 1;
  // Specular highlights.
  ctx.save();
  ctx.translate(-R * 0.45, topY + j.H * 0.24);
  ctx.rotate(-0.55);
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.beginPath();
  ctx.ellipse(0, 0, R * 0.24, R * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(-R * 0.12, topY + j.H * 0.13, R * 0.055, 0, Math.PI * 2);
  ctx.fill();

  // Face.
  const f = j.face();
  const fx = j.lookX.x * R * 0.16;
  const fy = j.lookY.x * R * 0.1;
  const eyeY = bodyMidY - R * 0.12 + fy;
  // Blush.
  if (f.blush > 0) {
    ctx.fillStyle = `rgba(255,60,110,${0.42 * f.blush})`;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * R * 0.6 + fx * 0.8, eyeY + R * 0.3, R * 0.16, R * 0.09, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  drawEye(ctx, f.eyes, -R * 0.36 + fx, eyeY, R, j.blink, now, -1);
  drawEye(ctx, f.eyes, R * 0.36 + fx, eyeY, R, j.blink, now, 1);
  // Brows.
  const b = j.brows.x;
  if (Math.abs(b) > 0.05) {
    ctx.strokeStyle = INK;
    ctx.lineCap = 'round';
    ctx.lineWidth = R * 0.07;
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(s * R * 0.36 + fx, eyeY - R * 0.36 - Math.abs(b) * R * 0.04);
      ctx.rotate(s * b * 0.45);
      ctx.beginPath();
      ctx.moveTo(-R * 0.12, 0);
      ctx.lineTo(R * 0.12, 0);
      ctx.stroke();
      ctx.restore();
    }
  }
  drawMouth(ctx, j, fx * 0.7, eyeY + R * 0.36, R, now);

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
  const pop = clamp01(t / 200);
  const scale = (pop < 1 ? easeOutBack(pop, 2.2) : 1) * (outT < 160 ? Math.max(0, outT / 160) : 1);
  if (scale <= 0.01) return;

  ctx.save();
  ctx.font = `800 ${fontSize}px ${FONT}`;
  ctx.direction = 'rtl';
  const full = ctx.measureText(s.text).width;
  const padX = fontSize * 0.75;
  const w = Math.min(full + padX * 2, maxX - minX);
  const h = fontSize * 1.9;
  const headY = j.ground - j.jumpH - j.H * 0.72;
  const gap = j.R * 1.25;
  let x = side < 0 ? j.x - gap - w : j.x + gap;
  x = Math.max(minX, Math.min(maxX - w, x));
  const y = headY - h / 2;
  const tailX = side < 0 ? x + w : x;
  const ox = side < 0 ? x + w : x;
  ctx.translate(ox, headY);
  ctx.scale(scale, scale);
  ctx.translate(-ox, -headY);

  // Shadow, body, tail.
  ctx.fillStyle = 'rgba(4,8,26,0.3)';
  roundRectPath(ctx, x, y + fontSize * 0.18, w, h, h * 0.45);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(tailX, headY - fontSize * 0.35);
  ctx.lineTo(tailX - side * fontSize * 0.75, headY + fontSize * 0.25);
  ctx.lineTo(tailX, headY + fontSize * 0.4);
  ctx.closePath();
  ctx.fill();
  roundRectPath(ctx, x, y, w, h, h * 0.45);
  ctx.fill();

  // Text revealed word by word (right to left).
  const words = s.words.slice(0, shown).join(' ');
  ctx.fillStyle = '#1C2350';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(words, x + w - padX, headY + fontSize * 0.08, w - padX * 2);
  ctx.restore();
}
