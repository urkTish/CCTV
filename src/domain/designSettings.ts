/**
 * Project-level design inputs for phase 2: recording and storage, the recorder,
 * PoE switching and cabling. Every input has a default so a project gives a
 * result straight away; the defaults that are engineering allowances rather
 * than sourced figures are listed in `ESTIMATED_DEFAULTS` and flagged wherever
 * they touch a number.
 */

import type { Capability } from '../data/schema.ts';
import type { NvrAnalytic, VideoOutputResolution } from '../data/productSchemas.ts';
import { DEFAULT_CABLE_BOX_METRES, DEFAULT_FORMATTING_OVERHEAD } from './standards.ts';
import { DEFAULT_RECORDING_SCHEDULE, type RaidLevel, type RecordingSchedule } from './storage.ts';

export interface StorageSettings {
  readonly schedule: RecordingSchedule;
  readonly raidLevel: RaidLevel;
  readonly hotSpare: boolean;
  /** Growth headroom on top of the computed requirement, percent. */
  readonly headroomPercent: number;
  /** Capacity lost to formatting, percent. Estimate — see standards.ts. */
  readonly formattingOverheadPercent: number;
}

export type NvrFormFactorPreference = 'any' | 'desktop' | 'rack' | '1U' | '1.5U' | '2U';
export type PoeMode = 'auto' | 'built-in' | 'external';

export interface RecorderSettings {
  /** Spare channels on top of today's camera count, percent. */
  readonly channelHeadroomPercent: number;
  readonly monitors: number;
  readonly outputResolution: VideoOutputResolution;
  readonly formFactor: NvrFormFactorPreference;
  readonly redundantPsu: boolean;
  readonly poeMode: PoeMode;
  /** Recorder-side analytics required. `null` = inherit from the cameras' analytics. */
  readonly analytics: readonly NvrAnalytic[] | null;
  /** Engineer-chosen recorder id; null = let the engine pick. */
  readonly pinnedNvrId: string | null;
}

export type SwitchManagementPreference = 'auto' | 'unmanaged' | 'managed';
export type UplinkPreference = 'auto' | 'copper' | 'sfp';

export interface SwitchSettings {
  readonly poeHeadroomPercent: number;
  readonly management: SwitchManagementPreference;
  readonly uplink: UplinkPreference;
  readonly sparePortsPercent: number;
}

export interface CableSettings {
  /** Ceiling-to-rack drop at the switch/NVR end of every run, metres. */
  readonly rackDropMetres: number;
  /** Termination and service-loop slack per run, metres. */
  readonly serviceLoopMetres: number;
  /** Purchasing waste on every run, percent. */
  readonly wastePercent: number;
  readonly boxMetres: number;
  readonly connectorsPerRun: number;
  readonly patchCordsPerRun: number;
  /** Straight line × this factor when a placed camera has no drawn route. */
  readonly routingFactor: number;
  /** Horizontal run assumed for a camera that is not placed on the site plan, metres. */
  readonly unplacedRunMetres: number;
}

export interface DesignSettings {
  readonly storage: StorageSettings;
  readonly recorder: RecorderSettings;
  readonly switches: SwitchSettings;
  readonly cabling: CableSettings;
}

export const DEFAULT_DESIGN_SETTINGS: DesignSettings = {
  storage: {
    schedule: DEFAULT_RECORDING_SCHEDULE,
    raidLevel: 'none',
    hotSpare: false,
    headroomPercent: 20,
    formattingOverheadPercent: DEFAULT_FORMATTING_OVERHEAD * 100,
  },
  recorder: {
    channelHeadroomPercent: 25,
    monitors: 1,
    outputResolution: '1080p',
    formFactor: 'any',
    redundantPsu: false,
    poeMode: 'auto',
    analytics: null,
    pinnedNvrId: null,
  },
  switches: {
    poeHeadroomPercent: 25,
    management: 'auto',
    uplink: 'auto',
    sparePortsPercent: 20,
  },
  cabling: {
    rackDropMetres: 3,
    serviceLoopMetres: 3,
    wastePercent: 10,
    boxMetres: DEFAULT_CABLE_BOX_METRES,
    connectorsPerRun: 2,
    patchCordsPerRun: 1,
    routingFactor: 1.3,
    unplacedRunMetres: 40,
  },
};

/**
 * Defaults that are engineering allowances, not sourced figures. The UI shows an
 * Unverified badge next to each, and any number they feed is flagged.
 */
export const ESTIMATED_DEFAULTS = {
  motionDutyPercent: 'Share of the day with motion — depends entirely on the site.',
  formattingOverheadPercent: 'No published figure for formatting loss on a Hikvision NVR.',
  rackDropMetres: 'Typical ceiling-to-rack drop; measure on site.',
  routingFactor: 'Cable follows walls and ceilings, not straight lines; 1.3 is a planning allowance.',
  unplacedRunMetres: 'A placeholder run for cameras not yet placed on the site plan.',
} as const;

/**
 * Recorder analytics implied by the cameras' required analytics (brief: "inherit
 * these from the camera analytics choices"). Mapping, see ASSUMPTIONS 10.x:
 *   ANPR → ANPR; people counting → people counting;
 *   face capture → face recognition (the recorder holds the face lists);
 *   AcuSense → Motion Detection 2.0 (the recorder's human/vehicle filter).
 */
const INHERITED: Partial<Record<Capability, NvrAnalytic>> = {
  anpr: 'anpr',
  'people-counting': 'people-counting',
  'face-capture': 'face-recognition',
  acusense: 'motion-detection-2',
};

export function inheritedRecorderAnalytics(capabilities: readonly Capability[]): NvrAnalytic[] {
  const out = new Set<NvrAnalytic>();
  for (const c of capabilities) {
    const a = INHERITED[c];
    if (a) out.add(a);
  }
  return [...out].sort();
}

export const NVR_ANALYTIC_LABELS: Readonly<Record<NvrAnalytic, string>> = {
  'motion-detection-2': 'Motion Detection 2.0 (AcuSense human/vehicle)',
  'perimeter-protection': 'Perimeter protection',
  'face-recognition': 'Face recognition',
  anpr: 'ANPR',
  'people-counting': 'People counting',
  acuseek: 'AcuSeek search',
};
