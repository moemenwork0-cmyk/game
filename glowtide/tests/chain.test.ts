import { describe, expect, it } from 'vitest';
import { ANY_COLOR, Chain, chainTier, type Linkable } from '../src/game/chain';

let nextId = 1;
function node(x: number, y: number, color = 0, prism = false): Linkable {
  return { id: nextId++, x, y, color, prism };
}

const REACH = 150;

describe('Chain: adding nodes', () => {
  it('rejects adds on an empty chain', () => {
    const c = new Chain();
    expect(c.tryAdd(node(0, 0), REACH)).toBe('empty');
    expect(c.length).toBe(0);
  });

  it('adds same-color nodes within reach', () => {
    const c = new Chain();
    c.start(node(0, 0, 1));
    expect(c.tryAdd(node(100, 0, 1), REACH)).toBe('added');
    expect(c.tryAdd(node(200, 0, 1), REACH)).toBe('added');
    expect(c.length).toBe(3);
  });

  it('rejects a different color', () => {
    const c = new Chain();
    c.start(node(0, 0, 1));
    expect(c.tryAdd(node(50, 0, 2), REACH)).toBe('color');
    expect(c.length).toBe(1);
  });

  it('rejects nodes out of reach of the LAST node (not node 0)', () => {
    const c = new Chain();
    c.start(node(0, 0));
    c.tryAdd(node(140, 0), REACH);
    expect(c.tryAdd(node(140, 151), REACH)).toBe('reach');
    expect(c.tryAdd(node(280, 0), REACH)).toBe('added');
  });

  it('accepts a node exactly at reach', () => {
    const c = new Chain();
    c.start(node(0, 0));
    expect(c.tryAdd(node(150, 0), REACH)).toBe('added');
  });

  it('rejects duplicates', () => {
    const c = new Chain();
    const a = node(0, 0);
    const b = node(50, 0);
    c.start(a);
    c.tryAdd(b, REACH);
    expect(c.tryAdd(a, REACH)).toBe('duplicate');
    expect(c.tryAdd(b, REACH)).toBe('duplicate');
    expect(c.length).toBe(2);
  });

  it('check() never mutates', () => {
    const c = new Chain();
    c.start(node(0, 0));
    expect(c.check(node(10, 0), REACH)).toBe('added');
    expect(c.length).toBe(1);
  });
});

describe('Chain: backtracking', () => {
  it('identifies node n-2 as the backtrack target and undoes the last link', () => {
    const c = new Chain();
    const a = node(0, 0);
    const b = node(50, 0);
    const d = node(100, 0);
    c.start(a);
    c.tryAdd(b, REACH);
    c.tryAdd(d, REACH);
    expect(c.isBacktrackTarget(b)).toBe(true);
    expect(c.isBacktrackTarget(a)).toBe(false);
    expect(c.isBacktrackTarget(d)).toBe(false);
    expect(c.backtrack()).toBe(d);
    expect(c.last).toBe(b);
    expect(c.isBacktrackTarget(a)).toBe(true);
  });

  it('a single-node chain has no backtrack target', () => {
    const c = new Chain();
    const a = node(0, 0);
    c.start(a);
    expect(c.isBacktrackTarget(a)).toBe(false);
  });

  it('a backtracked node can be re-added', () => {
    const c = new Chain();
    const a = node(0, 0);
    const b = node(50, 0);
    c.start(a);
    c.tryAdd(b, REACH);
    c.backtrack();
    expect(c.tryAdd(b, REACH)).toBe('added');
  });
});

