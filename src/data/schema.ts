/**
 * The one typed schema for camera data. The app reads camera specs from
 * `hikvision-cameras.json` and nowhere else, and that file is validated against
 * this schema at startup — a bad entry fails loudly rather than rendering a wrong
 * number in front of a client.
 *
 * Rules this schema enforces, because the whole tool rests on them:
 *   - every model carries `datasheetUrl` and `verifiedOn`;
 *   - any field that could not be read off the datasheet is `null`, never a guess;
 *   - `priceTier` is explicitly editorial and flagged as such in the UI.
 *
 * NVRs, switches and drives live in sibling files against their own schemas;
 * the provenance rules they all share are defined once in `shared.ts`.
 */

import { z } from 'zod';
import {
  poeStandardSchema,
  priceTierSchema,
  nullableNumber,
  nullablePositive,
} from './shared.ts';

// Re-exported so existing imports from './schema.ts' keep working.
export { poeStandardSchema, priceTierSchema };
export type { PriceTier } from './shared.ts';

export const formFactorSchema = z.enum([
  'bullet',
  'mini-bullet',
  'dome',
  'turret',
  'ptz',
  'panoramic',
  'fisheye',
  'multi-sensor',
]);
export type FormFactor = z.infer<typeof formFactorSchema>;

export const shapeSchema = z.enum(['cylindrical', 'hemispherical', 'cube', 'box', 'spherical']);

export const enclosureMaterialSchema = z.enum([
  'metal-aluminium-alloy',
  'polymer',
  'metal-and-plastic',
  'stainless-steel',
]);

export const indoorOutdoorSchema = z.enum(['indoor', 'outdoor', 'indoor-outdoor']);

export const supplementLightSchema = z.enum(['ir', 'white', 'smart-hybrid', 'none']);

export const lensTypeSchema = z.enum(['fixed', 'varifocal', 'motorised-varifocal', 'ptz-zoom']);
export type LensType = z.infer<typeof lensTypeSchema>;

/** Capabilities the recommendation engine filters and scores on. */
export const capabilitySchema = z.enum([
  'acusense',
  'colorvu',
  'darkfighter',
  'smart-hybrid-light',
  'line-crossing',
  'intrusion-detection',
  'region-entrance-exit',
  'people-counting',
  'anpr',
  'face-capture',
  'strobe-light',
  'audible-warning',
  'two-way-audio',
  'built-in-mic',
  'built-in-speaker',
  'smart-supplement-light',
  'true-wdr',
  'alarm-io',
  'audio-io',
  'microsd',
  'motorised-zoom',
  'ptz-control',
  'heater',
  'deep-learning-vca',
]);
export type Capability = z.infer<typeof capabilitySchema>;

/**
 * One selectable lens on a model. A fixed-lens camera sold in 2.8/4/6 mm is three
 * entries; a motorised varifocal is one entry whose min and max differ.
 */
export const lensOptionSchema = z
  .object({
    label: z.string().min(1),
    focalLengthMinMm: z.number().positive(),
    focalLengthMaxMm: z.number().positive(),
    /** Horizontal FOV at the WIDEST focal length (i.e. at focalLengthMinMm). */
    horizontalFovWideDeg: nullablePositive,
    /** Horizontal FOV at the LONGEST focal length. Equals wide for a fixed lens. */
    horizontalFovTeleDeg: nullablePositive,
    verticalFovWideDeg: nullablePositive,
    apertureFNumber: nullablePositive,
  })
  .strict()
  .refine((l) => l.focalLengthMaxMm >= l.focalLengthMinMm, {
    message: 'focalLengthMaxMm must be >= focalLengthMinMm',
  })
  .refine(
    (l) =>
      l.horizontalFovWideDeg === null ||
      l.horizontalFovTeleDeg === null ||
      l.horizontalFovWideDeg >= l.horizontalFovTeleDeg,
    { message: 'horizontalFovWideDeg must be >= horizontalFovTeleDeg (wide angle is the larger)' },
  );
export type LensOption = z.infer<typeof lensOptionSchema>;

export const doriDistancesSchema = z
  .object({
    detectMetres: nullablePositive,
    observeMetres: nullablePositive,
    recogniseMetres: nullablePositive,
    identifyMetres: nullablePositive,
  })
  .strict();

