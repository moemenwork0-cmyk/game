// Rapier world: static circuit colliders, dynamic roadside props, detached car parts, contact events.
import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

export const G = {
  STATIC: 0x0001, CAR: 0x0002, PROP: 0x0004, DEBRIS: 0x0008,
};
export const groups = (member, filter) => ((member & 0xffff) << 16) | (filter & 0xffff);
export const GROUP_STATIC = groups(G.STATIC, 0xffff);
export const GROUP_CAR = groups(G.CAR, G.STATIC | G.CAR | G.PROP | G.DEBRIS);
export const GROUP_CAR_GHOST = groups(G.CAR, G.STATIC);
export const GROUP_PROP = groups(G.PROP, G.STATIC | G.CAR | G.PROP | G.DEBRIS);
export const GROUP_DEBRIS = groups(G.DEBRIS, G.STATIC | G.CAR | G.PROP);
export const QUERY_WHEELS = groups(0xffff, G.STATIC | G.CAR | G.PROP);

export const SURF = { ROAD: 0, RUNOFF: 1, SAND: 2, BARRIER: 3, PROP: 4, CAR: 5, ROCK: 6 };

export class Physics {
  static async init() { await RAPIER.init(); }

  constructor() {
    this.R = RAPIER;
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = 1 / 120;
    this.world.integrationParameters.numSolverIterations = 6;
    this.events = new RAPIER.EventQueue(true);
    this.surface = new Map();   // collider handle -> SURF
    this.owner = new Map();     // collider handle -> object (vehicle / prop)
    this.props = [];
    this.debris = [];
  }

  addTrimesh(geo, surf, friction = 0.9) {
    const pos = geo.attributes.position.array;
    const idx = geo.index ? new Uint32Array(geo.index.array) : new Uint32Array([...Array(pos.length / 3).keys()]);
    const desc = this.R.ColliderDesc.trimesh(new Float32Array(pos), idx).setFriction(friction).setRestitution(0.05).setCollisionGroups(GROUP_STATIC);
    const c = this.world.createCollider(desc);
    this.surface.set(c.handle, surf);
    return c;
  }

  addHeightfield(terrain) {
    const { nx, nz, step, x0, z0, heights } = terrain;
    const h = new Float32Array(nx * nz);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) h[j + i * nz] = heights[j * nx + i];
    const sx = (nx - 1) * step, sz = (nz - 1) * step;
    const desc = this.R.ColliderDesc.heightfield(nz - 1, nx - 1, h, { x: sx, y: 1, z: sz })
      .setTranslation(x0 + sx / 2, 0, z0 + sz / 2).setFriction(0.8).setCollisionGroups(GROUP_STATIC);
    const c = this.world.createCollider(desc);
    this.surface.set(c.handle, SURF.SAND);
    return c;
  }

  addStaticBox(pos, quat, half, surf = SURF.ROCK) {
    const desc = this.R.ColliderDesc.cuboid(half.x, half.y, half.z).setTranslation(pos.x, pos.y, pos.z)
      .setRotation(quat ?? { x: 0, y: 0, z: 0, w: 1 }).setFriction(0.6).setCollisionGroups(GROUP_STATIC);
    const c = this.world.createCollider(desc);
    this.surface.set(c.handle, surf);
    return c;
  }

  addStaticCylinder(pos, radius, height, surf = SURF.ROCK) {
    const desc = this.R.ColliderDesc.cylinder(height / 2, radius).setTranslation(pos.x, pos.y, pos.z).setFriction(0.6).setCollisionGroups(GROUP_STATIC);
    const c = this.world.createCollider(desc);
    this.surface.set(c.handle, surf);
    return c;
  }

  /** Dynamic prop with a visual object; shape: 'box' | 'cyl'. */
  addProp(obj, { shape = 'box', half, mass, pos, quat }) {
    const bd = this.R.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setRotation(quat)
      .setLinearDamping(0.6).setAngularDamping(0.8).setCanSleep(true);
    const body = this.world.createRigidBody(bd);
    const vol = shape === 'cyl' ? Math.PI * half.x * half.x * half.y * 2 : 8 * half.x * half.y * half.z;
    const cd = (shape === 'cyl' ? this.R.ColliderDesc.cylinder(half.y, half.x) : this.R.ColliderDesc.cuboid(half.x, half.y, half.z))
      .setDensity(mass / vol).setFriction(0.6).setRestitution(0.15).setCollisionGroups(GROUP_PROP)
      .setActiveEvents(this.R.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(2000);
    const col = this.world.createCollider(cd, body);
    body.sleep();
    const p = { obj, body, col, mass, home: { pos: pos.clone(), quat: quat.clone() }, kind: 'prop' };
    this.surface.set(col.handle, SURF.PROP);
    this.owner.set(col.handle, p);
    this.props.push(p);
    return p;
  }

  /** A part torn off a car: becomes its own rigid body. */
  addDebris(obj, half, mass, pos, quat, vel, angvel) {
    const bd = this.R.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setRotation(quat)
      .setLinvel(vel.x, vel.y, vel.z).setAngvel(angvel).setLinearDamping(0.9).setAngularDamping(0.6).setCcdEnabled(true);
    const body = this.world.createRigidBody(bd);
    const cd = this.R.ColliderDesc.cuboid(Math.max(0.03, half.x), Math.max(0.03, half.y), Math.max(0.03, half.z))
      .setDensity(mass / (8 * Math.max(0.03, half.x) * Math.max(0.03, half.y) * Math.max(0.03, half.z)))
      .setFriction(0.5).setRestitution(0.25).setCollisionGroups(GROUP_DEBRIS);
    const col = this.world.createCollider(cd, body);
    const d = { obj, body, col, age: 0, kind: 'debris' };
    this.owner.set(col.handle, d);
    this.debris.push(d);
    if (this.debris.length > 40) this.removeDebris(this.debris[0]);
    return d;
  }

  removeDebris(d) {
    this.world.removeRigidBody(d.body);
    this.owner.delete(d.col.handle);
    d.obj.parent?.remove(d.obj);
    this.debris.splice(this.debris.indexOf(d), 1);
  }

  step() {
    this.world.step(this.events);
  }

  /** Sync visuals of props and debris. */
  syncVisuals(dt) {
    for (const p of this.props) {
      if (p.body.isSleeping()) continue;
      const t = p.body.translation(), r = p.body.rotation();
      p.obj.position.set(t.x, t.y, t.z);
      p.obj.quaternion.set(r.x, r.y, r.z, r.w);
    }
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.age += dt;
      const t = d.body.translation(), r = d.body.rotation();
      d.obj.position.set(t.x, t.y, t.z);
      d.obj.quaternion.set(r.x, r.y, r.z, r.w);
      if (d.age > 45 || t.y < -400) this.removeDebris(d);
    }
  }

  /** World-space average contact point + normal between two colliders (or null). */
  contactInfo(c1, c2) {
    let n = 0;
    const p = new THREE.Vector3(), nrm = new THREE.Vector3();
    this.world.contactPair(c1, c2, (manifold, flipped) => {
      const cnt = manifold.numSolverContacts();
      for (let i = 0; i < cnt; i++) {
        const q = manifold.solverContactPoint(i);
        p.x += q.x; p.y += q.y; p.z += q.z; n++;
      }
      const mn = manifold.normal();
      const s = flipped ? -1 : 1;
      nrm.set(mn.x * s, mn.y * s, mn.z * s);
    });
    if (!n) return null;
    return { point: p.multiplyScalar(1 / n), normal: nrm };
  }
}
