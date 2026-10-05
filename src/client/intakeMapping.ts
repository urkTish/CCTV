/**
 * Client intake → engine inputs. The one place a client's plain-language answers
 * become a `Project` the engine can design.
 *
 * Rules:
 *   - every answer maps onto an existing engine input (purpose, site, light,
 *     distance, camera count, retention, budget tier, PoE mode, form factor);
 *   - everything the client is not asked gets a documented default below, and is
 *     recorded in `assumed` with the reason, so the Admin version can mark it
 *     "assumed from client intake — please confirm" until the engineer confirms
 *     or edits it;
 *   - no engine logic is duplicated: the mapped project goes through the same
 *     `recommend` / `designProject` / `buildBillOfMaterials` as any other.
 *
 * The defaults are planning assumptions for a draft, not survey results. They
 * are listed in ASSUMPTIONS.md section 12.
 */

import type { Purpose } from '../domain/dori.ts';
import { DEFAULT_DESIGN_SETTINGS, type NvrFormFactorPreference, type PoeMode } from '../domain/designSettings.ts';
import { EMPTY_SITE_PLAN } from '../domain/sitePlan.ts';
import {
  DEFAULT_ENVIRONMENT,
  DEFAULT_GEOMETRY,
  DEFAULT_REQUIREMENTS,
  type AmbientLight,
  type Location,
  type PriceTier,
  type Project,
  type SiteEnvironment,
} from '../domain/types.ts';
import type {
  BudgetChoice,
  CabinetSpace,
  ClientAnswers,
  ClientArea,
  DistanceRange,
  NightLight,
  Place,
  PowerChoice,
  Premises,
  RecorderPlace,
  RetentionChoice,
  SeeChoice,
} from './intakeTypes.ts';

// ---------------------------------------------------------------------------
// The client's choices, in their words, and what each maps to
// ---------------------------------------------------------------------------

export const PREMISES_LABEL: Readonly<Record<Premises, string>> = {
  home: 'Home',
  shop: 'Shop or restaurant',
  office: 'Office',
  warehouse: 'Warehouse or industrial site',
  public: 'School or public building',
  other: 'Something else',
};

export interface SeeOption {
  readonly title: string;
  readonly example: string;
  /** The engine purpose (DORI level or special case) this choice is sized for. */
  readonly purpose: Purpose;
  /** Scene width assumed at the target distance, metres (capped at the distance). */
  readonly sceneWidthMetres: number;
}

/**
 * Plain-language purposes. "Watch general activity" covers the brief's
 * monitor/detect; it is sized for Detect (25 px/m) — the lowest level IEC
 * 62676-4 actually defines — rather than the unverified 12.5 px/m "monitor"
 * convention, so it is flagged for the engineer to confirm.
 *
 * Scene widths are what that job usually needs at the far point: a car-park or
 * yard view for activity, a doorway or gate for faces, one traffic lane for
 * plates, one counter for a till.
 */
export const SEE_OPTIONS: Readonly<Record<SeeChoice, SeeOption>> = {
  activity: { title: 'Watch general activity', example: 'See that someone or a vehicle is there — a yard, a car park, a field.', purpose: 'detect', sceneWidthMetres: 12 },
  actions: { title: 'See what people are doing', example: 'Follow what happens — someone picking up a box, opening a door.', purpose: 'observe', sceneWidthMetres: 8 },
  recognise: { title: 'Recognise people I know', example: 'Tell which of your staff or family it is.', purpose: 'recognise', sceneWidthMetres: 5 },
  identify: { title: 'Clearly identify faces', example: 'A face clear enough to identify a stranger — at an entrance or a gate.', purpose: 'identify', sceneWidthMetres: 3 },
  plates: { title: 'Read car number plates', example: 'Read the plate of a car coming in or out.', purpose: 'lpr', sceneWidthMetres: 3.5 },
  till: { title: 'Watch the cash register', example: 'See the cash, the notes and the hands at a till.', purpose: 'till', sceneWidthMetres: 1.2 },
};

export const PLACE_LABEL: Readonly<Record<Place, string>> = {
  indoor: 'Indoors',
  outdoor: 'Outdoors',
  covered: 'Outdoors, under a roof or canopy',
};

const PLACE_TO_SITE: Readonly<Record<Place, SiteEnvironment>> = { indoor: 'indoor', outdoor: 'outdoor', covered: 'semi-covered' };

export const NIGHT_LABEL: Readonly<Record<NightLight, string>> = {
  lit: 'No — it is lit all night',
  some: 'There is some light',
  dark: 'Yes — completely dark',
};

const NIGHT_TO_LIGHT: Readonly<Record<NightLight, AmbientLight>> = { lit: 'well-lit-24-7', some: 'low-light', dark: 'zero-lux' };

export interface DistanceOption {
  readonly label: string;
  /** Sized for the far end of the range: the engine must hold its pixel density out to here. */
  readonly metres: number;
}

