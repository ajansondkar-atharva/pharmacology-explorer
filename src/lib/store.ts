/* Persistent user state — favorites, notes, recents, visits, basket,
   quiz cards, prefs. Uses IndexedDB (Dexie) when available; falls back
   to localStorage, then in-memory. All access goes through this module
   so views never touch storage directly. */

import Dexie, { type Table } from 'dexie';
import { appState } from './state';

export interface Note {
  drugId: string;
  text: string;
  updatedAt: number;
}

export interface QuizCard {
  drugId: string;
  ease: number;          // 1.3 – 2.8 (SM-2 style)
  intervalDays: number;
  due: number;           // epoch ms
  reps: number;
  lapses: number;
}

interface PersistBackend {
  getFavs(): Promise<string[]>;
  addFav(id: string): Promise<void>;
  removeFav(id: string): Promise<void>;
  getNotes(): Promise<Note[]>;
  getNote(id: string): Promise<string | undefined>;
  setNote(id: string, text: string): Promise<void>;
  getRecents(): Promise<string[]>;
  addRecent(q: string): Promise<void>;
  getVisits(): Promise<string[]>;
  addVisit(id: string): Promise<void>;
  getBasket(): Promise<string[]>;
  setBasket(ids: string[]): Promise<void>;
  getQuiz(): Promise<QuizCard[]>;
  setQuiz(card: QuizCard): Promise<void>;
  getPrefs(): Promise<Record<string, string>>;
  setPref(key: string, value: string): Promise<void>;
}

/* ---------- IndexedDB backend (Dexie) ---------- */

class DexieBackend implements PersistBackend {
  db: Dexie;
  favs!: Table<{ id: string; createdAt: number }, string>;
  notes!: Table<Note, string>;
  recents!: Table<{ key: string; ts: number }, string>;
  visits!: Table<{ id: string; ts: number }, string>;
  basket!: Table<{ id: string; ts: number }, string>;
  quiz!: Table<QuizCard, string>;
  prefs!: Table<{ key: string; value: string }, string>;

  constructor() {
    this.db = new Dexie('pharm-explorer-v2');
    this.db.version(1).stores({
      favs: 'id, createdAt',
      notes: 'drugId, updatedAt',
      recents: 'key, ts',
      visits: 'id, ts',
      basket: 'id, ts',
      quiz: 'drugId, due',
      prefs: 'key',
    });
    this.favs = this.db.table('favs');
    this.notes = this.db.table('notes');
    this.recents = this.db.table('recents');
    this.visits = this.db.table('visits');
    this.basket = this.db.table('basket');
    this.quiz = this.db.table('quiz');
    this.prefs = this.db.table('prefs');
  }

  async getFavs() {
    return (await this.favs.orderBy('createdAt').toArray()).map((r) => r.id);
  }
  async addFav(id: string) {
    await this.favs.put({ id, createdAt: Date.now() });
  }
  async removeFav(id: string) {
    await this.favs.delete(id);
  }
  async getNotes() {
    return this.notes.toArray();
  }
  async getNote(id: string) {
    return (await this.notes.get(id))?.text;
  }
  async setNote(id: string, text: string) {
    await this.notes.put({ drugId: id, text, updatedAt: Date.now() });
  }
  async getRecents() {
    return (await this.recents.orderBy('ts').reverse().limit(8).toArray()).map((r) => r.key);
  }
  async addRecent(q: string) {
    const key = q.toLowerCase().trim();
    if (!key) return;
    await this.recents.put({ key, ts: Date.now() });
    const all = await this.recents.orderBy('ts').reverse().toArray();
    if (all.length > 8) {
      const drop = all.slice(8);
      await this.recents.bulkDelete(drop.map((r) => r.key));
    }
  }
  async getVisits() {
    return (await this.visits.orderBy('ts').reverse().limit(10).toArray()).map((r) => r.id);
  }
  async addVisit(id: string) {
    await this.visits.put({ id, ts: Date.now() });
  }
  async getBasket() {
    return (await this.basket.orderBy('ts').toArray()).map((r) => r.id);
  }
  async setBasket(ids: string[]) {
    await this.basket.clear();
    if (ids.length) await this.basket.bulkPut(ids.map((id, i) => ({ id, ts: Date.now() + i })));
  }
  async getQuiz() {
    return this.quiz.toArray();
  }
  async setQuiz(card: QuizCard) {
    await this.quiz.put(card);
  }
  async getPrefs() {
    const all = await this.prefs.toArray();
    return Object.fromEntries(all.map((r) => [r.key, r.value]));
  }
  async setPref(key: string, value: string) {
    await this.prefs.put({ key, value });
  }
}

/* ---------- localStorage fallback ---------- */

