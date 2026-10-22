/**
 * Camera finder: start from a recorder the client already owns and a short list
 * of requirements (resolution, lens, form factor, placement), and get the
 * catalogue cameras that work with it.
 *
 * Same shape as the other engines: every camera is checked, every check carries
 * a verdict and a reason in the engineer's words, and when nothing passes the
 * result names the nearest cameras and what each one misses rather than
 * returning an empty list.
 *
 * Checks, in two groups:
 *   - Recorder compatibility: the NVR records the camera's resolution, has the
 *     channels and incoming bandwidth for the quantity asked, and (when the
 *     cameras are to be powered from the NVR) the PoE ports, class and budget.
 *   - Requirements: minimum megapixels, a lens that offers the focal length
 *     asked for, form factor, indoor / outdoor.
 *
 * Pure: no React, no clock.
 */

import { cameras as catalogue } from '../data/cameras.ts';
import { nvrById, type Nvr } from '../data/products.ts';
import type { Camera, FormFactor, LensOption } from '../data/schema.ts';
import { bitrateFor } from '../domain/bitrate.ts';
import { poeStandard, type PoeStandard } from '../domain/power.ts';

export type Placement = 'any' | 'indoor' | 'outdoor';

export interface CameraFinderRequest {
  readonly nvrId: string;
  /** Minimum sensor resolution in megapixels, or null for no minimum. */
  readonly minMegapixels: number | null;
  /** Focal length the camera must offer, mm, or null for any lens. */
  readonly focalLengthMm: number | null;
  readonly formFactor: FormFactor | 'any';
  readonly placement: Placement;
  /** How many of the chosen camera will go on this recorder. */
  readonly quantity: number;
  /** Power the cameras from the recorder's own PoE ports. */
  readonly poeFromNvr: boolean;
}

export type FinderCheckId =
  | 'recorder-resolution'
  | 'channels'
  | 'bandwidth'
  | 'poe-ports'
  | 'poe-class'
  | 'poe-budget'
  | 'megapixels'
  | 'lens'
  | 'form-factor'
  | 'placement';

export interface FinderCheck {
  readonly id: FinderCheckId;
  readonly label: string;
  readonly pass: boolean;
  readonly detail: string;
}

export interface CameraMatch {
  readonly camera: Camera;
  readonly megapixels: number;
  /** The lens option that meets the focal length asked for (or the first one when none was asked). */
  readonly lens: LensOption;
  readonly checks: readonly FinderCheck[];
  readonly failed: readonly FinderCheck[];
  /** Peak bitrate per camera used for the bandwidth check, Kbps (H.265, 25 fps, moderate motion). */
  readonly peakKbps: number;
}

export interface CameraFinderResult {
  readonly nvr: Nvr;
  /** Cameras that pass every check, best fit first. */
  readonly matches: readonly CameraMatch[];
  /** Only when `matches` is empty: the closest cameras and what each misses. */
  readonly nearMisses: readonly CameraMatch[];
  /** Every camera that failed a check, with its reasons. */
  readonly rejected: readonly CameraMatch[];
  /** Plain-language notes about the request itself (e.g. asking for more than the recorder records). */
  readonly notices: readonly string[];
}

export class CameraFinderError extends Error {}

/** Tolerance when matching a fixed lens: 4 mm asked accepts a 4 mm lens, not 2.8 or 6. */
const FIXED_LENS_TOLERANCE_MM = 0.25;
const MAX_NEAR_MISSES = 5;

const POE_RANK: Readonly<Record<PoeStandard, number>> = {
  none: 0,
  '802.3af': 1,
  '802.3at': 2,
  '802.3bt-type3': 3,
  '802.3bt-type4': 4,
};

const PLACEMENT_LABEL = { indoor: 'indoor', outdoor: 'outdoor', 'indoor-outdoor': 'indoor and outdoor' } as const;
const TIER_ORDER = { economy: 0, standard: 1, premium: 2 } as const;

export function cameraMegapixels(camera: Camera): number {
  return camera.sensorMegapixels ?? Math.round((camera.maxResolutionWidthPx * camera.maxResolutionHeightPx) / 1e5) / 10;
}