export const DISTANCE_OPTIONS: Readonly<Record<DistanceRange, DistanceOption>> = {
  lt5: { label: 'Under 5 m', metres: 5 },
  '5to15': { label: '5 to 15 m', metres: 15 },
  '15to30': { label: '15 to 30 m', metres: 30 },
  gt30: { label: 'Over 30 m', metres: 40 },
};

export const RETENTION_OPTIONS: Readonly<Record<RetentionChoice, { readonly label: string; readonly days: number }>> = {
  '1w': { label: '1 week', days: 7 },
  '2w': { label: '2 weeks', days: 14 },
  '1m': { label: '1 month', days: 30 },
  '3m': { label: '3 months', days: 90 },
};

export const BUDGET_OPTIONS: Readonly<Record<BudgetChoice, { readonly label: string; readonly sentence: string; readonly tier: PriceTier }>> = {
  economy: { label: 'Economy', sentence: 'The lowest cost that still does the job; fewer extras and less low-light performance.', tier: 'economy' },
  balanced: { label: 'Balanced', sentence: 'Good image quality day and night for a sensible price — what most sites choose.', tier: 'standard' },
  premium: { label: 'Premium', sentence: 'The best picture in difficult light and the most features, at a higher price.', tier: 'premium' },
};

export const RECORDER_PLACE_LABEL: Readonly<Record<RecorderPlace, string>> = {
  unsure: 'Not sure — let the engineer suggest',
  desk: 'On a desk or a shelf',
  cabinet: 'In a network cabinet (rack)',
};

export const CABINET_SPACE_LABEL: Readonly<Record<CabinetSpace, string>> = {
  any: 'Any size / not sure',
  '1U': '1U (one slot)',
  '1.5U': '1.5U',
  '2U': '2U (two slots)',
};

export const POWER_LABEL: Readonly<Record<PowerChoice, { readonly label: string; readonly sentence: string }>> = {
  auto: { label: 'Let the engineer decide', sentence: 'Recommended if you are not sure.' },
  recorder: { label: 'Straight from the recorder', sentence: 'Fewer boxes; suits smaller sites where every camera is close to the recorder.' },
  switch: { label: 'From a separate network switch', sentence: 'Suits larger sites or cameras far from the recorder.' },
};

export function formFactorFor(place: RecorderPlace, space: CabinetSpace): NvrFormFactorPreference {
  if (place === 'desk') return 'desktop';
  if (place === 'cabinet') return space === 'any' ? 'rack' : space;
  return 'any';
}

export const POWER_TO_POE_MODE: Readonly<Record<PowerChoice, PoeMode>> = { auto: 'auto', recorder: 'built-in', switch: 'external' };

// ---------------------------------------------------------------------------
// Defaults for what the client is not asked
// ---------------------------------------------------------------------------

/** Lens height: a typical ceiling indoors; a wall or pole bracket outside. */
export const ASSUMED_MOUNT_HEIGHT_METRES = { indoor: 2.7, outside: 3 } as const;
/** Face height for people; plate height for vehicles (as the Admin helper text says). */
export const ASSUMED_TARGET_HEIGHT_METRES = { person: 1.6, plate: 0.5 } as const;

export interface MappedIntake {
  readonly project: Project;
  /** Location id → field key → why the value was assumed. */
  readonly assumed: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /** Location id → what the client asked for, in their words. */
  readonly clientWords: Readonly<Record<string, string>>;
}

export function areaInWords(area: ClientArea): string {
  const see = SEE_OPTIONS[area.see].title;
  const cams = `${area.cameraCount} camera${area.cameraCount === 1 ? '' : 's'}`;
  const dark = { lit: 'lit at night', some: 'some light at night', dark: 'completely dark at night' }[area.night];
  return `“${see}” · ${cams} · ${PLACE_LABEL[area.place].toLowerCase()} · ${dark} · ${DISTANCE_OPTIONS[area.distance].label.toLowerCase()} away`;
}

