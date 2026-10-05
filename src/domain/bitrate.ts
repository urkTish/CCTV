/**
 * Per-camera bitrate, bandwidth and storage.
 *
 * ## Source
 *
 * The table below is Hikvision's own published recommendation,
 * "H.264(5) & H.264(5)+ Recommended Bit Rate at General Resolutions":
 *
 *   https://www.hikvision.com/content/dam/hikvision/ca/faq-document/H.2645-&-H.2645-Recommended-Bit-Rate-at-General-Resolutions.pdf
 *
 * Verified 2026-10-04. Figures are in Kbps and are reproduced exactly for the
 * resolutions the camera dataset actually uses. For the "+" codecs Hikvision
 * publishes both a max and a *target* bitrate; the target is the one that
 * determines storage over time, so that is the figure used here, and the max is
 * kept for peak-bandwidth sizing.
 *
 * The document's own Note 1 is the basis of the motion multipliers:
 *
 *   "If the real environment is more complex, you can increase the bit rate
 *    20%~30% higher than recommend."
 *
 * so a busy scene takes the +30% top of that band. The intermediate +15% step is
 * interpolated, not published, and is labelled as an estimate.
 *
 * ## Storage
 *
 * bytes/day = kbps x 1000 / 8 x 86400. Reported in decimal GB (10^9 bytes)
 * because that is how drives are sold and how NVR capacity is quoted; a 4 TB disk
 * is 4.0e12 bytes, not 4 TiB.
 *
 * Phase 2 (NVR sizing, RAID, HDD selection) consumes these numbers. They are
 * emitted now so nothing has to be recomputed later.
 */

export const BITRATE_SOURCE_URL =
  'https://www.hikvision.com/content/dam/hikvision/ca/faq-document/H.2645-&-H.2645-Recommended-Bit-Rate-at-General-Resolutions.pdf';

export type Codec = 'h264' | 'h264plus' | 'h265' | 'h265plus';
export type MotionLevel = 'low' | 'moderate' | 'high';

export const CODEC_LABELS: Readonly<Record<Codec, string>> = {
  h264: 'H.264',
  h264plus: 'H.264+',
  h265: 'H.265',
  h265plus: 'H.265+',
};

/** Frame rates the Hikvision table publishes columns for. */
export const SUPPORTED_FPS = [30, 25, 20, 15, 12.5, 10] as const;
export type SupportedFps = (typeof SUPPORTED_FPS)[number];

interface CodecRow {
  /** Kbps by fps, in SUPPORTED_FPS order. For "+" codecs this is the target bitrate. */
  readonly target: readonly [number, number, number, number, number, number];
  /** Kbps by fps for the peak/max column. Equal to `target` for non-"+" codecs. */
  readonly max: readonly [number, number, number, number, number, number];
}

/**
 * Keyed by "widthxheight" exactly as the camera dataset records max resolution.
 * Only the rows the dataset needs are transcribed; `bitrateFor` falls back to the
 * next larger row rather than inventing a figure, and says that it did.
 */
