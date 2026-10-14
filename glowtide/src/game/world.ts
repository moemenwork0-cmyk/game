import { BALANCE } from '../config/balance';
import { CRITTER_COLORS } from '../config/palette';
import { EventBus } from '../core/events';
import { clamp, TAU } from '../core/math';
import { Pool } from '../core/pool';
import { Rng } from '../core/rng';
import { SpatialHash } from '../core/spatialHash';
import { TimeScale } from '../core/time';
import { Chain, chainTier, type ChainThresholds, type ChainTier } from './chain';
import { Critter } from './critters/critter';
import { initDrifter } from './critters/drifter';
import { Effects } from './effects';
import { Pearl } from './pearl';
import { PrototypeSpawner, type SpawnRequest } from './spawner';

const L = BALANCE.link;
const F = BALANCE.focus;
const CE = BALANCE.chainEffects;
const CR = BALANCE.critters;

export type PointerKind = 'mouse' | 'touch' | 'pen';
export type RunState = 'playing' | 'dying' | 'over';

export interface RunStats {
  timeAlive: number;
  popped: number;
  longestChain: number;
  tideReached: number;
}

export interface WorldEvents {
  link: { index: number; x: number; y: number; color: number };
  unlink: { index: number; x: number; y: number };
  snap: { x: number; y: number };
  tier: { tier: ChainTier; length: number };
  pop: { index: number; length: number; x: number; y: number; color: number; radius: number };
  chainPopped: { length: number; colors: number };
  kill: { x: number; y: number; color: number; radius: number };
  burst: { x: number; y: number; radius: number; color: number };
  pearlHit: { x: number; y: number; color: number; lost: number; segment: number };
  emptyTap: { x: number; y: number };
  death: Record<string, never>;
  runEnd: RunStats;
}

/** Chain popping in progress: nodes pop one by one with a short stagger. */
export interface PopBatch {
  nodes: Critter[];
  ids: number[];
  next: number;
  timer: number;
  tier: ChainTier;
  colors: number;
}

const isAlive = (c: Critter): boolean => c.alive;
const radiusOf = (c: Critter): number => c.radius;

/** Owns every entity and system for one run. */
export class World {
  readonly events = new EventBus<WorldEvents>();
  readonly pearl = new Pearl();
  readonly chain = new Chain<Critter>();
  readonly critters: Critter[] = [];
  readonly effects = new Effects();
  readonly timeScale = new TimeScale();

  state: RunState = 'playing';
  /** Game-time seconds since the run started (scaled by timeScale). */
  time = 0;
  /** Real seconds since the run started. */
  realTime = 0;
  focus: number = F.max;
  focusMax: number = F.max;
  invincible = false;

  /** Pointer state, in world units. */
  readonly pointer = { down: false, x: 0, y: 0, kind: 'mouse' as PointerKind, lastX: 0, lastY: 0 };
  /** The pointer is over a valid-color critter that is out of reach. */
  tooFar = false;
  /** Highest effect tier reached by the chain currently being dragged. */
  tier: ChainTier = 'none';

  readonly stats: RunStats = { timeAlive: 0, popped: 0, longestChain: 0, tideReached: 1 };

  private readonly rng: Rng;
  private readonly pool = new Pool(() => new Critter(), 64);
  private readonly hash = new SpatialHash<Critter>(
    BALANCE.limits.spatialCellSize,
    BALANCE.limits.maxCritters,
  );
  private readonly spawner: PrototypeSpawner;
  private readonly batches: PopBatch[] = [];
  private readonly scratch: Critter[] = [];
  private readonly removed: Critter[] = [];
  private focusRegenDelay = 0;
  private dyingTimer = 0;
  private lastHover: Critter | null = null;
  /** Node removed by backtracking; not re-addable until the pointer leaves it. */
  private backtracked: Critter | null = null;

  halfW = 400;
  halfH = 400;

  /** M1: only Burst is active. Ripple and Surge arrive in M2. */
  readonly thresholds: ChainThresholds = {
    burst: CE.burstThreshold,
    ripple: Infinity,
    surge: Infinity,
  };

  constructor(seed: number) {
    this.rng = new Rng(seed);
    this.spawner = new PrototypeSpawner(this.rng, (req) => this.spawnCritter(req));
  }

