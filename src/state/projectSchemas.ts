/**
 * Validation schemas for everything a project carries, shared by the two
 * boundaries that read a project from outside: the shareable URL and the saved
 * project file. Both are untrusted input.
 */

import { z } from 'zod';
import { capabilitySchema } from '../data/schema.ts';
import { nvrAnalyticsSchema, videoOutputResolutionSchema } from '../data/productSchemas.ts';
import { DEFAULT_DESIGN_SETTINGS } from '../domain/designSettings.ts';
import { siteLayoutSchema } from '../domain/layoutShapes.ts';

const purposeSchema = z.enum(['monitor', 'detect', 'observe', 'recognise', 'identify', 'lpr', 'till']);

const geometrySchema = z
  .object({
    mountHeightMetres: z.number().finite().positive().max(200),
    targetDistanceMetres: z.number().finite().positive().max(2000),
    nearestDistanceMetres: z.number().finite().positive().max(2000).nullable(),
    widthSource: z.enum(['width', 'room']),
    sceneWidthMetres: z.number().finite().positive().max(2000),
    roomLengthMetres: z.number().finite().positive().max(2000),
    roomWidthMetres: z.number().finite().positive().max(2000),
    targetHeightMetres: z.number().finite().min(0).max(10),
    overlapAllowance: z.number().finite().min(0).max(0.9),
  })
  .strict();

const environmentSchema = z
  .object({
    site: z.enum(['indoor', 'outdoor', 'semi-covered']),
    mountSurface: z.enum(['wall', 'ceiling', 'pole', 'corner', 'recessed', 'pendant']),
    vandalExposure: z.boolean(),
    ambientLight: z.enum(['well-lit-24-7', 'low-light', 'zero-lux']),
    colourAtNight: z.boolean(),
    strongBacklight: z.boolean(),
    specialConditions: z.array(z.enum(['dust', 'washdown', 'corrosive-marine', 'extreme-cold'])),
  })
  .strict();

const requirementsSchema = z
  .object({
    audioRequired: z.boolean(),
    twoWayAudioRequired: z.boolean(),
    // Phase 1 accepted any string here and cast it; an unknown capability would
    // then reach the engine. Now validated against the real enum.
    requiredCapabilities: z.array(capabilitySchema),
    budgetTier: z.enum(['economy', 'standard', 'premium', 'any']),
    retentionDays: z.number().int().positive().max(3650),
    motionLevel: z.enum(['low', 'moderate', 'high']),
    lensPreference: z.enum(['any', 'fixed', 'varifocal']),
    ptzAcceptable: z.boolean(),
    cameraCount: z.number().int().positive().max(1000),
    codec: z.enum(['h264', 'h264plus', 'h265', 'h265plus']),
    fps: z.union([z.literal(30), z.literal(25), z.literal(20), z.literal(15), z.literal(12.5), z.literal(10)]),
  })
  .strict();

export const locationSchema = z
  .object({
    id: z.string().min(1).max(64),
    name: z.string().min(1).max(120),
    purpose: purposeSchema,
    geometry: geometrySchema,
    environment: environmentSchema,
    requirements: requirementsSchema,
  })
  .strict();

const pct = (max: number) => z.number().finite().min(0).max(max);

export const designSettingsSchema = z
  .object({
    storage: z
      .object({
        schedule: z
          .object({
            mode: z.enum(['continuous', 'motion-only', 'scheduled']),
            motionDutyPercent: z.number().finite().gt(0).max(100),
            scheduledHoursPerDay: z.number().finite().gt(0).max(24),
          })
          .strict(),
        raidLevel: z.enum(['none', '1', '5', '6', '10']),
        hotSpare: z.boolean(),
        headroomPercent: pct(500),
        formattingOverheadPercent: pct(49),
      })
      .strict(),
    recorder: z
      .object({
        channelHeadroomPercent: pct(500),
        monitors: z.number().int().min(0).max(16),
        outputResolution: videoOutputResolutionSchema,
        formFactor: z.enum(['any', 'desktop', 'rack', '1U', '1.5U', '2U']),
        redundantPsu: z.boolean(),
        poeMode: z.enum(['auto', 'built-in', 'external']),
        analytics: z.array(nvrAnalyticsSchema).nullable(),
        pinnedNvrId: z.string().min(1).max(64).nullable(),
      })
      .strict(),
    switches: z
      .object({
        poeHeadroomPercent: pct(500),
        management: z.enum(['auto', 'unmanaged', 'managed']),
        uplink: z.enum(['auto', 'copper', 'sfp']),
        sparePortsPercent: pct(500),
      })
      .strict(),
    cabling: z
      .object({
        rackDropMetres: z.number().finite().min(0).max(50),
        serviceLoopMetres: z.number().finite().min(0).max(50),
        wastePercent: pct(100),
        boxMetres: z.number().finite().positive().max(10_000),
        connectorsPerRun: z.number().int().min(0).max(10),
        patchCordsPerRun: z.number().int().min(0).max(10),
        routingFactor: z.number().finite().min(1).max(5),
        unplacedRunMetres: z.number().finite().positive().max(1000),
      })
      .strict(),
  })
  .strict();

