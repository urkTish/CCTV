/**
 * The renovation proposal's content (spec 8.1, sections 1–9 and 11–17),
 * assembled from the derived figures — it calculates nothing new. Honesty
 * rules enforced here:
 *   - only APPROVED, SELECTED after images WITH the burned-in label appear
 *     (max 2 per room), each paired with its untouched before photo;
 *   - the narrative appears only once the engineer has reviewed it;
 *   - before the survey confirms every assumed value the client sees a price
 *     range "subject to survey" and the BOQ without rates (owner decision Q8);
 *   - furniture is captioned "for illustration, not included" (Q10).
 */

import { hasContent, type PictureSection } from '../pictures/pictureSection.ts';
import type { EngineerProfile } from '../state/engineerProfile.ts';
import type { BoqGroup } from './boq.ts';
import { FURNITURE_CAPTION, paletteInUse, scheduleRows, type ScheduleRow } from './briefs.ts';
import type { RnDerived } from './derive.ts';
import { materialById } from './library.ts';
import { DEFECT_LABEL, MOOD_LABEL, PALETTE_LABEL, PROPERTY_LABEL, SAFETY_ITEMS, STYLE_LABEL, type PortalData, type StartWhen } from './model.ts';
import type { Programme } from './programme.ts';
import { ILLUSTRATIVE_LABEL } from './photos.ts';
import { num } from './trace.ts';

export interface GalleryPair {
  readonly before: string;
  readonly after: string;
  readonly caption: string;
}

export interface ProposalRoom {
  readonly id: string;
  readonly name: string;
  readonly pairs: readonly GalleryPair[];
  readonly finishes: readonly ScheduleRow[];
  readonly subtotal: number | null;
  readonly scope: readonly string[];
}

export interface ProposalModel {
  readonly final: boolean;
  readonly revision: string;
  readonly date: string;
  readonly validUntil: string;
  readonly validityDays: number;
  readonly projectName: string;
  readonly clientName: string;
  readonly clientContact: string;
  readonly site: string;
  readonly preparedBy: EngineerProfile;
  readonly hero: GalleryPair | null;
  readonly summary: readonly string[];
  readonly firm: boolean;
  readonly currency: string;
  readonly total: number | null;
  readonly range: { readonly low: number; readonly high: number } | null;
  readonly durationDays: number;
  readonly startWindow: string;
  readonly narrative: string | null;
  readonly mood: { readonly title: string; readonly words: string; readonly palette: readonly { name: string; code: string; hex: string; where: readonly string[] }[]; readonly materials: readonly string[] };
  readonly rooms: readonly ProposalRoom[];
  /** The Concept chapter: picture sections with something to print, in the engineer's order. */
  readonly concepts: readonly PictureSection[];
  readonly lang: 'en' | 'ar';
  readonly roomName: (id: string | null) => string;
  readonly findings: readonly { readonly room: string; readonly text: string; readonly action: string; readonly fixNow: boolean }[];
  readonly safety: readonly { readonly text: string; readonly action: string }[];
  readonly schedule: readonly ScheduleRow[];
  readonly boqByRoom: readonly BoqGroup[];
  readonly boqByTrade: readonly BoqGroup[];
  readonly totals: { readonly subtotal: number; readonly contingency: number; readonly contingencyPct: number; readonly beforeVat: number; readonly vat: number; readonly vatPct: number; readonly total: number } | null;
  readonly programme: Programme | null;
  readonly payments: readonly { readonly label: string; readonly trigger: string; readonly percent: number; readonly amount: number | null }[];
  readonly exclusions: readonly string[];
  readonly assumptions: readonly string[];
  readonly warranty: string;
  readonly terms: string;
  readonly visualsDisclaimer: string;
  readonly illustrativeLabel: string;
  readonly furnitureCaption: string | null;
  readonly freeRounds: number;
  readonly legalApproved: boolean;
  readonly sampleRates: boolean;
}