const TABLE: Readonly<Record<string, Readonly<Record<Codec, CodecRow>>>> = {
  // 1080P (1920 x 1080)
  '1920x1080': {
    h264: { target: [4096, 4096, 3072, 2048, 2048, 1536], max: [4096, 4096, 3072, 2048, 2048, 1536] },
    h264plus: { target: [2048, 2048, 1856, 1440, 1440, 1136], max: [4096, 4096, 3072, 2048, 2048, 1536] },
    h265: { target: [2048, 2048, 1536, 1024, 1024, 768], max: [2048, 2048, 1536, 1024, 1024, 768] },
    h265plus: { target: [1440, 1440, 1136, 832, 832, 648], max: [2048, 2048, 1536, 1024, 1024, 768] },
  },
  // 4 MP (2560 x 1440)
  '2560x1440': {
    h264: { target: [8192, 8192, 6144, 4096, 4096, 3072], max: [8192, 8192, 6144, 4096, 4096, 3072] },
    h264plus: { target: [4096, 4096, 3072, 2048, 2048, 1856], max: [8192, 8192, 6144, 4096, 4096, 3072] },
    h265: { target: [4096, 4096, 3072, 2048, 2048, 1536], max: [4096, 4096, 3072, 2048, 2048, 1536] },
    h265plus: { target: [2048, 2048, 1856, 1440, 1440, 1136], max: [4096, 4096, 3072, 2048, 2048, 1536] },
  },
  // 4 MP wide (2688 x 1520) — the resolution most Hikvision 4 MP cameras actually report
  '2688x1520': {
    h264: { target: [8192, 8192, 6144, 4096, 4096, 3072], max: [8192, 8192, 6144, 4096, 4096, 3072] },
    h264plus: { target: [4096, 4096, 3072, 2048, 2048, 1856], max: [8192, 8192, 6144, 4096, 4096, 3072] },
    h265: { target: [4096, 4096, 3072, 2048, 2048, 1536], max: [4096, 4096, 3072, 2048, 2048, 1536] },
    h265plus: { target: [2048, 2048, 1856, 1440, 1440, 1136], max: [4096, 4096, 3072, 2048, 2048, 1536] },
  },
  // 6 MP (3072 x 2048)
  '3072x2048': {
    h264: { target: [10240, 10240, 7680, 5120, 5120, 3840], max: [10240, 10240, 7680, 5120, 5120, 3840] },
    h264plus: { target: [5120, 5120, 3840, 2560, 2560, 2000], max: [10240, 10240, 7680, 5120, 5120, 3840] },
    h265: { target: [5120, 5120, 3840, 2560, 2560, 1920], max: [5120, 5120, 3840, 2560, 2560, 1920] },
    h265plus: { target: [2560, 2560, 2000, 1648, 1648, 1364], max: [5120, 5120, 3840, 2560, 2560, 1920] },
  },
  // 6 MP wide (3072 x 1728)
  '3072x1728': {
    h264: { target: [8192, 8192, 6144, 4096, 4096, 3072], max: [8192, 8192, 6144, 4096, 4096, 3072] },
    h264plus: { target: [4096, 4096, 3072, 2048, 2048, 1856], max: [8192, 8192, 6144, 4096, 4096, 3072] },
    h265: { target: [4096, 4096, 3072, 2048, 2048, 1536], max: [4096, 4096, 3072, 2048, 2048, 1536] },
    h265plus: { target: [2048, 2048, 1856, 1440, 1440, 1136], max: [4096, 4096, 3072, 2048, 2048, 1536] },
  },
  // 8 MP / 4K (3840 x 2160)
  '3840x2160': {
    h264: { target: [16384, 16384, 12288, 8192, 8192, 6144], max: [16384, 16384, 12288, 8192, 8192, 6144] },
    h264plus: { target: [8192, 8192, 6144, 4096, 4096, 3072], max: [16384, 16384, 12288, 8192, 8192, 6144] },
    h265: { target: [8192, 8192, 6144, 4096, 4096, 3072], max: [8192, 8192, 6144, 4096, 4096, 3072] },
    h265plus: { target: [4096, 4096, 3072, 2048, 2048, 1856], max: [8192, 8192, 6144, 4096, 4096, 3072] },
  },
  // 12 MP (4000 x 3000)
  '4000x3000': {
    h264: { target: [20480, 20480, 15360, 10240, 10240, 7680], max: [20480, 20480, 15360, 10240, 10240, 7680] },
    h264plus: { target: [10240, 10240, 7680, 5120, 5120, 3840], max: [20480, 20480, 15360, 10240, 10240, 7680] },
    h265: { target: [10240, 10240, 7680, 5120, 5120, 3840], max: [10240, 10240, 7680, 5120, 5120, 3840] },
    h265plus: { target: [5120, 5120, 3840, 2560, 2560, 2000], max: [10240, 10240, 7680, 5120, 5120, 3840] },
  },
};

/** Multipliers on the published figure. 1.30 is the top of Hikvision's own Note 1 band. */
const MOTION_MULTIPLIER: Readonly<Record<MotionLevel, { factor: number; isEstimate: boolean; note: string }>> = {
  low: {
    factor: 1,
    isEstimate: false,
    note: 'Quiet scene — Hikvision’s published figure as-is.',
  },
  moderate: {
    factor: 1.15,
    isEstimate: true,
    note: 'Interpolated inside Hikvision’s "20%~30% for more complex environments" guidance. Estimate.',
  },
  high: {
    factor: 1.3,
    isEstimate: false,
    note: 'Busy scene — top of Hikvision’s published +20%~30% allowance for complex environments.',
  },
};

