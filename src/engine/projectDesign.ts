/**
 * The whole-project design pass (N1): every location's camera recommendation,
 * then — built on top of them — storage, the recorder, PoE switching and
 * cabling. Pure: product catalogues are parameters (defaulting to the shipped
 * datasets) so tests can pin them.
 *
 * Order, and what feeds what:
 *
 *   cameras (phase 1, per location)
 *     → instances (one per physical camera) → topology (who is cabled to what, how far)
 *     → storage requirement (bitrate × recording time × retention, + headroom, ÷ formatting)
 *     → PoE mode (built-in vs external switch, brief rule)
 *     → recorder (channels, bandwidth, resolution, drives in its bays, PoE...)
 *     → switches (grouped by endpoint on the map, installed run lengths)
 *     → cable plan (runs, TIA-568 checks, bin-packed boxes, connectors, fibre)
 *
 * Nothing here invents a figure: every number comes from a function that
 * already traces it. Failures of one stage (a bad setting, nothing fits) are
 * reported as text and never stop the others.
 */

import { hdds as shippedHdds, nvrs as shippedNvrs, poeSwitches as shippedSwitches, type Hdd, type Nvr, type PoeSwitch } from '../data/products.ts';
import type { PriceTier } from '../data/shared.ts';
import type { Capability } from '../data/schema.ts';
import type { NvrAnalytic } from '../data/productSchemas.ts';
import { CableInputError, cablePlan, computeRun, type CablePlan, type RunInput } from '../domain/cabling.ts';
import { inheritedRecorderAnalytics } from '../domain/designSettings.ts';
import { FORMATTING_OVERHEAD_IS_ESTIMATE, TIA568 } from '../domain/standards.ts';
import { StorageInputError, storageRequirement, type StorageRequirement, type StorageStream } from '../domain/storage.ts';
import type { Project } from '../domain/types.ts';
import { channelsNeeded, recommendNvr, type NvrRequirement, type NvrResult } from './nvrEngine.ts';
import { recommend, type RecommendationResult } from './recommend.ts';
import { groupCameras, groupingInputsFromTopology, planSwitches, type SwitchPlan } from './switchEngine.ts';
import { buildTopology, expandCameras, type CameraInstance, type Topology } from './topology.ts';

/** Phase-1 recommendation per location id. */
export function recommendAll(project: Pick<Project, 'locations'>): ReadonlyMap<string, RecommendationResult> {
  return new Map(project.locations.map((l) => [l.id, recommend(l)]));
}

export interface Catalogue {
  readonly nvrs: readonly Nvr[];
  readonly switches: readonly PoeSwitch[];
  readonly hdds: readonly Hdd[];
}

export const SHIPPED_CATALOGUE: Catalogue = { nvrs: shippedNvrs, switches: shippedSwitches, hdds: shippedHdds };

export interface PoeModeDecision {
  readonly mode: 'built-in' | 'external';
  readonly reason: string;
}

export interface ProjectDesign {
  readonly results: ReadonlyMap<string, RecommendationResult>;
  readonly instances: readonly CameraInstance[];
  readonly unresolvedLocations: readonly string[];
  readonly topology: Topology;
  readonly budgetTier: PriceTier | 'any';
  readonly storage: StorageRequirement | null;
  readonly poeMode: PoeModeDecision;
  /** Null when the project has no resolved cameras, or storage could not be computed. */
  readonly nvr: NvrResult | null;
  readonly switches: SwitchPlan | null;
  readonly cables: CablePlan | null;
  /** Stage failures (a setting out of range...), in plain language. */
  readonly errors: readonly string[];
  /** Every warning from every stage, deduplicated, in stage order. */
  readonly warnings: readonly string[];
}

/**
 * One budget tier for project-wide hardware. When every location asks for the
 * same tier that tier is used; mixed tiers give 'any' (score on fit, not
 * price), because the recorder and switches serve all locations at once.
 */
export function projectBudgetTier(project: Pick<Project, 'locations'>): PriceTier | 'any' {
  const tiers = new Set(project.locations.map((l) => l.requirements.budgetTier));
  const only = tiers.size === 1 ? [...tiers][0] : undefined;
  return only ?? 'any';
}

/** Recorder analytics inherited from every resolved location's camera analytics (brief item 2). */
export function inheritedProjectAnalytics(project: Pick<Project, 'locations'>, resolvedLocationIds: ReadonlySet<string>): NvrAnalytic[] {
  const caps = new Set<Capability>();
  for (const l of project.locations) {
    if (resolvedLocationIds.has(l.id)) for (const c of l.requirements.requiredCapabilities) caps.add(c);
  }
  return inheritedRecorderAnalytics([...caps]);
}

