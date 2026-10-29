// Collision response: turns Rapier contact forces into body crumple, paint scrapes, torn-off parts,
// mechanical damage, sparks / bubbles / silt, camera shake, haptics and impact audio.
import * as THREE from 'three';
import { SURF } from '../physics/physics.js';

const PART_RULES = {
  // part: [impact speed change (m/s) needed when the hit is within `reach` metres of the part, reach]
  mirrorL: [4.5, 0.9], mirrorR: [4.5, 0.9], splitter: [7, 1.3], wing: [8, 1.3], diffuser: [9, 1.2],
};

export class DamageSystem {
  constructor(game) {
    this.g = game;
    this.frame = new Map();   // vehicle -> {dv, point, normal, other, scrape, tangential}
    this._inv = new THREE.Quaternion();
  }

  /** Called after each physics substep. */
  collect() {
    const ph = this.g.physics;
    const dt = ph.world.timestep;
    ph.events.drainContactForceEvents((ev) => {
      const h1 = ev.collider1(), h2 = ev.collider2();
      const o1 = ph.owner.get(h1), o2 = ph.owner.get(h2);
      const J = ev.totalForceMagnitude() * dt;
      for (const [me, other, hMe, hOther] of [[o1, o2, h1, h2], [o2, o1, h2, h1]]) {
        if (!me || !me.isVehicle) continue;
        const dv = J / me.mass;
        let rec = this.frame.get(me);
        if (!rec) { rec = { dv: 0, sum: 0, point: null, normal: null, other: null, surf: null, hMe, hOther }; this.frame.set(me, rec); }
        rec.sum += dv;
        if (dv > rec.dv) {
          rec.dv = dv; rec.other = other; rec.hMe = hMe; rec.hOther = hOther;
          rec.surf = ph.surface.get(hOther);
        }
      }
      // props hit hard enough make noise too
      for (const o of [o1, o2]) if (o && o.kind === 'prop' && J / o.mass > 2) this.g.audio?.impact(Math.min(1, J / o.mass / 12), o.body.translation(), 'prop');
    });
  }

  /** Called once per rendered frame: apply aggregated damage/effects. */
  apply() {
    const g = this.g;
    for (const [car, rec] of this.frame) {
      const info = g.physics.contactInfo(g.physics.world.getCollider(rec.hMe), g.physics.world.getCollider(rec.hOther));
      const point = info ? info.point : car.pos.clone().add(new THREE.Vector3(0, 0.5, 0));
      const isPlayer = car === g.player.v;
      const otherCar = rec.other && rec.other.isVehicle ? rec.other : null;
      // relative tangential speed for scraping
      const vRel = car.linvel.clone();
      if (otherCar) vRel.sub(otherCar.linvel);
      const n = info ? info.normal : new THREE.Vector3(0, 1, 0);
      const tang = vRel.clone().addScaledVector(n, -vRel.dot(n)).length();
      // a hit is resolved over several substeps: the frame's summed impulse is the true speed change
      const dv = Math.max(rec.dv, rec.sum * 0.75);
      const hard = dv > 2.2;
      // ---- scraping: sustained contact while sliding fast ----
      if (rec.sum > 0.25 && tang > 6 && !hard) {
        const dir = vRel.clone().normalize().multiplyScalar(-1);
        g.world.particles.sparks(point, dir.add(new THREE.Vector3(0, 0.3, 0)), Math.min(6, 1 + tang * 0.12), 8 + tang * 0.25);
        car.visual.scrape(car.visual.group.worldToLocal(point.clone()), 0.5, 0.02 + tang * 0.002);
        car.scrapeLevel = Math.min(1, (car.scrapeLevel || 0) + 0.25 + tang * 0.01);
        if (isPlayer) { g.cameraRig.addShake(0.02); g.haptic(10, 60); }
      }
      if (dv > 1.0) {
        // ---- impact FX ----
        const strength = Math.min(1, (dv - 1) / 14);
        const dir = n.clone().multiplyScalar(info && n.dot(point.clone().sub(car.pos)) > 0 ? -1 : 1);
        if (rec.surf === SURF.SAND || rec.surf === SURF.RUNOFF) {
          g.world.particles.silt(point, car.linvel, 3 + Math.round(strength * 10), [0.42, 0.40, 0.33], 1.4, 3.5);
        } else {
          g.world.particles.sparks(point, dir.clone().add(car.linvel.clone().multiplyScalar(0.03)), 6 + Math.round(strength * 40), 10 + dv);
        }
        g.world.particles.bubbles(point, 4 + Math.round(strength * 24), 0.6 + strength, 2, 0.05 + strength * 0.06);
        if (strength > 0.25) g.world.particles.chips(point, dir, Math.round(strength * 18), car.visual.uniforms.uPaint.value.toArray());
        g.audio?.impact(strength, point, otherCar ? 'car' : rec.surf === SURF.SAND ? 'sand' : rec.surf === SURF.PROP ? 'prop' : 'wall', isPlayer || (otherCar === g.player.v));
        if (isPlayer || otherCar === g.player.v) {
          g.cameraRig.addShake(0.15 + strength * 1.2);
          g.haptic(20 + strength * 120, 80 + strength * 175);
          if (strength > 0.35) g.flash(strength * 0.35);
        }
      }
      if (hard && !car.wrecked && car.ghost <= 0) {
        // ---- crumple ----
        const local = car.visual.group.worldToLocal(point.clone());
        const comLocal = car.cgLocal.clone().setY(0.55);
        const push = comLocal.clone().sub(local).normalize();
        const dur = car.spec.durability;
        const amount = Math.min(0.32, (dv - 2.2) * 0.022 / Math.sqrt(dur));
        const radius = Math.min(1.25, 0.5 + dv * 0.045);
        car.visual.deform(local, push, amount, radius);
        // ---- mechanical damage ----
        const dmg = Math.pow(dv - 2.2, 1.35) * 0.012 / dur;
        car.health = Math.max(0, car.health - dmg);
        if (local.z > 1.2 && dv > 6) car.steerBias += (Math.random() - 0.5) * 0.04 * (dv / 10);
        car.steerBias = Math.max(-0.08, Math.min(0.08, car.steerBias));
        car.powerLoss = Math.max(0, (0.55 - car.health) * 0.5);
        // ---- parts ----
        for (const [name, [thr, reach]] of Object.entries(PART_RULES)) {
          const part = car.visual.parts[name];
          if (!part || !part.userData.attached) continue;
          const d = part.position.distanceTo(local);
          if (d < reach && dv > thr * Math.sqrt(dur) * (0.8 + Math.random() * 0.4)) g.detachPart(car, part, dv, point);
        }
        if (dv > 16 * Math.sqrt(dur)) {
          // a wheel can be torn off in a massive corner hit
          let best = null, bd = 1e9;
          car.visual.wheels.forEach((w, i) => { const d = w.steer.position.distanceTo(local); if (d < bd) { bd = d; best = i; } });
          if (best !== null && bd < 1.0 && !car.wheels[best].lost && Math.random() < 0.6) g.loseWheel(car, best, dv, point);
        }
        if (car.health <= 0 || dv > 30 * Math.sqrt(dur)) g.wreck(car, otherCar);
        if (otherCar && !car.wrecked) {
          const att = otherCar;
          car.lastHitBy = att; car.lastHitT = g.time;
        }
        if (isPlayer && dv > 11 && !g.cameraRig.crash && g.settings.crashCam) g.slowMo(dv);
      }
    }
    this.frame.clear();
  }
}