const START_TEXT: Readonly<Record<StartWhen, string>> = { asap: 'as soon as possible', '1m': 'within a month', '1-3m': 'in one to three months', later: 'later, to be agreed' };

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function buildProposal(portal: PortalData, d: RnDerived, opts: { projectName: string; clientName: string; clientContact: string; profile: EngineerProfile; today: string }): ProposalModel {
  const line = portal.renovation!;
  const s = line.settings;
  const final = line.proposal.status === 'final';
  const date = final && line.proposal.finalisedOn ? line.proposal.finalisedOn : opts.today;
  const preparedBy = final && line.proposal.preparedBy ? line.proposal.preparedBy : opts.profile;
  const boq = d.boq;
  const priced = !!boq && boq.lines.length > 0;
  const firm = d.firm && priced && boq.complete;

  // Gallery: approved + selected + labelled only.
  const rooms: ProposalRoom[] = portal.rooms.map((r) => {
    const pairs: GalleryPair[] = [];
    for (const v of line.views.filter((x) => x.roomId === r.id)) {
      const a = line.assets.find((x) => x.viewId === v.id && x.selected && x.approvedOn && x.labelBurned);
      const before = portal.photos.find((p) => p.id === v.photoId);
      if (a && before && pairs.length < 2) pairs.push({ before: before.dataUri, after: a.dataUri, caption: `${r.name} — ${v.facing || 'view'}` });
    }
    const group = boq?.byRoom.find((g) => g.id === r.id);
    return {
      id: r.id,
      name: r.name,
      pairs,
      finishes: scheduleRows(portal).filter((x) => x.roomId === r.id),
      subtotal: group ? group.subtotal : null,
      scope: group ? group.lines.map((l) => `${l.description} — ${num(l.quantity.value)} ${l.unit}`) : [],
    };
  });
  const hero = rooms.flatMap((r) => r.pairs)[0] ?? null;

  const style = line.style;
  const palette = paletteInUse(portal);
  const materials = [...new Set(line.specs.flatMap((x) => [x.floorTiles?.materialId, x.wallTiles?.materialId, x.gypsumBoardId].filter((m): m is string => !!m)))].map((id) => materialById(line.library, id)?.name ?? id);

  const findings = line.survey.defects.map((df) => ({
    room: portal.rooms.find((r) => r.id === df.roomId)?.name ?? '',
    text: `${DEFECT_LABEL[df.type]} on the ${df.surface}${df.location ? ` (${df.location})` : ''}${df.widthMm !== null ? `, ${num(df.widthMm)} mm wide` : ''}${df.moisturePct !== null ? `, moisture ${num(df.moisturePct)}%` : ''}`,
    action: df.action || 'To be assessed',
    fixNow: df.fixNow,
  }));
  const safety = SAFETY_ITEMS.flatMap((it) => {
    const a = line.survey.safety.find((x) => x.itemId === it.id);
    return a?.answer === 'yes' ? [{ text: it.text, action: a.action || 'Action to be agreed before works start' }] : [];
  });

  const dur = d.programme?.totalDays ?? 0;
  const startWindow = line.intakeAnswers?.timing.start ? START_TEXT[line.intakeAnswers.timing.start] : 'to be agreed';
  const summary = [
    `${PROPERTY_LABEL[portal.site.propertyType]} renovation: ${rooms.filter((r) => r.scope.length).length} of ${rooms.length} rooms, ${rooms.flatMap((r) => r.scope).length} items of work.`,
    style.primaryStyle ? `Style: ${STYLE_LABEL[style.primaryStyle]}${style.secondaryStyle ? ` with a touch of ${STYLE_LABEL[style.secondaryStyle]}` : ''}${style.moods.length ? `, feeling ${style.moods.map((m) => MOOD_LABEL[m]).join(', ')}` : ''}.` : '',
    dur ? `About ${num(dur, 1)} working days on site, starting ${startWindow}.` : '',
    portal.site.occupancy !== 'empty' ? 'The home stays occupied: rooms are worked on in sequence and protected daily.' : '',
    firm ? 'The price below is firm for the scope in the bill of quantities.' : 'Prices are an estimated range, subject to survey: a firm price follows the site survey.',
  ].filter(Boolean);

  const assumptions: string[] = [];
  for (const r of portal.rooms) for (const why of Object.values(r.assumed)) assumptions.push(`${r.name}: ${why}`);
  const consts = new Map<string, string>();
  for (const rq of d.quantities?.rooms ?? []) for (const it of rq.items) for (const c of it.quantity.constants) if (c.unverified) consts.set(c.key, `${c.label}: ${num(c.value, 3)} ${c.unit}`);
  for (const rq of d.quantities?.rooms ?? []) for (const f of rq.figures) for (const c of f.figure.constants) if (c.unverified) consts.set(c.key, `${c.label}: ${num(c.value, 3)} ${c.unit}`);
  assumptions.push(
    'Measurement convention: openings of 0.5 m² or more are deducted from wall areas; skirting runs the perimeter less door widths.',
    'Quantities include wastage and are rounded up to purchasable packs; rule-of-thumb figures used (Unverified, confirmed against product data sheets before ordering):',
    ...[...consts.values()],
  );
  if (boq?.sampleRateLines) assumptions.push(`${boq.sampleRateLines} line(s) are priced with SAMPLE rates that ContracTech must replace with its own rates; this draft is not an offer.`);
  for (const w of d.warnings.filter((x) => x.severity === 'attention' && x.id.startsWith('safety-'))) assumptions.push(w.text);

  return {
    final,
    revision: line.proposal.revision,
    date,
    validUntil: addDays(date, s.validityDays),
    validityDays: s.validityDays,
    projectName: opts.projectName,
    clientName: opts.clientName,
    clientContact: opts.clientContact,
    site: [portal.site.name, portal.site.address, portal.site.city].filter((x) => x.trim()).join(', '),
    preparedBy,
    hero,
    summary,
    firm,
    currency: s.currency,
    total: priced ? boq.total : null,
    range: priced && d.range ? { low: d.range.low, high: d.range.high } : null,
    durationDays: dur,
    startWindow,
    narrative: line.narrative.reviewed && line.narrative.text.trim() ? line.narrative.text.trim() : null,
    mood: {
      title: style.palette ? PALETTE_LABEL[style.palette] : 'Colour and material palette',
      words: [style.primaryStyle ? STYLE_LABEL[style.primaryStyle] : '', ...style.moods.map((m) => MOOD_LABEL[m])].filter(Boolean).join(' · '),
      palette,
      materials,
    },
    rooms,
    concepts: (line.concepts ?? []).filter(hasContent),
    lang: s.proposalLanguage,
    roomName: (id) => (id ? (portal.rooms.find((r) => r.id === id)?.name ?? '') : ''),
    findings,
    safety,
    schedule: scheduleRows(portal),
    boqByRoom: boq?.byRoom ?? [],
    boqByTrade: boq?.byTrade ?? [],
    totals: priced
      ? { subtotal: boq.subtotal, contingency: boq.contingency.value, contingencyPct: s.contingencyPercent, beforeVat: boq.beforeVat, vat: boq.vat.value, vatPct: s.vatPercent, total: boq.total }
      : null,
    programme: d.programme,
    payments: (d.payments?.rows ?? s.milestones.map((m) => ({ milestone: m, amount: 0 }))).map((r) => ({ label: r.milestone.label, trigger: r.milestone.trigger, percent: r.milestone.percent, amount: firm ? r.amount : null })),
    exclusions: s.exclusionsText.split('\n').map((x) => x.trim()).filter(Boolean),
    assumptions: [...new Set(assumptions)],
    warranty: s.warrantyText,
    terms: s.termsText,
    visualsDisclaimer: s.visualsDisclaimer,
    illustrativeLabel: ILLUSTRATIVE_LABEL[s.proposalLanguage],
    furnitureCaption: style.furniture === 'suggest' ? FURNITURE_CAPTION : null,
    freeRounds: s.freeDesignRounds,
    legalApproved: s.legalApproved,
    sampleRates: (boq?.sampleRateLines ?? 0) > 0,
  };
}

/** The next revision letter: '' → A → B … Z → ZA. */
export function nextRevision(r: string): string {
  if (!r) return 'A';
  const c = r.charCodeAt(r.length - 1);
  return c >= 90 ? `${r}A` : `${r.slice(0, -1)}${String.fromCharCode(c + 1)}`;
}
