/**
 * Project "extras": what the redesign adds beside the engineering project —
 * the client's name, optional prices, the report's draft/final state, and the
 * client intake a draft came from (the client's answers and the values assumed
 * from them that the engineer has not yet confirmed).
 *
 * The project file format and its schema are not changed. When a project has
 * extras, *Save project* writes a workspace envelope that wraps the unchanged
 * project-file document; when it has none, it writes the plain project file
 * exactly as before, so older copies of the app can still open it.
 *
 * Opening is a validation boundary, like the project file: the envelope is
 * parsed with its own strict schema and the inner project goes through
 * `parseProjectFile` untouched.
 */

import { z } from 'zod';

import { clientAnswersSchema, type ClientAnswers } from '../client/intakeTypes.ts';
import { engineerProfileSchema, type EngineerProfile } from './engineerProfile.ts';
import { parseProjectFile, serializeProjectFile, PROJECT_FILE_FORMAT, type OpenedProject } from './projectFile.ts';
import type { Project, UnitSystemState } from './projectTypes.ts';

export const WORKSPACE_FORMAT = 'contractech-cctv-workspace';
export const WORKSPACE_VERSION = 1;

export interface IntakeProvenance {
  /** ISO date (YYYY-MM-DD) the client submitted the intake, when known. */
  readonly submittedOn: string | null;
  readonly answers: ClientAnswers;
  /** Location id → field key → why the value was assumed. Confirmed keys are removed. */
  readonly assumed: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /** Location id → what the client asked for, in their words. */
  readonly clientWords: Readonly<Record<string, string>>;
}

export interface ReportState {
  readonly status: 'draft' | 'final';
  /** ISO date the report was made Final. */
  readonly finalisedOn: string | null;
  /** The engineer's details as they were when the report was made Final. */
  readonly preparedBy: EngineerProfile | null;
}

export interface ProjectExtras {
  readonly clientName: string;
  readonly clientContact: string;
  /** BOM line id → unit price entered by the engineer. Never invented. */
  readonly prices: Readonly<Record<string, number>>;
  readonly currency: string;
  /** How long the proposal is valid, days. */
  readonly validityDays: number;
  readonly report: ReportState;
  readonly intake: IntakeProvenance | null;
}

export const DEFAULT_EXTRAS: ProjectExtras = {
  clientName: '',
  clientContact: '',
  prices: {},
  currency: '',
  validityDays: 30,
  report: { status: 'draft', finalisedOn: null, preparedBy: null },
  intake: null,
};

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected a YYYY-MM-DD date');

export const extrasSchema = z
  .object({
    clientName: z.string().max(160),
    clientContact: z.string().max(300),
    prices: z.record(z.string().max(200), z.number().finite().min(0).max(1e9)),
    currency: z.string().max(12),
    validityDays: z.number().int().min(1).max(3650),
    report: z
      .object({
        status: z.enum(['draft', 'final']),
        finalisedOn: isoDate.nullable(),
        preparedBy: engineerProfileSchema.nullable(),
      })
      .strict(),
    intake: z
      .object({
        submittedOn: isoDate.nullable(),
        answers: clientAnswersSchema,
        assumed: z.record(z.string().max(64), z.record(z.string().max(80), z.string().max(400))),
        clientWords: z.record(z.string().max(64), z.string().max(600)),
      })
      .strict()
      .nullable(),
  })
  .strict();

export function hasExtras(extras: ProjectExtras): boolean {
  return JSON.stringify(extras) !== JSON.stringify(DEFAULT_EXTRAS);
}

/** The project as a file: the plain project file when there are no extras, else the envelope. */
export function serializeWorkspace(project: Project, units: UnitSystemState, extras: ProjectExtras): string {
  const projectText = serializeProjectFile(project, units);
  if (!hasExtras(extras)) return projectText;
  return JSON.stringify(
    { format: WORKSPACE_FORMAT, v: WORKSPACE_VERSION, project: JSON.parse(projectText) as unknown, extras },
    null,
    2,
  );
}

export type WorkspaceResult =
  | { readonly ok: true; readonly opened: OpenedProject; readonly extras: ProjectExtras; readonly notices: readonly string[] }
  | { readonly ok: false; readonly reason: string };

/** The `format` marker of a JSON document, or null when it has none / is not JSON. */
export function formatOf(text: string): string | null {
  try {
    const v = JSON.parse(text) as unknown;
    return typeof v === 'object' && v !== null && typeof (v as { format?: unknown }).format === 'string' ? (v as { format: string }).format : null;
  } catch {
    return null;
  }
}

/** Open a project file or a workspace envelope. Never throws. */
export function parseWorkspace(text: string): WorkspaceResult {
  if (formatOf(text) !== WORKSPACE_FORMAT) {
    const plain = parseProjectFile(text);
    return plain.ok ? { ...plain, extras: DEFAULT_EXTRAS } : plain;
  }
  const doc = JSON.parse(text) as { v?: unknown; project?: unknown; extras?: unknown };
  if (doc.v !== WORKSPACE_VERSION) {
    return { ok: false, reason: `The file is workspace version ${JSON.stringify(doc.v)}; this app reads version ${WORKSPACE_VERSION}.` };
  }
  const extras = extrasSchema.safeParse(doc.extras);
  if (!extras.success) {
    const first = extras.error.issues[0];
    return { ok: false, reason: `The project file failed validation at "extras.${first?.path.join('.') ?? ''}": ${first?.message ?? 'unknown'}.` };
  }
  if (typeof doc.project !== 'object' || doc.project === null || (doc.project as { format?: unknown }).format !== PROJECT_FILE_FORMAT) {
    return { ok: false, reason: 'The file is a workspace but does not contain a ContracTech CCTV project.' };
  }
  const inner = parseProjectFile(JSON.stringify(doc.project));
  if (!inner.ok) return inner;
  return { ...inner, extras: extras.data };
}

/** Values still assumed from the intake, per location. */
export function assumedCounts(extras: ProjectExtras): Map<string, number> {
  const out = new Map<string, number>();
  for (const [loc, fields] of Object.entries(extras.intake?.assumed ?? {})) {
    const n = Object.keys(fields).length;
    if (n > 0) out.set(loc, n);
  }
  return out;
}

/** Remove `keys` from a location's assumed list (the engineer confirmed or edited them). */
export function confirmAssumed(extras: ProjectExtras, locationId: string, keys: readonly string[]): ProjectExtras {
  const intake = extras.intake;
  const current = intake?.assumed[locationId];
  if (!intake || !current || !keys.some((k) => k in current)) return extras;
  const next = Object.fromEntries(Object.entries(current).filter(([k]) => !keys.includes(k)));
  return { ...extras, intake: { ...intake, assumed: { ...intake.assumed, [locationId]: next } } };
}

/** Drop intake marks for locations that no longer exist. */
export function pruneExtras(extras: ProjectExtras, locationIds: readonly string[]): ProjectExtras {
  const intake = extras.intake;
  if (!intake) return extras;
  const keep = new Set(locationIds);
  const stale = Object.keys(intake.assumed).some((id) => !keep.has(id));
  if (!stale) return extras;
  return {
    ...extras,
    intake: {
      ...intake,
      assumed: Object.fromEntries(Object.entries(intake.assumed).filter(([id]) => keep.has(id))),
      clientWords: Object.fromEntries(Object.entries(intake.clientWords).filter(([id]) => keep.has(id))),
    },
  };
}
