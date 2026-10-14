export interface Positioned {
  x: number;
  y: number;
}

/**
 * Uniform-grid spatial hash rebuilt every step. Cells are hashed into a fixed table, and items
 * are chained through typed arrays, so neither rebuilding nor querying allocates.
 */
export class SpatialHash<T extends Positioned> {
  private readonly head: Int32Array;
  private readonly next: Int32Array;
  private readonly stamp: Int32Array;
  private readonly items: T[] = [];
  private count = 0;
  private queryId = 0;
  private readonly mask: number;

  constructor(
    private readonly cellSize: number,
    capacity: number,
    tableBits = 12,
  ) {
    const tableSize = 1 << tableBits;
    this.mask = tableSize - 1;
    this.head = new Int32Array(tableSize).fill(-1);
    this.next = new Int32Array(capacity);
    this.stamp = new Int32Array(capacity);
  }

  clear(): void {
    this.head.fill(-1);
    this.count = 0;
  }

  private bucket(cx: number, cy: number): number {
    return (Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663)) & this.mask;
  }

  insert(item: T): void {
    if (this.count >= this.next.length) return;
    const i = this.count++;
    this.items[i] = item;
    const b = this.bucket(Math.floor(item.x / this.cellSize), Math.floor(item.y / this.cellSize));
    this.next[i] = this.head[b];
    this.stamp[i] = 0;
    this.head[b] = i;
  }

  /**
   * Collects items whose position is within `radius` of (x, y) into `out` (cleared first).
   * `extra(item)` widens the test per item (for example by the item's own radius).
   */
  query(x: number, y: number, radius: number, out: T[], extra?: (item: T) => number): T[] {
    out.length = 0;
    const id = ++this.queryId;
    const cs = this.cellSize;
    const reachPad = extra ? cs : 0;
    const r = radius + reachPad;
    const cx0 = Math.floor((x - r) / cs);
    const cx1 = Math.floor((x + r) / cs);
    const cy0 = Math.floor((y - r) / cs);
    const cy1 = Math.floor((y + r) / cs);
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        let i = this.head[this.bucket(cx, cy)];
        while (i !== -1) {
          if (this.stamp[i] !== id) {
            this.stamp[i] = id;
            const it = this.items[i];
            const dx = it.x - x;
            const dy = it.y - y;
            const rr = radius + (extra ? extra(it) : 0);
            if (dx * dx + dy * dy <= rr * rr) out.push(it);
          }
          i = this.next[i];
        }
      }
    }
    return out;
  }
}
