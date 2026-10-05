/**
 * Project extras and the workspace envelope (U10): the project file format is
 * unchanged; extras ride in an envelope only when there are any.
 */

import { describe, it, expect } from 'vitest';

import { emptyAnswers, newArea } from '../client/intakeTypes.ts';
import { autosaveProject, loadAutosave, type AutosaveStore } from './autosave.ts';
import { parseProjectFile, serializeProjectFile } from './projectFile.ts';
import { defaultLocation, defaultProject } from './projectTypes.ts';
import {
  assumedCounts,
  confirmAssumed,
  DEFAULT_EXTRAS,
  parseWorkspace,
  pruneExtras,
  serializeWorkspace,
  WORKSPACE_FORMAT,
  type ProjectExtras,
} from './workspace.ts';

const answers = { ...emptyAnswers(), areas: [newArea('a1', 1)] };

const withExtras: ProjectExtras = {
  ...DEFAULT_EXTRAS,
  clientName: 'Northgate Logistics',
  prices: { 'camera:x': 125.5 },
  currency: 'SAR',
  report: { status: 'final', finalisedOn: '2026-10-05', preparedBy: { name: 'A. Engineer', title: 'Engineer', phone: '', email: '' } },
  intake: { submittedOn: '2026-10-04', answers, assumed: { 'loc-1': { 'geometry.mountHeightMetres': 'Not asked.' } }, clientWords: { 'loc-1': '“Watch general activity”' } },
};

describe('workspace file', () => {
  it('writes the plain project file, byte for byte, when there are no extras', () => {
    const p = defaultProject();
    expect(serializeWorkspace(p, 'metric', DEFAULT_EXTRAS)).toBe(serializeProjectFile(p, 'metric'));
  });

  it('wraps an unchanged project document in an envelope when there are extras, and round-trips', () => {
    const p = { ...defaultProject(), locations: [defaultLocation('loc-1', 'Gate')] };
    const text = serializeWorkspace(p, 'imperial', withExtras);
    const doc = JSON.parse(text) as { format: string; project: unknown };
    expect(doc.format).toBe(WORKSPACE_FORMAT);
    expect(JSON.stringify(doc.project, null, 2)).toBe(serializeProjectFile(p, 'imperial'));
    const r = parseWorkspace(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.extras).toEqual(withExtras);
    expect(r.opened.project).toEqual(p);
    expect(r.opened.units).toBe('imperial');
    // Re-saving an opened workspace gives identical bytes.
    expect(serializeWorkspace(r.opened.project, r.opened.units, r.extras)).toBe(text);
  });

  it('still opens a plain project file, with default extras', () => {
    const r = parseWorkspace(serializeProjectFile(defaultProject(), 'metric'));
    expect(r.ok && r.extras).toEqual(DEFAULT_EXTRAS);
  });

  it('refuses a bad envelope with the failing field, and a bad inner project with the project reason', () => {
    const p = defaultProject();
    const good = JSON.parse(serializeWorkspace(p, 'metric', withExtras)) as Record<string, unknown>;
    const badExtras = parseWorkspace(JSON.stringify({ ...good, extras: { ...withExtras, prices: { x: -1 } } }));
    expect(badExtras.ok).toBe(false);
    if (!badExtras.ok) expect(badExtras.reason).toMatch(/extras\.prices\.x/);
    const badInner = parseWorkspace(JSON.stringify({ ...good, project: { ...(good.project as object), v: 9 } }));
    expect(badInner.ok).toBe(false);
    if (!badInner.ok) expect(badInner.reason).toMatch(/project-file version 9/);
    const wrongVersion = parseWorkspace(JSON.stringify({ ...good, v: 2 }));
    expect(wrongVersion.ok).toBe(false);
  });

  it('the plain project-file parser still refuses an envelope (older copies say why)', () => {
    const r = parseProjectFile(serializeWorkspace(defaultProject(), 'metric', withExtras));
    expect(r.ok).toBe(false);
  });
});

describe('intake marks', () => {
  it('counts, confirms and prunes assumed values', () => {
    expect(assumedCounts(withExtras).get('loc-1')).toBe(1);
    const confirmed = confirmAssumed(withExtras, 'loc-1', ['geometry.mountHeightMetres']);
    expect(assumedCounts(confirmed).size).toBe(0);
    expect(confirmAssumed(withExtras, 'loc-1', ['not.a.key'])).toBe(withExtras);
    const pruned = pruneExtras(withExtras, ['loc-2']);
    expect(pruned.intake?.assumed).toEqual({});
    expect(pruned.intake?.clientWords).toEqual({});
  });
});

describe('autosave carries the extras', () => {
  it('round-trips project and extras through the store', async () => {
    let text: string | null = null;
    const store: AutosaveStore = {
      load: () => Promise.resolve(text),
      save: (t) => {
        text = t;
        return Promise.resolve();
      },
      clear: () => Promise.resolve(),
    };
    expect(await autosaveProject(store, defaultProject(), 'metric', withExtras)).toEqual({ ok: true });
    const r = await loadAutosave(store);
    expect(r?.ok && r.extras).toEqual(withExtras);
  });
});