function mapArea(area: ClientArea, index: number, answers: ClientAnswers): { location: Location; assumed: Record<string, string> } {
  const see = SEE_OPTIONS[area.see];
  const distance = DISTANCE_OPTIONS[area.distance];
  const indoor = area.place === 'indoor';
  const plate = area.see === 'plates';
  const mountHeight = indoor ? ASSUMED_MOUNT_HEIGHT_METRES.indoor : ASSUMED_MOUNT_HEIGHT_METRES.outside;
  const sceneWidth = Math.min(see.sceneWidthMetres, distance.metres);
  const id = `loc-${index + 1}`;

  const location: Location = {
    id,
    name: area.name.trim() || `Area ${index + 1}`,
    purpose: see.purpose,
    geometry: {
      ...DEFAULT_GEOMETRY,
      mountHeightMetres: mountHeight,
      targetDistanceMetres: distance.metres,
      nearestDistanceMetres: null,
      widthSource: 'width',
      sceneWidthMetres: sceneWidth,
      targetHeightMetres: plate ? ASSUMED_TARGET_HEIGHT_METRES.plate : ASSUMED_TARGET_HEIGHT_METRES.person,
    },
    environment: {
      ...DEFAULT_ENVIRONMENT,
      site: PLACE_TO_SITE[area.place],
      mountSurface: indoor ? 'ceiling' : 'wall',
      vandalExposure: false,
      ambientLight: NIGHT_TO_LIGHT[area.night],
      colourAtNight: false,
      strongBacklight: false,
      specialConditions: [],
    },
    requirements: {
      ...DEFAULT_REQUIREMENTS,
      audioRequired: false,
      twoWayAudioRequired: false,
      requiredCapabilities: [],
      budgetTier: BUDGET_OPTIONS[answers.budget].tier,
      retentionDays: RETENTION_OPTIONS[answers.recording.retention].days,
      cameraCount: area.cameraCount,
    },
  };

  const assumed: Record<string, string> = {
    'geometry.mountHeightMetres': `Not asked. ${mountHeight} m assumed (${indoor ? 'a typical ceiling' : 'a typical wall or pole bracket'}).`,
    'geometry.targetDistanceMetres': `Client chose “${distance.label}”; sized for ${distance.metres} m${area.distance === 'gt30' ? ' (the range is open-ended)' : ', the far end'}. Measure it.`,
    'geometry.widthSource': 'Not asked. Coverage given as a scene width.',
    'geometry.sceneWidthMetres': `Not asked. ${sceneWidth} m assumed for “${see.title}”.`,
    'geometry.nearestDistanceMetres': 'Not asked; no near-field check.',
    'geometry.targetHeightMetres': plate ? 'Not asked. Plate height 0.5 m assumed.' : 'Not asked. Face height 1.6 m assumed.',
    'environment.mountSurface': `Not asked. ${indoor ? 'Ceiling' : 'Wall'} assumed.`,
    'environment.vandalExposure': 'Not asked. No vandal risk assumed.',
    'environment.colourAtNight': 'Not asked. Black-and-white (IR) at night assumed.',
    'environment.strongBacklight': 'Not asked. No strong backlight assumed — check doorways and windows.',
    'environment.specialConditions': 'Not asked. No dust, washdown, corrosion or extreme cold assumed.',
    'requirements.audioRequired': 'Not asked. No audio assumed.',
    'requirements.twoWayAudioRequired': 'Not asked. No two-way audio assumed.',
    'requirements.requiredCapabilities': plate
      ? 'Not asked. Sized to read plates; automatic plate recognition (ANPR) not assumed.'
      : 'Not asked. No must-have analytics assumed.',
    'requirements.lensPreference': 'Not asked. Fixed or varifocal both allowed.',
    'requirements.ptzAcceptable': 'Not asked. Fixed cameras only.',
    'requirements.motionLevel': 'Not asked. Moderate motion assumed.',
    'requirements.codec': 'Not asked. H.265+ assumed.',
    'requirements.fps': 'Not asked. 25 fps assumed.',
  };
  if (area.see === 'activity') {
    assumed.purpose = 'Client chose “Watch general activity”; sized for Detect (25 px/m), the lowest IEC 62676-4 level.';
  }
  return { location, assumed };
}

export function projectNameFor(answers: ClientAnswers): string {
  return answers.site.siteName.trim() || `${PREMISES_LABEL[answers.site.premises]} — client intake`;
}

/** Map a client's answers onto a draft project, with every assumption recorded. */
export function intakeToProject(answers: ClientAnswers): MappedIntake {
  const mapped = answers.areas.map((a, i) => mapArea(a, i, answers));
  const locations = mapped.map((m) => m.location);
  const first = locations[0];
  if (!first) throw new Error('An intake needs at least one area');
  const project: Project = {
    name: projectNameFor(answers),
    locations,
    activeLocationId: first.id,
    settings: {
      ...DEFAULT_DESIGN_SETTINGS,
      recorder: {
        ...DEFAULT_DESIGN_SETTINGS.recorder,
        formFactor: formFactorFor(answers.recording.recorderPlace, answers.recording.cabinetSpace),
        poeMode: POWER_TO_POE_MODE[answers.recording.power],
      },
    },
    sitePlan: EMPTY_SITE_PLAN,
  };
  return {
    project,
    assumed: Object.fromEntries(mapped.map((m) => [m.location.id, m.assumed])),
    clientWords: Object.fromEntries(answers.areas.map((a, i) => [mapped[i]!.location.id, areaInWords(a)])),
  };
}

/** The client's two recorder answers, in words, for the Admin recorder settings. */
export function recorderAnswersInWords(answers: ClientAnswers): { formFactor: string; poe: string } {
  const r = answers.recording;
  const place = RECORDER_PLACE_LABEL[r.recorderPlace];
  return {
    formFactor: r.recorderPlace === 'cabinet' ? `${place}, ${CABINET_SPACE_LABEL[r.cabinetSpace].toLowerCase()}` : place,
    poe: POWER_LABEL[r.power].label,
  };
}
