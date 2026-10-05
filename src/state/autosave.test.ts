import { describe, it, expect } from 'vitest';
import { autosaveProject, clearAutosave, hasSiteMap, indexedDbStore, loadAutosave, type AutosaveStore } from './autosave.ts';
import { defaultProject } from './projectTypes.ts';

function memoryStore(): AutosaveStore & { text: string | null } {
  const s = {
    text: null as string | null,
    load: () => Promise.resolve(s.text),
    save: (t: string) => {
      s.text = t;
      return Promise.resolve();
    },
    clear: () => {
      s.text = null;
      return Promise.resolve();
    },
  };
  return s;
}

const failing: AutosaveStore = {
  load: () => Promise.reject(new Error('SecurityError: storage blocked')),
  save: () => Promise.reject(new Error('QuotaExceededError')),
  clear: () => Promise.reject(new Error('blocked')),
};

const withMap = () => {
  const p = defaultProject();
  return { ...p, sitePlan: { ...p.sitePlan, devices: [{ kind: 'nvr' as const, id: 'nvr-1', label: 'Rack', x: 1, y: 1 }] } };
};

describe('IndexedDB autosave (M6)', () => {
  it('round-trips the project through the same format as Save project', async () => {
    const store = memoryStore();
    expect(await loadAutosave(store)).toBeNull();
    expect(await autosaveProject(store, withMap(), 'imperial')).toEqual({ ok: true });
    const r = await loadAutosave(store);
    expect(r?.ok).toBe(true);
    if (!r?.ok) return;
    expect(r.opened.project).toEqual(withMap());
    expect(r.opened.units).toBe('imperial');
    await clearAutosave(store);
    expect(store.text).toBeNull();
  });

  it('never throws when storage fails; it reports a reason', async () => {
    const saved = await autosaveProject(failing, defaultProject(), 'metric');
    expect(saved.ok).toBe(false);
    if (!saved.ok) expect(saved.reason).toMatch(/QuotaExceededError.*Save project/);
    const loaded = await loadAutosave(failing);
    expect(loaded?.ok).toBe(false);
    expect((await clearAutosave(failing)).ok).toBe(false);
  });

  it('reports a corrupt autosave instead of applying it', async () => {
    const store = memoryStore();
    store.text = '{"format":"contractech-cctv-project","v":1,"name":';
    const r = await loadAutosave(store);
    expect(r?.ok).toBe(false);
  });

  it('is simply absent when the browser has no IndexedDB', () => {
    expect(indexedDbStore(undefined)).toBeNull();
  });

  it('only offers a restore when there is a map to restore', () => {
    expect(hasSiteMap(defaultProject())).toBe(false);
    expect(hasSiteMap(withMap())).toBe(true);
  });
});