/** The lens option that offers `mm`, or null. A fixed lens must match; a varifocal must span it. */
export function lensFor(camera: Camera, mm: number): LensOption | null {
  return (
    camera.lensOptions.find((l) =>
      l.focalLengthMinMm === l.focalLengthMaxMm
        ? Math.abs(l.focalLengthMinMm - mm) <= FIXED_LENS_TOLERANCE_MM
        : l.focalLengthMinMm <= mm && mm <= l.focalLengthMaxMm,
    ) ?? null
  );
}

function lensSummary(camera: Camera): string {
  return camera.lensOptions.map((l) => l.label).join(', ');
}

export function evaluateCamera(camera: Camera, nvr: Nvr, req: CameraFinderRequest): CameraMatch {
  const mp = cameraMegapixels(camera);
  const checks: FinderCheck[] = [];

  // --- Recorder compatibility -------------------------------------------
  checks.push({
    id: 'recorder-resolution',
    label: 'Recorder records this resolution',
    pass: mp <= nvr.maxRecordingResolutionMp,
    detail:
      mp <= nvr.maxRecordingResolutionMp
        ? `${mp} MP camera; ${nvr.model} records up to ${nvr.maxRecordingResolutionMp} MP`
        : `${mp} MP camera, but ${nvr.model} records only up to ${nvr.maxRecordingResolutionMp} MP`,
  });

  checks.push({
    id: 'channels',
    label: 'Channels',
    pass: req.quantity <= nvr.channels,
    detail: `${req.quantity} camera${req.quantity === 1 ? '' : 's'} on a ${nvr.channels}-channel recorder`,
  });

  const peakKbps = bitrateFor(camera.maxResolutionWidthPx, camera.maxResolutionHeightPx, 'h265', 25, 'moderate').peakKbps;
  const totalMbps = (peakKbps * req.quantity) / 1000;
  checks.push({
    id: 'bandwidth',
    label: 'Incoming bandwidth',
    pass: totalMbps <= nvr.incomingBandwidthMbps,
    detail: `${totalMbps.toFixed(1)} Mbps peak (H.265, 25 fps) against ${nvr.incomingBandwidthMbps} Mbps incoming`,
  });

  if (req.poeFromNvr) {
    if (nvr.poePorts === 0) {
      checks.push({ id: 'poe-ports', label: 'Built-in PoE ports', pass: false, detail: `${nvr.model} has no PoE ports; use an external PoE switch` });
    } else {
      checks.push({
        id: 'poe-ports',
        label: 'Built-in PoE ports',
        pass: req.quantity <= nvr.poePorts,
        detail: `${req.quantity} needed, ${nvr.poePorts} on the recorder`,
      });
      const maxPort = nvr.poeStandards.reduce((m, s) => Math.max(m, POE_RANK[s]), 0);
      const camRank = POE_RANK[camera.poeStandard];
      checks.push({
        id: 'poe-class',
        label: 'PoE class',
        pass: camRank <= maxPort,
        detail:
          camera.poeStandard === 'none'
            ? 'Camera is not PoE powered'
            : `Camera needs ${poeStandard(camera.poeStandard).label}; ports give ${nvr.poeStandards.join(', ') || 'no PoE'}`,
      });
      const perCamera = camera.poeMaxWatts ?? poeStandard(camera.poeStandard).maxPdWatts;
      const load = perCamera * req.quantity;
      const budget = nvr.poeBudgetWatts ?? 0;
      checks.push({
        id: 'poe-budget',
        label: 'PoE budget',
        pass: load <= budget,
        detail: `${load.toFixed(1)} W${camera.poeMaxWatts === null ? ' (class maximum; datasheet draw not stated)' : ''} against ${budget} W`,
      });
    }
  }

  // --- Requirements --------------------------------------------------------
  if (req.minMegapixels !== null) {
    checks.push({
      id: 'megapixels',
      label: 'Resolution',
      pass: mp >= req.minMegapixels,
      detail: `${mp} MP, ${req.minMegapixels} MP asked`,
    });
  }

  let lens = camera.lensOptions[0] as LensOption;
  if (req.focalLengthMm !== null) {
    const match = lensFor(camera, req.focalLengthMm);
    if (match) lens = match;
    checks.push({
      id: 'lens',
      label: 'Lens',
      pass: match !== null,
      detail: match ? `${match.label} offers ${req.focalLengthMm} mm` : `${req.focalLengthMm} mm asked; sold with ${lensSummary(camera)}`,
    });
  }

  if (req.formFactor !== 'any') {
    checks.push({
      id: 'form-factor',
      label: 'Form factor',
      pass: camera.formFactor === req.formFactor,
      detail: `${camera.formFactor}, ${req.formFactor} asked`,
    });
  }

  if (req.placement !== 'any') {
    checks.push({
      id: 'placement',
      label: 'Indoor / outdoor',
      pass: camera.indoorOutdoor === req.placement || camera.indoorOutdoor === 'indoor-outdoor',
      detail: `Rated ${PLACEMENT_LABEL[camera.indoorOutdoor]}, ${req.placement} asked`,
    });
  }

  return { camera, megapixels: mp, lens, checks, failed: checks.filter((c) => !c.pass), peakKbps };
}

