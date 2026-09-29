// Minimal in-memory Web Storage for the node test environment
class MemoryStorage {
  #data = new Map();
  getItem(k) {
    return this.#data.has(k) ? this.#data.get(k) : null;
  }
  setItem(k, v) {
    this.#data.set(k, String(v));
  }
  removeItem(k) {
    this.#data.delete(k);
  }
  clear() {
    this.#data.clear();
  }
}
globalThis.localStorage ??= new MemoryStorage();
