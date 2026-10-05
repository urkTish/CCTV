/**
 * IndexedDB autosave wired into React (M6).
 *
 * On start it looks for an autosaved project. If that project has a site map,
 * it is OFFERED for restore rather than applied: the URL may hold a different
 * project, and silently swapping it would be worse than losing the map.
 * Autosaving is paused until the engineer chooses, so the offered map is never
 * overwritten by the map-less project from the link.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { autosaveProject, hasSiteMap, indexedDbStore, loadAutosave, type AutosaveStore } from '../state/autosave.ts';
import type { OpenedProject } from '../state/projectFile.ts';
import type { Project, UnitSystemState } from '../state/projectTypes.ts';

const DEBOUNCE_MS = 800;

type Phase = 'checking' | 'offer' | 'active' | 'unavailable';

export interface Autosave {
  readonly status: string;
  readonly offer: OpenedProject | null;
  readonly accept: () => OpenedProject | null;
  readonly dismiss: () => void;
}

function defaultStore(): AutosaveStore | null {
  try {
    return indexedDbStore();
  } catch {
    return null;
  }
}

export function useAutosave(project: Project, units: UnitSystemState): Autosave {
  const store = useMemo(defaultStore, []);
  const [phase, setPhase] = useState<Phase>(store ? 'checking' : 'unavailable');
  const [offer, setOffer] = useState<OpenedProject | null>(null);
  const [status, setStatus] = useState<string>(
    store ? 'Autosave: checking this browser…' : 'Autosave is not available in this browser — use Save project to keep a site map.',
  );

  useEffect(() => {
    if (!store) return;
    let cancelled = false;
    void loadAutosave(store).then((r) => {
      if (cancelled) return;
      if (r && r.ok && hasSiteMap(r.opened.project)) {
        setOffer(r.opened);
        setPhase('offer');
        setStatus('Autosave paused until you restore or dismiss the autosaved project.');
        return;
      }
      if (r && !r.ok) setStatus(`The autosaved project could not be read and will be replaced: ${r.reason}`);
      setPhase('active');
    });
    return () => {
      cancelled = true;
    };
  }, [store]);

  useEffect(() => {
    if (phase !== 'active' || !store) return;
    const t = window.setTimeout(() => {
      void autosaveProject(store, project, units).then((s) =>
        setStatus(s.ok ? `Autosaved in this browser at ${new Date().toLocaleTimeString()}.` : s.reason),
      );
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [phase, store, project, units]);

  const accept = useCallback(() => {
    const o = offer;
    setOffer(null);
    setPhase('active');
    return o;
  }, [offer]);

  const dismiss = useCallback(() => {
    setOffer(null);
    setPhase('active');
  }, []);

  return { status, offer, accept, dismiss };
}
