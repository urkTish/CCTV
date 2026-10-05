/**
 * The Admin workflow as sections, each with a status the engineer can read at a
 * glance, and every open warning in the project gathered into one list that
 * says where each is fixed.
 *
 * Pure: everything here reads results the engine already produced (the
 * recommendation per location, `designProject`, `siteMapView`, the BOM). No
 * figure is computed here; only counted and routed.
 */

import type { BillOfMaterials } from '../../engine/billOfMaterials.ts';
import type { ProjectDesign } from '../../engine/projectDesign.ts';
import type { RecommendationResult } from '../../engine/recommend.ts';
import type { SiteMapView } from '../../engine/siteMapView.ts';
import type { Project } from '../../state/projectTypes.ts';
import type { IconName } from '../icons.tsx';
import type { StatusKind } from '../uiStyles.ts';

export type SectionId = 'overview' | 'map' | 'locations' | 'recording' | 'network' | 'cabling' | 'bom' | 'report' | 'settings';

export interface SectionDef {
  readonly id: SectionId;
  readonly label: string;
  readonly short: string;
  readonly icon: IconName;
  readonly description: string;
}

/** Workflow order. Settings sits apart, at the foot of the navigation. */
export const SECTIONS: readonly SectionDef[] = [
  { id: 'overview', label: 'Overview', short: 'Overview', icon: 'home', description: 'Totals for the whole project and every open warning, each linked to where it is fixed.' },
  { id: 'map', label: 'Site map', short: 'Map', icon: 'map', description: 'Upload the plan, set its scale, place the cameras, recorder and switches, and draw the cable routes.' },
  { id: 'locations', label: 'Locations & cameras', short: 'Locations', icon: 'camera', description: 'One location per camera position: what it must see, where it is, and the camera that does it.' },
  { id: 'recording', label: 'Recording & storage', short: 'Recording', icon: 'recorder', description: 'How long to keep video, the drives that hold it and the recorder (NVR) for every camera.' },
  { id: 'network', label: 'Network (switches)', short: 'Network', icon: 'network', description: 'PoE switches: how many, which model and which cameras each one powers.' },
  { id: 'cabling', label: 'Cabling', short: 'Cabling', icon: 'cable', description: 'Every CAT6 run against the TIA-568 limits, and the boxes, connectors and patch cords to buy.' },
  { id: 'bom', label: 'Bill of materials', short: 'BOM', icon: 'list', description: 'Everything to order, with datasheets. Prices are optional and never invented.' },
  { id: 'report', label: 'Report', short: 'Report', icon: 'report', description: 'The client-facing proposal, ready to print or save as PDF.' },
];

export const SETTINGS_SECTION: SectionDef = {
  id: 'settings',
  label: 'Settings',
  short: 'Settings',
  icon: 'settings',
  description: 'Your name and contact details for the report. Stored in this browser only.',
};

export function sectionDef(id: SectionId): SectionDef {
  return SECTIONS.find((s) => s.id === id) ?? SETTINGS_SECTION;
}

export interface SectionStatus {
  readonly kind: StatusKind;
  /** Short text shown beside the status icon, e.g. "3 need attention". */
  readonly text: string;
}

export interface ProjectWarning {
  readonly id: string;
  readonly severity: 'blocked' | 'attention';
  readonly text: string;
  readonly section: SectionId;
  /** Set when the fix is in one location's detail. */
  readonly locationId?: string;
}

