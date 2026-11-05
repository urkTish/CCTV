/**
 * The jobs register as React state, loaded from and saved to this browser.
 *
 * Held by AdminApp (not the Jobs section) so it survives moving between
 * sections, and so the navigation can show how many follow-ups are due.
 *
 * Saving rules:
 * - Nothing is saved until the stored register has been read, so an empty list
 *   can never overwrite saved jobs during start-up.
 * - If the stored register is unreadable, it is never saved over automatically.
 *   Importing a backup (an explicit "replace") lifts that.
 * - Saves run one after another, in order, so the last edit always wins.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { Job } from '../model.ts';
import { loadJobs, saveJobs, type JobsStore } from '../store.ts';

export type RegisterStatus =
  | { readonly kind: 'loading' }
  | { readonly kind: 'saved' }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'error'; readonly text: string };

export interface JobsRegister {
  readonly jobs: readonly Job[];
  readonly ready: boolean;
  readonly status: RegisterStatus;
  /** Apply an edit to the register. Ignored until the register has loaded. */
  readonly update: (f: (jobs: readonly Job[]) => Job[]) => void;
  /** Replace the whole register (importing a backup). Also lifts the "unreadable" lock. */
  readonly replace: (jobs: readonly Job[]) => void;
}

export function useJobsRegister(store: JobsStore | null): JobsRegister {
  const [jobs, setJobs] = useState<readonly Job[]>([]);
  const [ready, setReady] = useState(store === null);
  const [status, setStatus] = useState<RegisterStatus>(store === null ? { kind: 'unavailable' } : { kind: 'loading' });
  const dirty = useRef(false);
  const locked = useRef(false);
  const queue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (store === null) return;
    let cancelled = false;
    void loadJobs(store).then((r) => {
      if (cancelled) return;
      if (r.ok) {
        setJobs(r.jobs);
        setStatus({ kind: 'saved' });
      } else {
        locked.current = true;
        setStatus({ kind: 'error', text: `${r.reason} It will not be saved over; import a backup to replace it.` });
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [store]);

  useEffect(() => {
    if (!dirty.current || store === null || locked.current) return;
    dirty.current = false;
    const snapshot = jobs;
    queue.current = queue.current.then(async () => {
      const r = await saveJobs(store, snapshot);
      setStatus(r.ok ? { kind: 'saved' } : { kind: 'error', text: r.reason });
    });
  }, [jobs, store]);

  const update = useCallback(
    (f: (jobs: readonly Job[]) => Job[]) => {
      if (!ready) return;
      dirty.current = true;
      setJobs((prev) => f(prev));
    },
    [ready],
  );

  const replace = useCallback((next: readonly Job[]) => {
    locked.current = false;
    dirty.current = true;
    setReady(true);
    setJobs([...next]);
  }, []);

  return { jobs, ready, status, update, replace };
}
