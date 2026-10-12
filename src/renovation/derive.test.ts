/**
 * What Admin derives for the renovation line: open items, Final blockers
 * (safety, assumed values, sample rates, legal texts), and the proposal model's
 * honesty rules (labelled + approved visuals only, reviewed narrative only,
 * range before the survey).
 */

import { describe, it, expect } from 'vitest';

import type { SitePlan } from '../domain/sitePlan.ts';
import { deriveRenovation } from './derive.ts';
import { draftFromRenovationIntake } from './intake.ts';
import { sampleLibrary } from './library.ts';
import { LEGAL_PLACEHOLDER, type PortalData, type VisualAsset } from './model.ts';
import { buildProposal, nextRevision } from './proposal.ts';
import { drawnRooms, promoteShape, updateLine } from './rnState.ts';
import { THREE_ROOM_PHOTOS, threeRoomAnswers } from './testFixtures.ts';

const plan: SitePlan = { image: null, calibration: null, devices: [], routes: [] };
const today = '2026-10-12';
const draft = () => draftFromRenovationIntake({ answers: threeRoomAnswers(), submittedOn: today, photos: THREE_ROOM_PHOTOS, planImage: null }, sampleLibrary()).portal;

/** The draft with every assumed value confirmed, every room surveyed and the checklist answered "No". */
function surveyed(p: PortalData): PortalData {
  return updateLine(
    { ...p, rooms: p.rooms.map((r) => ({ ...r, assumed: {}, surveyed: true })) },
    (l) => ({ ...l, survey: { ...l.survey, safety: l.survey.safety.map((s) => ({ ...s, answer: 'no' as const })) } }),
  );
}

/** Own rates (not samples) and approved legal texts. */
function priced(p: PortalData): PortalData {
  return updateLine(p, (l) => ({
    ...l,
    library: { ...l.library, rates: l.library.rates.map((r) => ({ ...r, sample: false, unverified: false, source: 'Rate sheet RS-1' })) },
    settings: { ...l.settings, legalApproved: true, warrantyText: 'Approved warranty.', termsText: 'Approved terms.' },
  }));
}

const blockersOf = (p: PortalData) => deriveRenovation(p, plan, today).finalBlockers.map((b) => b.text);

describe('Final is blocked until the survey, rates and legal texts are done', () => {
  it('a fresh intake draft lists every blocker', () => {
    const b = blockersOf(draft());
    expect(b.join(' | ')).toMatch(/safety checklist has 8 unanswered/);
    expect(b.join(' | ')).toMatch(/15 values still assumed/);
    expect(b.join(' | ')).toMatch(/SAMPLE rates/);
    expect(b.join(' | ')).toMatch(/not marked as approved by a lawyer/);
  });

  it('a "Yes" on a blocking safety item blocks Final until an action is recorded; a non-blocking Yes only notes it', () => {
    const base = priced(surveyed(draft()));
    expect(blockersOf(base)).toEqual([]);
    const yes = (item: string, action = '') => updateLine(base, (l) => ({ ...l, survey: { ...l.survey, safety: l.survey.safety.map((s) => (s.itemId === item ? { ...s, answer: 'yes' as const, action } : s)) } }));
    expect(blockersOf(yes('gas')).join(' ')).toMatch(/Safety: .*gas.*needs an action recorded/i);
    expect(blockersOf(yes('gas', 'Gas supply isolated; specialist booked'))).toEqual([]);
    expect(blockersOf(yes('fire'))).toEqual([]);
    const d = deriveRenovation(yes('fire'), plan, today);
    expect(d.warnings.find((w) => w.id === 'safety-fire')?.severity).toBe('attention');
  });

  it('the placeholder legal line blocks Final even when ticked approved', () => {
    const p = updateLine(priced(surveyed(draft())), (l) => ({ ...l, settings: { ...l.settings, warrantyText: `${LEGAL_PLACEHOLDER}\nx` } }));
    expect(blockersOf(p).join(' ')).toMatch(/placeholder line/);
  });

  it('section statuses say what is open', () => {
    const d = deriveRenovation(draft(), plan, today);
    expect(d.statuses['rn-survey'].kind).toBe('attention');
    expect(d.statuses['rn-boq']).toEqual({ kind: 'attention', text: 'Sample rates' });
    expect(d.statuses['rn-proposal']).toEqual({ kind: 'in-progress', text: 'Draft' });
    expect(d.firm).toBe(false);
  });
});

