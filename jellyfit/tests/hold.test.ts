import { describe, expect, it } from 'vitest';
import { Session, HOLD } from '../src/game/session';
import { pieceIndex } from '../src/game/rules';

describe('Jello hold', () => {
  it('moves a tray piece to Jello and places it from his hand', () => {
    const s = new Session({ seed: 1 });
    s.setTray([pieceIndex('sq2'), pieceIndex('h3'), pieceIndex('v2')]);
    const r = s.hold(0)!;
    expect(r.swapped).toBeNull();
    expect(s.tray[0]).toBeNull();
    expect(s.held?.piece).toBe(pieceIndex('sq2'));
    const res = s.place(HOLD, 0, 0)!;
    expect(res.placed.length).toBe(4);
    expect(s.held).toBeNull();
  });

  it('swaps when Jello already holds a piece', () => {
    const s = new Session({ seed: 2 });
    s.setTray([pieceIndex('sq2'), pieceIndex('h3'), pieceIndex('v2')]);
    s.hold(0);
    const r = s.hold(1)!;
    expect(r.swapped?.piece).toBe(pieceIndex('sq2'));
    expect(s.tray[1]?.piece).toBe(pieceIndex('sq2'));
    expect(s.held?.piece).toBe(pieceIndex('h3'));
  });

  it('deals a new set when the tray empties into his hand', () => {
    const s = new Session({ seed: 3 });
    s.setTray([pieceIndex('1x1'), null, null]);
    const r = s.hold(0)!;
    expect(r.newDeal).toBe(true);
    expect(s.tray.filter(Boolean).length).toBe(3);
    expect(s.held?.piece).toBe(pieceIndex('1x1'));
  });

  it('the held piece keeps the game alive and survives save/restore', () => {
    const s = new Session({ seed: 4 });
    for (let i = 0; i < 64; i++) if (((i >> 3) + (i & 7)) % 2 === 0) s.board.set(i, 0);
    s.setTray([pieceIndex('1x1'), pieceIndex('sq2'), pieceIndex('h2')]);
    s.hold(0);
    expect(s.gameOver).toBe(false);
    const r = Session.restore(JSON.parse(JSON.stringify(s.snapshot())));
    expect(r.held?.piece).toBe(pieceIndex('1x1'));
    expect(r.gameOver).toBe(false);
    r.place(HOLD, 0, 1);
    expect(r.gameOver).toBe(true);
  });
});
