/**
 * App shell.
 *
 * Layout: inputs left, live results right on desktop; stacked on mobile. The
 * results recompute from state on every change — there is no submit step.
 *
 * State lives here and is mirrored into `location.hash` so the whole scenario is
 * shareable and reproducible. Camera data loads at import time and is validated
 * then, so a bad dataset surfaces as an error boundary rather than a wrong spec.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { recommend } from './engine/recommend.ts';
import { cameraDataset } from './data/cameras.ts';
import { PURPOSES } from './domain/dori.ts';
import {
  activeLocation,
  replaceLocation,
  nextLocationId,
  projectTotals,
  defaultLocation,
  type Project,
  type UnitSystemState,
} from './state/projectTypes.ts';
import { encodeProject, readStateFromHash } from './state/urlState.ts';
import { InputPanel } from './ui/InputPanel.tsx';
import { ResultsPanel } from './ui/ResultsPanel.tsx';
import { Button, Card } from './ui/primitives.tsx';
import { COMPANY_NAME, LOGO_LIGHT_URL, LOGO_DARK_URL, LOGO_INTRINSIC } from './brand.ts';

type Theme = 'system' | 'light' | 'dark';

export default function App() {
  const initial = useMemo(() => readStateFromHash(window.location.hash), []);
  const [project, setProject] = useState<Project>(initial.state.project);
  const [units, setUnits] = useState<UnitSystemState>(initial.state.units);
  const [theme, setTheme] = useState<Theme>('system');
  const [linkWarning, setLinkWarning] = useState<string | null>(initial.warning);
  const [copied, setCopied] = useState(false);

  // Mirror state into the hash. `replaceState` rather than assigning
  // `location.hash` so the back button is not filled with every keystroke.
  useEffect(() => {
    const encoded = encodeProject(project, units);
    window.history.replaceState(null, '', `#${encoded}`);
  }, [project, units]);

  useEffect(() => {
    if (theme === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const location = activeLocation(project);
  const result = useMemo(() => recommend(location), [location]);
  const totals = useMemo(() => projectTotals(project), [project]);

  const addLocation = useCallback(() => {
    setProject((p) => {
      const id = nextLocationId(p);
      return {
        ...p,
        locations: [...p.locations, defaultLocation(id, `Location ${p.locations.length + 1}`)],
        activeLocationId: id,
      };
    });
  }, []);

  const removeLocation = useCallback((id: string) => {
    setProject((p) => {
      if (p.locations.length <= 1) return p; // a project always has at least one
      const locations = p.locations.filter((l) => l.id !== id);
      const first = locations[0];
      if (!first) return p;
      return {
        ...p,
        locations,
        activeLocationId: p.activeLocationId === id ? first.id : p.activeLocationId,
      };
    });
  }, []);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Clipboard access can be refused (insecure context, permissions). Say so
      // rather than swallowing it; the URL bar still holds the link.
      setLinkWarning(
        `Could not copy to the clipboard (${err instanceof Error ? err.message : 'unknown error'}). The link is in the address bar.`,
      );
    }
  }, []);

  return (
    <div className="min-h-full">
      <a
        href="#results"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-control focus:bg-[var(--color-accent)] focus:px-3 focus:py-2 focus:text-[var(--color-accent-ink)]"
      >
        Skip to results
      </a>

      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            {/* Two variants; CSS shows the one matching the active theme
                (`.brand-logo-*` rules in index.css). The hidden one is
                display:none, so screen readers announce the name once. */}
            <img
              src={LOGO_LIGHT_URL}
              alt={COMPANY_NAME}
              width={LOGO_INTRINSIC.width}
              height={LOGO_INTRINSIC.height}
              className="brand-logo-light h-8 w-auto shrink-0"
            />
            <img
              src={LOGO_DARK_URL}
              alt={COMPANY_NAME}
              width={LOGO_INTRINSIC.width}
              height={LOGO_INTRINSIC.height}
              className="brand-logo-dark h-8 w-auto shrink-0"
            />
            <div>
              <h1 className="text-lg font-semibold text-[var(--color-ink)]">
                CCTV camera sizing &mdash; Hikvision
              </h1>
              <p className="text-xs text-[var(--color-ink-3)]">
                {cameraDataset.cameras.length} models, every spec read from the manufacturer datasheet
                &middot; dataset reviewed {cameraDataset.datasetVerifiedOn}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              className="flex overflow-hidden rounded-control border border-[var(--color-border-strong)]"
              role="group"
              aria-label="Units"
            >
              {(['metric', 'imperial'] as const).map((sys) => (
                <button
                  key={sys}
                  type="button"
                  onClick={() => setUnits(sys)}
                  aria-pressed={units === sys}
                  className={`px-3 py-1.5 text-sm ${
                    units === sys
                      ? 'bg-[var(--color-accent)] text-[var(--color-accent-ink)]'
                      : 'bg-[var(--color-surface)] text-[var(--color-ink-2)]'
                  }`}
                >
                  {sys === 'metric' ? 'Metric' : 'Imperial'}
                </button>
              ))}
            </div>

            <label className="sr-only" htmlFor="theme-select">
              Theme
            </label>
            <select
              id="theme-select"
              value={theme}
              onChange={(e) => setTheme(e.currentTarget.value as Theme)}
              className="rounded-control border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2 py-1.5 text-sm text-[var(--color-ink)]"
            >
              <option value="system">Theme: system</option>
              <option value="light">Theme: light</option>
              <option value="dark">Theme: dark</option>
            </select>

            <Button variant="primary" onClick={copyLink}>
              {copied ? 'Link copied' : 'Copy shareable link'}
            </Button>
          </div>
        </div>
      </header>

      {linkWarning && (
        <div
          role="alert"
          className="mx-auto max-w-[1600px] px-4 pt-3"
          onClick={() => setLinkWarning(null)}
        >
          <p
            className="rounded-control border-l-4 px-3 py-2 text-sm"
            style={{
              borderColor: 'var(--color-marginal)',
              background: 'var(--color-marginal-soft)',
              color: 'var(--color-marginal)',
            }}
          >
            {linkWarning}
          </p>
        </div>
      )}

      {/* --- locations and project totals ----------------------------------- */}
      <div className="mx-auto max-w-[1600px] px-4 pt-4">
        <Card
          title="Project"
          subtitle="Add a location per camera position. The totals below are what the later NVR, storage and switch modules will consume."
          actions={<Button onClick={addLocation}>Add location</Button>}
        >
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Locations">
            {project.locations.map((l) => {
              const isActive = l.id === project.activeLocationId;
              return (
                <span key={l.id} className="inline-flex items-center">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setProject((p) => ({ ...p, activeLocationId: l.id }))}
                    className={`rounded-l-control border px-3 py-1.5 text-sm ${
                      isActive
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] font-medium text-[var(--color-accent)]'
                        : 'border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-ink-2)]'
                    }`}
                  >
                    {l.name}
                    <span className="ml-1.5 text-xs text-[var(--color-ink-3)]">
                      &times;{l.requirements.cameraCount}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeLocation(l.id)}
                    disabled={project.locations.length <= 1}
                    aria-label={`Remove ${l.name}`}
                    className="rounded-r-control border border-l-0 border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2 py-1.5 text-sm text-[var(--color-ink-3)] disabled:opacity-40"
                  >
                    &times;
                  </button>
                </span>
              );
            })}
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-5">
            <Total label="Locations" value={String(totals.locationCount)} />
            <Total label="Cameras" value={String(totals.cameraCount)} />
            <Total
              label="PoE load"
              value={`${totals.poeCameraWatts.toFixed(0)} W`}
              note={`budget ${totals.poeSwitchBudgetWatts.toFixed(0)} W at the switch`}
            />
            <Total
              label="Aggregate bitrate"
              value={`${totals.aggregateBitrateMbps.toFixed(1)} Mbps`}
            />
            <Total
              label="Storage"
              value={`${(totals.storageGb / 1000).toFixed(2)} TB`}
              note={`${totals.storageGb.toFixed(0)} GB total`}
            />
          </dl>
          <p className="mt-2 text-xs text-[var(--color-ink-3)]">{totals.poeExplanation}</p>
          {totals.unresolvedLocations.length > 0 && (
            <p className="mt-1 text-xs text-[var(--color-marginal)]">
              Not counted, no model satisfies them yet: {totals.unresolvedLocations.join(', ')}.
            </p>
          )}
          <p className="mt-2 text-xs text-[var(--color-ink-3)]">
            Recorder, storage hardware, PoE switch and bill of materials are a later phase and are
            deliberately not sized here.
          </p>
        </Card>
      </div>

      {/* --- the working area ------------------------------------------------ */}
      <main className="mx-auto grid max-w-[1600px] gap-4 px-4 py-4 lg:grid-cols-[minmax(380px,480px)_1fr]">
        <div>
          <InputPanel
            location={location}
            units={units}
            onChange={(updated) => setProject((p) => replaceLocation(p, updated))}
          />
        </div>
        <div id="results" className="min-w-0">
          <ResultsPanel result={result} location={location} units={units} />
        </div>
      </main>

      <footer className="border-t border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto max-w-[1600px] px-4 py-4 text-xs text-[var(--color-ink-3)]">
          <p>
            Pixel-density thresholds from IEC 62676-4:2014 as reproduced in the Axis white paper
            &ldquo;Pixel density based on IEC 62676-4:2014&rdquo;. &ldquo;
            {PURPOSES.filter((p) => p.isEstimate)
              .map((p) => p.label)
              .join('&rdquo; and &ldquo;')}
            &rdquo; are not levels in that standard and are marked unverified wherever they appear.
          </p>
          <p className="mt-1">
            Bitrate and storage figures from Hikvision&rsquo;s published recommended bit-rate tables.
            Every camera specification is read from the manufacturer datasheet linked on its card;
            fields the datasheet does not state render as &ldquo;Not specified&rdquo;. Nothing here is
            a substitute for a site survey.
          </p>
        </div>
      </footer>
    </div>
  );
}

function Total({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <dt className="text-xs text-[var(--color-ink-3)]">{label}</dt>
      <dd className="font-mono text-base text-[var(--color-ink)]">{value}</dd>
      {note && <dd className="text-xs text-[var(--color-ink-3)]">{note}</dd>}
    </div>
  );
}
