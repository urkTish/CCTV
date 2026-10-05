/**
 * Who is cabled to what, and how far.
 *
 * Expands the project into individual physical cameras (location × count, each
 * carrying its location's primary recommendation), works out which endpoint
 * each camera is cabled to (a placed switch, or the NVR rack), and how long the
 * horizontal run is — measured on the site plan when it can be, otherwise a
 * flagged placeholder. Pure.
 */

import type { Camera } from '../data/cameras.ts';
import type { PoeStandard } from '../domain/power.ts';
import {
  cameraKey,
  deviceById,
  horizontalRunBetween,
  primaryNvr,
  type PlacedCamera,
  type PlacedSwitch,
  type RunLengthBasis,
} from '../domain/sitePlan.ts';
import type { Location, Project } from '../domain/types.ts';
import type { RecommendationResult } from './recommend.ts';

export interface CameraInstance {
  readonly key: string;
  readonly locationId: string;
  readonly locationName: string;
  readonly index: number;
  readonly label: string;
  readonly camera: Camera;
  readonly lensLabel: string;
  readonly targetKbps: number;
  readonly peakKbps: number;
  readonly bitrateIsEstimate: boolean;
  readonly poeStandard: PoeStandard;
  /** Published max draw at the camera, W; null when the datasheet gives none. */
  readonly poeDrawWatts: number | null;
  /** Labelled megapixels, rounded the way datasheets name them (8 MP, 4 MP...). */
  readonly megapixels: number;
  readonly mountHeightMetres: number;
  readonly retentionDays: number;
  readonly placed: PlacedCamera | null;
}

export interface ExpandedCameras {
  readonly instances: readonly CameraInstance[];
  /** Locations whose cameras could not be counted because no model satisfies them. */
  readonly unresolvedLocations: readonly string[];
}

export function labelledMegapixels(camera: Camera): number {
  return Math.round((camera.maxResolutionWidthPx * camera.maxResolutionHeightPx) / 1e6);
}

export function expandCameras(
  project: Project,
  results: ReadonlyMap<string, RecommendationResult>,
): ExpandedCameras {
  const instances: CameraInstance[] = [];
  const unresolved: string[] = [];
  for (const loc of project.locations) {
    const primary = results.get(loc.id)?.primary ?? null;
    if (!primary) {
      unresolved.push(loc.name);
      continue;
    }
    const calc = primary.calculation;
    for (let i = 1; i <= loc.requirements.cameraCount; i++) {
      const key = cameraKey(loc.id, i);
      const placed =
        project.sitePlan.devices.find(
          (d): d is PlacedCamera => d.kind === 'camera' && d.locationId === loc.id && d.index === i,
        ) ?? null;
      instances.push({
        key,
        locationId: loc.id,
        locationName: loc.name,
        index: i,
        label: loc.requirements.cameraCount > 1 ? `${loc.name} #${i}` : loc.name,
        camera: calc.camera,
        lensLabel: calc.lens.label,
        targetKbps: calc.bitrate.targetKbps,
        peakKbps: calc.bitrate.peakKbps,
        bitrateIsEstimate: calc.bitrate.isEstimate,
        poeStandard: calc.camera.poeStandard,
        poeDrawWatts: calc.camera.poeMaxWatts,
        megapixels: labelledMegapixels(calc.camera),
        mountHeightMetres: loc.geometry.mountHeightMetres,
        retentionDays: loc.requirements.retentionDays,
        placed,
      });
    }
  }
  return { instances, unresolvedLocations: unresolved };
}

/** Where a camera's cable terminates: a placed switch, or the NVR rack. */
export type Endpoint = { readonly kind: 'nvr' } | { readonly kind: 'switch'; readonly switchId: string; readonly label: string };

export interface CameraLink {
  readonly instance: CameraInstance;
  readonly endpoint: Endpoint;
  /** Horizontal route length, metres. */
  readonly horizontalMetres: number;
  readonly basis: RunLengthBasis;
  readonly isEstimate: boolean;
  readonly explanation: string;
}

