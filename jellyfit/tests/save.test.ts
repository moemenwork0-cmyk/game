import { describe, expect, it } from 'vitest';
import { SAVE_KEY } from '../src/config/config';
import { MemoryStorage, SaveStore, migrate } from '../src/meta/save';
import { Session } from '../src/game/session';

function playSome(s: Session, n: number): void {
  for (let k = 0; k < n && !s.gameOver; k++) {
    let done = false;
    for (let slot = 0; slot < 3 && !done; slot++) {
      for (let i = 0; i < 64 && !done; i++) if (s.canPlace(slot, i >> 3, i & 7)) done = !!s.place(slot, i >> 3, i & 7);
    }
  }
}

describe('save', () => {
  it('round-trips through storage', () => {
    const kv = new MemoryStorage();
    const a = new SaveStore(kv);
    a.data.best = 1234;
    a.data.gamesPlayed = 3;
    a.data.settings.sfx = false;
    a.save();
    const b = new SaveStore(kv);
    expect(b.data.best).toBe(1234);
    expect(b.data.gamesPlayed).toBe(3);
    expect(b.data.settings.sfx).toBe(false);
  });

  it('recovers from corrupt data and backs it up', () => {
    const kv = new MemoryStorage();
    kv.set(SAVE_KEY, '{not json');
    const s = new SaveStore(kv);
    expect(s.data.best).toBe(0);
    expect(kv.get(`${SAVE_KEY}.corrupt`)).toBe('{not json');
    kv.set(SAVE_KEY, '[1,2,3]');
    expect(new SaveStore(kv).data.gamesPlayed).toBe(0);
  });

  it('migrates partial / invalid fields', () => {
    const d = migrate({ best: 50, gamesPlayed: -3, settings: { music: false, sfx: 'yes' }, current: { v: 9 } });
    expect(d.best).toBe(50);
    expect(d.gamesPlayed).toBe(0);
    expect(d.settings.music).toBe(false);
    expect(d.settings.sfx).toBe(true);
    expect(d.current).toBeNull();
  });

  it('resumes an in-progress game exactly', () => {
    const s = new Session({ seed: 42 });
    playSome(s, 17);
    const kv = new MemoryStorage();
    const store = new SaveStore(kv);
    store.data.current = s.snapshot();
    store.save();
    const r = Session.restore(new SaveStore(kv).data.current!);
    expect(r.score).toBe(s.score);
    expect(r.combo).toBe(s.combo);
    expect(r.board.toRows()).toEqual(s.board.toRows());
    expect(r.tray).toEqual(s.tray);
    // Same future: identical deals after the same moves.
    playSome(s, 20);
    playSome(r, 20);
    expect(r.score).toBe(s.score);
    expect(r.board.toRows()).toEqual(s.board.toRows());
    expect(r.tray).toEqual(s.tray);
  });
});
