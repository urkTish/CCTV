/**
 * Client intake → engine inputs (U12). Every answer maps onto an existing
 * engine input; every value the client is not asked is a documented default and
 * is recorded as assumed. The mapped project runs through the real engine.
 */

import { describe, it, expect } from 'vitest';

import { buildBillOfMaterials } from '../engine/billOfMaterials.ts';
import { recommend } from '../engine/recommend.ts';
import { locationSchema, designSettingsSchema } from '../state/projectSchemas.ts';
import { DEFAULT_GEOMETRY, DEFAULT_REQUIREMENTS } from '../state/projectTypes.ts';
import { intakeLinkHash, parseIntakeFile, parseIntakeLink, serializeIntakeFile } from './intakeFile.ts';
import {
  DISTANCE_OPTIONS,
  formFactorFor,
  intakeToProject,
  POWER_TO_POE_MODE,
  projectNameFor,
  recorderAnswersInWords,
  RETENTION_OPTIONS,
  SEE_OPTIONS,
} from './intakeMapping.ts';
import { emptyAnswers, newArea, SEE_CHOICES, type ClientAnswers, type ClientArea } from './intakeTypes.ts';

function answers(areas: ClientArea[], patch: Partial<ClientAnswers> = {}): ClientAnswers {
  return { ...emptyAnswers(), areas, ...patch };
}

const gate: ClientArea = { id: 'a1', name: 'Main gate', cameraCount: 2, see: 'identify', place: 'outdoor', night: 'dark', distance: '5to15' };
const till: ClientArea = { id: 'a2', name: 'Till', cameraCount: 1, see: 'till', place: 'indoor', night: 'lit', distance: 'lt5' };

describe('answers → engine inputs', () => {
  it('maps the purpose choices onto the DORI levels and special cases', () => {
    expect(Object.fromEntries(SEE_CHOICES.map((c) => [c, SEE_OPTIONS[c].purpose]))).toEqual({
      activity: 'detect',
      actions: 'observe',
      recognise: 'recognise',
      identify: 'identify',
      plates: 'lpr',
      till: 'till',
    });
  });

  it('maps place, light, distance, count, retention and budget onto the location', () => {
    const { project } = intakeToProject(answers([gate], { budget: 'premium', recording: { ...emptyAnswers().recording, retention: '2w' } }));
    const l = project.locations[0]!;
    expect(l.name).toBe('Main gate');
    expect(l.purpose).toBe('identify');
    expect(l.environment.site).toBe('outdoor');
    expect(l.environment.ambientLight).toBe('zero-lux');
    expect(l.geometry.targetDistanceMetres).toBe(DISTANCE_OPTIONS['5to15'].metres);
    expect(l.requirements.cameraCount).toBe(2);
    expect(l.requirements.retentionDays).toBe(RETENTION_OPTIONS['2w'].days);
    expect(l.requirements.budgetTier).toBe('premium');
  });

  it('sizes a range for its far end, and caps the assumed scene width at the distance', () => {
    expect(DISTANCE_OPTIONS.lt5.metres).toBe(5);
    expect(DISTANCE_OPTIONS['15to30'].metres).toBe(30);
    const { project } = intakeToProject(answers([{ ...gate, see: 'activity', distance: 'lt5' }]));
    expect(project.locations[0]!.geometry.sceneWidthMetres).toBe(5);
  });

  it('uses plate height for number plates and face height otherwise', () => {
    const { project } = intakeToProject(answers([{ ...gate, see: 'plates' }, till]));
    expect(project.locations[0]!.geometry.targetHeightMetres).toBe(0.5);
    expect(project.locations[1]!.geometry.targetHeightMetres).toBe(DEFAULT_GEOMETRY.targetHeightMetres);
  });

  it('maps the client’s recorder and power choices (owner decision: the client’s options)', () => {
    expect(formFactorFor('unsure', 'any')).toBe('any');
    expect(formFactorFor('desk', '2U')).toBe('desktop');
    expect(formFactorFor('cabinet', 'any')).toBe('rack');
    expect(formFactorFor('cabinet', '1.5U')).toBe('1.5U');
    expect(POWER_TO_POE_MODE).toEqual({ auto: 'auto', recorder: 'built-in', switch: 'external' });
    const { project } = intakeToProject(answers([gate], { recording: { retention: '1m', recorderPlace: 'cabinet', cabinetSpace: '2U', power: 'switch' } }));
    expect(project.settings.recorder.formFactor).toBe('2U');
    expect(project.settings.recorder.poeMode).toBe('external');
    expect(recorderAnswersInWords(answers([gate], { recording: { retention: '1m', recorderPlace: 'cabinet', cabinetSpace: '2U', power: 'switch' } }))).toEqual({
      formFactor: 'In a network cabinet (rack), 2u (two slots)',
      poe: 'From a separate network switch',
    });
  });

  it('defaults the sensible choice when the client is unsure', () => {
    const { project } = intakeToProject(answers([gate]));
    expect(project.settings.recorder.formFactor).toBe('any');
    expect(project.settings.recorder.poeMode).toBe('auto');
  });

  it('names the project from the site name, or the premises type', () => {
    expect(projectNameFor(answers([gate], { site: { ...emptyAnswers().site, siteName: '  Harbour depot ' } }))).toBe('Harbour depot');
    expect(projectNameFor(answers([gate]))).toBe('Shop or restaurant — client intake');
  });
});

