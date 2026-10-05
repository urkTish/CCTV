/**
 * Schemas for the phase-2 product categories: recorders, PoE switches and hard
 * drives. Each category lives in its own JSON file, validated against the schema
 * here at load time. Provenance (datasheet URL, verified date, editorial price
 * band) comes from `shared.ts` so every category obeys the same rules.
 */

import { z } from 'zod';
import {
  provenanceShape,
  poeStandardSchema,
  nullablePositive,
  nullableNumber,
  nullableNonNegativeInt,
  datasetSchema,
} from './shared.ts';

// ---------------------------------------------------------------------------
// NVR
// ---------------------------------------------------------------------------

export const raidLevelSchema = z.enum(['0', '1', '5', '6', '10']);
export type RaidLevelId = z.infer<typeof raidLevelSchema>;

/** Analytics the RECORDER performs or supports, as its datasheet states them. */
export const nvrAnalyticsSchema = z.enum([
  'motion-detection-2',
  'perimeter-protection',
  'face-recognition',
  'anpr',
  'people-counting',
  'acuseek',
]);
export type NvrAnalytic = z.infer<typeof nvrAnalyticsSchema>;

export const nvrFormFactorSchema = z.enum(['desktop', '1U', '1.5U', '2U', '3U']);
export type NvrFormFactor = z.infer<typeof nvrFormFactorSchema>;

export const videoOutputResolutionSchema = z.enum(['1080p', '4K', '8K']);
export type VideoOutputResolution = z.infer<typeof videoOutputResolutionSchema>;

export const nvrSchema = z
  .object({
    ...provenanceShape,
    series: z.string().min(1),

    channels: z.number().int().positive(),
    incomingBandwidthMbps: z.number().positive(),
    outgoingBandwidthMbps: nullablePositive,
    /** Highest resolution the datasheet lists under "Recording Resolution", MP. */
    maxRecordingResolutionMp: z.number().positive(),
    /** Live-view decode capacity in the datasheet's own words. */
    decodingCapability: z.string().min(1).nullable(),

    sataBays: z.number().int().min(0),
    maxHddCapacityTb: z.number().positive(),
    esata: z.boolean(),
    raidLevels: z.array(raidLevelSchema),
    hotSpare: z.boolean(),

    poePorts: z.number().int().min(0),
    poeBudgetWatts: nullablePositive,
    poeStandards: z.array(poeStandardSchema),

    networkInterfaces: z.number().int().positive(),
    networkSpeedMbps: z.union([z.literal(100), z.literal(1000)]),

    hdmiOutputs: z.number().int().min(0),
    maxHdmiResolution: videoOutputResolutionSchema.nullable(),
    vgaOutputs: z.number().int().min(0),

    analytics: z.array(nvrAnalyticsSchema),

    formFactor: nvrFormFactorSchema,
    /** True only when the chassis is 19-inch rack width (about 440 mm). */
    rackWidth19in: z.boolean(),
    redundantPsu: z.boolean(),

    alarmInputs: nullableNonNegativeInt,
    alarmOutputs: nullableNonNegativeInt,
    onvif: z.string().min(1).nullable(),
    powerSupply: z.string().min(1).nullable(),
    consumptionWattsWithoutHdd: nullablePositive,
    dimensions: z.string().min(1).nullable(),
    weightKg: nullablePositive,
    operatingTempMinC: nullableNumber,
    operatingTempMaxC: nullableNumber,
  })
  .strict()
  .refine((n) => n.poePorts === 0 || n.poeBudgetWatts !== null, {
    message: 'A PoE NVR must publish its PoE power budget',
  })
  .refine((n) => n.poePorts === 0 || n.poeStandards.length > 0, {
    message: 'A PoE NVR must name its PoE standard(s)',
  })
  .refine((n) => !n.hotSpare || n.raidLevels.length > 0, {
    message: 'Hot spare requires RAID support',
  });

export type Nvr = z.infer<typeof nvrSchema>;
export const nvrDatasetSchema = datasetSchema(nvrSchema);

// ---------------------------------------------------------------------------
// PoE switch
// ---------------------------------------------------------------------------