export interface BitrateResult {
  readonly codec: Codec;
  readonly fps: SupportedFps;
  readonly motion: MotionLevel;
  /** Sustained bitrate used for storage, Kbps. */
  readonly targetKbps: number;
  /** Peak bitrate used for switch/NVR throughput headroom, Kbps. */
  readonly peakKbps: number;
  readonly storageGbPerDay: number;
  readonly storageGbPerDayPerCamera: number;
  /** True when any input had to be substituted or interpolated. */
  readonly isEstimate: boolean;
  readonly explanation: string;
  readonly resolutionKeyUsed: string;
}

function nearestResolutionKey(widthPx: number, heightPx: number): { key: string; exact: boolean } {
  const exactKey = `${widthPx}x${heightPx}`;
  if (exactKey in TABLE) return { key: exactKey, exact: true };

  // Fall back to the smallest published row that is at least as many pixels, so we
  // never under-estimate bandwidth. Never interpolate between rows.
  const pixels = widthPx * heightPx;
  const candidates = Object.keys(TABLE)
    .map((key) => {
      const [w, h] = key.split('x').map(Number);
      return { key, pixels: (w ?? 0) * (h ?? 0) };
    })
    .filter((c) => c.pixels >= pixels)
    .sort((a, b) => a.pixels - b.pixels);

  const chosen = candidates[0];
  if (chosen) return { key: chosen.key, exact: false };

  // Larger than anything published: use the largest row and flag it.
  const largest = Object.keys(TABLE)
    .map((key) => {
      const [w, h] = key.split('x').map(Number);
      return { key, pixels: (w ?? 0) * (h ?? 0) };
    })
    .sort((a, b) => b.pixels - a.pixels)[0];
  if (!largest) throw new Error('Bitrate table is empty');
  return { key: largest.key, exact: false };
}

export function bitrateFor(
  widthPx: number,
  heightPx: number,
  codec: Codec,
  fps: SupportedFps,
  motion: MotionLevel,
): BitrateResult {
  if (!Number.isInteger(widthPx) || widthPx <= 0 || !Number.isInteger(heightPx) || heightPx <= 0) {
    throw new RangeError(`Resolution must be positive integers, got ${widthPx}x${heightPx}`);
  }
  const fpsIndex = SUPPORTED_FPS.indexOf(fps);
  if (fpsIndex < 0) {
    throw new RangeError(
      `fps must be one of ${SUPPORTED_FPS.join(', ')} (the columns Hikvision publishes), got ${String(fps)}`,
    );
  }

  const { key, exact } = nearestResolutionKey(widthPx, heightPx);
  const row = TABLE[key]?.[codec];
  if (!row) throw new Error(`No published bitrate for ${key} / ${codec}`);

  const multiplier = MOTION_MULTIPLIER[motion];
  const baseTarget = row.target[fpsIndex] ?? 0;
  const basePeak = row.max[fpsIndex] ?? 0;
  const targetKbps = Math.round(baseTarget * multiplier.factor);
  const peakKbps = Math.round(basePeak * multiplier.factor);

  const storageGbPerDay = (targetKbps * 1000 * 86400) / 8 / 1e9;

  return {
    codec,
    fps,
    motion,
    targetKbps,
    peakKbps,
    storageGbPerDay,
    storageGbPerDayPerCamera: storageGbPerDay,
    isEstimate: !exact || multiplier.isEstimate,
    resolutionKeyUsed: key,
    explanation:
      `Hikvision published ${CODEC_LABELS[codec]} figure for ${key} at ${fps} fps: ${baseTarget} Kbps` +
      `${exact ? '' : ` (no row for ${widthPx}x${heightPx}; used the next larger published resolution)`}` +
      `, x${multiplier.factor} for ${motion} motion = ${targetKbps} Kbps. ` +
      `${targetKbps} Kbps x 86 400 s / 8 = ${storageGbPerDay.toFixed(1)} GB/day. ${multiplier.note}`,
  };
}

export function storageGbForRetention(storageGbPerDay: number, retentionDays: number): number {
  if (!Number.isFinite(storageGbPerDay) || storageGbPerDay <= 0) {
    throw new RangeError(`storageGbPerDay must be positive, got ${String(storageGbPerDay)}`);
  }
  if (!Number.isInteger(retentionDays) || retentionDays <= 0) {
    throw new RangeError(`retentionDays must be a positive integer, got ${String(retentionDays)}`);
  }
  return storageGbPerDay * retentionDays;
}
