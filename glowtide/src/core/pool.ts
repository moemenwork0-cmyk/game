/** Generic free-list pool. Objects are reset by the caller after `acquire`. */
export class Pool<T> {
  private readonly free: T[] = [];

  constructor(
    private readonly factory: () => T,
    prewarm = 0,
  ) {
    for (let i = 0; i < prewarm; i++) this.free.push(factory());
  }

  acquire(): T {
    return this.free.length > 0 ? (this.free.pop() as T) : this.factory();
  }

  release(item: T): void {
    this.free.push(item);
  }

  get available(): number {
    return this.free.length;
  }
}
