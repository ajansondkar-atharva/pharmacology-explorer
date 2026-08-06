/* Tiny pub/sub for app-level reactive state (basket, favorites, notes). */

type Listener = () => void;

class AppState {
  private listeners = new Map<string, Set<Listener>>();

  on(event: string, fn: Listener): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn);
    return () => this.listeners.get(event)?.delete(fn);
  }

  emit(event: string): void {
    this.listeners.get(event)?.forEach((fn) => fn());
  }
}

export const appState = new AppState();
