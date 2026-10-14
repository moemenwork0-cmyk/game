import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { Jello } from '../src/jello/jello';
import { JelloDirector } from '../src/jello/director';
import { LineBag, LINES } from '../src/jello/lines';
import type { PlaceResult } from '../src/game/session';

function setup() {
  const said: number[] = [];
  const j = new Jello(new Rng(1), { voice: (n) => said.push(n), sound: () => undefined });
  const d = new JelloDirector(j, new Rng(2));
  let now = 0;
  const tick = (ms: number) => {
    for (let t = 0; t < ms; t += 16) {
      now += 16;
      j.update(0.016, now);
      d.update(false);
    }
  };
  return { j, d, said, tick };
}

const res = (o: Partial<PlaceResult>): PlaceResult =>
  ({ lines: 0, combo: 0, perfect: false, score: 100, gameOver: false, ...o }) as PlaceResult;

describe('jello', () => {
  it('line bags never repeat back to back', () => {
    const bag = new LineBag(new Rng(5));
    let prev = '';
    for (let k = 0; k < 200; k++) {
      const l = bag.pick('tap');
      expect(l).not.toBe(prev);
      expect(LINES.tap).toContain(l as never);
      prev = l;
    }
  });

  it('greets on the home screen and stays quiet on plain placements', () => {
    const { d, said, tick } = setup();
    d.menu(0);
    tick(600);
    expect(said.length).toBe(1);
    d.gameStart(false, 0);
    tick(4000);
    const before = said.length;
    for (let k = 0; k < 10; k++) {
      d.placed(res({ lines: 0 }), 0.2, 0);
      tick(500);
    }
    expect(said.length).toBe(before);
  });

  it('worries in danger and celebrates the comeback', () => {
    const { j, d, said, tick } = setup();
    d.gameStart(false, 0);
    tick(4000);
    const n0 = said.length;
    d.placed(res({ lines: 0 }), 0.75, 0);
    tick(100);
    expect(j.mood).toBe('worried');
    expect(said.length).toBe(n0 + 1);
    tick(5000);
    d.placed(res({ lines: 3, combo: 1 }), 0.3, 0);
    tick(100);
    expect(said.length).toBe(n0 + 2);
    expect(j.mood).toBe('love');
  });

  it('gets dizzy after five quick taps and sleeps when ignored', () => {
    const { j, d, tick } = setup();
    d.gameStart(false, 0);
    tick(1000);
    for (let k = 0; k < 5; k++) {
      d.tap(j.x, j.ground - 20);
      tick(100);
    }
    expect(j.face().eyes).toBe('spiral');
    tick(32000);
    expect(j.mood).toBe('sleepy');
  });

  it('talk can be switched off', () => {
    const { j, d, said, tick } = setup();
    j.talkEnabled = false;
    d.menu(0);
    tick(1000);
    expect(said.length).toBe(0);
    expect(j.speech).toBeNull();
  });
});