export interface StatusInputs {
  readonly project: Project;
  readonly results: ReadonlyMap<string, RecommendationResult>;
  readonly design: ProjectDesign;
  readonly mapView: SiteMapView;
  readonly bom: Pick<BillOfMaterials, 'complete' | 'incompleteReasons'>;
  readonly reportFinal: boolean;
  /** Intake values still marked "assumed — please confirm", by location id. */
  readonly assumedByLocation: ReadonlyMap<string, number>;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Every open warning in the project, once each, with the section (and location)
 * where it is fixed. Every string in `design.warnings` and `design.errors` is
 * included; the stage it came from decides where it links.
 */
export function collectWarnings(inputs: StatusInputs): ProjectWarning[] {
  const { project, results, design, mapView } = inputs;
  const out: ProjectWarning[] = [];
  const seen = new Set<string>();
  const add = (w: ProjectWarning) => {
    const key = `${w.section}|${w.locationId ?? ''}|${w.text}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(w);
  };

  for (const loc of project.locations) {
    const r = results.get(loc.id);
    if (!r) continue;
    if (r.error) {
      add({ id: `loc-error-${loc.id}`, severity: 'blocked', text: `${loc.name}: ${r.error}`, section: 'locations', locationId: loc.id });
      continue;
    }
    if (!r.primary) {
      add({ id: `loc-none-${loc.id}`, severity: 'blocked', text: `${loc.name}: no camera model satisfies this location as stated.`, section: 'locations', locationId: loc.id });
      continue;
    }
    const calc = r.primary.calculation;
    if (calc.pixelDensity.verdict !== 'pass') {
      add({
        id: `loc-density-${loc.id}`,
        severity: 'attention',
        text: `${loc.name}: pixel density is ${calc.pixelDensity.verdict} (${calc.pixelDensity.achievedPxPerMetre.toFixed(0)} px/m).`,
        section: 'locations',
        locationId: loc.id,
      });
    }
    calc.warnings.forEach((w, i) => add({ id: `loc-warn-${loc.id}-${i}`, severity: 'attention', text: `${loc.name}: ${w}`, section: 'locations', locationId: loc.id }));
    const assumed = inputs.assumedByLocation.get(loc.id) ?? 0;
    if (assumed > 0) {
      add({
        id: `loc-assumed-${loc.id}`,
        severity: 'attention',
        text: `${loc.name}: ${plural(assumed, 'value')} assumed from the client intake still to confirm.`,
        section: 'locations',
        locationId: loc.id,
      });
    }
  }

  design.errors.forEach((e, i) => add({ id: `design-error-${i}`, severity: 'blocked', text: e, section: e.startsWith('Cabling') ? 'cabling' : e.startsWith('Switches') ? 'network' : 'recording' }));

  // Attribute each design warning to the stage that produced it.
  const attributed = new Map<string, SectionId>();
  const mark = (texts: readonly string[], section: SectionId) => texts.forEach((t) => attributed.has(t) || attributed.set(t, section));
  mark(design.topology.warnings, 'map');
  if (design.nvr) {
    const recorder: string[] = [...design.nvr.notices];
    if (!design.nvr.primary) recorder.unshift('No recorder in the catalogue passes every check; see the recorder section for the near misses and what to change.');
    if (design.nvr.storageAdvice) recorder.push(design.nvr.storageAdvice.message);
    if (design.nvr.primary?.evaluation.drivePlan.ok) recorder.push(...design.nvr.primary.evaluation.drivePlan.config.warnings);
    mark(recorder, 'recording');
  }
  if (design.switches) mark(design.switches.warnings, 'network');
  if (design.cables) mark(design.cables.warnings, 'cabling');
  design.warnings.forEach((w, i) => {
    const section = attributed.get(w) ?? (w.startsWith('Not designed for') ? 'locations' : 'overview');
    const blocked = section === 'recording' && !design.nvr?.primary;
    add({ id: `design-warn-${i}`, severity: blocked ? 'blocked' : 'attention', text: w, section });
  });

  for (const g of design.switches?.groups ?? []) {
    if (g.failure) add({ id: `switch-fail-${g.group.id}`, severity: 'blocked', text: g.failure.message, section: 'network' });
  }
  mapView.warnings.forEach((w, i) => add({ id: `map-warn-${i}`, severity: 'attention', text: w, section: 'map' }));
  return out;
}

export function sectionStatuses(inputs: StatusInputs, warnings: readonly ProjectWarning[]): Record<SectionId, SectionStatus> {
  const { project, results, design, mapView, bom } = inputs;
  const count = (section: SectionId, severity?: ProjectWarning['severity']) =>
    warnings.filter((w) => w.section === section && (!severity || w.severity === severity)).length;

  // --- overview
  const open = warnings.length;
  const overview: SectionStatus =
    open === 0 ? { kind: 'complete', text: 'All clear' } : { kind: warnings.some((w) => w.severity === 'blocked') ? 'blocked' : 'attention', text: `${open} open` };

  // --- map
  const plan = project.sitePlan;
  const placedCameras = mapView.devices.filter((d) => d.device.kind === 'camera').length;
  const hasNvr = plan.devices.some((d) => d.kind === 'nvr');
  let map: SectionStatus;
  if (!plan.image && plan.devices.length === 0) map = { kind: 'not-started', text: 'No plan yet' };
  else if (mapView.unplaced.length > 0) map = { kind: 'in-progress', text: `${mapView.unplaced.length} to place` };
  else if (!hasNvr) map = { kind: 'in-progress', text: 'Place the NVR' };
  else if (plan.image && !plan.calibration) map = { kind: 'in-progress', text: 'Set the scale' };
  else if (count('map') > 0) map = { kind: 'attention', text: `${count('map')} to check` };
  else map = { kind: 'complete', text: `${placedCameras} placed` };

  // --- locations
  const unresolved = project.locations.filter((l) => !results.get(l.id)?.primary).length;
  const withWarnings = new Set(warnings.filter((w) => w.section === 'locations' && w.locationId).map((w) => w.locationId)).size;
  const locations: SectionStatus =
    unresolved > 0
      ? { kind: 'blocked', text: `${unresolved} without a camera` }
      : withWarnings > 0
        ? { kind: 'attention', text: `${withWarnings} to check` }
        : { kind: 'complete', text: `${project.locations.length} resolved` };

  // --- recording
  let recording: SectionStatus;
  if (design.instances.length === 0) recording = { kind: 'not-started', text: 'No cameras yet' };
  else if (!design.nvr?.primary || !design.nvr.primary.evaluation.drivePlan.ok || count('recording', 'blocked') > 0)
    recording = { kind: 'blocked', text: design.nvr?.primary ? 'Drives do not fit' : 'No recorder fits' };
  else if (design.nvr.primary.evaluation.failed.length > 0 || count('recording') > 0) recording = { kind: 'attention', text: `${Math.max(1, count('recording'))} to check` };
  else recording = { kind: 'complete', text: design.nvr.primary.evaluation.nvr.model };

  // --- network
  let network: SectionStatus;
  const sw = design.switches;
  if (design.instances.length === 0 || !sw) network = { kind: 'not-started', text: 'No cameras yet' };
  else if (sw.groups.some((g) => g.failure)) network = { kind: 'blocked', text: 'A group has no switch' };
  else if (count('network') > 0) network = { kind: 'attention', text: `${count('network')} to check` };
  else if (sw.groups.length === 0) network = { kind: 'complete', text: 'Recorder PoE' };
  else network = { kind: 'complete', text: plural(sw.switchCount, 'switch', 'switches') };

  // --- cabling
  let cabling: SectionStatus;
  const cables = design.cables;
  if (!cables || cables.runs.length === 0) cabling = { kind: 'not-started', text: 'No runs yet' };
  else {
    const fails = cables.runs.filter((r) => r.tia.verdict === 'fail').length;
    const marginal = cables.runs.filter((r) => r.tia.verdict === 'marginal').length;
    const estimated = cables.runs.filter((r) => r.isEstimate).length;
    if (fails > 0) cabling = { kind: 'blocked', text: `${plural(fails, 'run')} over 100 m` };
    else if (marginal > 0) cabling = { kind: 'attention', text: `${plural(marginal, 'run')} over 90 m` };
    else if (estimated > 0) cabling = { kind: 'in-progress', text: `${estimated} estimated` };
    else cabling = { kind: 'complete', text: plural(cables.packing.boxes.length, 'box', 'boxes') };
  }

  const bomStatus: SectionStatus = bom.complete
    ? { kind: 'complete', text: 'Complete' }
    : { kind: 'blocked', text: `${plural(bom.incompleteReasons.length, 'gap')}` };

  const report: SectionStatus = inputs.reportFinal ? { kind: 'complete', text: 'Final' } : { kind: 'in-progress', text: 'Draft' };

  return { overview, map, locations, recording, network, cabling, bom: bomStatus, report, settings: { kind: 'not-started', text: '' } };
}