  get tide(): number {
    return this.spawner.tide;
  }

  /** Chains currently popping (for drawing the rope pulse). */
  get popBatches(): readonly PopBatch[] {
    return this.batches;
  }

  get pointerPad(): number {
    return this.pointer.kind === 'mouse' ? L.hitPadMouse : L.hitPadTouch;
  }

  get reach(): number {
    return L.reach;
  }

  get breakFactor(): number {
    return L.breakFactor;
  }

  setView(halfW: number, halfH: number): void {
    this.halfW = halfW;
    this.halfH = halfH;
    const mx = halfW + BALANCE.spawn.resizeClampMargin;
    const my = halfH + BALANCE.spawn.resizeClampMargin;
    for (const c of this.critters) {
      c.x = clamp(c.x, -mx, mx);
      c.y = clamp(c.y, -my, my);
    }
  }

  reset(seed?: number): void {
    for (const c of this.critters) this.pool.release(c);
    this.critters.length = 0;
    this.batches.length = 0;
    this.chain.clear();
    this.effects.clear();
    this.pearl.reset();
    this.timeScale.snap(1);
    this.state = 'playing';
    this.time = 0;
    this.realTime = 0;
    this.focus = this.focusMax = F.max;
    this.focusRegenDelay = 0;
    this.dyingTimer = 0;
    this.pointer.down = false;
    this.tooFar = false;
    this.tier = 'none';
    this.lastHover = null;
    this.backtracked = null;
    this.stats.timeAlive = 0;
    this.stats.popped = 0;
    this.stats.longestChain = 0;
    this.stats.tideReached = 1;
    if (seed !== undefined) this.rng.reseed(seed);
    this.spawner.reset();
  }

  // ---------------------------------------------------------------- input

  pointerDown(x: number, y: number, kind: PointerKind): void {
    if (this.state !== 'playing' || this.pointer.down) return;
    const p = this.pointer;
    p.down = true;
    p.kind = kind;
    p.x = p.lastX = x;
    p.y = p.lastY = y;
    this.rebuildHash();
    const hit = this.nearestHit(x, y);
    if (!hit) {
      this.events.emit('emptyTap', { x, y });
      return;
    }
    this.chain.start(hit);
    hit.linked = true;
    this.tier = 'none';
    this.lastHover = hit;
    this.backtracked = null;
    this.events.emit('link', { index: 0, x: hit.x, y: hit.y, color: hit.color });
  }

  pointerMove(x: number, y: number): void {
    this.pointer.x = x;
    this.pointer.y = y;
  }

  pointerUp(): void {
    if (!this.pointer.down) return;
    this.pointer.down = false;
    this.releaseChain();
  }

  /** Drops the current chain without popping it (for example when the game pauses mid-drag). */
  cancelChain(): void {
    this.pointer.down = false;
    for (const n of this.chain.nodes) n.linked = false;
    this.chain.clear();
    this.tier = 'none';
    this.tooFar = false;
    this.lastHover = null;
    this.backtracked = null;
  }

  // ---------------------------------------------------------------- update

  update(realDt: number): void {
    if (this.state === 'over') return;
    this.realTime += realDt;
    this.updateFocus(realDt);
    this.timeScale.update(realDt);
    const dt = realDt * this.timeScale.value;
    this.time += dt;

    if (this.state === 'dying') {
      this.dyingTimer -= realDt;
      if (this.dyingTimer <= 0) {
        this.state = 'over';
        this.events.emit('runEnd', { ...this.stats });
      }
    } else {
      this.stats.timeAlive += dt;
      this.spawner.update(dt, this.halfW, this.halfH);
      this.stats.tideReached = Math.max(this.stats.tideReached, this.spawner.tide);
    }

    this.rebuildHash();
    if (this.chain.active && this.pointer.down) this.processPointerPath();
    this.updateCritters(dt);
    this.pearl.update(dt);
    this.validateChain();
    this.updatePopBatches(dt);
    this.effects.update(dt);
    this.updateCandidates();
    this.removeDead();
  }

