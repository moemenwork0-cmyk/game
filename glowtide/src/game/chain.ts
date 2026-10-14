/**
 * Pure link-validation logic (spec Section 4.1). No rendering, no DOM, no timing:
 * the world feeds it nodes and positions and acts on the results.
 */

export interface Linkable {
  readonly id: number;
  x: number;
  y: number;
  /** Color id (index into CRITTER_COLORS). Ignored for prisms. */
  color: number;
  /** Prisms link into any chain and let the next node be any color. */
  prism: boolean;
}

export type AddResult = 'added' | 'empty' | 'duplicate' | 'color' | 'reach';

/** Color id meaning "any color may come next". */
export const ANY_COLOR = -1;

export class Chain<T extends Linkable = Linkable> {
  readonly nodes: T[] = [];

  get length(): number {
    return this.nodes.length;
  }

  get active(): boolean {
    return this.nodes.length > 0;
  }

  get last(): T | undefined {
    return this.nodes[this.nodes.length - 1];
  }

  clear(): void {
    this.nodes.length = 0;
  }

  /** Starts a new chain with `node` as node 0. Any previous chain is discarded. */
  start(node: T): void {
    this.nodes.length = 0;
    this.nodes.push(node);
  }

  contains(node: T): boolean {
    return this.nodes.indexOf(node) !== -1;
  }

  /**
   * The color the next node must have: the last node's color, or ANY_COLOR when the last
   * node is a prism (or the chain is empty).
   */
  get requiredColor(): number {
    const last = this.last;
    if (!last || last.prism) return ANY_COLOR;
    return last.color;
  }

  /** The chain's current color: the color of the last non-prism node, or ANY_COLOR. */
  get chainColor(): number {
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      if (!this.nodes[i].prism) return this.nodes[i].color;
    }
    return ANY_COLOR;
  }

  /** Number of distinct non-prism colors in the chain. */
  colorCount(): number {
    let mask = 0;
    let count = 0;
    for (const n of this.nodes) {
      if (n.prism) continue;
      const bit = 1 << n.color;
      if ((mask & bit) === 0) {
        mask |= bit;
        count++;
      }
    }
    return count;
  }

  /** True when `node`'s color is acceptable as the next node, ignoring reach and duplicates. */
  colorAllows(node: T): boolean {
    const required = this.requiredColor;
    return node.prism || required === ANY_COLOR || node.color === required;
  }

  /** Checks whether `node` may be added next, without changing the chain. */
  check(node: T, reach: number): AddResult {
    const last = this.last;
    if (!last) return 'empty';
    if (this.contains(node)) return 'duplicate';
    if (!this.colorAllows(node)) return 'color';
    const dx = node.x - last.x;
    const dy = node.y - last.y;
    if (dx * dx + dy * dy > reach * reach) return 'reach';
    return 'added';
  }

  tryAdd(node: T, reach: number): AddResult {
    const result = this.check(node, reach);
    if (result === 'added') this.nodes.push(node);
    return result;
  }

  /** True when `node` is node n−2, so moving onto it should undo the last link. */
  isBacktrackTarget(node: T): boolean {
    const n = this.nodes.length;
    return n >= 2 && this.nodes[n - 2] === node;
  }

  /** Removes and returns the last node. */
  backtrack(): T | undefined {
    return this.nodes.pop();
  }

  /**
   * Index i of the first overstretched link (between node i−1 and node i), or −1.
   * A link is overstretched when its length exceeds `maxLength`.
   */
  findOverstretched(maxLength: number): number {
    const max2 = maxLength * maxLength;
    for (let i = 1; i < this.nodes.length; i++) {
      const a = this.nodes[i - 1];
      const b = this.nodes[i];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      if (dx * dx + dy * dy > max2) return i;
    }
    return -1;
  }

  /** Keeps the first `length` nodes. Removed nodes are appended to `removed` if given. */
  truncate(length: number, removed?: T[]): void {
    if (length >= this.nodes.length) return;
    if (removed) {
      for (let i = length; i < this.nodes.length; i++) removed.push(this.nodes[i]);
    }
    this.nodes.length = Math.max(0, length);
  }

  /**
   * Breaks the chain at the first node for which `isAlive` is false: that node and every node
   * after it are removed. Returns the index of the dead node, or −1 when all nodes are alive.
   */
  removeDead(isAlive: (node: T) => boolean, removed?: T[]): number {
    for (let i = 0; i < this.nodes.length; i++) {
      if (!isAlive(this.nodes[i])) {
        if (removed) {
          for (let j = i + 1; j < this.nodes.length; j++) removed.push(this.nodes[j]);
        }
        this.nodes.length = i;
        return i;
      }
    }
    return -1;
  }

  /**
   * Ends the chain. Returns the nodes to pop (a copy, in link order) if the chain reached
   * `minChain`, otherwise null (the chain dissolves). The chain is always cleared.
   */
  release(minChain: number): T[] | null {
    const result = this.nodes.length >= minChain ? this.nodes.slice() : null;
    this.nodes.length = 0;
    return result;
  }
}

export type ChainTier = 'none' | 'burst' | 'ripple' | 'surge';

export interface ChainThresholds {
  burst: number;
  ripple: number;
  surge: number;
}

/** Highest effect tier reached by a chain of `length` nodes. */
export function chainTier(length: number, t: ChainThresholds): ChainTier {
  if (length >= t.surge) return 'surge';
  if (length >= t.ripple) return 'ripple';
  if (length >= t.burst) return 'burst';
  return 'none';
}
