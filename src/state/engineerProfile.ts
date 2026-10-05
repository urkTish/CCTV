/**
 * The engineer's own details for the report's "prepared by" (Admin → Settings).
 * They belong to the person, not the project, so they live in this browser's
 * localStorage — a per-viewer convenience — and are copied into a project's
 * extras when its report is made Final, so a reopened final report keeps them.
 *
 * Storage can be missing or blocked (private mode, policy); every access is in
 * try/catch and the app carries on with empty details.
 */

import { z } from 'zod';

export interface EngineerProfile {
  readonly name: string;
  readonly title: string;
  readonly phone: string;
  readonly email: string;
}

export const EMPTY_PROFILE: EngineerProfile = { name: '', title: '', phone: '', email: '' };

export const engineerProfileSchema = z
  .object({ name: z.string().max(120), title: z.string().max(120), phone: z.string().max(60), email: z.string().max(160) })
  .strict();

const KEY = 'contractech-cctv.engineer-profile';

export type ProfileStorage = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): ProfileStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadProfile(storage: ProfileStorage | null = defaultStorage()): EngineerProfile {
  if (!storage) return EMPTY_PROFILE;
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return EMPTY_PROFILE;
    const parsed = engineerProfileSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : EMPTY_PROFILE;
  } catch {
    return EMPTY_PROFILE;
  }
}

/** Returns null on success, or the reason it could not be stored. */
export function saveProfile(profile: EngineerProfile, storage: ProfileStorage | null = defaultStorage()): string | null {
  if (!storage) return 'This browser does not allow saving settings; they will last until the page is closed.';
  try {
    storage.setItem(KEY, JSON.stringify(profile));
    return null;
  } catch (err) {
    return `Could not save your details in this browser (${err instanceof Error ? err.message : 'unknown error'}).`;
  }
}

export function profileIsEmpty(p: EngineerProfile): boolean {
  return !p.name.trim() && !p.title.trim() && !p.phone.trim() && !p.email.trim();
}
