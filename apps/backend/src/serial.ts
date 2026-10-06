/**
 * Calls under the same key run one after another, in the order they were made; calls under different keys run side by
 * side. A call that fails does not hold up the ones after it, and a key is forgotten once its last call has settled.
 */
export class Serial {
  private tails = new Map<string, Promise<unknown>>();

  run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const next = (this.tails.get(key) ?? Promise.resolve()).catch(() => {}).then(fn);
    this.tails.set(key, next);
    void next
      .finally(() => {
        if (this.tails.get(key) === next) this.tails.delete(key);
      })
      .catch(() => {});
    return next;
  }

  /** Whether a call under the key is waiting or running */
  busy(key: string): boolean {
    return this.tails.has(key);
  }
}
