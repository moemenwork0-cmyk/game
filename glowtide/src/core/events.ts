type Handler<P> = (payload: P) => void;

/** Tiny typed event bus. `M` maps event names to payload types. */
export class EventBus<M> {
  private readonly handlers: { [K in keyof M]?: Handler<M[K]>[] } = {};

  on<K extends keyof M>(event: K, handler: Handler<M[K]>): () => void {
    const list = (this.handlers[event] ??= []);
    list.push(handler);
    return () => {
      const i = list.indexOf(handler);
      if (i >= 0) list.splice(i, 1);
    };
  }

  emit<K extends keyof M>(event: K, payload: M[K]): void {
    const list = this.handlers[event];
    if (!list) return;
    for (let i = 0; i < list.length; i++) list[i](payload);
  }
}
