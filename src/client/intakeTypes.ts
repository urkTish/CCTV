/**
 * What the end client tells us in the intake wizard — in their terms, not the
 * engine's. `intakeMapping.ts` turns these answers into engine inputs.
 *
 * The schema is a validation boundary: an intake arrives as a file or a link
 * from outside, so it is parsed, never trusted.
 */

import { z } from 'zod';

export const PREMISES = ['home', 'shop', 'office', 'warehouse', 'public', 'other'] as const;
export type Premises = (typeof PREMISES)[number];

/** What the client needs to see — the plain-language face of the DORI purposes. */
export const SEE_CHOICES = ['activity', 'actions', 'recognise', 'identify', 'plates', 'till'] as const;
export type SeeChoice = (typeof SEE_CHOICES)[number];

export const PLACES = ['indoor', 'outdoor', 'covered'] as const;
export type Place = (typeof PLACES)[number];

export const NIGHT_LIGHT = ['lit', 'some', 'dark'] as const;
export type NightLight = (typeof NIGHT_LIGHT)[number];

export const DISTANCE_RANGES = ['lt5', '5to15', '15to30', 'gt30'] as const;
export type DistanceRange = (typeof DISTANCE_RANGES)[number];

export const RETENTION_CHOICES = ['1w', '2w', '1m', '3m'] as const;
export type RetentionChoice = (typeof RETENTION_CHOICES)[number];

export const BUDGET_CHOICES = ['economy', 'balanced', 'premium'] as const;
export type BudgetChoice = (typeof BUDGET_CHOICES)[number];

/** Owner decision: the recorder's form factor is the client's choice. */
export const RECORDER_PLACES = ['unsure', 'desk', 'cabinet'] as const;
export type RecorderPlace = (typeof RECORDER_PLACES)[number];
export const CABINET_SPACE = ['any', '1U', '1.5U', '2U'] as const;
export type CabinetSpace = (typeof CABINET_SPACE)[number];

/** Owner decision: how the cameras get power is the client's choice. */
export const POWER_CHOICES = ['auto', 'recorder', 'switch'] as const;
export type PowerChoice = (typeof POWER_CHOICES)[number];

export interface ClientArea {
  readonly id: string;
  readonly name: string;
  readonly cameraCount: number;
  readonly see: SeeChoice;
  readonly place: Place;
  readonly night: NightLight;
  readonly distance: DistanceRange;
}

export interface ClientAnswers {
  readonly site: {
    readonly premises: Premises;
    readonly siteName: string;
    readonly contactName: string;
    readonly contactPhone: string;
    readonly contactEmail: string;
  };
  readonly areas: readonly ClientArea[];
  readonly recording: {
    readonly retention: RetentionChoice;
    readonly recorderPlace: RecorderPlace;
    readonly cabinetSpace: CabinetSpace;
    readonly power: PowerChoice;
  };
  readonly budget: BudgetChoice;
}

export const MAX_AREAS = 50;
export const MAX_CAMERAS_PER_AREA = 50;

const text = (max: number) => z.string().max(max);

export const clientAreaSchema = z
  .object({
    id: z.string().min(1).max(64),
    name: text(120),
    cameraCount: z.number().int().min(1).max(MAX_CAMERAS_PER_AREA),
    see: z.enum(SEE_CHOICES),
    place: z.enum(PLACES),
    night: z.enum(NIGHT_LIGHT),
    distance: z.enum(DISTANCE_RANGES),
  })
  .strict();

export const clientAnswersSchema = z
  .object({
    site: z
      .object({
        premises: z.enum(PREMISES),
        siteName: text(160),
        contactName: text(120),
        contactPhone: text(60),
        contactEmail: text(160),
      })
      .strict(),
    areas: z.array(clientAreaSchema).min(1).max(MAX_AREAS),
    recording: z
      .object({
        retention: z.enum(RETENTION_CHOICES),
        recorderPlace: z.enum(RECORDER_PLACES),
        cabinetSpace: z.enum(CABINET_SPACE),
        power: z.enum(POWER_CHOICES),
      })
      .strict(),
    budget: z.enum(BUDGET_CHOICES),
  })
  .strict();

export function newArea(id: string, index: number): ClientArea {
  return { id, name: `Area ${index}`, cameraCount: 1, see: 'activity', place: 'outdoor', night: 'some', distance: '5to15' };
}

export function emptyAnswers(): ClientAnswers {
  return {
    site: { premises: 'shop', siteName: '', contactName: '', contactPhone: '', contactEmail: '' },
    areas: [],
    recording: { retention: '1m', recorderPlace: 'unsure', cabinetSpace: 'any', power: 'auto' },
    budget: 'balanced',
  };
}

/** A wizard still being filled in may have no areas yet (kept in this browser only). */
export const draftAnswersSchema = clientAnswersSchema.extend({ areas: z.array(clientAreaSchema).max(MAX_AREAS) });
