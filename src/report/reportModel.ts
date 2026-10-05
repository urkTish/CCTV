/**
 * The client report's content, from the confirmed project. Pure.
 *
 * Built on `buildBillOfMaterials(project)` and the engine outputs it carries
 * (`design.results`, the recorder, switches and cable plan), plus
 * `buildOutputCard` and `siteMapView`. There are no new calculations here:
 * every figure is read from those results and put into words. The only
 * arithmetic is presentation — counting lines, a price × quantity where the
 * engineer typed a price, and the proposal's "valid until" date.
 */

import { PURPOSES } from '../domain/dori.ts';
import type { Purpose } from '../domain/dori.ts';
import { RAID_LABELS } from '../domain/storage.ts';
import { buildBillOfMaterials, type BillOfMaterials, type BomLine } from '../engine/billOfMaterials.ts';
import { buildOutputCard, type CardField } from '../engine/outputCard.ts';
import { siteMapView, type SiteMapView } from '../engine/siteMapView.ts';
import { SEE_OPTIONS } from '../client/intakeMapping.ts';
import { SEE_CHOICES } from '../client/intakeTypes.ts';
import type { EngineerProfile } from '../state/engineerProfile.ts';
import type { Project } from '../state/projectTypes.ts';
import type { ProjectExtras } from '../state/workspace.ts';

export interface ReportArea {
  readonly locationId: string;
  readonly name: string;
  readonly cameraCount: number;
  /** What the client asked for — their own words from the intake, or a plain description. */
  readonly asked: string;
  readonly fromIntake: boolean;
  readonly camera: {
    readonly model: string;
    readonly marketingName: string;
    readonly lens: string;
    readonly datasheetUrl: string;
  } | null;
  /** The fifteen fields, in `CARD_FIELD_ORDER`. */
  readonly spec: readonly CardField[] | null;
  /** One line: why this camera. */
  readonly why: string;
}

export interface ReportDatasheet {
  readonly url: string;
  readonly manufacturer: string;
  readonly model: string;
  readonly description: string;
  readonly verifiedOn: string | null;
}

