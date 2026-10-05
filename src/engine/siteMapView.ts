/**
 * What the site-map editor draws, computed from the project (M2–M4). Pure, so
 * the editor component only renders and forwards edits, and the UI agent can
 * restyle or move it without touching any maths.
 *
 * Every camera on the map shows its FOV cone from the phase-1 calculation (the
 * horizontal FOV actually delivered by the recommended lens, out to the
 * location's target distance) and its cable run with the run's basis — drawn,
 * entered, or an estimated straight line × routing factor, which is drawn
 * dashed and labelled "estimated route".
 */

import {
  deviceById,
  metresPerPixel,
  primaryNvr,
  type PlacedDevice,
  type Point,
  type RunLengthBasis,
} from '../domain/sitePlan.ts';
import { canvasSize, endpointIdOf, fovCone, placedCamera, routeBetween } from '../domain/sitePlanEdit.ts';
import type { Project } from '../domain/types.ts';
import type { RecommendationResult } from './recommend.ts';
import { buildTopology, cameraLabel, expandCameras } from './topology.ts';

export interface RunView {
  readonly metres: number;
  readonly basis: RunLengthBasis;
  readonly isEstimate: boolean;
  readonly explanation: string;
}

export interface DeviceView {
  readonly device: PlacedDevice;
  readonly label: string;
  /** Camera only: wedge polygon, apex first; empty when there is no scale or no recommendation. */
  readonly cone: readonly Point[];
  readonly coneNote: string | null;
  /** Camera: the device it is cabled to. Switch: the NVR. */
  readonly endpointId: string | null;
  /** Camera: horizontal run to its endpoint. Switch: uplink to the NVR (only once it has cameras). */
  readonly run: RunView | null;
}

export interface LineView {
  readonly id: string;
  readonly points: readonly Point[];
  readonly kind: 'drawn' | 'estimated';
  readonly label: string;
}

export interface UnplacedCamera {
  readonly locationId: string;
  readonly index: number;
  readonly label: string;
}

export interface SiteMapView {
  readonly widthPx: number;
  readonly heightPx: number;
  readonly metresPerPx: number | null;
  readonly devices: readonly DeviceView[];
  readonly lines: readonly LineView[];
  readonly unplaced: readonly UnplacedCamera[];
  /** Placed switches a camera can be cabled to (the alternative is the NVR rack). */
  readonly switches: readonly { readonly id: string; readonly label: string }[];
  readonly warnings: readonly string[];
}

function deviceLabel(project: Project, d: PlacedDevice): string {
  if (d.kind !== 'camera') return d.label;
  const loc = project.locations.find((l) => l.id === d.locationId);
  return loc ? cameraLabel(loc, d.index) : `${d.locationId} #${d.index}`;
}

export function siteMapView(project: Project, results: ReadonlyMap<string, RecommendationResult>): SiteMapView {
  const plan = project.sitePlan;
  const { widthPx, heightPx } = canvasSize(plan);
  const mpp = plan.calibration ? metresPerPixel(plan.calibration) : null;
  const { instances } = expandCameras(project, results);
  const topology = buildTopology(project, instances);
  const linkByKey = new Map(topology.links.map((l) => [l.instance.key, l]));
  const uplinkBySwitch = new Map(topology.uplinks.map((u) => [u.switchId, u]));

  const devices: DeviceView[] = [];
  const lines: LineView[] = [];

  for (const d of plan.devices) {
    const label = deviceLabel(project, d);
    if (d.kind === 'camera') {
      const loc = project.locations.find((l) => l.id === d.locationId);
      const calc = results.get(d.locationId)?.primary?.calculation ?? null;
      let cone: Point[] = [];
      let coneNote: string | null = null;
      if (!calc || !loc) coneNote = 'No recommended model for this location yet, so no field of view to draw.';
      else if (mpp === null) coneNote = 'Calibrate the scale to draw the field of view.';
      else {
        cone = fovCone(d, d.rotationDeg, calc.deliveredHorizontalFovDeg, loc.geometry.targetDistanceMetres, mpp);
        coneNote = `${calc.deliveredHorizontalFovDeg.toFixed(1)}° horizontal FOV (${calc.camera.model}, ${calc.lens.label}) out to the ${loc.geometry.targetDistanceMetres} m target distance.`;
      }
      const endpointId = endpointIdOf(plan, d);
      const link = linkByKey.get(`${d.locationId}#${d.index}`);
      const run: RunView | null = link
        ? { metres: link.horizontalMetres, basis: link.basis, isEstimate: link.isEstimate, explanation: link.explanation }
        : null;
      devices.push({ device: d, label, cone, coneNote, endpointId, run });

      const end = endpointId ? deviceById(plan, endpointId) : null;
      if (end) {
        const route = routeBetween(plan, d.id, end.id);
        if (route) {
          const ordered = route.fromId === d.id ? route.waypoints : [...route.waypoints].reverse();
          lines.push({ id: route.id, points: [d, ...ordered, end], kind: 'drawn', label: `${label} → ${deviceLabel(project, end)}` });
        } else if (d.runMetresOverride === null && mpp !== null) {
          lines.push({ id: `est-${d.id}`, points: [d, end], kind: 'estimated', label: 'estimated route' });
        }
      }
    } else if (d.kind === 'switch') {
      const up = uplinkBySwitch.get(d.id);
      const nvr = primaryNvr(plan);
      devices.push({
        device: d,
        label,
        cone: [],
        coneNote: null,
        endpointId: nvr?.id ?? null,
        run: up ? { metres: up.horizontalMetres, basis: up.basis, isEstimate: up.isEstimate, explanation: up.explanation } : null,
      });
      if (nvr) {
        const route = routeBetween(plan, d.id, nvr.id);
        if (route) {
          const ordered = route.fromId === d.id ? route.waypoints : [...route.waypoints].reverse();
          lines.push({ id: route.id, points: [d, ...ordered, nvr], kind: 'drawn', label: `${label} uplink` });
        } else if (up && d.runMetresOverride === null && mpp !== null) {
          lines.push({ id: `est-${d.id}`, points: [d, nvr], kind: 'estimated', label: 'estimated route' });
        }
      }
    } else {
      devices.push({ device: d, label, cone: [], coneNote: null, endpointId: null, run: null });
    }
  }

  const unplaced: UnplacedCamera[] = [];
  for (const loc of project.locations) {
    for (let i = 1; i <= loc.requirements.cameraCount; i++) {
      if (!placedCamera(plan, loc.id, i)) unplaced.push({ locationId: loc.id, index: i, label: cameraLabel(loc, i) });
    }
  }

  const warnings: string[] = [];
  if (plan.devices.some((d) => d.kind === 'camera') && !plan.devices.some((d) => d.kind === 'nvr')) {
    warnings.push('Place the NVR / rack: cameras cabled to it cannot be measured until it is on the plan.');
  }
  const nvrs = plan.devices.filter((d) => d.kind === 'nvr');
  if (nvrs.length > 1) {
    warnings.push(`${nvrs.length} NVRs are placed; the design sizes one recorder, at the first one (${nvrs[0]!.label}). Remove the others or treat them as markers.`);
  }
  if (!plan.calibration && plan.devices.length > 0) {
    warnings.push('The plan is not calibrated: runs use typed-in lengths where given, otherwise the flagged placeholder.');
  }

  return {
    widthPx,
    heightPx,
    metresPerPx: mpp,
    devices,
    lines,
    unplaced,
    switches: plan.devices.filter((d) => d.kind === 'switch').map((d) => ({ id: d.id, label: deviceLabel(project, d) })),
    warnings,
  };
}
