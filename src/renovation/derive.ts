/**
 * Everything Admin shows for the renovation line, derived from the stored
 * inputs in one pure pass: quantities, BOQ, programme, payment schedule, the
 * section statuses, every open warning (with the section that fixes it) and
 * what still blocks a Final proposal. Nothing here is stored.
 */

import type { SitePlan } from '../domain/sitePlan.ts';
import type { IconName } from '../ui/icons.tsx';
import type { StatusKind } from '../ui/uiStyles.ts';
import { buildBoq, paymentSchedule, priceRange, type Boq, type PaymentSchedule, type PriceRange } from './boq.ts';
import { measureShape, isClosedArea, type PlanMeasure } from './geometry.ts';
import { assumedTotal, LEGAL_PLACEHOLDER, SAFETY_ITEMS, type PortalData, type Room } from './model.ts';
import { buildProgramme, type Programme } from './programme.ts';
import { projectQuantities, type ProjectQuantities } from './quantities.ts';

export type RnSectionId = 'rn-overview' | 'rn-client' | 'map' | 'rn-survey' | 'rn-spec' | 'rn-library' | 'rn-quantities' | 'rn-boq' | 'rn-visuals' | 'rn-proposal';

export interface RnSectionDef {
  readonly id: RnSectionId;
  readonly label: string;
  readonly short: string;
  readonly icon: IconName;
  readonly description: string;
}

export const RN_SECTIONS: readonly RnSectionDef[] = [
  { id: 'rn-overview', label: 'Overview', short: 'Overview', icon: 'home', description: 'The renovation at a glance: rooms, totals, programme and every open item, each linked to where it is fixed.' },
  { id: 'rn-client', label: 'Client & intake', short: 'Client', icon: 'user', description: 'The client, the site, their consent, what they asked for in their own words, and their style profile.' },
  { id: 'map', label: 'Site map', short: 'Map', icon: 'map', description: 'Draw the floor plan with the drawing tools; closed rooms can then become room records in the Survey.' },
  { id: 'rn-survey', label: 'Survey', short: 'Survey', icon: 'door', description: 'Room by room: dimensions, openings, surfaces and condition, defects, photos, and the mandatory safety checklist.' },
  { id: 'rn-spec', label: 'Specification', short: 'Spec', icon: 'edit', description: 'The proposed finishes per room, chosen from the library only. These drive the quantities, the BOQ and the visual briefs.' },
  { id: 'rn-library', label: 'Library', short: 'Library', icon: 'file', description: 'Materials, colours with codes, unit rates and rule constants — each with its source and an Unverified flag. Nothing is priced without a library rate.' },
  { id: 'rn-quantities', label: 'Quantities', short: 'Quantities', icon: 'square', description: 'Every quantity per room with the formula behind it, and the materials to order rounded up to packs, boxes, bags and boards.' },
  { id: 'rn-boq', label: 'BOQ & programme', short: 'BOQ', icon: 'list', description: 'The bill of quantities by room or by trade, with totals, VAT and the payment schedule; and the programme from the productivities.' },
  { id: 'rn-visuals', label: 'Visuals', short: 'Visuals', icon: 'camera', description: 'Export the brief pack, import the generated “after” images, pair them, check them and approve them. Every visual is labelled Illustrative.' },
  { id: 'rn-proposal', label: 'Proposal', short: 'Proposal', icon: 'report', description: 'The branded A4 renovation proposal: preview, print or save as PDF, and the deliberate switch from Draft to Final.' },
];

export function rnSectionDef(id: RnSectionId): RnSectionDef {
  return RN_SECTIONS.find((s) => s.id === id) ?? RN_SECTIONS[0]!;
}

export function sectionLabel(id: RnSectionId | 'settings'): string {
  return id === 'settings' ? 'Settings' : rnSectionDef(id).label;
}

export interface RnWarning {
  readonly id: string;
  readonly severity: 'blocked' | 'attention';
  readonly text: string;
  readonly section: RnSectionId | 'settings';
  readonly roomId?: string;
}

export interface RnStatus {
  readonly kind: StatusKind;
  readonly text: string;
}