describe('assumptions are recorded, never silent', () => {
  it('flags every input the client was not asked, with a reason', () => {
    const { project, assumed } = intakeToProject(answers([gate]));
    const a = assumed[project.locations[0]!.id]!;
    for (const key of [
      'geometry.mountHeightMetres',
      'geometry.targetDistanceMetres',
      'geometry.sceneWidthMetres',
      'geometry.targetHeightMetres',
      'environment.mountSurface',
      'environment.vandalExposure',
      'environment.colourAtNight',
      'environment.strongBacklight',
      'environment.specialConditions',
      'requirements.audioRequired',
      'requirements.twoWayAudioRequired',
      'requirements.requiredCapabilities',
      'requirements.lensPreference',
      'requirements.ptzAcceptable',
      'requirements.motionLevel',
      'requirements.codec',
      'requirements.fps',
    ]) {
      expect(a[key], key).toMatch(/\w/);
    }
    // What the client did say is not marked as assumed.
    for (const key of ['environment.site', 'environment.ambientLight', 'requirements.cameraCount', 'requirements.retentionDays', 'requirements.budgetTier']) {
      expect(a[key], key).toBeUndefined();
    }
  });

  it('flags the one purpose choice that is a judgement (general activity → Detect)', () => {
    const r = intakeToProject(answers([{ ...gate, see: 'activity' }, gate]));
    expect(r.assumed['loc-1']!.purpose).toMatch(/Detect/);
    expect(r.assumed['loc-2']!.purpose).toBeUndefined();
  });

  it('keeps the client’s own words per location', () => {
    const { clientWords } = intakeToProject(answers([gate]));
    expect(clientWords['loc-1']).toBe('“Clearly identify faces” · 2 cameras · outdoors · completely dark at night · 5 to 15 m away');
  });
});

describe('the mapped project is valid engine input', () => {
  it('passes the project schemas and designs through the real engine', () => {
    const { project } = intakeToProject(answers([gate, till, newArea('a3', 3)]));
    for (const l of project.locations) expect(locationSchema.safeParse(l).success).toBe(true);
    expect(designSettingsSchema.safeParse(project.settings).success).toBe(true);
    for (const l of project.locations) expect(recommend(l).error).toBeNull();
    const bom = buildBillOfMaterials(project);
    expect(bom.totals.cameras).toBeGreaterThan(0);
  });

  it('every location keeps the engine defaults for the requirements it does not set', () => {
    const { project } = intakeToProject(answers([gate]));
    const r = project.locations[0]!.requirements;
    expect(r.codec).toBe(DEFAULT_REQUIREMENTS.codec);
    expect(r.fps).toBe(DEFAULT_REQUIREMENTS.fps);
  });

  it('refuses an intake with no areas', () => {
    expect(() => intakeToProject(answers([]))).toThrow(/at least one area/);
  });
});

describe('intake file and link', () => {
  it('round-trips through the file, plan included', () => {
    const planImage = { dataUri: 'data:image/png;base64,iVBORw0KGgo=', widthPx: 10, heightPx: 10, fileName: 'plan.png' };
    const text = serializeIntakeFile({ answers: answers([gate]), submittedOn: '2026-10-05', planImage });
    const r = parseIntakeFile(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.intake.answers).toEqual(answers([gate]));
    expect(r.intake.planImage).toEqual(planImage);
  });

  it('round-trips through the link, without a plan', () => {
    const hash = intakeLinkHash(answers([gate, till]), '2026-10-05');
    expect(hash.startsWith('#/intake/')).toBe(true);
    const r = parseIntakeLink(hash.slice('#/intake/'.length));
    expect(r.ok && r.intake.answers.areas).toHaveLength(2);
  });

  it('refuses a truncated link and a tampered file with a reason', () => {
    const hash = intakeLinkHash(answers([gate]), null);
    const cut = parseIntakeLink(hash.slice('#/intake/'.length, 40));
    expect(cut.ok).toBe(false);
    const bad = JSON.parse(serializeIntakeFile({ answers: answers([gate]), submittedOn: null, planImage: null })) as { answers: { areas: { see: string }[] } };
    bad.answers.areas[0]!.see = 'x-ray';
    const r = parseIntakeFile(JSON.stringify(bad));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/answers\.areas\.0\.see/);
  });
});
