/**
 * The client's renovation draft, kept on the phone while they fill the wizard
 * in, so a refresh or a call does not lose their answers or photos. A
 * per-device convenience only: IndexedDB when available (photos are too big
 * for localStorage), else localStorage for the answers alone. Every access is
 * wrapped; nothing here ever leaves the device.
 */

import type { PlanImage } from '../domain/sitePlan.ts';
import { emptyRenovationAnswers, photoSchema, renovationAnswersSchema, type Photo, type RenovationAnswers } from './model.ts';

export interface RenovationDraft {
  readonly answers: RenovationAnswers;
  readonly photos: readonly Photo[];
  readonly plan: PlanImage | null;
}

const LS_KEY = 'contractech-renovation.intake-draft';
const DB = 'contractech-renovation';
const STORE = 'draft';

export function emptyDraft(): RenovationDraft {
  return { answers: emptyRenovationAnswers(), photos: [], plan: null };
}

function parse(raw: unknown): RenovationDraft | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as { answers?: unknown; photos?: unknown; plan?: unknown };
  const a = renovationAnswersSchema.safeParse(r.answers);
  if (!a.success) return null;
  const photos = Array.isArray(r.photos) ? r.photos.map((p) => photoSchema.safeParse(p)).filter((p) => p.success).map((p) => p.data) : [];
  const plan = typeof r.plan === 'object' && r.plan !== null && typeof (r.plan as { dataUri?: unknown }).dataUri === 'string' ? (r.plan as PlanImage) : null;
  return { answers: a.data, photos, plan };
}

function idb(): IDBFactory | null {
  try {
    return globalThis.indexedDB ?? null;
  } catch {
    return null;
  }
}

function open(f: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = f.open(DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB'));
  });
}

export function loadDraftSync(): RenovationDraft {
  try {
    const raw = globalThis.localStorage?.getItem(LS_KEY);
    return (raw && parse(JSON.parse(raw))) || emptyDraft();
  } catch {
    return emptyDraft();
  }
}

export async function loadDraft(): Promise<RenovationDraft | null> {
  const f = idb();
  if (!f) return null;
  try {
    const db = await open(f);
    try {
      const value = await new Promise<unknown>((resolve, reject) => {
        const req = db.transaction(STORE, 'readonly').objectStore(STORE).get('current');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('IndexedDB'));
      });
      return typeof value === 'string' ? parse(JSON.parse(value)) : null;
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

export async function saveDraft(d: RenovationDraft): Promise<void> {
  try {
    globalThis.localStorage?.setItem(LS_KEY, JSON.stringify({ answers: d.answers, photos: [], plan: null }));
  } catch {
    // storage blocked or full: the answers last until the page closes
  }
  const f = idb();
  if (!f) return;
  try {
    const db = await open(f);
    try {
      await new Promise<void>((resolve, reject) => {
        const req = db.transaction(STORE, 'readwrite').objectStore(STORE).put(JSON.stringify(d), 'current');
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error ?? new Error('IndexedDB'));
      });
    } finally {
      db.close();
    }
  } catch {
    // a convenience only
  }
}
