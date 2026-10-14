import { BALANCE } from '../../config/balance';
import type { Critter } from './critter';

const D = BALANCE.critters.drifter;

/** Drifter: steady swim with wobble. */
export function initDrifter(c: Critter): void {
  c.type = 'drifter';
  c.radius = D.radius;
  c.baseSpeed = D.speed;
  c.hp = D.hp;
  c.damage = D.damage;
  c.glow = D.glow;
}