export interface ReportModel {
  readonly projectName: string;
  readonly clientName: string;
  readonly clientContact: string;
  /** ISO date the report is dated. */
  readonly date: string;
  readonly validUntil: string;
  readonly validityDays: number;
  readonly final: boolean;
  readonly preparedBy: EngineerProfile;
  readonly summary: string;
  readonly facts: readonly { readonly label: string; readonly value: string }[];
  readonly map: SiteMapView | null;
  readonly planImage: string | null;
  readonly areas: readonly ReportArea[];
  readonly system: {
    readonly recorder: string | null;
    readonly recorderDetail: string | null;
    readonly storage: string | null;
    readonly retention: string;
    readonly power: string;
    readonly switches: readonly string[];
    readonly cabling: readonly string[];
    readonly fibreOrLongRuns: readonly string[];
  };
  readonly bom: BillOfMaterials;
  readonly prices: { readonly priced: boolean; readonly currency: string; readonly unit: Readonly<Record<string, number>>; readonly total: number; readonly pricedLines: number };
  readonly datasheets: readonly ReportDatasheet[];
  readonly notes: {
    readonly toConfirmOnSite: readonly string[];
    readonly unverified: readonly string[];
    readonly incomplete: readonly string[];
  };
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Plain words for a purpose, reusing the client intake's language. */
export function purposeInWords(p: Purpose): string {
  const choice = SEE_CHOICES.find((c) => SEE_OPTIONS[c].purpose === p);
  if (choice) return SEE_OPTIONS[choice].title;
  return p === 'monitor' ? 'Watch general activity' : (PURPOSES.find((x) => x.id === p)?.label ?? p);
}

const SITE_WORDS = { indoor: 'indoors', outdoor: 'outdoors', 'semi-covered': 'outdoors under cover' } as const;
const LIGHT_WORDS = { 'well-lit-24-7': 'lit at night', 'low-light': 'low light at night', 'zero-lux': 'dark at night' } as const;

/** The first clause of the engine's explanation — one line for the report. */
function firstSentence(text: string): string {
  const m = /^(.+?)(?:[.!?](?:\s|$)|;\s)/.exec(text.trim());
  const s = (m?.[1] ?? text.trim()).trim();
  return /[.!?]$/.test(s) ? s : `${s}.`;
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

/** "5 October 2026". */
export function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${d} ${months[m - 1] ?? ''} ${y}`;
}

export function buildReport(project: Project, extras: ProjectExtras, profile: EngineerProfile, today: string): ReportModel {
  const bom = buildBillOfMaterials(project);
  const design = bom.design;
  const final = extras.report.status === 'final';
  const date = final && extras.report.finalisedOn ? extras.report.finalisedOn : today;
  const preparedBy = final && extras.report.preparedBy ? extras.report.preparedBy : profile;
  const intake = extras.intake;

  // --- areas -----------------------------------------------------------------
  const areas: ReportArea[] = project.locations.map((l) => {
    const rec = design.results.get(l.id)?.primary ?? null;
    const words = intake?.clientWords[l.id];
    const asked =
      words ??
      `“${purposeInWords(l.purpose)}” · ${plural(l.requirements.cameraCount, 'camera')} · ${SITE_WORDS[l.environment.site]} · ${LIGHT_WORDS[l.environment.ambientLight]} · about ${l.geometry.targetDistanceMetres} m away`;
    return {
      locationId: l.id,
      name: l.name,
      cameraCount: l.requirements.cameraCount,
      asked,
      fromIntake: words !== undefined,
      camera: rec
        ? {
            model: rec.calculation.camera.model,
            marketingName: rec.calculation.camera.marketingName,
            lens: rec.calculation.lens.label,
            datasheetUrl: rec.calculation.camera.datasheetUrl,
          }
        : null,
      spec: rec ? buildOutputCard(rec.calculation.camera) : null,
      why: rec ? firstSentence(rec.why) : 'No camera in the verified range meets this area as described; the engineer will review it on site.',
    };
  });

  // --- system ----------------------------------------------------------------
  const nvr = design.nvr?.primary ?? null;
  const drives = nvr?.evaluation.drivePlan.ok ? nvr.evaluation.drivePlan.config : null;
  const retentionSet = [...new Set(bom.locations.map((l) => l.retentionDays))].sort((a, b) => a - b);
  const retention =
    retentionSet.length === 1 ? `about ${retentionSet[0]} days` : `between ${retentionSet[0]} and ${retentionSet[retentionSet.length - 1]} days, depending on the area`;
  const switchLines = bom.lines.filter((l) => l.category === 'switch');
  const switches = switchLines.map((l) => `${l.quantity} × ${l.manufacturer ?? ''} ${l.model ?? ''} — ${l.description}`.trim());
  const cables = design.cables;
  const cabling: string[] = [];
  for (const l of bom.lines) {
    if (l.category === 'cable') cabling.push(`${plural(l.quantity, 'box', 'boxes')} of ${l.description}${cables ? ` (about ${Math.round(cables.packing.totalMetres)} m to buy, including waste)` : ''}`);
    if (l.category === 'connector') cabling.push(`${l.quantity} × ${l.description}`);
    if (l.category === 'patch-cord') cabling.push(`${l.quantity} × ${l.description}`);
  }
  const fibreOrLongRuns: string[] = [
    ...(cables?.fibreUplinks ?? []).map((f) => `${f.label}: about ${Math.round(f.installedMetres)} m — fibre is needed, not CAT6.`),
    ...(cables?.runs ?? []).filter((r) => r.tia.verdict !== 'pass').map((r) => `${r.label}: about ${Math.round(r.installedMetres)} m of cable. ${r.tia.message}`),
  ];
  const power =
    design.instances.length === 0
      ? 'Not designed yet.'
      : design.poeMode.mode === 'built-in'
        ? 'The cameras take their power through their network cable, straight from the recorder.'
        : `The cameras take their power through their network cable, from ${plural(switchLines.reduce((n, l) => n + l.quantity, 0), 'PoE network switch', 'PoE network switches')}.`;

  // --- summary ----------------------------------------------------------------
  const designed = bom.totals.cameras;
  const areaPhrases = areas
    .filter((a) => a.camera)
    .slice(0, 4)
    .map((a) => `${lowerFirst(purposeInWords(project.locations.find((l) => l.id === a.locationId)!.purpose))} at ${a.name}`);
  const summaryParts = [
    `ContracTech proposes ${plural(designed, 'Hikvision camera')} covering ${plural(project.locations.length, 'area')}${extras.clientName ? ` for ${extras.clientName}` : ''}.`,
    areaPhrases.length
      ? `Each camera was chosen for what it has to show where it is mounted — to ${areaPhrases.join(', ')}${areas.filter((a) => a.camera).length > 4 ? ', and more' : ''}.`
      : '',
    nvr
      ? `Video is recorded on a ${nvr.evaluation.nvr.channels}-channel Hikvision recorder${drives ? ` with ${drives.totalDrives} × ${drives.drive.capacityTb} TB surveillance hard drives` : ''}, sized to keep ${retention} of recordings.`
      : 'The recorder is still to be chosen; see the notes.',
    power,
    cables && cables.packing.boxes.length ? `About ${plural(cables.packing.boxes.length, 'box', 'boxes')} of CAT6 cable connect everything.` : '',
    final
      ? `This proposal is valid for ${extras.validityDays} days.`
      : 'This is a draft for discussion: positions, distances and cable routes are confirmed by a site survey before the proposal is final.',
  ];

  const facts = [
    { label: 'Cameras', value: String(designed) },
    { label: 'Areas', value: String(project.locations.length) },
    { label: 'Recorder', value: nvr ? `${nvr.evaluation.nvr.model} (${nvr.evaluation.nvr.channels} channels)` : 'To be chosen' },
    { label: 'Recording kept', value: retention },
    { label: 'Storage', value: drives ? `${drives.totalDrives} × ${drives.drive.capacityTb} TB (${Math.round(drives.usableTb * 10) / 10} TB usable)` : '—' },
    { label: 'PoE switches', value: String(bom.totals.switches) },
    { label: 'CAT6 cable', value: `${plural(bom.totals.cableBoxes, 'box', 'boxes')}` },
  ];

  // --- prices (only what the engineer typed) ---------------------------------
  const priceFor = (l: BomLine) => extras.prices[l.id];
  const pricedLines = bom.lines.filter((l) => priceFor(l) !== undefined);
  const total = pricedLines.reduce((s, l) => s + (priceFor(l) ?? 0) * l.quantity, 0);

  // --- datasheets --------------------------------------------------------------
  const seen = new Set<string>();
  const datasheets: ReportDatasheet[] = [];
  for (const l of bom.lines) {
    if (!l.datasheetUrl || seen.has(l.datasheetUrl)) continue;
    seen.add(l.datasheetUrl);
    datasheets.push({ url: l.datasheetUrl, manufacturer: l.manufacturer ?? '', model: l.model ?? l.description, description: l.description, verifiedOn: l.verifiedOn });
  }

  // --- notes --------------------------------------------------------------------
  const toConfirmOnSite = [
    'Exact camera positions, mounting heights and viewing directions.',
    'The distances each camera must cover, and the lighting at night.',
    'Cable routes and lengths, power and network points, and where the recorder goes.',
  ];
  const assumedLeft = Object.entries(intake?.assumed ?? {}).filter(([, f]) => Object.keys(f).length > 0);
  if (assumedLeft.length) {
    const n = assumedLeft.reduce((s, [, f]) => s + Object.keys(f).length, 0);
    toConfirmOnSite.push(
      `${plural(n, 'detail')} in ${plural(assumedLeft.length, 'area')} (${assumedLeft
        .map(([id]) => project.locations.find((l) => l.id === id)?.name ?? id)
        .join(', ')}) were assumed from the questionnaire and are still to be confirmed.`,
    );
  }

  const unverified: string[] = [];
  const estimatePurposes = new Set(project.locations.map((l) => PURPOSES.find((p) => p.id === l.purpose)).filter((p) => p?.isEstimate).map((p) => p!.label));
  if (estimatePurposes.size) {
    unverified.push(`The detail level used for ${[...estimatePurposes].map((x) => `“${x}”`).join(' and ')} is an industry convention rather than a level in the international standard (IEC 62676-4).`);
  }
  if (design.storage?.isEstimate) {
    unverified.push('The storage figure includes allowances that are not published values (such as the space lost to formatting the drives), so it carries a margin.');
  }
  const estimatedRuns = cables?.runs.filter((r) => r.isEstimate).length ?? 0;
  if (estimatedRuns) unverified.push(`${plural(estimatedRuns, 'cable run is', 'cable runs are')} estimated from the plan until the routes are measured, so the cable quantity may change.`);
  const estimatedBitrate = design.instances.some((i) => design.results.get(i.locationId)?.primary?.calculation.bitrate.isEstimate);
  if (estimatedBitrate) unverified.push('Some recording bitrates are estimated from the nearest published figure.');
  for (const l of bom.lines.filter((x) => x.flagged)) unverified.push(`${l.model ?? l.description}: ${l.notes.filter((n) => !n.startsWith('Locations:')).slice(-1)[0] ?? 'check before ordering.'}`);

  return {
    projectName: project.name,
    clientName: extras.clientName,
    clientContact: extras.clientContact,
    date,
    validUntil: addDays(date, extras.validityDays),
    validityDays: extras.validityDays,
    final,
    preparedBy,
    summary: summaryParts.filter(Boolean).join(' '),
    facts,
    map: project.sitePlan.image || project.sitePlan.devices.length ? siteMapView(project, design.results) : null,
    planImage: project.sitePlan.image?.dataUri ?? null,
    areas,
    system: {
      recorder: nvr ? `${nvr.evaluation.nvr.model} — ${nvr.evaluation.nvr.marketingName}` : null,
      recorderDetail: nvr ? firstSentence(nvr.why) : null,
      storage: drives
        ? `${drives.totalDrives} × ${drives.drive.capacityTb} TB ${drives.drive.manufacturer} ${drives.drive.marketingName} (${drives.drive.model})${drives.level !== 'none' ? `, ${RAID_LABELS[drives.level]}` : ''}: ${Math.round(drives.usableTb * 10) / 10} TB usable against ${design.storage ? Math.round(design.storage.requiredUsableTb * 10) / 10 : '—'} TB needed.`
        : null,
      retention,
      power,
      switches,
      cabling,
      fibreOrLongRuns,
    },
    bom,
    prices: { priced: pricedLines.length > 0, currency: extras.currency.trim(), unit: extras.prices, total, pricedLines: pricedLines.length },
    datasheets,
    notes: { toConfirmOnSite, unverified, incomplete: bom.incompleteReasons },
  };
}
