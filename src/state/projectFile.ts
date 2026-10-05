/**
 * Project file save/open (K3).
 *
 * The site plan's image is far too big for the shareable URL, so a project with
 * a map is saved as a `.json` file instead: every location, the phase-2 design
 * settings and the whole site plan, with the plan image embedded as a data URI.
 *
 * Opening a file is a validation boundary exactly like reading the URL: the file
 * may be hand-edited, truncated or simply not ours. `parseProjectFile` never
 * throws; it returns the project or a reason naming the field that failed.
 */

import { z } from 'zod';
import { locationSchema, settingsOrDefault, sitePlanSchema } from './projectSchemas.ts';
import type { Location, Project, UnitSystemState } from './projectTypes.ts';
import { EMPTY_SITE_PLAN, type SitePlan } from '../domain/sitePlan.ts';

/** Identifies our files, so a random `.json` is rejected with a clear reason. */
export const PROJECT_FILE_FORMAT = 'contractech-cctv-project';
export const PROJECT_FILE_VERSION = 1;
export const PROJECT_FILE_EXTENSION = '.json';
export const PROJECT_FILE_MIME = 'application/json';

/**
 * Largest file we will try to parse: the 30 MB image cap plus generous room for
 * the rest. Checked before `JSON.parse` so a huge file fails fast with a reason.
 */
export const MAX_PROJECT_FILE_CHARS = 32_000_000;

const projectFileSchema = z
  .object({
    format: z.literal(PROJECT_FILE_FORMAT),
    v: z.literal(PROJECT_FILE_VERSION),
    name: z.string().min(1).max(160),
    units: z.enum(['metric', 'imperial']),
    locations: z.array(locationSchema).min(1).max(50),
    activeLocationId: z.string().min(1),
    settings: settingsOrDefault,
    sitePlan: sitePlanSchema.optional(),
  })
  .strict()
  .superRefine((file, ctx) => {
    // A placed camera must belong to a location that exists, or it would be
    // silently dropped from every count.
    const locationIds = new Set(file.locations.map((l) => l.id));
    file.sitePlan?.devices.forEach((d, i) => {
      if (d.kind === 'camera' && !locationIds.has(d.locationId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['sitePlan', 'devices', i, 'locationId'],
          message: `Placed camera refers to location "${d.locationId}", which is not in the project`,
        });
      }
    });
  });

export interface OpenedProject {
  readonly project: Project;
  readonly units: UnitSystemState;
}

export type ProjectFileResult =
  | { readonly ok: true; readonly opened: OpenedProject; readonly notices: readonly string[] }
  | { readonly ok: false; readonly reason: string };

/** The project as a pretty-printed JSON document. Deterministic: no timestamps. */
export function serializeProjectFile(project: Project, units: UnitSystemState): string {
  const payload = {
    format: PROJECT_FILE_FORMAT,
    v: PROJECT_FILE_VERSION,
    name: project.name,
    units,
    locations: project.locations,
    activeLocationId: project.activeLocationId,
    settings: project.settings,
    sitePlan: project.sitePlan,
  };
  return JSON.stringify(payload, null, 2);
}

/** A safe download name derived from the project name. */
export function projectFileName(project: Project): string {
  const stem = project.name
    .normalize('NFKD')
    .replace(/[^\w\- ]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
  return `${stem || 'cctv-project'}${PROJECT_FILE_EXTENSION}`;
}

export function parseProjectFile(text: string): ProjectFileResult {
  if (text.length === 0) return { ok: false, reason: 'The file is empty.' };
  if (text.length > MAX_PROJECT_FILE_CHARS) {
    return {
      ok: false,
      reason: `The file is ${(text.length / 1e6).toFixed(1)} MB; the limit is ${MAX_PROJECT_FILE_CHARS / 1e6} MB. Downscale the plan image and save again.`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return {
      ok: false,
      reason: `The file is not valid JSON (${err instanceof Error ? err.message : 'parse error'}). It may be truncated.`,
    };
  }

  if (typeof parsed !== 'object' || parsed === null || (parsed as { format?: unknown }).format !== PROJECT_FILE_FORMAT) {
    return { ok: false, reason: 'This is not a ContracTech CCTV project file (the "format" marker is missing or different).' };
  }
  const version = (parsed as { v?: unknown }).v;
  if (version !== PROJECT_FILE_VERSION) {
    return {
      ok: false,
      reason: `The file is project-file version ${JSON.stringify(version)}; this app reads version ${PROJECT_FILE_VERSION}.`,
    };
  }

  const result = projectFileSchema.safeParse(parsed);
  if (!result.success) {
    const first = result.error.issues[0];
    const more = result.error.issues.length > 1 ? ` (and ${result.error.issues.length - 1} more problem(s))` : '';
    return {
      ok: false,
      reason: `The project file failed validation at "${first?.path.join('.') || 'root'}": ${first?.message ?? 'unknown'}${more}.`,
    };
  }

  const data = result.data;
  const notices: string[] = [];
  const activeOk = data.locations.some((l) => l.id === data.activeLocationId);
  if (!activeOk) notices.push('The saved active location no longer exists; the first location is shown instead.');
  const sitePlan: SitePlan = data.sitePlan ?? EMPTY_SITE_PLAN;

  return {
    ok: true,
    opened: {
      project: {
        name: data.name,
        locations: data.locations as readonly Location[],
        activeLocationId: activeOk ? data.activeLocationId : (data.locations[0]?.id ?? ''),
        settings: data.settings,
        sitePlan,
      },
      units: data.units,
    },
    notices,
  };
}