describe('Chain: prisms', () => {
  it('a prism links into any chain', () => {
    const c = new Chain();
    c.start(node(0, 0, 0));
    expect(c.tryAdd(node(50, 0, 3, true), REACH)).toBe('added');
  });

  it('after a prism, any color may follow and becomes the chain color', () => {
    const c = new Chain();
    c.start(node(0, 0, 0));
    c.tryAdd(node(50, 0, 0, true), REACH);
    expect(c.requiredColor).toBe(ANY_COLOR);
    expect(c.tryAdd(node(100, 0, 2), REACH)).toBe('added');
    expect(c.chainColor).toBe(2);
    expect(c.tryAdd(node(150, 0, 0), REACH)).toBe('color');
    expect(c.tryAdd(node(150, 0, 2), REACH)).toBe('added');
    expect(c.colorCount()).toBe(2);
  });

  it('a chain may start on a prism', () => {
    const c = new Chain();
    c.start(node(0, 0, 0, true));
    expect(c.chainColor).toBe(ANY_COLOR);
    expect(c.tryAdd(node(50, 0, 4), REACH)).toBe('added');
    expect(c.chainColor).toBe(4);
  });

  it('two prisms in a row still allow any color', () => {
    const c = new Chain();
    c.start(node(0, 0, 1));
    c.tryAdd(node(50, 0, 0, true), REACH);
    c.tryAdd(node(100, 0, 0, true), REACH);
    expect(c.tryAdd(node(150, 0, 3), REACH)).toBe('added');
  });

  it('backtracking off a color switch restores the previous requirement', () => {
    const c = new Chain();
    c.start(node(0, 0, 1));
    c.tryAdd(node(50, 0, 0, true), REACH);
    c.tryAdd(node(100, 0, 2), REACH);
    c.backtrack();
    expect(c.requiredColor).toBe(ANY_COLOR);
    c.backtrack();
    expect(c.requiredColor).toBe(1);
  });

  it('counts three colors across two prisms', () => {
    const c = new Chain();
    c.start(node(0, 0, 0));
    c.tryAdd(node(40, 0, 0, true), REACH);
    c.tryAdd(node(80, 0, 1), REACH);
    c.tryAdd(node(120, 0, 0, true), REACH);
    c.tryAdd(node(160, 0, 2), REACH);
    expect(c.colorCount()).toBe(3);
  });
});

describe('Chain: breaking', () => {
  it('finds the first overstretched link', () => {
    const c = new Chain();
    const nodes = [node(0, 0), node(100, 0), node(200, 0), node(300, 0)];
    c.start(nodes[0]);
    for (let i = 1; i < nodes.length; i++) c.tryAdd(nodes[i], REACH);
    expect(c.findOverstretched(REACH * 1.35)).toBe(-1);
    nodes[2].x = 330; // link 1→2 is now 230 long, over 202.5
    expect(c.findOverstretched(REACH * 1.35)).toBe(2);
    const removed: Linkable[] = [];
    c.truncate(2, removed);
    expect(c.length).toBe(2);
    expect(removed).toEqual([nodes[2], nodes[3]]);
  });

  it('removes a dead node and everything after it', () => {
    const c = new Chain();
    const nodes = [node(0, 0), node(50, 0), node(100, 0), node(150, 0)];
    c.start(nodes[0]);
    for (let i = 1; i < nodes.length; i++) c.tryAdd(nodes[i], REACH);
    const dead = new Set([nodes[1]]);
    const removed: Linkable[] = [];
    expect(c.removeDead((n) => !dead.has(n), removed)).toBe(1);
    expect(c.nodes).toEqual([nodes[0]]);
    expect(removed).toEqual([nodes[2], nodes[3]]);
  });

  it('removeDead is a no-op when all nodes live', () => {
    const c = new Chain();
    c.start(node(0, 0));
    c.tryAdd(node(10, 0), REACH);
    expect(c.removeDead(() => true)).toBe(-1);
    expect(c.length).toBe(2);
  });

  it('removing node 0 empties the chain', () => {
    const c = new Chain();
    const a = node(0, 0);
    c.start(a);
    c.tryAdd(node(10, 0), REACH);
    c.removeDead((n) => n !== a);
    expect(c.active).toBe(false);
  });
});

describe('Chain: release', () => {
  it('chains below the minimum dissolve', () => {
    const c = new Chain();
    c.start(node(0, 0));
    c.tryAdd(node(10, 0), REACH);
    expect(c.release(3)).toBeNull();
    expect(c.active).toBe(false);
  });

  it('chains at the minimum pop, in order', () => {
    const c = new Chain();
    const nodes = [node(0, 0), node(10, 0), node(20, 0)];
    c.start(nodes[0]);
    c.tryAdd(nodes[1], REACH);
    c.tryAdd(nodes[2], REACH);
    expect(c.release(3)).toEqual(nodes);
    expect(c.active).toBe(false);
  });
});

describe('chainTier', () => {
  const t = { burst: 5, ripple: 8, surge: 12 };
  it('maps lengths to tiers', () => {
    expect(chainTier(3, t)).toBe('none');
    expect(chainTier(4, t)).toBe('none');
    expect(chainTier(5, t)).toBe('burst');
    expect(chainTier(7, t)).toBe('burst');
    expect(chainTier(8, t)).toBe('ripple');
    expect(chainTier(11, t)).toBe('ripple');
    expect(chainTier(12, t)).toBe('surge');
  });
});
