/**
 * The Concept chapter and the completion / photo report on the renovation
 * line: generated from the proposal (nothing typed twice), Final blockers and
 * status, the proposal model's Concept chapter, and file compatibility — files
 * from earlier releases (including a Phase 1 renovation workspace written by
 * commit fe10261's own code) open and re-save byte for byte, and the new data
 * round-trips.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

import type { SitePlan } from '../domain/sitePlan.ts';
import { addImage, newPictureSection, type PictureSection } from '../pictures/pictureSection.ts';
import { EMPTY_PROFILE } from '../state/engineerProfile.ts';
import { parseWorkspace, serializeWorkspace } from '../state/workspace.ts';
import { buildCompletionModel, completionBlockers, completionStatus, createCompletionReport } from './completion.ts';
import { deriveRenovation } from './derive.ts';
import { draftFromRenovationIntake } from './intake.ts';
import { sampleLibrary } from './library.ts';
import { portalSchema, type PortalData } from './model.ts';
import { buildProposal } from './proposal.ts';
import { updateLine } from './rnState.ts';
import { THREE_ROOM_PHOTOS, threeRoomAnswers } from './testFixtures.ts';

const plan: SitePlan = { image: null, calibration: null, devices: [], routes: [] };
const today = '2026-10-12';
const DATA = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP8=';
const img = { fileName: 'render.jpg', dataUri: DATA, widthPx: 1600, heightPx: 1200, caption: 'Render', takenOn: null, metadataStripped: true };
const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures', name), 'utf8');

const draft = () => draftFromRenovationIntake({ answers: threeRoomAnswers(), submittedOn: today, photos: THREE_ROOM_PHOTOS, planImage: null }, sampleLibrary()).portal;

function withConcepts(p: PortalData, concepts: PictureSection[]): PortalData {
  return updateLine(p, (l) => ({ ...l, concepts }));
}

const concept = (id: string, title: string, roomId: string | null) => addImage({ ...newPictureSection(id, 'concept', title), roomId, description: `${title}: the idea.\n\n- warm light\n- stone floor` }, img);

describe('completion report generated from the proposal', () => {
  it('makes one item per concept and one per room with scope that no concept covers, with the before photo', () => {
    const p = withConcepts(draft(), [concept('concept-1', 'Living room feature wall', 'room-1'), newPictureSection('concept-2', 'concept'), concept('concept-3', 'Calm palette', null)]);
    const d = deriveRenovation(p, plan, today);
    const roomsWithScope = (d.boq?.byRoom ?? []).map((g) => g.id);
    expect(roomsWithScope).toContain('room-1');
    const r = createCompletionReport(p, d, today);
    // The empty concept-2 is skipped; room-1 is covered by concept-1.
    const titles = r.items.map((i) => i.title);
    expect(titles.slice(0, 2)).toEqual(['Living room feature wall', 'Calm palette']);
    expect(titles).not.toContain('Family living room — works');
    expect(titles.filter((t) => t.endsWith('— works')).length).toBe(roomsWithScope.filter((id) => id !== 'room-1' && id !== 'project').length);
    const first = r.items[0]!;
    expect(first).toMatchObject({ kind: 'actual', status: 'in-progress', roomId: 'room-1', layout: 'two', doneOn: null, description: expect.stringContaining('- warm light') });
    // Concept pictures are illustrative: never carried over as evidence. The room's before photo is.
    expect(first.images.map((i) => [i.role, i.dataUri === DATA])).toEqual([['before', false]]);
    expect(first.images[0]!.dataUri).toBe(THREE_ROOM_PHOTOS[0]!.dataUri);
    // A room item lists its BOQ lines as bullets and links the BOQ refs.
    const room = r.items.find((i) => i.roomId === 'room-2')!;
    expect(room.description.split('\n').every((l) => l.startsWith('- '))).toBe(true);
    expect(room.scopeText).toMatch(/BOQ item/);
    expect(r.source).toEqual({ proposalStatus: 'draft', proposalRevision: '' });
    expect(r.state.status).toBe('draft');
  });

  it('blocks Final until every item is done or snag, done items have an After photo and a date', () => {
    const p = draft();
    const r = createCompletionReport(p, deriveRenovation(p, plan, today), today);
    expect(r.items.length).toBeGreaterThan(0);
    expect(completionBlockers(r).length).toBe(r.items.length);
    const done = r.items.map((it, i) => (i === 0 ? { ...it, status: 'snag' as const } : addImage({ ...it, status: 'done' as const, doneOn: today }, { ...img, role: 'after', takenOn: today })));
    expect(completionBlockers({ ...r, items: done })).toEqual([]);
    const noAfter = done.map((it, i) => (i === 1 ? { ...it, images: it.images.filter((x) => x.role !== 'after') } : it));
    expect(completionBlockers({ ...r, items: noAfter }).map((b) => b.text).join()).toMatch(/no After photo/);
    expect(completionBlockers({ ...r, items: [] })[0]!.text).toMatch(/no items/);
    expect(completionStatus({ ...r, items: done })).toEqual({ kind: 'attention', text: `${done.length - 1} of ${done.length} done · 1 snag` });
    expect(completionStatus(undefined)).toEqual({ kind: 'not-started', text: 'Not created' });
    expect(completionStatus({ ...r, state: { ...r.state, status: 'final', revision: 'A' } })).toEqual({ kind: 'complete', text: 'Final Rev A' });
  });

  it('the report model splits done, snags and open items, and keeps the Final engineer', () => {
    const p0 = draft();
    const r = createCompletionReport(p0, deriveRenovation(p0, plan, today), today);
    const items = r.items.map((it, i) => (i === 0 ? { ...it, status: 'snag' as const } : i === 1 ? { ...it, status: 'done' as const, doneOn: '2026-11-02', doneBy: 'Crew A' } : it));
    const p = updateLine(p0, (l) => ({ ...l, completion: { ...r, items, state: { status: 'final', finalisedOn: '2026-11-05', revision: '', preparedBy: { ...EMPTY_PROFILE, name: 'Eng. Turki' } } } }));
    const m = buildCompletionModel(p, { projectName: 'Flat 12', clientName: 'Sara', clientContact: '', profile: { ...EMPTY_PROFILE, name: 'Someone else' }, today });
    expect(m.final).toBe(true);
    expect(m.date).toBe('2026-11-05');
    expect(m.preparedBy.name).toBe('Eng. Turki');
    expect([m.done.length, m.snags.length, m.open.length]).toEqual([1, 1, items.length - 2]);
    expect(m.facts.find((f) => f.label === 'Works carried out')?.value).toBe('2026-11-02');
    expect(m.facts.find((f) => f.label === 'Work by')?.value).toBe('Crew A');
  });
});

describe('the proposal Concept chapter and section statuses', () => {
  it('the proposal carries the concepts that have content, in order; the statuses follow', () => {
    const p = withConcepts(draft(), [concept('concept-2', 'B', 'room-2'), newPictureSection('concept-9', 'concept'), concept('concept-1', 'A', null)]);
    const d = deriveRenovation(p, plan, today);
    const m = buildProposal(p, d, { projectName: 'X', clientName: 'Y', clientContact: '', profile: EMPTY_PROFILE, today });
    expect(m.concepts.map((c) => c.title)).toEqual(['B', 'A']);
    expect(m.roomName('room-2')).toBe('Master bedroom');
    expect(d.statuses['rn-concepts']).toEqual({ kind: 'complete', text: '2 sections' });
    expect(d.statuses['rn-completion']).toEqual({ kind: 'not-started', text: 'Not created' });
    const noPic = withConcepts(draft(), [{ ...newPictureSection('c', 'concept', 'Words only') }]);
    expect(deriveRenovation(noPic, plan, today).statuses['rn-concepts'].kind).toBe('attention');
    expect(deriveRenovation(draft(), plan, today).statuses['rn-concepts']).toEqual({ kind: 'not-started', text: 'Optional' });
  });
});

describe('files: old ones unchanged, new data round-trips', () => {
  it('a Phase 1 renovation workspace (written by fe10261) opens with no concepts or completion and re-saves byte for byte', () => {
    const text = fixture('phase1-renovation-workspace.json');
    const r = parseWorkspace(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.extras.portal?.renovation).not.toBeNull();
    expect(r.extras.portal?.renovation?.concepts).toBeUndefined();
    expect(r.extras.portal?.renovation?.completion).toBeUndefined();
    expect(serializeWorkspace(r.opened.project, r.opened.units, r.extras)).toBe(text);
    expect(text).not.toMatch(/"concepts"|"completion"/);
  });

  it('the earlier CCTV project and workspace files still re-save byte for byte', () => {
    for (const name of ['old-project.json', 'old-workspace.json']) {
      const text = fixture(name);
      const r = parseWorkspace(text);
      if (!r.ok) throw new Error(r.reason);
      expect(serializeWorkspace(r.opened.project, r.opened.units, r.extras)).toBe(text);
    }
  });

  it('concepts and a completion report round-trip through the file, byte-stable', () => {
    const old = parseWorkspace(fixture('phase1-renovation-workspace.json'));
    if (!old.ok) throw new Error(old.reason);
    const base = old.extras.portal!;
    const withC = withConcepts(base, [concept('concept-1', 'Feature wall', 'room-1')]);
    const report = createCompletionReport(withC, deriveRenovation(withC, plan, today), today);
    const items = report.items.map((it) => addImage({ ...it, status: 'done' as const, doneOn: today, doneBy: 'Crew A', signOff: true }, { ...img, role: 'after', takenOn: today }));
    const portal = updateLine(withC, (l) => ({ ...l, completion: { ...report, items } }));
    const text = serializeWorkspace(old.opened.project, old.opened.units, { ...old.extras, portal });
    const back = parseWorkspace(text);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.extras.portal).toEqual(portalSchema.parse(portal));
    expect(back.extras.portal?.renovation?.completion?.items[0]?.images.map((i) => i.role)).toEqual(['before', 'after']);
    expect(serializeWorkspace(back.opened.project, back.opened.units, back.extras)).toBe(text);
    // The CCTV project document inside the envelope is untouched.
    expect(JSON.stringify((JSON.parse(text) as { project: unknown }).project)).toBe(JSON.stringify((JSON.parse(fixture('phase1-renovation-workspace.json')) as { project: unknown }).project));
  });

  it('a tampered concept is refused with the field path', () => {
    const old = parseWorkspace(fixture('phase1-renovation-workspace.json'));
    if (!old.ok) throw new Error(old.reason);
    const portal = withConcepts(old.extras.portal!, [concept('concept-1', 'Feature wall', null)]);
    const text = serializeWorkspace(old.opened.project, old.opened.units, { ...old.extras, portal }).replace('"status": "proposed"', '"status": "approved"');
    const r = parseWorkspace(text);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toMatch(/extras\.portal\.renovation\.concepts\.0\.status/);
  });
});