export const switchManagementSchema = z.enum(['unmanaged', 'smart-managed']);
export type SwitchManagement = z.infer<typeof switchManagementSchema>;

export const switchInstallSchema = z.enum(['desk', 'wall', 'rack']);

export const poeSwitchSchema = z
  .object({
    ...provenanceShape,
    management: switchManagementSchema,

    poePorts: z.number().int().positive(),
    poePortSpeedMbps: z.union([z.literal(100), z.literal(1000)]),
    /** Ports that can deliver 802.3bt (Hikvision calls these Hi-PoE). */
    hiPoePorts: z.number().int().min(0),
    maxPortPowerWatts: z.number().positive(),
    hiPoeMaxPortPowerWatts: nullablePositive,
    poeBudgetWatts: z.number().positive(),
    poeStandards: z.array(poeStandardSchema).min(1),

    uplinkCopperPorts: z.number().int().min(0),
    uplinkSfpPorts: z.number().int().min(0),
    /** Combo ports: either copper or SFP, one at a time. */
    uplinkComboPorts: z.number().int().min(0),
    uplinkSpeedMbps: z.union([z.literal(100), z.literal(1000), z.literal(10000)]),

    /** How many PoE ports support long-range ("extend") mode. 0 = none. */
    longRangePorts: z.number().int().min(0),
    longRangeMaxMetres: nullablePositive,
    /** Link speed in extend mode, where THIS model's documentation states it. */
    longRangeSpeedMbps: nullablePositive,

    switchingCapacityGbps: nullablePositive,
    maxPowerConsumptionWatts: nullablePositive,
    powerSupply: z.string().min(1).nullable(),
    /** Empty when the datasheet does not state an installation mode. */
    installation: z.array(switchInstallSchema),
    rackWidth19in: z.boolean(),
    surgeProtectionKv: nullablePositive,
    poeWatchdog: z.boolean(),
    dimensions: z.string().min(1).nullable(),
    weightKg: nullablePositive,
  })
  .strict()
  .refine((s) => s.uplinkCopperPorts + s.uplinkSfpPorts + s.uplinkComboPorts > 0, {
    message: 'A switch must have at least one uplink',
  })
  .refine((s) => s.longRangePorts <= s.poePorts, {
    message: 'longRangePorts cannot exceed poePorts',
  })
  .refine((s) => s.longRangePorts === 0 || s.longRangeMaxMetres !== null, {
    message: 'A long-range switch must publish its maximum reach',
  });

export type PoeSwitch = z.infer<typeof poeSwitchSchema>;
export const switchDatasetSchema = datasetSchema(poeSwitchSchema);

// ---------------------------------------------------------------------------
// Hard drive
// ---------------------------------------------------------------------------

export const hddSchema = z
  .object({
    ...provenanceShape,
    manufacturer: z.enum(['Seagate', 'Western Digital', 'Hikvision']),
    line: z.string().min(1),
    /** Decimal terabytes, as the manufacturer sells it. */
    capacityTb: z.number().positive(),
    recordingTechnology: z.enum(['CMR', 'SMR']).nullable(),
    rpm: nullablePositive,
    cacheMb: nullablePositive,
    workloadTbPerYear: nullablePositive,
    mtbfHours: nullablePositive,
    /** Max drive bays the manufacturer rates the drive for; null if not stated. */
    maxBaysSupported: nullablePositive,
    averageOperatingPowerWatts: nullablePositive,
    warrantyYears: nullablePositive,
    /**
     * Whether this exact part number appears on Hikvision's own "HDD Compatible
     * List for Hikvision DVR/NVR". null = not checked.
     */
    onHikvisionCompatList: z.boolean().nullable(),
  })
  .strict();

export type Hdd = z.infer<typeof hddSchema>;
export const hddDatasetSchema = datasetSchema(hddSchema);

export const HIKVISION_HDD_COMPAT_LIST_URL =
  'https://www.hikvision.com/content/dam/hikvision/en/support/notice/HDD-Compatible-List-for-Hikvision-DVR-NVR_20240718.pdf';
export const HIKVISION_HDD_COMPAT_LIST_VERSION = 'v20240718';