/** Lower is a better fit: closest resolution to the one asked, an exact fixed lens, then the cheaper tier. */
function fitKey(m: CameraMatch, req: CameraFinderRequest): number[] {
  const mpGap = req.minMegapixels === null ? 0 : Math.abs(m.megapixels - req.minMegapixels);
  const varifocal = m.lens.focalLengthMinMm === m.lens.focalLengthMaxMm ? 0 : 1;
  return [m.failed.length, mpGap, varifocal, TIER_ORDER[m.camera.priceTier]];
}

function byKey(req: CameraFinderRequest) {
  return (a: CameraMatch, b: CameraMatch) => {
    const ka = fitKey(a, req);
    const kb = fitKey(b, req);
    for (let i = 0; i < ka.length; i++) {
      const d = (ka[i] ?? 0) - (kb[i] ?? 0);
      if (d !== 0) return d;
    }
    return a.camera.model.localeCompare(b.camera.model);
  };
}

export function findCamerasForNvr(req: CameraFinderRequest, pool: readonly Camera[] = catalogue): CameraFinderResult {
  const nvr = nvrById(req.nvrId);
  if (!nvr) throw new CameraFinderError(`Unknown recorder: ${req.nvrId}`);
  if (!Number.isInteger(req.quantity) || req.quantity < 1) throw new CameraFinderError('Quantity must be a whole number of at least 1');
  if (req.minMegapixels !== null && !(req.minMegapixels > 0)) throw new CameraFinderError('Resolution must be more than 0 MP');
  if (req.focalLengthMm !== null && !(req.focalLengthMm > 0)) throw new CameraFinderError('Focal length must be more than 0 mm');

  const notices: string[] = [];
  if (req.minMegapixels !== null && req.minMegapixels > nvr.maxRecordingResolutionMp) {
    notices.push(
      `${nvr.model} records up to ${nvr.maxRecordingResolutionMp} MP, so a ${req.minMegapixels} MP camera would not be recorded at full resolution on it.`,
    );
  }
  const catalogueMax = pool.reduce((m, c) => Math.max(m, cameraMegapixels(c)), 0);
  if (req.minMegapixels !== null && req.minMegapixels > catalogueMax) {
    notices.push(`The catalogue's highest resolution is ${catalogueMax} MP; nothing at ${req.minMegapixels} MP is listed yet.`);
  }
  if (req.quantity > nvr.channels) {
    notices.push(`${nvr.model} has ${nvr.channels} channels, fewer than the ${req.quantity} cameras asked for.`);
  }

  const sort = byKey(req);
  const evaluated = pool.map((c) => evaluateCamera(c, nvr, req));
  const matches = evaluated.filter((m) => m.failed.length === 0).sort(sort);
  const rejected = evaluated.filter((m) => m.failed.length > 0).sort(sort);
  // A near miss must at least work with the recorder; otherwise it is not a real alternative.
  const compatible = rejected.filter((m) => !m.failed.some((f) => f.id === 'recorder-resolution'));
  const nearMisses = matches.length === 0 ? compatible.slice(0, MAX_NEAR_MISSES) : [];

  return { nvr, matches, nearMisses, rejected, notices };
}