export interface RnDerived {
  readonly quantities: ProjectQuantities | null;
  readonly boq: Boq | null;
  readonly programme: Programme | null;
  readonly payments: PaymentSchedule | null;
  readonly range: PriceRange | null;
  /** True once nothing is assumed any more: the client may see a firm price. */
  readonly firm: boolean;
  readonly warnings: readonly RnWarning[];
  readonly statuses: Readonly<Record<RnSectionId, RnStatus>>;
  readonly finalBlockers: readonly { readonly text: string; readonly section: RnSectionId | 'settings' }[];
  readonly planOf: (room: Room) => PlanMeasure | null;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function planLookup(plan: SitePlan): (room: Room) => PlanMeasure | null {
  const shapes = plan.layout?.shapes ?? [];
  return (room) => {
    if (!room.planShapeId) return null;
    const s = shapes.find((x) => x.id === room.planShapeId);
    return s && isClosedArea(s) ? measureShape(s, plan.calibration) : null;
  };
}

export function deriveRenovation(portal: PortalData | undefined, plan: SitePlan, today: string): RnDerived {
  const planOf = planLookup(plan);
  const line = portal?.renovation ?? null;
  const empty: RnStatus = { kind: 'not-started', text: 'Not started' };
  if (!portal || !line) {
    const statuses = Object.fromEntries(['rn-overview', 'rn-client', 'map', 'rn-survey', 'rn-spec', 'rn-library', 'rn-quantities', 'rn-boq', 'rn-visuals', 'rn-proposal'].map((id) => [id, empty])) as Record<RnSectionId, RnStatus>;
    return { quantities: null, boq: null, programme: null, payments: null, range: null, firm: false, warnings: [], statuses, finalBlockers: [], planOf };
  }
  const quantities = projectQuantities(portal, planOf);
  const boq = quantities ? buildBoq(portal, quantities, today) : null;
  const roomName = (id: string | null) => (id === null ? 'Whole project' : portal.rooms.find((r) => r.id === id)?.name ?? id);
  const programme = quantities ? buildProgramme(quantities, line.library, line.crews, roomName) : null;
  const payments = boq ? paymentSchedule(boq.total, line.settings.milestones) : null;
  const range = boq ? priceRange(boq.total, line.settings) : null;
  const assumed = assumedTotal(portal);

  const warnings: RnWarning[] = [];
  const add = (w: RnWarning) => warnings.push(w);

  // Survey
  if (portal.rooms.length === 0) add({ id: 'no-rooms', severity: 'blocked', text: 'No rooms yet: add rooms in the Survey (or open the client’s intake).', section: 'rn-survey' });
  for (const r of portal.rooms) {
    const n = Object.keys(r.assumed).length;
    if (n > 0) add({ id: `assumed-${r.id}`, severity: 'attention', text: `${r.name}: ${plural(n, 'value')} assumed from the client intake still to confirm.`, section: 'rn-survey', roomId: r.id });
    if (!r.surveyed) add({ id: `unsurveyed-${r.id}`, severity: 'attention', text: `${r.name}: not marked as surveyed on site yet.`, section: 'rn-survey', roomId: r.id });
  }
  for (const rq of quantities?.rooms ?? []) {
    rq.warnings.forEach((w, i) =>
      add({ id: `q-${rq.roomId}-${i}`, severity: rq.geometry ? 'attention' : 'blocked', text: w, section: rq.geometry ? (/library|colour|chosen/.test(w) ? 'rn-spec' : 'rn-survey') : 'rn-survey', roomId: rq.roomId }),
    );
  }
  const safety = line.survey.safety;
  const unanswered = SAFETY_ITEMS.filter((s) => !safety.find((a) => a.itemId === s.id)?.answer);
  if (unanswered.length) add({ id: 'safety-unanswered', severity: 'attention', text: `Safety checklist: ${plural(unanswered.length, 'item')} not answered (mandatory, even if “No”).`, section: 'rn-survey' });
  for (const s of SAFETY_ITEMS) {
    const a = safety.find((x) => x.itemId === s.id);
    if (a?.answer !== 'yes') continue;
    if (s.blocking && !a.action.trim()) add({ id: `safety-${s.id}`, severity: 'blocked', text: `Safety: “${s.text}” — answered Yes with no action recorded. This blocks a Final proposal.`, section: 'rn-survey' });
    else add({ id: `safety-${s.id}`, severity: 'attention', text: `Safety: “${s.text}” — Yes${a.action.trim() ? `; action: ${a.action.trim()}` : ''}. Shown in the proposal’s notes.`, section: 'rn-survey' });
  }
  // Specification
  const specified = line.specs.filter((s) => s.wallPaint || s.ceilingPaint || s.floorTiles || s.wallTiles || s.skirtingId || s.gypsumBoardId || s.removeFloor || s.removeWallTiles || s.items.length);
  if (portal.rooms.length > 0 && specified.length === 0) add({ id: 'no-spec', severity: 'attention', text: 'No finishes specified yet.', section: 'rn-spec' });
  // Library / BOQ
  for (const [i, r] of (boq?.incompleteReasons ?? []).entries()) if (specified.length) add({ id: `boq-${i}`, severity: 'blocked', text: `BOQ: ${r}`, section: 'rn-library' });
  if (boq && boq.sampleRateLines > 0) add({ id: 'sample-rates', severity: 'attention', text: `${plural(boq.sampleRateLines, 'BOQ line')} priced with SAMPLE rates — replace them with your own rates before a Final proposal.`, section: 'rn-library' });
  if (boq && boq.expiredRateLines > 0) add({ id: 'expired-rates', severity: 'attention', text: `${plural(boq.expiredRateLines, 'BOQ line')} use a rate that may be out of date.`, section: 'rn-library' });
  // Settings
  if (payments && !payments.ok) add({ id: 'payments', severity: 'blocked', text: `The payment milestones add up to ${payments.percentTotal}%, not 100%.`, section: 'settings' });
  if (!line.settings.legalApproved) add({ id: 'legal', severity: 'attention', text: 'Warranty, terms and the visuals disclaimer are placeholder texts, not yet approved by a lawyer.', section: 'settings' });
  // Visuals
  const approved = line.assets.filter((a) => a.approvedOn);
  const unlabelled = approved.filter((a) => !a.labelBurned);
  if (unlabelled.length) add({ id: 'unlabelled', severity: 'blocked', text: `${plural(unlabelled.length, 'approved visual')} without the burned-in Illustrative label; they are left out of the proposal.`, section: 'rn-visuals' });
  const viewsWithout = line.views.filter((v) => !line.assets.some((a) => a.viewId === v.id && a.selected && a.approvedOn));
  if (line.views.length && viewsWithout.length) add({ id: 'views-open', severity: 'attention', text: `${plural(viewsWithout.length, 'view')} without an approved, selected after image.`, section: 'rn-visuals' });
  if (line.narrative.text.trim() && !line.narrative.reviewed) add({ id: 'narrative', severity: 'attention', text: 'The imported narrative has not been reviewed; it is left out of the proposal until it is.', section: 'rn-visuals' });
  if (line.designRoundsUsed > line.settings.freeDesignRounds) add({ id: 'rounds', severity: 'attention', text: `${line.designRoundsUsed} design rounds used; ${line.settings.freeDesignRounds} are free (owner setting).`, section: 'rn-visuals' });

  // Final blockers (spec 4.5, Q8, Q5, Q6)
  const finalBlockers: { text: string; section: RnSectionId | 'settings' }[] = [];
  for (const s of SAFETY_ITEMS) {
    const a = safety.find((x) => x.itemId === s.id);
    if (!a?.answer) continue;
    if (a.answer === 'yes' && s.blocking && !a.action.trim()) finalBlockers.push({ text: `Safety: “${s.text}” needs an action recorded.`, section: 'rn-survey' });
  }
  if (unanswered.length) finalBlockers.push({ text: `The safety checklist has ${plural(unanswered.length, 'unanswered item')}.`, section: 'rn-survey' });
  if (assumed > 0) finalBlockers.push({ text: `${plural(assumed, 'value')} still assumed from the client intake — a firm price needs the survey (until then the client sees a range).`, section: 'rn-survey' });
  if (!boq || !boq.complete || specified.length === 0) finalBlockers.push({ text: 'The BOQ is incomplete.', section: 'rn-boq' });
  if (boq && boq.sampleRateLines > 0) finalBlockers.push({ text: `${plural(boq.sampleRateLines, 'line')} priced with SAMPLE rates.`, section: 'rn-library' });
  if (payments && !payments.ok) finalBlockers.push({ text: 'The payment milestones do not add up to 100%.', section: 'settings' });
  if (!line.settings.legalApproved) finalBlockers.push({ text: 'The legal texts (warranty, terms, visuals disclaimer) are not marked as approved by a lawyer.', section: 'settings' });
  else if ([line.settings.warrantyText, line.settings.termsText].some((t) => t.includes(LEGAL_PLACEHOLDER))) finalBlockers.push({ text: 'The warranty or terms still contain the placeholder line.', section: 'settings' });

  // Statuses
  const count = (section: RnWarning['section'], severity?: RnWarning['severity']) => warnings.filter((w) => w.section === section && (!severity || w.severity === severity)).length;
  const status = (section: RnSectionId, done: RnStatus, started: boolean, notStartedText = 'Not started'): RnStatus => {
    if (count(section, 'blocked')) return { kind: 'blocked', text: `${count(section, 'blocked')} blocking` };
    if (!started) return { kind: 'not-started', text: notStartedText };
    if (count(section)) return { kind: 'attention', text: `${count(section)} to check` };
    return done;
  };
  const surveyed = portal.rooms.filter((r) => r.surveyed).length;
  const statuses: Record<RnSectionId, RnStatus> = {
    'rn-overview': warnings.length === 0 ? { kind: 'complete', text: 'All clear' } : { kind: warnings.some((w) => w.severity === 'blocked') ? 'blocked' : 'attention', text: `${warnings.length} open` },
    'rn-client': portal.client.phone || portal.client.email ? { kind: 'complete', text: line.intakeAnswers ? 'From intake' : 'Entered' } : { kind: 'in-progress', text: 'Add contact' },
    map: plan.layout?.shapes.length ? { kind: 'complete', text: `${plural(plan.layout.shapes.filter(isClosedArea).length, 'area')} drawn` } : { kind: 'not-started', text: 'Optional' },
    'rn-survey': status('rn-survey', { kind: 'complete', text: `${surveyed} of ${portal.rooms.length} surveyed` }, portal.rooms.length > 0, 'No rooms'),
    'rn-spec': status('rn-spec', { kind: 'complete', text: `${specified.length} room${specified.length === 1 ? '' : 's'}` }, specified.length > 0, 'Nothing yet'),
    'rn-library': status('rn-library', { kind: 'complete', text: `${line.library.rates.length} rates` }, true),
    'rn-quantities': quantities && specified.length ? (quantities.warnings.length ? { kind: 'attention', text: `${quantities.warnings.length} to check` } : { kind: 'complete', text: `${quantities.order.length} to order` }) : { kind: 'not-started', text: 'Nothing yet' },
    'rn-boq': !boq || specified.length === 0 ? { kind: 'not-started', text: 'Nothing yet' } : boq.complete ? { kind: boq.sampleRateLines ? 'attention' : 'complete', text: boq.sampleRateLines ? 'Sample rates' : 'Complete' } : { kind: 'blocked', text: `${plural(boq.incompleteReasons.length, 'gap')}` },
    'rn-visuals': status('rn-visuals', { kind: 'complete', text: `${approved.length} approved` }, line.views.length > 0 || line.assets.length > 0, 'No photos'),
    'rn-proposal': line.proposal.status === 'final' ? { kind: 'complete', text: `Final${line.proposal.revision ? ` Rev ${line.proposal.revision}` : ''}` } : { kind: 'in-progress', text: 'Draft' },
  };

  return { quantities, boq, programme, payments, range, firm: assumed === 0, warnings, statuses, finalBlockers, planOf };
}
