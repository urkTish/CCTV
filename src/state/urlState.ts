/**
 * Shareable, reproducible configuration in the URL.
 *
 * The whole project — every location — is encoded into the hash so an engineer
 * can send a client's scenario as a link and reopen it later. The hash is used
 * rather than the query string so the page can be served from a file:// path or
 * any subdirectory without a server rewriting anything.
 *
 * Reading is a validation boundary: a hand-edited or truncated link must fall
 * back to defaults rather than crash or, worse, render a half-populated scenario
 * that looks real. `decodeProject` therefore returns a discriminated result and
 * never throws.
 */

import { z } from 'zod';
import {
  defaultProject,
  type Project,
  type Location,
  type UnitSystemState,
} from './projectTypes.ts';
import { locationSchema, settingsOrDefault } from './projectSchemas.ts';
import { EMPTY_SITE_PLAN } from '../domain/sitePlan.ts';

const projectSchema = z
  .object({
    v: z.literal(1),
    name: z.string().min(1).max(160),
    units: z.enum(['metric', 'imperial']),
    locations: z.array(locationSchema).min(1).max(50),
    activeLocationId: z.string().min(1),
    // Phase 2. Optional so phase-1 links still open (defaults are filled in).
    settings: settingsOrDefault,
  })
  .strict();

export interface EncodedState {
  readonly project: Project;
  readonly units: UnitSystemState;
}

export type DecodeResult =
  | { readonly ok: true; readonly state: EncodedState }
  | { readonly ok: false; readonly reason: string };

/** URL-safe base64 without padding, so the link survives chat clients. */
function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(encoded: string): string {
  const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeProject(project: Project, units: UnitSystemState): string {
  const payload = {
    v: 1 as const,
    name: project.name,
    units,
    locations: project.locations,
    activeLocationId: project.activeLocationId,
    settings: project.settings,
    // The site plan is deliberately NOT encoded: an embedded image would make
    // the link unusably long. Use Save project for anything with a map.
  };
  return toBase64Url(JSON.stringify(payload));
}

export function decodeProject(encoded: string): DecodeResult {
  if (!encoded) return { ok: false, reason: 'empty' };
  let json: string;
  try {
    json = fromBase64Url(encoded);
  } catch {
    return { ok: false, reason: 'The shared link is not valid base64 — it was probably truncated.' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, reason: 'The shared link does not contain valid JSON.' };
  }

  const result = projectSchema.safeParse(parsed);
  if (!result.success) {
    const first = result.error.issues[0];
    return {
      ok: false,
      reason: `The shared link failed validation at "${first?.path.join('.') ?? 'root'}": ${first?.message ?? 'unknown'}.`,
    };
  }

  const data = result.data;
  // An activeLocationId pointing at nothing would render an empty page, so
  // repair it rather than rejecting the whole link.
  const active = data.locations.some((l) => l.id === data.activeLocationId)
    ? data.activeLocationId
    : (data.locations[0]?.id ?? '');

  return {
    ok: true,
    state: {
      project: {
        name: data.name,
        locations: data.locations as readonly Location[],
        activeLocationId: active,
        settings: data.settings,
        sitePlan: EMPTY_SITE_PLAN,
      },
      units: data.units,
    },
  };
}

/** Read the project out of `location.hash`, falling back to a fresh default. */
export function readStateFromHash(hash: string): { state: EncodedState; warning: string | null } {
  const raw = hash.replace(/^#/, '');
  if (!raw) return { state: { project: defaultProject(), units: 'metric' }, warning: null };
  const decoded = decodeProject(raw);
  if (decoded.ok) return { state: decoded.state, warning: null };
  return {
    state: { project: defaultProject(), units: 'metric' },
    warning: `${decoded.reason} Starting from defaults instead.`,
  };
}
