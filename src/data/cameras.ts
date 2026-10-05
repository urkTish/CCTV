/**
 * The only place camera data enters the application.
 *
 * The JSON is validated against `cameraDatasetSchema` at module load. A bad
 * dataset throws immediately with the offending path, which is what we want: a
 * silent fallback would put an unvalidated spec in front of a paying client.
 */

import rawDataset from './hikvision-cameras.json';
import { cameraDatasetSchema, type Camera, type CameraDataset } from './schema.ts';

export class CameraDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CameraDataError';
  }
}

/**
 * Validate an arbitrary value as a camera dataset. Exported so tests can feed it
 * deliberately corrupt fixtures.
 */
export function parseCameraDataset(value: unknown): CameraDataset {
  const result = cameraDatasetSchema.safeParse(value);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 10)
      .map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new CameraDataError(
      `hikvision-cameras.json failed validation (${result.error.issues.length} issue(s)):\n${issues}`,
    );
  }
  return result.data;
}

export const cameraDataset: CameraDataset = parseCameraDataset(rawDataset);

export const cameras: readonly Camera[] = cameraDataset.cameras;

export function cameraById(id: string): Camera | null {
  return cameras.find((c) => c.id === id) ?? null;
}

export type { Camera } from './schema.ts';
