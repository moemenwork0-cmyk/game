// Race rules: grid, countdown, lap counting with direction checks, positions, respawns, nitro economy,
// near misses, slipstream, takedowns, results.
import * as THREE from 'three';
import { TRACK } from '../world/trackdef.js';

export class Race {
  constructor(game, entrants) {
    this.g = game;
    this.track = game.world.track;
    this.laps = TRACK.laps;
    this.state = 'grid';      // grid -> countdown -> racing -> finished
    this.t = 0; this.countdown = 4.2;
    this.entrants = entrants; // [{v, ai|null, name, isPlayer}]
    for (const e of entrants) {
      Object.assign(e, { k: -1, lap: 0, progress: 0, lapStart: 0, best: Infinity, lastLap: 0, finished: false, finishT: 0, pos: 0,
        offT: 0, flipT: 0, wreckT: 0, stuckT: 0, nitro: 0.35, nitroOn: false, takedowns: 0, maxCheckpoint: 0, wrongWayT: 0, lapTimes: [] });
    }
    this.finishOrder = [];
    this.events = [];
  }

  start() { this.state = 'countdown'; this.countdown = 4.2; }

  gridSlot(i) {
    const t = this.track;
    const k = t.wrap(-14 - i * 8);
    const lat = (i % 2 === 0 ? -3.4 : 3.4);
    const p = t.lateralPoint(k, lat).addScaledVector(t.U(k), 0.25);
    const fwd = t.T(k), up = t.U(k);
    const m = new THREE.Matrix4().lookAt(new THREE.Vector3(), fwd.clone().negate(), up);
    const q = new THREE.Quaternion().setFromRotationMatrix(m);
    return { p, q, k };
  }

  respawn(e, back = 18) {
    const t = this.track;
    let k = t.wrap((e.k < 0 ? 0 : e.k) - back);
    // never put a car back on the run-up to the canyon: drop it beyond the landing instead
    const jk = Math.round(t.jumpS / t.ds), gapEnd = jk + Math.round(t.jumpGap / t.ds);
    const rel = t.wrap(k - (jk - 160));
    if (rel < 160 + (gapEnd - jk) + 6) k = t.wrap(gapEnd + 12);
    const p = t.lateralPoint(k, t.line[k] * 0.5).addScaledVector(t.U(k), 0.35);
    const m = new THREE.Matrix4().lookAt(new THREE.Vector3(), t.T(k).negate(), t.U(k));
    e.v.teleport(p, new THREE.Quaternion().setFromRotationMatrix(m));
    e.v.setSpeed(Math.min(26, t.lineSpeed[k] * 0.7));
    e.v.wrecked = false; e.v.engineOn = true;
    if (e.v.health <= 0.05) e.v.health = 0.35;
    e.v.setGhost(true); e.ghostT = 2.5;
    e.k = k; e.offT = e.flipT = e.wreckT = e.stuckT = 0;
    if (e.ai) e.ai.k = k;
    this.g.onRespawn?.(e);
  }

