/**
 * IndexedDB autosave (M6).
 *
 * The site plan is not in the shareable URL (the image is too big), so without
 * this a browser refresh would lose a map that was never saved to a file. The
 * whole project (with its extras: client name, prices, report state, intake
 * marks) is written as the same JSON document `Save project` produces, so
 * restoring goes through the same validation as opening a file.
 *
 * Autosave is a convenience, never a dependency: IndexedDB can be missing
 * (old browser, jsdom), blocked (private mode, storage policy) or full. Every
 * call is wrapped in try/catch and reports a status instead of throwing; the
 * app carries on and the UI says autosave is unavailable.
 */

import type { Project, UnitSystemState } from './projectTypes.ts';
import { DEFAULT_EXTRAS, parseWorkspace, serializeWorkspace, type ProjectExtras, type WorkspaceResult } from './workspace.ts';

export interface AutosaveStore {
  load(): Promise<string | null>;
  save(text: string): Promise<void>;
  clear(): Promise<void>;
}

export type AutosaveStatus = { readonly ok: true } | { readonly ok: false; readonly reason: string };

const DB_NAME = 'contractech-cctv';
const STORE = 'autosave';
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

/** The browser's IndexedDB as an `AutosaveStore`, or null when there is none. */
export function indexedDbStore(factory: IDBFactory | undefined = globalThis.indexedDB): AutosaveStore | null {
  if (!factory) return null;
  return {
    async load() {
      const v = await withStore<unknown>(factory, 'readonly', (s) => s.get(KEY));
      return typeof v === 'string' ? v : null;
    },
    async save(text) {
      await withStore(factory, 'readwrite', (s) => s.put(text, KEY));
    },
    async clear() {
      await withStore(factory, 'readwrite', (s) => s.delete(KEY));
    },
  };
}

function why(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function autosaveProject(
  store: AutosaveStore,
  project: Project,
  units: UnitSystemState,
  extras: ProjectExtras = DEFAULT_EXTRAS,
): Promise<AutosaveStatus> {
  try {
    await store.save(serializeWorkspace(project, units, extras));
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: `Autosave failed (${why(err)}). Use Save project to keep your work.` };
  }
}

/** The autosaved project, null when there is none, or a reason when it is unreadable. */
export async function loadAutosave(store: AutosaveStore): Promise<WorkspaceResult | null> {
  let text: string | null;
  try {
    text = await store.load();
  } catch (err) {
    return { ok: false, reason: `Could not read the autosave (${why(err)}).` };
  }
  return text === null ? null : parseWorkspace(text);
}

export async function clearAutosave(store: AutosaveStore): Promise<AutosaveStatus> {
  try {
    await store.clear();
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: `Could not clear the autosave (${why(err)}).` };
  }
}

/** True when an autosaved project holds a site plan worth offering to restore. */
export function hasSiteMap(project: Project): boolean {
  const layout = project.sitePlan.layout;
  return (
    project.sitePlan.image !== null ||
    project.sitePlan.devices.length > 0 ||
    (layout !== undefined && (layout.canvas !== null || layout.shapes.length > 0))
  );
}