/** Recorder analytics: the engineer's explicit choice, or inherited from the cameras. */
export function projectRecorderAnalytics(project: Project, resolvedLocationIds: ReadonlySet<string>): NvrAnalytic[] {
  if (project.settings.recorder.analytics !== null) return [...project.settings.recorder.analytics];
  return inheritedProjectAnalytics(project, resolvedLocationIds);
}

function installedCameraRun(link: Topology['links'][number], project: Project): number {
  return computeRun(
    {
      id: link.instance.key,
      label: link.instance.label,
      kind: 'camera',
      horizontalMetres: link.horizontalMetres,
      cameraDropMetres: link.instance.mountHeightMetres,
      basis: link.basis,
      isEstimate: link.isEstimate,
    },
    project.settings.cabling,
  ).installedMetres;
}

/**
 * Brief: built-in PoE when channels ≤ 16 and every camera is within 90 m of
 * cable from the NVR; otherwise an external switch. "Within 90 m" is checked on
 * the INSTALLED length (the same one the cable plan checks against TIA-568),
 * and a camera cabled to a placed switch is, by definition, not on the NVR.
 */
export function decidePoeMode(project: Project, topology: Topology, cameraCount: number): PoeModeDecision {
  const pref = project.settings.recorder.poeMode;
  if (pref === 'built-in') return { mode: 'built-in', reason: 'Built-in PoE, as chosen: cameras cabled to the rack are powered by the NVR’s own ports.' };
  if (pref === 'external') return { mode: 'external', reason: 'External PoE switch, as chosen.' };

  const need = channelsNeeded(cameraCount, project.settings.recorder.channelHeadroomPercent);
  if (need > 16) {
    return { mode: 'external', reason: `Default rule: ${need} channels needed (more than 16) → external PoE switch.` };
  }
  const onSwitch = topology.links.filter((l) => l.endpoint.kind === 'switch');
  if (onSwitch.length > 0) {
    return { mode: 'external', reason: `Default rule: ${onSwitch.length} camera(s) are cabled to a switch on the site plan → external PoE switching.` };
  }
  let longest = 0;
  let longestLabel = '';
  for (const l of topology.links) {
    const m = installedCameraRun(l, project);
    if (m > longest) {
      longest = m;
      longestLabel = l.instance.label;
    }
  }
  if (longest > TIA568.permanentLinkMaxMetres) {
    return {
      mode: 'external',
      reason: `Default rule: ${longestLabel} is ${longest.toFixed(1)} m of cable from the NVR (over ${TIA568.permanentLinkMaxMetres} m) → external PoE switch.`,
    };
  }
  const estimated = topology.links.some((l) => l.isEstimate);
  return {
    mode: 'built-in',
    reason:
      `Default rule: ${need} channels (≤ 16) and every camera within ${TIA568.permanentLinkMaxMetres} m of cable from the NVR (longest ${longest.toFixed(1)} m) → built-in PoE.` +
      (estimated ? ' Some run lengths are estimates; confirm them before relying on this.' : ''),
  };
}

/** Text of an expected domain error; anything else is a bug and is rethrown. */
function domainError(err: unknown): string {
  if (err instanceof StorageInputError || err instanceof CableInputError) return err.message;
  throw err;
}

