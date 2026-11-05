/**
 * Where the jobs register lives in this browser: IndexedDB, in its own database
 * (`contractech-jobs`) so it never touches the project autosave's database or
 * its version.
 *
 * Unlike the project autosave, this is the register's home, not a convenience:
 * a failure is reported to the engineer every time (the Jobs section shows it
 * and says to export a backup), never swallowed. IndexedDB can be missing (jsdom,
 * old browsers), blocked (private mode) or full, so every call returns a status
 * instead of throwing.
 */

import { parseJobs, serializeJobs, type Job } from './model.ts';

export interface JobsStore {
  load(): Promise<string | null>;
  save(text: string): Promise<void>;
}

const DB_NAME = 'contractech-jobs';
const STORE = 'register';
const KEY = 'current';

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

function openDb(factory: IDBFactory): Promise<IDBDatabase> {
  const req = factory.open(DB_NAME, 1);
  req.onupgradeneeded = () => {
    if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
  };
  return request(req);
}

async function withStore<T>(factory: IDBFactory, mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb(factory);
  try {
    return await request(f(db.transaction(STORE, mode).objectStore(STORE)));
  } finally {
    db.close();
  }
}

/** The browser's IndexedDB as a `JobsStore`, or null when there is none. */
export function indexedDbJobsStore(factory: IDBFactory | undefined = globalThis.indexedDB): JobsStore | null {
  if (!factory) return null;
  return {
    async load() {
      const v = await withStore<unknown>(factory, 'readonly', (s) => s.get(KEY));
      return typeof v === 'string' ? v : null;
    },
    async save(text) {
      await withStore(factory, 'readwrite', (s) => s.put(text, KEY));
    },
  };
}

function why(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export type LoadOutcome = { readonly ok: true; readonly jobs: Job[] } | { readonly ok: false; readonly reason: string };

/** The saved register (an empty one when nothing was saved yet), or why it could not be read. */
export async function loadJobs(store: JobsStore): Promise<LoadOutcome> {
  let text: string | null;
  try {
    text = await store.load();
  } catch (err) {
    return { ok: false, reason: `The jobs register could not be read from this browser (${why(err)}).` };
  }
  if (text === null) return { ok: true, jobs: [] };
  const r = parseJobs(text);
  return r.ok ? r : { ok: false, reason: `The jobs register saved in this browser is unreadable. ${r.reason}` };
}

export type SaveOutcome = { readonly ok: true } | { readonly ok: false; readonly reason: string };

export async function saveJobs(store: JobsStore, jobs: readonly Job[]): Promise<SaveOutcome> {
  try {
    await store.save(serializeJobs(jobs));
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: `The jobs register could not be saved in this browser (${why(err)}). Export a backup now.` };
  }
}