  private updateFocus(realDt: number): void {
    if (this.state !== 'playing') return;
    if (this.chain.active && this.focus > 0) {
      this.focus = Math.max(0, this.focus - F.drainPerSec * realDt);
      this.focusRegenDelay = F.regenDelay;
      if (this.focus > 0) this.timeScale.setTarget(F.timeScale, F.slowLerpTime);
      else this.timeScale.setTarget(1, F.restoreLerpTime);
      return;
    }
    if (!this.chain.active) {
      this.timeScale.setTarget(1, F.restoreLerpTime);
      if (this.focusRegenDelay > 0) this.focusRegenDelay -= realDt;
      else this.focus = Math.min(this.focusMax, this.focus + F.regenPerSec * realDt);
    }
  }

  private rebuildHash(): void {
    this.hash.clear();
    for (const c of this.critters) if (c.interactive) this.hash.insert(c);
  }

  /** Nearest interactive critter whose hit circle (radius + pad) contains (x, y). */
  private nearestHit(x: number, y: number): Critter | null {
    const pad = this.pointerPad;
    const found = this.hash.query(x, y, pad, this.scratch, radiusOf);
    let best: Critter | null = null;
    let bestD = Infinity;
    for (const c of found) {
      const dx = c.x - x;
      const dy = c.y - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  /** Samples the pointer path since the last step so fast drags don't skip critters. */
  private processPointerPath(): void {
    const p = this.pointer;
    const dx = p.x - p.lastX;
    const dy = p.y - p.lastY;
    const len = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.max(1, Math.ceil(len / L.pathSampleStep));
    this.tooFar = false;
    for (let s = 1; s <= steps && this.chain.active; s++) {
      const t = s / steps;
      this.processSample(p.lastX + dx * t, p.lastY + dy * t);
    }
    p.lastX = p.x;
    p.lastY = p.y;
  }

  private processSample(x: number, y: number): void {
    const chain = this.chain;
    const pad = this.pointerPad;
    const reach = this.reach;
    const found = this.hash.query(x, y, pad, this.scratch, radiusOf);

    let hovered: Critter | null = null;
    let hoveredD = Infinity;
    let addable: Critter | null = null;
    let addableD = Infinity;
    let tooFar = false;
    let backtrackedStillHit = false;
    for (const c of found) {
      const dx = c.x - x;
      const dy = c.y - y;
      const d = dx * dx + dy * dy;
      if (d < hoveredD) {
        hoveredD = d;
        hovered = c;
      }
      if (c === this.backtracked) {
        backtrackedStillHit = true;
        continue;
      }
      const result = chain.check(c, reach);
      if (result === 'added' && d < addableD) {
        addableD = d;
        addable = c;
      } else if (result === 'reach') {
        tooFar = true;
      }
    }
    if (!backtrackedStillHit) this.backtracked = null;

    if (hovered !== this.lastHover) {
      this.lastHover = hovered;
      if (hovered && chain.isBacktrackTarget(hovered)) {
        const undone = chain.backtrack();
        if (undone) {
          undone.linked = false;
          this.backtracked = undone;
          this.events.emit('unlink', { index: chain.length, x: undone.x, y: undone.y });
          this.refreshTier();
        }
        return;
      }
    }

    if (addable) {
      chain.tryAdd(addable, reach);
      addable.linked = true;
      this.lastHover = addable;
      const index = chain.length - 1;
      this.events.emit('link', { index, x: addable.x, y: addable.y, color: addable.color });
      this.refreshTier();
      return;
    }
    if (tooFar) this.tooFar = true;
  }

  private refreshTier(): void {
    const tier = chainTier(this.chain.length, this.thresholds);
    if (tier !== this.tier) {
      const rising = tierRank(tier) > tierRank(this.tier);
      this.tier = tier;
      if (rising) this.events.emit('tier', { tier, length: this.chain.length });
    }
  }

  private updateCritters(dt: number): void {
    const pearl = this.pearl;
    const held = L.heldSpeedMult;
    const amp = CR.wobbleAmp;
    const stiffness = CR.separationStiffness;
    const emergeRate = 1 / CR.emergeTime;
    const neighbors = this.scratch;

    for (const c of this.critters) {
      if (!c.alive) continue;
      c.age += dt;
      if (c.emerge < 1) c.emerge = Math.min(1, c.emerge + dt * emergeRate);
      this.updateBlink(c, dt);
      if (c.popping) continue;

      const d = Math.sqrt(c.x * c.x + c.y * c.y) || 1;
      const ux = -c.x / d;
      const uy = -c.y / d;
      const speed = c.baseSpeed * c.speedMult * (c.linked ? held : 1);
      const w = TAU * c.wobbleFreq;
      const wobble = amp * w * Math.cos(w * c.age + c.wobblePhase) * (c.linked ? held : 1);
      let vx = ux * speed - uy * wobble;
      let vy = uy * speed + ux * wobble;

      this.hash.query(c.x, c.y, c.radius, neighbors, radiusOf);
      for (const n of neighbors) {
        if (n === c) continue;
        const dx = c.x - n.x;
        const dy = c.y - n.y;
        const dd = Math.sqrt(dx * dx + dy * dy);
        const overlap = c.radius + n.radius - dd;
        if (overlap <= 0) continue;
        if (dd < 1e-4) {
          vx += stiffness * overlap;
          continue;
        }
        vx += (dx / dd) * overlap * stiffness;
        vy += (dy / dd) * overlap * stiffness;
      }

      c.vx = vx;
      c.vy = vy;
      c.x += vx * dt;
      c.y += vy * dt;

      const contact = pearl.radius + c.radius;
      if (c.x * c.x + c.y * c.y <= contact * contact) this.critterHitsPearl(c);
    }
  }

  private updateBlink(c: Critter, dt: number): void {
    if (c.blinkLeft > 0) {
      c.blinkLeft -= dt;
      return;
    }
    c.blinkTimer -= dt;
    if (c.blinkTimer <= 0) {
      c.blinkLeft = CR.blinkDuration;
      c.blinkTimer = this.rng.range(CR.blinkIntervalMin, CR.blinkIntervalMax);
    }
  }

  private critterHitsPearl(c: Critter): void {
    c.alive = false;
    if (this.state !== 'playing') return;
    const lost = this.invincible ? 0 : this.pearl.hit(c.damage);
    this.events.emit('pearlHit', {
      x: c.x,
      y: c.y,
      color: c.color,
      lost,
      segment: this.pearl.shell,
    });
    if (this.pearl.dead) this.beginDying();
  }

  private beginDying(): void {
    this.state = 'dying';
    this.dyingTimer = BALANCE.pearl.deathSlowmoTime;
    this.pointer.down = false;
    for (const n of this.chain.nodes) n.linked = false;
    this.chain.clear();
    this.tier = 'none';
    this.tooFar = false;
    this.timeScale.setTarget(BALANCE.pearl.deathTimeScale, F.slowLerpTime);
    this.events.emit('death', {});
  }

  /** Breaks the chain at dead nodes and at overstretched links. */
  private validateChain(): void {
    const chain = this.chain;
    if (!chain.active) return;
    const removed = this.removed;
    removed.length = 0;

    const deadAt = chain.removeDead(isAlive, removed);
    if (deadAt >= 0) {
      const prev = chain.last;
      if (prev) this.events.emit('snap', { x: prev.x, y: prev.y });
    }

    const at = chain.findOverstretched(this.reach * this.breakFactor);
    if (at > 0) {
      const a = chain.nodes[at - 1];
      const b = chain.nodes[at];
      this.events.emit('snap', { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      chain.truncate(at, removed);
    }

    if (removed.length > 0) {
      for (const n of removed) n.linked = false;
      this.refreshTier();
      this.lastHover = null;
    }
  }

  private releaseChain(): void {
    const chain = this.chain;
    const length = chain.length;
    const colors = chain.colorCount();
    const tier = this.tier;
    for (const n of chain.nodes) n.linked = false;
    const nodes = chain.release(L.minChain);
    this.tier = 'none';
    this.tooFar = false;
    this.lastHover = null;
    this.backtracked = null;
    if (!nodes) return;

    this.stats.longestChain = Math.max(this.stats.longestChain, length);
    const ids: number[] = [];
    for (const n of nodes) {
      n.popping = true;
      ids.push(n.id);
    }
    this.batches.push({ nodes, ids, next: 0, timer: 0, tier, colors });
  }

  private updatePopBatches(dt: number): void {
    const batches = this.batches;
    for (let b = batches.length - 1; b >= 0; b--) {
      const batch = batches[b];
      batch.timer -= dt;
      while (batch.timer <= 0 && batch.next < batch.nodes.length) {
        const i = batch.next++;
        const node = batch.nodes[i];
        if (node.alive && node.id === batch.ids[i]) this.popNode(node, i, batch);
        batch.timer += L.popStagger;
      }
      if (batch.next >= batch.nodes.length) {
        this.events.emit('chainPopped', { length: batch.nodes.length, colors: batch.colors });
        batches.splice(b, 1);
      }
    }
  }

  private popNode(node: Critter, index: number, batch: PopBatch): void {
    node.alive = false;
    this.stats.popped++;
    this.events.emit('pop', {
      index,
      length: batch.nodes.length,
      x: node.x,
      y: node.y,
      color: node.color,
      radius: node.radius,
    });
    if (batch.tier !== 'none') this.burstAt(node.x, node.y, CE.burstRadius, node.color);
  }

  /** Shockwave dealing damage to every interactive critter it touches, any color. */
  private burstAt(x: number, y: number, radius: number, color: number): void {
    this.effects.addBurst(x, y, radius, color);
    this.events.emit('burst', { x, y, radius, color });
    const hits = this.hash.query(x, y, radius, this.scratch, radiusOf);
    for (const c of hits) {
      if (!c.interactive) continue;
      c.hp -= CE.burstDamage;
      if (c.hp <= 0) {
        c.alive = false;
        this.stats.popped++;
        this.events.emit('kill', { x: c.x, y: c.y, color: c.color, radius: c.radius });
      }
    }
  }

  /** Flags critters that could legally be added next (affordance pulse). */
  private updateCandidates(): void {
    for (const c of this.critters) c.candidate = false;
    const chain = this.chain;
    const last = chain.last;
    if (!last || !this.pointer.down) return;
    const reach = this.reach;
    const near = this.hash.query(last.x, last.y, reach, this.scratch);
    for (const c of near) {
      if (c.interactive && !c.linked && chain.check(c, reach) === 'added') c.candidate = true;
    }
  }

  private removeDead(): void {
    const list = this.critters;
    let w = 0;
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (c.alive) list[w++] = c;
      else {
        c.linked = false;
        this.pool.release(c);
      }
    }
    list.length = w;
  }

  // ---------------------------------------------------------------- spawning

  spawnCritter(req: SpawnRequest): Critter | null {
    if (this.critters.length >= BALANCE.limits.maxCritters) return null;
    const c = this.pool.acquire();
    c.reset();
    initDrifter(c);
    c.x = req.x;
    c.y = req.y;
    c.color = clamp(req.color, 0, CRITTER_COLORS.length - 1);
    c.speedMult = req.speedMult;
    c.wobbleFreq = this.rng.range(CR.wobbleFreqMin, CR.wobbleFreqMax);
    c.wobblePhase = this.rng.range(0, TAU);
    c.blinkTimer = this.rng.range(CR.blinkIntervalMin, CR.blinkIntervalMax);
    this.critters.push(c);
    return c;
  }

  // ---------------------------------------------------------------- debug

  debugKillAll(): void {
    for (const c of this.critters) {
      if (!c.interactive) continue;
      c.alive = false;
      this.events.emit('kill', { x: c.x, y: c.y, color: c.color, radius: c.radius });
    }
  }

  debugSkipTide(): void {
    this.spawner.tideBonus++;
  }

  /** Spawns `count` critters at random positions on the spawn ring. */
  debugSpawn(count: number): void {
    const req: SpawnRequest = { x: 0, y: 0, color: 0, speedMult: 1 };
    for (let i = 0; i < count; i++) {
      const a = this.rng.range(0, TAU);
      const d = this.rng.range(0.6, 1.1) * Math.max(this.halfW, this.halfH);
      req.x = Math.cos(a) * d;
      req.y = Math.sin(a) * d;
      req.color = this.rng.int(0, BALANCE.prototype.colors - 1);
      this.spawnCritter(req);
    }
  }
}

function tierRank(t: ChainTier): number {
  return t === 'none' ? 0 : t === 'burst' ? 1 : t === 'ripple' ? 2 : 3;
}
