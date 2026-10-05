/**
 * Image-sensor optical formats -> physical active-area dimensions.
 *
 * ## Why this table exists
 *
 * The "1/2.8 inch" style format name is a historical label inherited from vidicon
 * tube diameters. It is **not** the sensor diagonal, and it is not a continuous
 * function of it, so focal-length maths must use real millimetres. Treating the
 * sensor as one constant (a common shortcut) puts the required focal length out
 * by a factor of two between a 1/3" and a 1/1.2" camera.
 *
 * ## Method and sources
 *
 * Diagonals come from Commonlands' CMOS sensor format look-up table, which fits a
 * curve to the agreed anchor points (1" = 16.0 mm, 1/2" = 8.0 mm, 1/3" = 6.0 mm,
 * 1/4" = 4.5 mm) and explicitly warns that the fit is "a convenience, not a
 * definition":
 *
 *   https://commonlands.com/blogs/technical/cmos-sensor-size
 *
 * Surveillance sensors are 16:9, not the 4:3 that table assumes, so width and
 * height are re-split from the diagonal:
 *
 *   width  = diagonal x 16 / sqrt(16^2 + 9^2) = diagonal x 0.871576
 *   height = diagonal x  9 / sqrt(16^2 + 9^2) = diagonal x 0.490261
 *
 * That derivation was cross-checked against the two sensors Hikvision actually
 * uses most, whose active areas are published by Sony:
 *
 *   - Sony IMX327, "Type 1/2.8", active area 5.57 x 3.13 mm (diagonal 6.46 mm).
 *     Our 1/2.8" row predicts 5.58 x 3.14 mm — within 0.2%.
 *     https://commonlands.com/pages/image-sensors/imx327
 *   - Sony IMX585, "1/1.2"", active area 11.14 x 6.26 mm (diagonal 12.78 mm).
 *     Used directly rather than curve-fitted, since 1/1.2" is absent from the
 *     Commonlands table.
 *     https://commonlands.com/pages/image-sensors/imx585
 *
 * Verified 2026-10-04.
 *
 * Rows marked `isEstimate: true` are interpolated from the fitted curve with no
 * matching published sensor to confirm them. The UI shows that.
 */

export const SENSOR_SOURCE_URL = 'https://commonlands.com/blogs/technical/cmos-sensor-size';

/** 16:9 width share of the diagonal. */
const W16_9 = 16 / Math.sqrt(16 * 16 + 9 * 9);
/** 16:9 height share of the diagonal. */
const H16_9 = 9 / Math.sqrt(16 * 16 + 9 * 9);

export interface SensorFormat {
  /** Format name exactly as Hikvision datasheets print it, e.g. `1/2.8"`. */
  readonly format: string;
  readonly diagonalMm: number;
  readonly widthMm: number;
  readonly heightMm: number;
  readonly isEstimate: boolean;
  readonly sourceUrl: string;
  readonly note: string;
}

function fromDiagonal(
  format: string,
  diagonalMm: number,
  isEstimate: boolean,
  note: string,
): SensorFormat {
  return {
    format,
    diagonalMm,
    widthMm: diagonalMm * W16_9,
    heightMm: diagonalMm * H16_9,
    isEstimate,
    sourceUrl: SENSOR_SOURCE_URL,
    note,
  };
}

export const SENSOR_FORMATS: readonly SensorFormat[] = [
  fromDiagonal('1/4"', 4.5, true, 'Commonlands anchor point, 16:9 split. No published sensor cross-check.'),
  fromDiagonal('1/3"', 6.0, false, 'Commonlands anchor point (1/3" = 6.0 mm), 16:9 split.'),
  fromDiagonal('1/2.9"', 6.2, true, 'Interpolated from the Commonlands curve, 16:9 split.'),
  fromDiagonal(
    '1/2.8"',
    6.4,
    false,
    'Commonlands curve; matches Sony IMX327 published active area 5.57 x 3.13 mm to within 0.2%.',
  ),
  fromDiagonal('1/2.7"', 6.7, true, 'Commonlands curve, 16:9 split. No published sensor cross-check.'),
  fromDiagonal('1/2.5"', 7.2, true, 'Commonlands curve, 16:9 split. No published sensor cross-check.'),
  fromDiagonal('1/2"', 8.0, false, 'Commonlands anchor point (1/2" = 8.0 mm), 16:9 split.'),
  fromDiagonal(
    '1/1.8"',
    8.9,
    false,
    'Commonlands curve, 16:9 split; consistent with 1/1.8" surveillance sensors (~7.7 x 4.3 mm).',
  ),
  fromDiagonal('1/1.7"', 9.4, true, 'Commonlands curve, 16:9 split. No published sensor cross-check.'),
  {
    format: '1/1.2"',
    diagonalMm: 12.78,
    widthMm: 11.14,
    heightMm: 6.26,
    isEstimate: false,
    sourceUrl: 'https://commonlands.com/pages/image-sensors/imx585',
    note: 'Sony IMX585 published active area 11.14 x 6.26 mm, diagonal 12.78 mm. Used directly.',
  },
];

const BY_FORMAT = new Map<string, SensorFormat>(SENSOR_FORMATS.map((s) => [normalise(s.format), s]));

function normalise(format: string): string {
  // Datasheets are inconsistent about the inch mark: 1/2.8", 1/2.8 inch, 1/2.8”.
  return format
    .replace(/\s+/g, '')
    .replace(/[“”″]/g, '"')
    .replace(/inch(es)?/gi, '"')
    .toLowerCase();
}

/**
 * Look up a sensor format. Returns `null` rather than guessing: an unknown format
 * must surface as "Not specified" on the card, not as silently wrong optics.
 */
export function sensorFormat(format: string | null | undefined): SensorFormat | null {
  if (!format) return null;
  return BY_FORMAT.get(normalise(format)) ?? null;
}

export function knownSensorFormats(): readonly string[] {
  return SENSOR_FORMATS.map((s) => s.format);
}
