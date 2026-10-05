/**
 * The report model (U15): built from buildBillOfMaterials and engine outputs,
 * with no figure of its own.
 */

import { describe, it, expect } from 'vitest';

import { intakeToProject } from '../client/intakeMapping.ts';
import { emptyAnswers } from '../client/intakeTypes.ts';
import { buildBillOfMaterials } from '../engine/billOfMaterials.ts';
import { CARD_FIELD_ORDER } from '../engine/outputCard.ts';
import { EMPTY_PROFILE } from '../state/engineerProfile.ts';
import { defaultLocation, defaultProject, DEFAULT_GEOMETRY, type Project } from '../state/projectTypes.ts';
import { DEFAULT_EXTRAS, type ProjectExtras } from '../state/workspace.ts';
import { buildReport, longDate, purposeInWords } from './reportModel.ts';

const profile = { name: 'Omar Haddad', title: 'Engineer', phone: '1', email: 'o@x' };
const project: Project = {
  ...defaultProject(),
  name: 'Depot',
  locations: [
    { ...defaultLocation('loc-1', 'Main gate'), purpose: 'identify', geometry: { ...DEFAULT_GEOMETRY, targetDistanceMetres: 8, sceneWidthMetres: 4 } },
    { ...defaultLocation('loc-2', 'Yard'), purpose: 'detect', requirements: { ...defaultLocation('x', 'x').requirements, cameraCount: 3 } },
  ],
};

describe('report model', () => {
  it('takes every figure from the bill of materials', () => {
    const r = buildReport(project, DEFAULT_EXTRAS, profile, '2026-10-05');
    const bom = buildBillOfMaterials(project);
    expect(r.bom.lines).toEqual(bom.lines);
    expect(r.facts.find((f) => f.label === 'Cameras')?.value).toBe(String(bom.totals.cameras));
    expect(r.summary).toContain(`${bom.totals.cameras} Hikvision cameras`);
    expect(r.summary).toContain(`${bom.design.nvr!.primary!.evaluation.nvr.channels}-channel`);
  });

  it('gives every area its 15 fields in the client’s order, and a one-line reason', () => {
    const r = buildReport(project, DEFAULT_EXTRAS, profile, '2026-10-05');
    for (const a of r.areas) {
      expect(a.spec?.map((f) => f.name)).toEqual([...CARD_FIELD_ORDER]);
      expect(a.spec?.every((f) => f.value.trim().length > 0)).toBe(true);
      expect(a.why).toMatch(/[.!?]$/);
      expect(a.why).not.toMatch(/;/);
    }
    expect(r.areas[0]!.asked).toMatch(/^“Clearly identify faces” · 1 camera · outdoors/);
  });

  it('lists each datasheet once, product lines only', () => {
    const r = buildReport(project, DEFAULT_EXTRAS, profile, '2026-10-05');
    const urls = r.datasheets.map((d) => d.url);
    expect(new Set(urls).size).toBe(urls.length);
    const expected = new Set(r.bom.lines.filter((l) => l.datasheetUrl).map((l) => l.datasheetUrl));
    expect(new Set(urls)).toEqual(expected);
  });

  it('prices only what the engineer typed', () => {
    const none = buildReport(project, DEFAULT_EXTRAS, profile, '2026-10-05');
    expect(none.prices.priced).toBe(false);
    const line = none.bom.lines[0]!;
    const extras: ProjectExtras = { ...DEFAULT_EXTRAS, prices: { [line.id]: 100 }, currency: 'SAR' };
    const some = buildReport(project, extras, profile, '2026-10-05');
    expect(some.prices).toMatchObject({ priced: true, pricedLines: 1, total: 100 * line.quantity, currency: 'SAR' });
  });

  it('a final report keeps its own date and preparer; a draft uses today and the current profile', () => {
    const final: ProjectExtras = { ...DEFAULT_EXTRAS, validityDays: 30, report: { status: 'final', finalisedOn: '2026-09-01', preparedBy: profile } };
    const r = buildReport(project, final, EMPTY_PROFILE, '2026-10-05');
    expect(r.final).toBe(true);
    expect(r.date).toBe('2026-09-01');
    expect(r.validUntil).toBe('2026-10-01');
    expect(r.preparedBy.name).toBe('Omar Haddad');
    const draft = buildReport(project, DEFAULT_EXTRAS, profile, '2026-10-05');
    expect(draft.final).toBe(false);
    expect(draft.date).toBe('2026-10-05');
  });

  it('uses the client’s own words when the project came from an intake, and lists what is still assumed', () => {
    const answers = { ...emptyAnswers(), areas: [{ id: 'a', name: 'Gate', cameraCount: 1, see: 'plates' as const, place: 'outdoor' as const, night: 'dark' as const, distance: 'lt5' as const }] };
    const m = intakeToProject(answers);
    const extras: ProjectExtras = { ...DEFAULT_EXTRAS, intake: { submittedOn: null, answers, assumed: m.assumed, clientWords: m.clientWords } };
    const r = buildReport(m.project, extras, profile, '2026-10-05');
    expect(r.areas[0]!.fromIntake).toBe(true);
    expect(r.areas[0]!.asked).toBe(m.clientWords['loc-1']);
    expect(r.notes.toConfirmOnSite.some((n) => /were assumed from the questionnaire/.test(n))).toBe(true);
  });

  it('says plainly when a location has no camera', () => {
    const p: Project = { ...project, locations: [{ ...project.locations[0]!, geometry: { ...DEFAULT_GEOMETRY, targetDistanceMetres: 60, sceneWidthMetres: 30 } }] };
    const r = buildReport(p, DEFAULT_EXTRAS, profile, '2026-10-05');
    expect(r.areas[0]!.camera).toBeNull();
    expect(r.notes.incomplete.length).toBeGreaterThan(0);
  });

  it('formats dates and purposes in plain words', () => {
    expect(longDate('2026-10-05')).toBe('5 October 2026');
    expect(purposeInWords('lpr')).toBe('Read car number plates');
    expect(purposeInWords('monitor')).toBe('Watch general activity');
  });
});