  update(dt) {
    this.t += dt;
    const t = this.track;
    if (this.state === 'countdown') {
      const prev = Math.ceil(this.countdown - 1);
      this.countdown -= dt;
      const now = Math.ceil(this.countdown - 1);
      if (now !== prev && now >= 0) this.g.onCountdown?.(now);
      if (this.countdown <= 1) { this.state = 'racing'; this.raceStart = this.t; for (const e of this.entrants) e.lapStart = this.t; }
    }
    const racing = this.state === 'racing' || this.state === 'finished';
    for (const e of this.entrants) {
      const v = e.v;
      const kPrev = e.k;
      const k = t.nearest(v.pos.x, v.pos.y, v.pos.z, e.k);
      if (k < 0) { e.offT += dt; } else {
        e.k = k;
        const loc = t.local(k, v.pos.x, v.pos.y, v.pos.z);
        e.lat = loc.lat; e.h = loc.h;
        // lap counting: crossing the line forwards
        if (kPrev >= 0 && racing && !e.finished) {
          const d = k - kPrev;
          if (d < -t.N / 2 && !e.started) { e.started = true; e.maxCheckpoint = 0; }
          else if (d < -t.N / 2 && e.maxCheckpoint >= 3) {
            const lapTime = this.t - e.lapStart;
            e.lap++; e.lastLap = lapTime; e.lapTimes.push(lapTime); e.best = Math.min(e.best, lapTime); e.lapStart = this.t; e.maxCheckpoint = 0;
            if (e.lap >= this.laps) { e.finished = true; e.finishT = this.t - this.raceStart; this.finishOrder.push(e); this.g.onFinish?.(e); }
            else this.g.onLap?.(e);
          } else if (d > t.N / 2) {
            // crossed backwards
            e.lap = Math.max(0, e.lap) ; e.maxCheckpoint = 0;
          }
          const cp = Math.floor(k / (t.N / 4));
          if (cp === e.maxCheckpoint + 1) e.maxCheckpoint = cp;
        }
        if (Math.abs(loc.lat) > t.halfWidth[k] + 9 || loc.h < -7) e.offT += dt; else e.offT = 0;
        // wrong way
        const along = v.linvel.dot(t.T(k));
        if (along < -5 && racing) e.wrongWayT += dt; else e.wrongWayT = 0;
      }
      e.progress = e.started ? e.lap * t.N + Math.max(0, e.k) : Math.max(0, e.k) - t.N;
      if (e.finished) e.progress = 1e9 - e.finishT;
      // respawn conditions
      if (v.up.y < 0.25 && v.speed < 4) e.flipT += dt; else e.flipT = 0;
      if (v.wrecked) e.wreckT += dt;
      if (v.speed > 2.5) e.stuckT = 0;
      if (e.ghostT > 0) { e.ghostT -= dt; if (e.ghostT <= 0) v.setGhost(false); }
      if (racing && (e.offT > 1.2 || e.flipT > 2.2 || e.wreckT > 3.6 || (e.ai && v.speed < 1.5 && (e.stuckT += dt) > 7) || (e.ai && e.wrongWayT > 4))) this.respawn(e);
      // nitro
      if (racing && !e.finished) {
        const w = v.wheels;
        const rearSlip = Math.abs((w[2].sa + w[3].sa) / 2);
        if (v.grounded >= 3 && v.speed > 14 && rearSlip > 0.12) { e.nitro += dt * 0.12 * Math.min(2, rearSlip / 0.12); e.drifting = (e.drifting || 0) + dt; } else e.drifting = 0;
        if (v.airborne > 0.25) e.nitro += dt * 0.15;
        // slipstream: directly behind another car
        e.draft = 0;
        for (const o of this.entrants) {
          if (o === e) continue;
          const rel = o.v.pos.clone().sub(v.pos);
          const ahead = rel.dot(v.fwd), side = Math.abs(rel.dot(v.right));
          if (ahead > 4 && ahead < 28 && side < 2.2 && v.speed > 25) {
            e.draft = 1 - ahead / 28;
            e.nitro += dt * 0.05;
            v.body.applyImpulse(v.fwd.clone().multiplyScalar(900 * e.draft * dt), true);
          }
          // near miss: passing very close at speed without touching
          if (Math.abs(ahead) < 2 && side > 2.0 && side < 2.9 && Math.abs(v.speed - o.v.speed) > 6 && e.isPlayer) {
            if (!e.nearT || this.t - e.nearT > 2) { e.nearT = this.t; e.nitro += 0.08; this.g.onNearMiss?.(e); }
          }
        }
        if (e.nitroOn) { e.nitro -= dt * 0.22; if (e.nitro <= 0) e.nitroOn = false; }
        e.nitro = Math.min(1, Math.max(0, e.nitro));
        v.boost = e.nitroOn && racing ? 1 : 0;
      } else v.boost = 0;
    }
    // positions
    const order = [...this.entrants].sort((a, b) => b.progress - a.progress);
    order.forEach((e, i) => { e.pos = i + 1; });
    this.order = order;
    // race end: player finished -> allow a few seconds, then finish everyone
    const p = this.entrants.find((e) => e.isPlayer);
    if (p.finished && this.state === 'racing') { this.state = 'finished'; this.endT = this.t; }
  }

  results() {
    const t = this.track;
    const res = this.entrants.map((e) => {
      let time = e.finished ? e.finishT : null;
      if (!e.finished) {
        // estimate from remaining distance at a typical pace
        const done = e.lap * t.length + (e.k < 0 ? 0 : e.k * t.ds);
        const remaining = this.laps * t.length - done;
        const elapsed = this.t - (this.raceStart ?? this.t);
        const pace = done / Math.max(1, elapsed);
        time = elapsed + remaining / Math.max(20, pace);
      }
      return { e, time, best: e.best };
    });
    res.sort((a, b) => a.time - b.time);
    return res;
  }
}