export interface UplinkLink {
  readonly switchId: string;
  readonly label: string;
  readonly horizontalMetres: number;
  readonly basis: RunLengthBasis;
  readonly isEstimate: boolean;
  readonly explanation: string;
}

export interface Topology {
  readonly links: readonly CameraLink[];
  /** One per placed switch that has at least one camera on it. */
  readonly uplinks: readonly UplinkLink[];
  readonly warnings: readonly string[];
}

/**
 * Link every camera to its endpoint and measure the run.
 *
 * Unplaced cameras, cameras on an uncalibrated plan, and cameras whose endpoint
 * is not placed all get `unplacedRunMetres`, flagged as an estimate — never a
 * silent zero.
 */
export function buildTopology(
  project: Project,
  instances: readonly CameraInstance[],
): Topology {
  const plan = project.sitePlan;
  const { routingFactor, unplacedRunMetres } = project.settings.cabling;
  const nvr = primaryNvr(plan);
  const warnings: string[] = [];
  const links: CameraLink[] = [];

  const placeholder = (why: string) => ({
    horizontalMetres: unplacedRunMetres,
    basis: 'unplaced' as const,
    isEstimate: true,
    explanation: `${why} Placeholder run of ${unplacedRunMetres} m used; place it on the site plan for a measured figure.`,
  });

  let unplacedCount = 0;
  for (const inst of instances) {
    const cam = inst.placed;
    const target = cam?.connectTo ? deviceById(plan, cam.connectTo) : null;
    const endpoint: Endpoint =
      target && target.kind === 'switch'
        ? { kind: 'switch', switchId: target.id, label: (target as PlacedSwitch).label }
        : { kind: 'nvr' };

    if (!cam) {
      unplacedCount++;
      links.push({ instance: inst, endpoint, ...placeholder('Not placed on the site plan.') });
      continue;
    }
    const endDevice = endpoint.kind === 'switch' ? target : nvr;
    if (!endDevice) {
      links.push({ instance: inst, endpoint, ...placeholder('The NVR/rack is not placed on the site plan.') });
      continue;
    }
    const run = horizontalRunBetween(plan, cam, endDevice, routingFactor);
    if (run.metres === null) {
      links.push({ instance: inst, endpoint, ...placeholder(run.explanation) });
      continue;
    }
    links.push({
      instance: inst,
      endpoint,
      horizontalMetres: run.metres,
      basis: run.basis,
      isEstimate: run.basis !== 'drawn',
      explanation: run.explanation,
    });
  }
  if (unplacedCount > 0) {
    warnings.push(
      `${unplacedCount} camera(s) are not on the site plan; their cable runs use the ${unplacedRunMetres} m placeholder and are flagged as estimates.`,
    );
  }

  const uplinks: UplinkLink[] = [];
  const usedSwitchIds = new Set(links.flatMap((l) => (l.endpoint.kind === 'switch' ? [l.endpoint.switchId] : [])));
  for (const id of usedSwitchIds) {
    const sw = deviceById(plan, id);
    if (!sw || sw.kind !== 'switch') continue;
    if (!nvr) {
      uplinks.push({ switchId: id, label: sw.label, ...placeholder('The NVR/rack is not placed, so the switch uplink cannot be measured.') });
      continue;
    }
    const run = horizontalRunBetween(plan, sw, nvr, routingFactor);
    if (run.metres === null) {
      uplinks.push({ switchId: id, label: sw.label, ...placeholder(run.explanation) });
      continue;
    }
    uplinks.push({
      switchId: id,
      label: sw.label,
      horizontalMetres: run.metres,
      basis: run.basis,
      isEstimate: run.basis !== 'drawn',
      explanation: run.explanation,
    });
  }

  return { links, uplinks, warnings };
}

/** Locations by id, for labels. */
export function locationsById(project: Project): ReadonlyMap<string, Location> {
  return new Map(project.locations.map((l) => [l.id, l]));
}
