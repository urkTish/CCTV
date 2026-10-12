/**
 * The shared spine rides in the workspace envelope's optional `portal` field.
 * Files written by the previous release (fixtures generated with commit
 * a9feecd's own code) open and re-save byte for byte, and adding a renovation
 * line never changes the CCTV project document inside the envelope.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

import { parseProjectFile, serializeProjectFile } from '../state/projectFile.ts';
import { DEFAULT_EXTRAS, parseWorkspace, serializeWorkspace } from '../state/workspace.ts';
import { sampleLibrary } from './library.ts';
import { emptyPortal, newRenovationLine, newRoom, portalSchema, type PortalData } from './model.ts';

const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures', name), 'utf8');

describe('old files open and save unchanged', () => {
  it('a plain CCTV project file from the previous release re-saves byte for byte', () => {
    const text = fixture('old-project.json');
    const r = parseWorkspace(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.extras).toEqual(DEFAULT_EXTRAS);
    expect(r.extras.portal).toBeUndefined();
    expect(serializeWorkspace(r.opened.project, r.opened.units, r.extras)).toBe(text);
  });

  it('a workspace (envelope with extras) from the previous release re-saves byte for byte', () => {
    const text = fixture('old-workspace.json');
    const r = parseWorkspace(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(serializeWorkspace(r.opened.project, r.opened.units, r.extras)).toBe(text);
  });

  it('adding a renovation line keeps the CCTV project document identical, and round-trips', () => {
    const old = parseWorkspace(fixture('old-workspace.json'));
    if (!old.ok) throw new Error(old.reason);
    const portal: PortalData = {
      ...emptyPortal(['cctv', 'renovation']),
      rooms: [{ ...newRoom('room-1', 'Living room', 'living'), lengthM: 5, widthM: 4, heightM: 2.8 }],
      renovation: newRenovationLine(sampleLibrary()),
    };
    const text = serializeWorkspace(old.opened.project, old.opened.units, { ...old.extras, portal });
    const doc = JSON.parse(text) as { project: unknown };
    expect(JSON.stringify(doc.project, null, 2)).toBe(serializeProjectFile(old.opened.project, old.opened.units));
    const back = parseWorkspace(text);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.extras.portal).toEqual(portal);
    expect(serializeWorkspace(back.opened.project, back.opened.units, back.extras)).toBe(text);
    // The plain project-file parser, as an older app would use it, still refuses the envelope with a reason.
    expect(parseProjectFile(text).ok).toBe(false);
  });

  it('a renovation-only project still carries a valid (default) CCTV project inside', () => {
    const portal = { ...emptyPortal(['renovation']), renovation: newRenovationLine(sampleLibrary()) };
    const old = parseWorkspace(fixture('old-project.json'));
    if (!old.ok) throw new Error(old.reason);
    const r = parseWorkspace(serializeWorkspace(old.opened.project, 'metric', { ...DEFAULT_EXTRAS, portal }));
    expect(r.ok && r.extras.portal?.lines).toEqual(['renovation']);
  });
});

describe('spine schema (validation boundary)', () => {
  const good = { ...emptyPortal(['renovation']), renovation: newRenovationLine(sampleLibrary()) };

  it('accepts the defaults and the sample library', () => {
    expect(portalSchema.safeParse(good).success).toBe(true);
  });

  it('refuses unknown fields, wrong enums and out-of-range numbers, naming the field', () => {
    const bad = (patch: (p: Record<string, unknown>) => void) => {
      const doc = JSON.parse(JSON.stringify(good)) as Record<string, unknown>;
      patch(doc);
      const r = portalSchema.safeParse(doc);
      return r.success ? null : r.error.issues[0]?.path.join('.');
    };
    expect(bad((d) => (d.extra = 1))).toBe('');
    expect(bad((d) => ((d.site as Record<string, unknown>).propertyType = 'castle'))).toBe('site.propertyType');
    expect(
      bad((d) => {
        d.rooms = [{ ...newRoom('r', 'R'), heightM: 50 }];
      }),
    ).toBe('rooms.0.heightM');
    expect(
      bad((d) => {
        const rn = d.renovation as { settings: { vatPercent: number } };
        rn.settings.vatPercent = 150;
      }),
    ).toBe('renovation.settings.vatPercent');
    expect(
      bad((d) => {
        d.photos = [{ id: 'p', roomId: null, purpose: 'before', facing: '', fileName: 'x', dataUri: 'data:text/html;base64,AAAA', widthPx: 1, heightPx: 1, addedOn: null, metadataStripped: true, note: '' }];
      }),
    ).toBe('photos.0.dataUri');
  });

  it('a workspace whose portal fails validation is refused with the field path', () => {
    const old = parseWorkspace(fixture('old-project.json'));
    if (!old.ok) throw new Error(old.reason);
    const text = serializeWorkspace(old.opened.project, 'metric', { ...DEFAULT_EXTRAS, portal: good });
    const tampered = text.replace('"vatPercent": 15', '"vatPercent": -1');
    const r = parseWorkspace(tampered);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toMatch(/extras\.portal\.renovation\.settings\.vatPercent/);
  });
});