/** Accept a missing settings block (a phase-1 link or file) and fill defaults. */
export const settingsOrDefault = designSettingsSchema.optional().transform((s) => s ?? DEFAULT_DESIGN_SETTINGS);

const coord = z.number().finite().min(-1e6).max(1e6);
const pointSchema = z.object({ x: coord, y: coord }).strict();

/** Max embedded image: 30 MB of base64. A bigger plan should be downscaled first. */
export const MAX_IMAGE_DATA_URI_LENGTH = 30_000_000;

const planImageSchema = z
  .object({
    dataUri: z
      .string()
      .max(MAX_IMAGE_DATA_URI_LENGTH, 'The embedded plan image is larger than 30 MB')
      .regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/, 'The plan image must be a base64 PNG or JPEG data URI'),
    widthPx: z.number().int().positive().max(40_000),
    heightPx: z.number().int().positive().max(40_000),
    fileName: z.string().max(260),
  })
  .strict();

const idSchema = z.string().min(1).max(64);

/** An engineer-typed run length, metres. Absent in older files → null (use the plan). */
const runOverrideSchema = z.number().finite().min(0).max(10_000).nullable().default(null);

const placedDeviceSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('camera'),
      id: idSchema,
      locationId: idSchema,
      index: z.number().int().positive().max(1000),
      x: coord,
      y: coord,
      rotationDeg: z.number().finite(),
      connectTo: idSchema.nullable(),
      runMetresOverride: runOverrideSchema,
    })
    .strict(),
  z.object({ kind: z.literal('nvr'), id: idSchema, label: z.string().max(80), x: coord, y: coord }).strict(),
  z
    .object({ kind: z.literal('switch'), id: idSchema, label: z.string().max(80), x: coord, y: coord, runMetresOverride: runOverrideSchema })
    .strict(),
]);

export const sitePlanSchema = z
  .object({
    image: planImageSchema.nullable(),
    calibration: z.object({ a: pointSchema, b: pointSchema, metres: z.number().finite().positive().max(100_000) }).strict().nullable(),
    devices: z.array(placedDeviceSchema).max(2000),
    routes: z
      .array(z.object({ id: idSchema, fromId: idSchema, toId: idSchema, waypoints: z.array(pointSchema).max(500) }).strict())
      .max(2000),
    // Drawn layout (rooms, walls, doors, labels, blank canvas). Optional: files
    // saved before drawing existed have none, and a plan with nothing drawn is
    // saved without it, so such files stay byte-identical (ASSUMPTIONS 13.2).
    layout: siteLayoutSchema.optional(),
  })
  .strict()
  .superRefine((plan, ctx) => {
    const ids = new Set<string>();
    plan.devices.forEach((d, i) => {
      if (ids.has(d.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['devices', i, 'id'], message: `Duplicate device id "${d.id}"` });
      ids.add(d.id);
    });
    plan.routes.forEach((r, i) => {
      if (!ids.has(r.fromId) || !ids.has(r.toId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['routes', i], message: 'Route refers to a device that does not exist' });
      }
    });
    plan.devices.forEach((d, i) => {
      if (d.kind === 'camera' && d.connectTo !== null && !ids.has(d.connectTo)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['devices', i, 'connectTo'], message: 'Camera is connected to a device that does not exist' });
      }
    });
  });
