/**
 * Re-exports and project-level helpers for the UI layer.
 *
 * The domain owns the shapes; this module exists so UI code never reaches past
 * `state/` into `domain/` for a type, and so the multi-location helpers live in
 * one place ready for phase 2's project-wide NVR and switch sizing.
 */

import { poeTotals, type PoeLineItem } from '../domain/power.ts';
import { calculateScenario, calculateForCamera } from '../domain/calculate.ts';
import { recommend } from '../engine/recommend.ts';
import type { Project, Location } from '../domain/types.ts';
import type { UnitSystem } from '../domain/units.ts';

export type UnitSystemState = UnitSystem;

export type {
  Project,
  Location,
  Geometry,
  Environment,
  ClientRequirements,
  TracedValue,
  MountSurface,
  SiteEnvironment,
  AmbientLight,
  SpecialCondition,
  LensPreference,
} from '../domain/types.ts';

export {
  defaultProject,
  defaultLocation,
  DEFAULT_GEOMETRY,
  DEFAULT_ENVIRONMENT,
  DEFAULT_REQUIREMENTS,
} from '../domain/types.ts';

export function activeLocation(project: Project): Location {
  const found = project.locations.find((l) => l.id === project.activeLocationId);
  if (!found) {
    const first = project.locations[0];
    if (!first) throw new Error('A project must always have at least one location');
    return first;
  }
  return found;
}

export function replaceLocation(project: Project, updated: Location): Project {
  return {
    ...project,
    locations: project.locations.map((l) => (l.id === updated.id ? updated : l)),
  };
}

export function nextLocationId(project: Project): string {
  let n = project.locations.length + 1;
  const taken = new Set(project.locations.map((l) => l.id));
  while (taken.has(`loc-${n}`)) n += 1;
  return `loc-${n}`;
}

export interface ProjectTotals {
  readonly locationCount: number;
  readonly cameraCount: number;
  readonly poePortCount: number;
  readonly poeCameraWatts: number;
  readonly poeSwitchBudgetWatts: number;
  readonly aggregateBitrateMbps: number;
  readonly storageGb: number;
  /** Locations whose best recommendation could not be found. */
  readonly unresolvedLocations: readonly string[];
  readonly poeExplanation: string;
}

/**
 * Project-wide totals, built from each location's primary recommendation.
 *
 * This is the hook the phase-2 NVR, switch and storage modules plug into: they
 * are pure functions of this object plus their own product data. Nothing here is
 * phase-2 work — it is the figures phase 1 already computes, added up.
 */
export function projectTotals(project: Project): ProjectTotals {
  let cameraCount = 0;
  let aggregateKbps = 0;
  let storageGb = 0;
  const poeItems: PoeLineItem[] = [];
  const unresolved: string[] = [];

  for (const location of project.locations) {
    const quantity = location.requirements.cameraCount;
    cameraCount += quantity;

    const result = recommend(location);
    if (!result.primary) {
      unresolved.push(location.name);
      continue;
    }
    const calc = result.primary.calculation;
    aggregateKbps += calc.bitrate.targetKbps * quantity;
    storageGb += calc.storageGbForRetention * quantity;
    poeItems.push({
      standard: calc.camera.poeStandard,
      drawWatts: calc.camera.poeMaxWatts,
      quantity,
    });
  }

  const totals = poeTotals(poeItems);
  return {
    locationCount: project.locations.length,
    cameraCount,
    poePortCount: totals.portCount,
    poeCameraWatts: totals.totalCameraWatts,
    poeSwitchBudgetWatts: totals.totalPseBudgetWatts,
    aggregateBitrateMbps: aggregateKbps / 1000,
    storageGb,
    unresolvedLocations: unresolved,
    poeExplanation: totals.explanation,
  };
}

export { calculateScenario, calculateForCamera, recommend };
