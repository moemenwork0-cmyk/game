// Unified input: on-screen touch controls, tilt steering, keyboard and gamepad.
export class Input {
  constructor() {
    this.keys = new Set();
    this.touch = { left: false, right: false, gas: false, brake: false, boost: false, hand: false };
    this.steer = 0; this.throttle = 0; this.brake = 0; this.handbrake = 0; this.boost = 0;
    this.mode = 'buttons';         // 'buttons' | 'tilt'
    this.autoGas = false;
    this.tilt = 0; this.tiltZero = null; this.tiltRaw = 0;
    this.pressed = new Set();      // one-shot actions
    addEventListener('keydown', (e) => {
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    addEventListener('deviceorientation', (e) => {
      if (e.beta == null) return;
      const ang = (screen.orientation && screen.orientation.angle) ?? window.orientation ?? 90;
      // landscape: rolling the phone like a wheel changes beta
      this.tiltRaw = (ang === 270 || ang === -90) ? -e.beta : e.beta;
      if (this.tiltZero === null) this.tiltZero = this.tiltRaw;
      this.tilt = this.tiltRaw - this.tiltZero;
      this.hasTilt = true;
    });
  }

  calibrateTilt() { this.tiltZero = this.tiltRaw; }

  /** Bind an element to a touch control flag (multi-touch safe). */
  bind(el, name) {
    const on = (e) => { e.preventDefault(); this.touch[name] = true; el.classList.add('on'); this.usedTouch = true; try { el.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ } };
    const off = (e) => { e.preventDefault(); this.touch[name] = false; el.classList.remove('on'); };
    el.addEventListener('pointerdown', on);
    el.addEventListener('pointerup', off);
    el.addEventListener('pointercancel', off);
    el.addEventListener('lostpointercapture', off);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  took(code) { const h = this.pressed.has(code); return h; }
  endFrame() { this.pressed.clear(); }

  update(dt) {
    const k = this.keys, t = this.touch;
    const left = k.has('ArrowLeft') || k.has('KeyA') || t.left;
    const right = k.has('ArrowRight') || k.has('KeyD') || t.right;
    let target = (right ? 1 : 0) - (left ? 1 : 0);
    let gas = (k.has('ArrowUp') || k.has('KeyW') || t.gas) ? 1 : 0;
    let brk = (k.has('ArrowDown') || k.has('KeyS') || t.brake) ? 1 : 0;
    let hand = (k.has('Space') || t.hand) ? 1 : 0;
    let boost = (k.has('ShiftLeft') || k.has('ShiftRight') || k.has('KeyN') || t.boost) ? 1 : 0;
    // gamepad
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const ax = p.axes[0] || 0;
      if (Math.abs(ax) > 0.12) target = Math.sign(ax) * ((Math.abs(ax) - 0.12) / 0.88);
      gas = Math.max(gas, p.buttons[7]?.value || 0, p.buttons[0]?.pressed ? 1 : 0);
      brk = Math.max(brk, p.buttons[6]?.value || 0);
      hand = Math.max(hand, p.buttons[2]?.pressed ? 1 : 0);
      boost = Math.max(boost, p.buttons[1]?.pressed || p.buttons[5]?.pressed ? 1 : 0);
      this.usedPad = true;
    }
    if (this.mode === 'tilt' && this.hasTilt && !(left || right)) {
      const deg = this.tilt;
      const dz = 2.5;
      const v = Math.abs(deg) < dz ? 0 : (Math.abs(deg) - dz) * Math.sign(deg) / 24;
      this.steer = Math.max(-1, Math.min(1, v));
    } else if (Math.abs(target) > 0 && Number.isInteger(target)) {
      // digital: ramp so taps give small corrections and holds give full lock
      const rate = Math.sign(target) !== Math.sign(this.steer) && this.steer !== 0 ? 7 : 3.2;
      this.steer += Math.max(-rate * dt, Math.min(rate * dt, target - this.steer));
    } else if (target !== 0) {
      this.steer = target;
    } else {
      this.steer += Math.max(-6 * dt, Math.min(6 * dt, -this.steer));
    }
    if (this.autoGas && !brk) gas = Math.max(gas, 1);
    this.throttle = gas; this.brake = brk; this.handbrake = hand; this.boost = boost;
  }
}