export const cameraSchema = z
  .object({
    /** Stable key used in URLs and phase-2 bills of materials. */
    id: z.string().regex(/^[a-z0-9-]+$/, 'id must be lowercase kebab-case'),
    model: z.string().min(1),
    marketingName: z.string().min(1),
    series: z.string().min(1),

    datasheetUrl: z.string().url(),
    /** ISO date on which a human read this entry off the datasheet above. */
    verifiedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'verifiedOn must be YYYY-MM-DD'),

    // --- Imaging -----------------------------------------------------------
    /** Optical format exactly as the datasheet prints it, e.g. `1/2.8"`. */
    sensorFormat: z.string().min(1).nullable(),
    sensorMegapixels: nullablePositive,
    sensorDescription: z.string().min(1).nullable(),
    maxResolutionWidthPx: z.number().int().positive(),
    maxResolutionHeightPx: z.number().int().positive(),
    /** Snapshot/still resolution where the datasheet states one separately. */
    stillResolution: z.string().min(1).nullable(),

    // --- Optics ------------------------------------------------------------
    lensType: lensTypeSchema,
    lensOptions: z.array(lensOptionSchema).min(1),
    opticalZoom: nullablePositive,

    // --- Light -------------------------------------------------------------
    supplementLight: supplementLightSchema,
    irRangeMetres: nullablePositive,
    whiteLightRangeMetres: nullablePositive,
    minIlluminationColourLux: nullableNumber,
    minIlluminationBwLux: nullableNumber,
    wdrDb: nullablePositive,

    // --- Environment -------------------------------------------------------
    indoorOutdoor: indoorOutdoorSchema,
    ipRating: z
      .string()
      .regex(/^IP\d{2}[KX]?$/, 'ipRating must look like IP67')
      .nullable(),
    ikRating: z
      .string()
      .regex(/^IK\d{2}$/, 'ikRating must look like IK10')
      .nullable(),
    operatingTempMinC: nullableNumber,
    operatingTempMaxC: nullableNumber,

    // --- Physical ----------------------------------------------------------
    formFactor: formFactorSchema,
    shape: shapeSchema,
    enclosureMaterial: enclosureMaterialSchema.nullable(),
    colour: z.string().min(1).nullable(),
    mountTypes: z.array(z.string().min(1)).min(1),
    /** Bracket model where one is required and the datasheet names it. */
    requiredBracket: z.string().min(1).nullable(),
    dimensions: z.string().min(1).nullable(),
    weightGrams: nullablePositive,

    // --- Interfaces --------------------------------------------------------
    audioInputs: z.number().int().min(0).nullable(),
    audioOutputs: z.number().int().min(0).nullable(),
    alarmInputs: z.number().int().min(0).nullable(),
    alarmOutputs: z.number().int().min(0).nullable(),
    microSdMaxGb: nullablePositive,
    compression: z.array(z.string().min(1)).min(1),
    onvifProfiles: z.array(z.string().min(1)),
    /** Hikvision/third-party software the datasheet lists under "Client". */
    clients: z.array(z.string().min(1)),

    // --- Capability tags (drive filtering, scoring and the card) -----------
    capabilities: z.array(capabilitySchema),
    /** Standout features, in the words the card should show them. */
    headlineFeatures: z.array(z.string().min(1)).min(1),

    // --- Power -------------------------------------------------------------
    poeStandard: poeStandardSchema,
    poeMaxWatts: nullablePositive,
    dcPowerMaxWatts: nullablePositive,

    // --- Published DORI distances (cross-check for our own geometry) -------
    doriAtWidestLens: doriDistancesSchema.nullable(),

    // --- Editorial (NOT from the datasheet) --------------------------------
    /**
     * Indicative budget band. Assigned from series positioning, not from price
     * data — there is no public Hikvision price list. Shown with a caveat.
     */
    priceTier: priceTierSchema,
    /** Anything a reader of the card should know. Free text, shown verbatim. */
    notes: z.string().nullable(),
  })
  .strict()
  .refine(
    (c) =>
      c.supplementLight === 'none' ||
      c.irRangeMetres !== null ||
      c.whiteLightRangeMetres !== null,
    { message: 'A model with a supplement light must publish at least one light range' },
  )
  .refine((c) => c.indoorOutdoor === 'indoor' || c.ipRating !== null, {
    message: 'An outdoor-rated model must carry an IP rating',
  });

export type Camera = z.infer<typeof cameraSchema>;

export const cameraDatasetSchema = z
  .object({
    /** Bumped whenever the shape of an entry changes, so a stale file is caught. */
    schemaVersion: z.literal(1),
    /** Date the dataset as a whole was last reviewed. */
    datasetVerifiedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    source: z.string().min(1),
    cameras: z.array(cameraSchema).min(1),
  })
  .strict()
  .superRefine((data, ctx) => {
    const seen = new Set<string>();
    for (const [i, cam] of data.cameras.entries()) {
      if (seen.has(cam.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['cameras', i, 'id'],
          message: `Duplicate camera id "${cam.id}"`,
        });
      }
      seen.add(cam.id);
    }
  });

export type CameraDataset = z.infer<typeof cameraDatasetSchema>;
