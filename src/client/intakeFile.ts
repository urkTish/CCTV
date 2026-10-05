/**
 * How a client's intake travels to the engineer, with no backend:
 *   - a file (`.json`, format "contractech-cctv-intake") that carries the
 *     answers and, when uploaded, the floor plan; or
 *   - a link (`#/intake/<base64url>`) that carries the answers only — a plan
 *     image is far too big for a URL.
 *
 * Both are validation boundaries: parsed field by field, never thrown at.
 */

import { z } from 'zod';

import { sitePlanSchema } from '../state/projectSchemas.ts';
import type { PlanImage } from '../domain/sitePlan.ts';
import { clientAnswersSchema, type ClientAnswers } from './intakeTypes.ts';
import { INTAKE_HASH_PREFIX } from '../ui/route.ts';

export const INTAKE_FILE_FORMAT = 'contractech-cctv-intake';
export const INTAKE_FILE_VERSION = 1;

/** Links longer than this are refused by some chat and mail clients; offer the file instead. */
export const MAX_INTAKE_LINK_CHARS = 8000;

export interface Intake {
  readonly answers: ClientAnswers;
  /** ISO date the client sent it. */
  readonly submittedOn: string | null;
  readonly planImage: PlanImage | null;
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const intakeFileSchema = z
  .object({
    format: z.literal(INTAKE_FILE_FORMAT),
    v: z.literal(INTAKE_FILE_VERSION),
    submittedOn: isoDate.nullable(),
    answers: clientAnswersSchema,
    // The plan rides in a site-plan document so it is validated by the same
    // schema as a project file's plan (PNG/JPEG data URI, size caps).
    sitePlan: sitePlanSchema.nullable(),
  })
  .strict();

const intakeLinkSchema = z.object({ v: z.literal(INTAKE_FILE_VERSION), submittedOn: isoDate.nullable(), answers: clientAnswersSchema }).strict();

export type IntakeResult = { readonly ok: true; readonly intake: Intake } | { readonly ok: false; readonly reason: string };

export function serializeIntakeFile(intake: Intake): string {
  return JSON.stringify(
    {
      format: INTAKE_FILE_FORMAT,
      v: INTAKE_FILE_VERSION,
      submittedOn: intake.submittedOn,
      answers: intake.answers,
      sitePlan: intake.planImage ? { image: intake.planImage, calibration: null, devices: [], routes: [] } : null,
    },
    null,
    2,
  );
}

function firstIssue(err: z.ZodError, prefix: string): string {
  const first = err.issues[0];
  return `The intake failed validation at "${[prefix, ...(first?.path ?? [])].filter((x) => x !== '').join('.')}": ${first?.message ?? 'unknown'}.`;
}

export function parseIntakeFile(text: string): IntakeResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return { ok: false, reason: `The intake file is not valid JSON (${err instanceof Error ? err.message : 'parse error'}).` };
  }
  const r = intakeFileSchema.safeParse(parsed);
  if (!r.success) return { ok: false, reason: firstIssue(r.error, '') };
  return { ok: true, intake: { answers: r.data.answers, submittedOn: r.data.submittedOn, planImage: r.data.sitePlan?.image ?? null } };
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(encoded: string): string {
  const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(binary, (ch) => ch.charCodeAt(0)));
}

/** The `#/intake/…` hash for these answers (never carries the plan image). */
export function intakeLinkHash(answers: ClientAnswers, submittedOn: string | null): string {
  return `${INTAKE_HASH_PREFIX}${toBase64Url(JSON.stringify({ v: INTAKE_FILE_VERSION, submittedOn, answers }))}`;
}

export function parseIntakeLink(payload: string): IntakeResult {
  let json: string;
  try {
    json = fromBase64Url(payload);
  } catch {
    return { ok: false, reason: 'The intake link is not valid — it was probably cut short when it was copied.' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, reason: 'The intake link does not contain valid data — it was probably cut short when it was copied.' };
  }
  const r = intakeLinkSchema.safeParse(parsed);
  if (!r.success) return { ok: false, reason: firstIssue(r.error, '') };
  return { ok: true, intake: { answers: r.data.answers, submittedOn: r.data.submittedOn, planImage: null } };
}

/** Today as YYYY-MM-DD in local time. */
export function todayIso(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}
