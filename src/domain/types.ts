/**
 * The typed inputs the whole engine runs on.
 *
 * A `Project` holds many `Location`s from the start. Phase 1's UI may only show
 * one at a time, but the NVR, switch and storage modules in phase 2 need the
 * whole project, and retro-fitting a container around a single-location model is
 * exactly the corner the brief says not to paint ourselves into.
 */

import type { Purpose } from './dori.ts';
import type { Codec, MotionLevel, SupportedFps } from './bitrate.ts';
import type { Capability, PriceTier } from '../data/schema.ts';
import { DEFAULT_DESIGN_SETTINGS, type DesignSettings } from './designSettings.ts';
import { EMPTY_SITE_PLAN, type SitePlan } from './sitePlan.ts';

export type MountSurface = 'wall' | 'ceiling' | 'pole' | 'corner' | 'recessed' | 'pendant';
export type SiteEnvironment = 'indoor' | 'outdoor' | 'semi-covered';
export type AmbientLight = 'well-lit-24-7' | 'low-light' | 'zero-lux';
export type SpecialCondition = 'dust' | 'washdown' | 'corrosive-marine' | 'extreme-cold';
export type LensPreference = 'any' | 'fixed' | 'varifocal';

export interface Geometry {
  /** Lens height above the floor, metres. */
  readonly mountHeightMetres: number;
  /** Ground distance to the furthest point of interest, metres. */
  readonly targetDistanceMetres: number;
  /** Ground distance to the nearest point of interest, metres. Null if not stated. */
  readonly nearestDistanceMetres: number | null;
  /**
   * How the scene width was specified. 'width' takes `sceneWidthMetres`
   * directly; 'room' derives it from the room's short axis.
   */
  readonly widthSource: 'width' | 'room';
  readonly sceneWidthMetres: number;
  readonly roomLengthMetres: number;
  readonly roomWidthMetres: number;
  /** Height of the thing being looked at (face height, plate height), metres. */
  readonly targetHeightMetres: number;
  /** Fraction of each camera's footprint given up to its neighbour, 0 to <1. */
  readonly overlapAllowance: number;
}

export interface Environment {
  readonly site: SiteEnvironment;
  readonly mountSurface: MountSurface;
  readonly vandalExposure: boolean;
  readonly ambientLight: AmbientLight;
  /** Client wants usable colour at night, not monochrome IR. */
  readonly colourAtNight: boolean;
  /** Doorway, window, loading bay — anything that needs real WDR. */
  readonly strongBacklight: boolean;
  readonly specialConditions: readonly SpecialCondition[];
}

export interface ClientRequirements {
  readonly audioRequired: boolean;
  readonly twoWayAudioRequired: boolean;
  /** Analytics the client has actually asked for. */
  readonly requiredCapabilities: readonly Capability[];
  readonly budgetTier: PriceTier | 'any';
  readonly retentionDays: number;
  readonly motionLevel: MotionLevel;
  readonly lensPreference: LensPreference;
  readonly ptzAcceptable: boolean;
  readonly cameraCount: number;
  readonly codec: Codec;
  readonly fps: SupportedFps;
}

export interface Location {
  readonly id: string;
  readonly name: string;
  readonly purpose: Purpose;
  readonly geometry: Geometry;
  readonly environment: Environment;
  readonly requirements: ClientRequirements;
}

export interface Project {
  readonly name: string;
  readonly locations: readonly Location[];
  readonly activeLocationId: string;
  /** Phase 2: project-wide recorder, storage, switch and cabling inputs. */
  readonly settings: DesignSettings;
  /** Phase 2: the site plan. Not carried in the shareable URL (the image is too big). */
  readonly sitePlan: SitePlan;
}

/** A single traceable number shown to the user. Nothing reaches the UI without one. */
export interface TracedValue {
  readonly label: string;
  /** Rendered value including units, e.g. "212 px/m". */
  readonly display: string;
  /** The raw number, for charts and for phase 2. */
  readonly value: number | null;
  /** The formula, in words, as it was actually applied. */
  readonly formula: string;
  /** Where the formula or the constants came from. */
  readonly sourceUrl: string | null;
  /** True when any input to this number was an estimate rather than a sourced figure. */
  readonly isEstimate: boolean;
  readonly verdict?: 'pass' | 'marginal' | 'fail' | 'info';
}

export const DEFAULT_GEOMETRY: Geometry = {
  mountHeightMetres: 3,
  targetDistanceMetres: 10,
  nearestDistanceMetres: null,
  widthSource: 'width',
  sceneWidthMetres: 6,
  roomLengthMetres: 12,
  roomWidthMetres: 6,
  // 1.6 m is a conventional working figure for eye/face height on an adult.
  // Not a standard; it is an input default the user can change.
  targetHeightMetres: 1.6,
  overlapAllowance: 0.15,
};

export const DEFAULT_ENVIRONMENT: Environment = {
  site: 'outdoor',
  mountSurface: 'wall',
  vandalExposure: false,
  ambientLight: 'low-light',
  colourAtNight: false,
  strongBacklight: false,
  specialConditions: [],
};

export const DEFAULT_REQUIREMENTS: ClientRequirements = {
  audioRequired: false,
  twoWayAudioRequired: false,
  requiredCapabilities: [],
  budgetTier: 'any',
  retentionDays: 30,
  motionLevel: 'moderate',
  lensPreference: 'any',
  ptzAcceptable: false,
  cameraCount: 1,
  codec: 'h265plus',
  fps: 25,
};

export function defaultLocation(id: string, name: string): Location {
  return {
    id,
    name,
    purpose: 'recognise',
    geometry: DEFAULT_GEOMETRY,
    environment: DEFAULT_ENVIRONMENT,
    requirements: DEFAULT_REQUIREMENTS,
  };
}

export function defaultProject(): Project {
  const first = defaultLocation('loc-1', 'Main gate');
  return {
    name: 'New project',
    locations: [first],
    activeLocationId: first.id,
    settings: DEFAULT_DESIGN_SETTINGS,
    sitePlan: EMPTY_SITE_PLAN,
  };
}

export type { Purpose } from './dori.ts';
export type { Codec, MotionLevel, SupportedFps } from './bitrate.ts';
export type { FormFactor, Capability, PriceTier, LensType } from '../data/schema.ts';