export function designProject(project: Project, catalogue: Catalogue = SHIPPED_CATALOGUE, results?: ReadonlyMap<string, RecommendationResult>): ProjectDesign {
  const recs = results ?? recommendAll(project);
  const { instances, unresolvedLocations } = expandCameras(project, recs);
  const topology = buildTopology(project, instances);
  const budgetTier = projectBudgetTier(project);
  const errors: string[] = [];
  const s = project.settings;

  // --- storage ---------------------------------------------------------------
  const streams: StorageStream[] = [];
  for (const loc of project.locations) {
    const calc = recs.get(loc.id)?.primary?.calculation;
    if (!calc) continue;
    streams.push({
      label: loc.name,
      quantity: loc.requirements.cameraCount,
      targetKbps: calc.bitrate.targetKbps,
      retentionDays: loc.requirements.retentionDays,
      bitrateIsEstimate: calc.bitrate.isEstimate,
    });
  }
  let storage: StorageRequirement | null = null;
  try {
    storage = storageRequirement({
      streams,
      schedule: s.storage.schedule,
      formattingOverhead: s.storage.formattingOverheadPercent / 100,
      formattingOverheadIsEstimate: FORMATTING_OVERHEAD_IS_ESTIMATE,
      headroomPercent: s.storage.headroomPercent,
    });
  } catch (err) {
    errors.push(`Storage: ${domainError(err)}`);
  }

  // --- PoE mode and recorder -------------------------------------------------
  let poeMode: PoeModeDecision = { mode: 'external', reason: 'No cameras yet.' };
  let nvr: NvrResult | null = null;
  try {
    poeMode = decidePoeMode(project, topology, instances.length);
  } catch (err) {
    errors.push(`PoE mode: ${domainError(err)}`);
  }
  if (instances.length > 0 && storage) {
    const rackCameras = topology.links.filter((l) => l.endpoint.kind === 'nvr').map((l) => l.instance);
    const resolved = new Set(instances.map((i) => i.locationId));
    const req: NvrRequirement = {
      cameraCount: instances.length,
      channelHeadroomPercent: s.recorder.channelHeadroomPercent,
      incomingMbps: instances.reduce((sum, i) => sum + i.peakKbps / 1000, 0),
      maxCameraMegapixels: Math.max(...instances.map((i) => i.megapixels)),
      storage,
      raidLevel: s.storage.raidLevel,
      hotSpare: s.storage.hotSpare,
      poeMode: poeMode.mode,
      builtInPoeLoads:
        poeMode.mode === 'built-in'
          ? rackCameras.filter((i) => i.poeStandard !== 'none').map((i) => ({ standard: i.poeStandard, drawWatts: i.poeDrawWatts }))
          : [],
      poeHeadroomPercent: s.switches.poeHeadroomPercent,
      analytics: projectRecorderAnalytics(project, resolved),
      monitors: s.recorder.monitors,
      outputResolution: s.recorder.outputResolution,
      formFactor: s.recorder.formFactor,
      redundantPsu: s.recorder.redundantPsu,
      budgetTier,
      pinnedNvrId: s.recorder.pinnedNvrId,
    };
    nvr = recommendNvr(req, catalogue.nvrs, catalogue.hdds);
  }

  // --- switches ----------------------------------------------------------------
  let switches: SwitchPlan | null = null;
  try {
    const { inputs, uplinkMetresBySwitch } = groupingInputsFromTopology(topology, s.cabling);
    const groups = groupCameras(inputs, uplinkMetresBySwitch, poeMode.mode);
    switches = planSwitches(groups, catalogue.switches, s.switches, budgetTier);
  } catch (err) {
    errors.push(`Switches: ${domainError(err)}`);
  }

  // --- cabling -------------------------------------------------------------------
  let cables: CablePlan | null = null;
  try {
    const runs: RunInput[] = [
      ...topology.links.map<RunInput>((l) => ({
        id: l.instance.key,
        label: l.instance.label,
        kind: 'camera',
        horizontalMetres: l.horizontalMetres,
        cameraDropMetres: l.instance.mountHeightMetres,
        basis: l.basis,
        isEstimate: l.isEstimate,
      })),
      ...topology.uplinks.map<RunInput>((u) => ({
        id: `uplink:${u.switchId}`,
        label: `${u.label} uplink`,
        kind: 'uplink',
        horizontalMetres: u.horizontalMetres,
        cameraDropMetres: 0,
        basis: u.basis,
        isEstimate: u.isEstimate,
      })),
    ];
    cables = cablePlan(runs, s.cabling);
  } catch (err) {
    errors.push(`Cabling: ${domainError(err)}`);
  }

  // --- warnings ------------------------------------------------------------------
  const warnings: string[] = [];
  if (unresolvedLocations.length) {
    warnings.push(`Not designed for, because no camera model satisfies them yet: ${unresolvedLocations.join(', ')}.`);
  }
  warnings.push(...topology.warnings);
  if (nvr) {
    if (!nvr.primary) warnings.push('No recorder in the catalogue passes every check; see the recorder section for the near misses and what to change.');
    warnings.push(...nvr.notices);
    if (nvr.storageAdvice) warnings.push(nvr.storageAdvice.message);
    if (nvr.primary?.evaluation.drivePlan.ok) warnings.push(...nvr.primary.evaluation.drivePlan.config.warnings);
  }
  if (switches) warnings.push(...switches.warnings);
  if (cables) warnings.push(...cables.warnings);

  return {
    results: recs,
    instances,
    unresolvedLocations,
    topology,
    budgetTier,
    storage,
    poeMode,
    nvr,
    switches,
    cables,
    errors,
    warnings: [...new Set(warnings)],
  };
}