class LSBackend implements PersistBackend {
  private read<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem('pex:' + key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  }
  private write(key: string, value: unknown) {
    try {
      localStorage.setItem('pex:' + key, JSON.stringify(value));
    } catch {
      /* storage full / unavailable — ignore */
    }
  }
  async getFavs() {
    return this.read<string[]>('favs', []);
  }
  async addFav(id: string) {
    const s = new Set(await this.getFavs());
    s.add(id);
    this.write('favs', [...s]);
  }
  async removeFav(id: string) {
    const s = new Set(await this.getFavs());
    s.delete(id);
    this.write('favs', [...s]);
  }
  async getNotes() {
    return Object.entries(this.read<Record<string, string>>('notes', {})).map(([drugId, text]) => ({
      drugId, text, updatedAt: 0,
    }));
  }
  async getNote(id: string) {
    return this.read<Record<string, string>>('notes', {})[id];
  }
  async setNote(id: string, text: string) {
    const notes = this.read<Record<string, string>>('notes', {});
    notes[id] = text;
    this.write('notes', notes);
  }
  async getRecents() {
    return this.read<string[]>('recents', []);
  }
  async addRecent(q: string) {
    const key = q.toLowerCase().trim();
    if (!key) return;
    const arr = (await this.getRecents()).filter((r) => r !== key);
    arr.unshift(key);
    this.write('recents', arr.slice(0, 8));
  }
  async getVisits() {
    return this.read<string[]>('visits', []);
  }
  async addVisit(id: string) {
    const arr = (await this.getVisits()).filter((r) => r !== id);
    arr.unshift(id);
    this.write('visits', arr.slice(0, 10));
  }
  async getBasket() {
    return this.read<string[]>('basket', []);
  }
  async setBasket(ids: string[]) {
    this.write('basket', ids);
  }
  async getQuiz() {
    return this.read<QuizCard[]>('quiz', []);
  }
  async setQuiz(card: QuizCard) {
    const arr = (await this.getQuiz()).filter((c) => c.drugId !== card.drugId);
    arr.push(card);
    this.write('quiz', arr);
  }
  async getPrefs() {
    return this.read<Record<string, string>>('prefs', {});
  }
  async setPref(key: string, value: string) {
    const prefs = this.read<Record<string, string>>('prefs', {});
    prefs[key] = value;
    this.write('prefs', prefs);
  }
}

/* ---------- in-memory fallback (private mode / disabled storage) ---------- */

class MemBackend implements PersistBackend {
  favs = new Set<string>();
  notes = new Map<string, string>();
  recents: string[] = [];
  visits: string[] = [];
  basket: string[] = [];
  quiz = new Map<string, QuizCard>();
  prefs = new Map<string, string>();
  async getFavs() { return [...this.favs]; }
  async addFav(id: string) { this.favs.add(id); }
  async removeFav(id: string) { this.favs.delete(id); }
  async getNotes() { return [...this.notes].map(([drugId, text]) => ({ drugId, text, updatedAt: 0 })); }
  async getNote(id: string) { return this.notes.get(id); }
  async setNote(id: string, text: string) { this.notes.set(id, text); }
  async getRecents() { return this.recents.slice(0, 8); }
  async addRecent(q: string) {
    const key = q.toLowerCase().trim();
    if (!key) return;
    this.recents = [key, ...this.recents.filter((r) => r !== key)].slice(0, 8);
  }
  async getVisits() { return this.visits.slice(0, 10); }
  async addVisit(id: string) { this.visits = [id, ...this.visits.filter((v) => v !== id)].slice(0, 10); }
  async getBasket() { return this.basket; }
  async setBasket(ids: string[]) { this.basket = ids; }
  async getQuiz() { return [...this.quiz.values()]; }
  async setQuiz(card: QuizCard) { this.quiz.set(card.drugId, card); }
  async getPrefs() { return Object.fromEntries(this.prefs); }
  async setPref(key: string, value: string) { this.prefs.set(key, value); }
}

/* ---------- facade ---------- */

let backend: PersistBackend | null = null;
export let storageMode: 'indexeddb' | 'localstorage' | 'memory' = 'memory';

export async function initStore(): Promise<void> {
  try {
    const b = new DexieBackend();
    await b.db.open();
    backend = b;
    storageMode = 'indexeddb';
  } catch {
    try {
      localStorage.setItem('pex:probe', '1');
      localStorage.removeItem('pex:probe');
      backend = new LSBackend();
      storageMode = 'localstorage';
    } catch {
      backend = new MemBackend();
      storageMode = 'memory';
    }
  }
}

function b(): PersistBackend {
  if (!backend) throw new Error('store not initialized — call initStore() first');
  return backend;
}

/* favorites */
export async function getFavorites(): Promise<string[]> {
  return b().getFavs();
}
export async function toggleFavorite(id: string): Promise<boolean> {
  const favs = new Set(await b().getFavs());
  if (favs.has(id)) {
    await b().removeFav(id);
    favs.delete(id);
  } else {
    await b().addFav(id);
    favs.add(id);
  }
  appState.emit('favorites');
  return favs.has(id);
}

/* notes */
export async function getNotes(): Promise<Note[]> {
  return b().getNotes();
}
export async function getNote(id: string): Promise<string | undefined> {
  return b().getNote(id);
}
export async function setNote(id: string, text: string): Promise<void> {
  await b().setNote(id, text);
  appState.emit('notes');
}

/* recents / visits */
export async function addRecentSearch(q: string): Promise<void> {
  return b().addRecent(q);
}
export async function getRecentSearches(): Promise<string[]> {
  return b().getRecents();
}
export async function addVisit(id: string): Promise<void> {
  return b().addVisit(id);
}
export async function getVisits(): Promise<string[]> {
  return b().getVisits();
}

/* basket */
export async function getBasket(): Promise<string[]> {
  return b().getBasket();
}
export async function setBasket(ids: string[]): Promise<void> {
  await b().setBasket(ids);
  appState.emit('basket');
}
export async function toggleBasket(id: string, max = 4): Promise<string[]> {
  const cur = await getBasket();
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= max ? cur : [...cur, id];
  await setBasket(next);
  return next;
}

/* quiz (spaced repetition) */
export async function getQuizCards(): Promise<QuizCard[]> {
  return b().getQuiz();
}
export async function setQuizCard(card: QuizCard): Promise<void> {
  await b().setQuiz(card);
  appState.emit('quiz');
}
export async function dueQuizCards(now = Date.now()): Promise<QuizCard[]> {
  return (await b().getQuiz()).filter((c) => c.due <= now);
}

/* prefs */
export async function getPrefs(): Promise<Record<string, string>> {
  return b().getPrefs();
}
export async function setPref(key: string, value: string): Promise<void> {
  await b().setPref(key, value);
  appState.emit('prefs');
}