const asset = (viewId: string, patch: Partial<VisualAsset> = {}): VisualAsset => ({
  id: `visual-${viewId}`,
  viewId,
  fileName: `${viewId}-v1.jpg`,
  dataUri: THREE_ROOM_PHOTOS[0]!.dataUri,
  widthPx: 640,
  heightPx: 480,
  labelBurned: true,
  variant: 1,
  provider: 'Tool',
  modelName: 'Model',
  templateId: 'RN-IMG-EDIT',
  templateVersion: 'v1.0',
  promptText: 'prompt',
  inputPhotoIds: [],
  importedOn: today,
  qa: ['pass', 'pass', 'pass', 'pass', 'pass', 'pass', 'pass', 'pass'],
  qaNotes: '',
  recommend: 'use',
  overrideReason: '',
  approvedBy: 'Engineer',
  approvedOn: today,
  selected: true,
  ...patch,
});

describe('the proposal model', () => {
  const opts = { projectName: 'P', clientName: 'C', clientContact: '', profile: { name: 'E', title: '', phone: '', email: '' }, today };

  it('shows the client a range, no rates and no payment amounts before the survey', () => {
    const p = draft();
    const m = buildProposal(p, deriveRenovation(p, plan, today), opts);
    expect(m.firm).toBe(false);
    expect(m.range && m.range.low < m.range.high).toBe(true);
    expect(m.payments.every((x) => x.amount === null)).toBe(true);
  });

  it('shows the firm total and payment amounts once surveyed', () => {
    const p = priced(surveyed(draft()));
    const d = deriveRenovation(p, plan, today);
    const m = buildProposal(p, d, opts);
    expect(m.firm).toBe(true);
    expect(m.total).toBe(d.boq!.total);
    expect(m.payments.reduce((s, x) => s + (x.amount ?? 0), 0)).toBeCloseTo(d.boq!.total, 2);
  });

  it('puts only approved, selected, labelled visuals in the gallery (max 2 per room), and the narrative only once reviewed', () => {
    let p = draft();
    p = updateLine(p, (l) => ({
      ...l,
      assets: [asset('view-1'), asset('view-2'), asset('view-3', { labelBurned: false }), asset('view-4', { approvedOn: null })],
      narrative: { ...l.narrative, text: '# Intro\nHello', reviewed: false },
    }));
    const m = buildProposal(p, deriveRenovation(p, plan, today), opts);
    expect(m.rooms.map((r) => r.pairs.length)).toEqual([2, 0, 0]);
    expect(m.hero).not.toBeNull();
    expect(m.narrative).toBeNull();
    expect(deriveRenovation(p, plan, today).warnings.find((w) => w.id === 'unlabelled')?.severity).toBe('blocked'); // approved but unlabelled: flagged, and left out
    const reviewed = updateLine(p, (l) => ({ ...l, narrative: { ...l.narrative, reviewed: true } }));
    expect(buildProposal(reviewed, deriveRenovation(reviewed, plan, today), opts).narrative).toBe('# Intro\nHello');
    expect(m.furnitureCaption).toBeNull(); // the client keeps their furniture
  });

  it('moves to the next revision letter', () => {
    expect(['', 'A', 'B', 'Z'].map(nextRevision)).toEqual(['A', 'B', 'C', 'ZA']);
  });
});

describe('rooms from the drawn plan', () => {
  it('lists closed shapes with area and perimeter, and promotes one to a room measured from the drawing', () => {
    const drawn: SitePlan = {
      ...plan,
      layout: { canvas: { widthMetres: 20, heightMetres: 16 }, gridMetres: 1, shapes: [{ kind: 'rect', id: 'area-1', cx: 150, cy: 140, width: 100, height: 80, rotationDeg: 0, stroke: 'wall', fill: 'room' }] },
    };
    const p = draft();
    const list = drawnRooms(p, drawn);
    expect(list).toHaveLength(1);
    expect(list[0]!.areaM2).toBeCloseTo(20, 2);
    const { portal, roomId } = promoteShape(p, 'area-1', 'Study');
    const d = deriveRenovation(portal, drawn, today);
    const rq = d.quantities!.rooms.find((r) => r.roomId === roomId)!;
    expect(rq.geometry?.source).toBe('plan');
    expect(rq.geometry?.floorArea.value).toBeCloseTo(20, 2);
    expect(rq.geometry?.perimeter.value).toBeCloseTo(18, 2);
  });
});
