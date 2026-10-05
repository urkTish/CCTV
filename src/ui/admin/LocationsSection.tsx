/**
 * Locations as a list → detail pattern. The list says, per location: name,
 * camera count, the chosen camera, its verdict, open warnings and intake values
 * still to confirm. Selecting one opens its detail: inputs (tabs) beside the
 * live results (tabs).
 *
 * Wide screens show the list as a rail beside the detail; narrower ones show
 * either the list or the detail, with "All locations" and previous / next.
 * Which applies is a container query on the section's width, so a collapsed
 * navigation gives the rail back.
 */

import type { RecommendationResult } from '../../engine/recommend.ts';
import type { Location, Project, UnitSystemState } from '../../state/projectTypes.ts';
import { Icon } from '../icons.tsx';
import { InputPanel } from '../InputPanel.tsx';
import { Button, Notice, VerdictBadge } from '../primitives.tsx';
import { ResultsPanel } from '../ResultsPanel.tsx';
import type { ProjectWarning } from './sections.ts';

function LocationVerdict({ result }: { result: RecommendationResult | undefined }) {
  if (!result || result.error) return <VerdictBadge verdict="fail">Input error</VerdictBadge>;
  if (!result.primary) return <VerdictBadge verdict="fail">No camera</VerdictBadge>;
  const v = result.primary.calculation.pixelDensity.verdict;
  return <VerdictBadge verdict={v}>{v === 'pass' ? 'Pass' : v === 'marginal' ? 'Marginal' : 'Fail'}</VerdictBadge>;
}

export function LocationList({
  project,
  results,
  warnings,
  assumedByLocation,
  onSelect,
  onRemove,
}: {
  project: Project;
  results: ReadonlyMap<string, RecommendationResult>;
  warnings: readonly ProjectWarning[];
  assumedByLocation: ReadonlyMap<string, number>;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="grid min-w-0 content-start gap-2">
      <ul className="grid min-w-0 gap-1.5" aria-label="Locations">
        {project.locations.map((l) => {
          const active = l.id === project.activeLocationId;
          const r = results.get(l.id);
          const warn = warnings.filter((w) => w.locationId === l.id && !w.id.startsWith('loc-assumed')).length;
          const toConfirm = assumedByLocation.get(l.id) ?? 0;
          return (
            <li key={l.id} className="relative min-w-0">
              <button
                type="button"
                onClick={() => onSelect(l.id)}
                aria-current={active ? 'true' : undefined}
                className={`w-full rounded-control border py-2 pr-9 pl-3 text-left transition-colors ${
                  active
                    ? 'border-[var(--color-brand)] bg-[var(--color-accent-soft)]'
                    : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)]'
                }`}
              >
                <span className="flex min-w-0 items-baseline justify-between gap-2">
                  <span className={`min-w-0 truncate text-sm font-semibold ${active ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink)]'}`}>{l.name}</span>
                  <span className="shrink-0 font-mono text-xs text-[var(--color-ink-3)]">×{l.requirements.cameraCount}</span>
                </span>
                <span className="mt-0.5 block truncate text-xs text-[var(--color-ink-3)]">{r?.primary?.calculation.camera.model ?? 'No model yet'}</span>
                <span className="mt-1 flex flex-wrap items-center gap-1.5">
                  <LocationVerdict result={r} />
                  {warn > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-marginal)]">
                      <Icon name="alert" size={12} />
                      {warn} warning{warn === 1 ? '' : 's'}
                    </span>
                  )}
                  {toConfirm > 0 && <span className="text-xs font-medium text-[var(--color-estimate)]">{toConfirm} to confirm</span>}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onRemove(l.id)}
                disabled={project.locations.length <= 1}
                aria-label={`Remove ${l.name}`}
                title={project.locations.length <= 1 ? 'A project always has at least one location' : `Remove ${l.name}`}
                className="absolute top-1.5 right-1.5 rounded-control p-1 text-[var(--color-ink-3)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fail)] disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <Icon name="trash" size={14} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function LocationDetail({
  location,
  result,
  units,
  index,
  total,
  onChange,
  onStep,
  onBack,
  assumed,
  onConfirm,
  clientWords,
}: {
  location: Location;
  result: RecommendationResult;
  units: UnitSystemState;
  index: number;
  total: number;
  onChange: (next: Location) => void;
  onStep: (delta: -1 | 1) => void;
  onBack: () => void;
  assumed: ReadonlyMap<string, string> | undefined;
  onConfirm: (keys: readonly string[]) => void;
  clientWords: string | undefined;
}) {
  const toConfirm = assumed?.size ?? 0;
  return (
    <div className="@container grid min-w-0 content-start gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 rounded-control px-1.5 py-1 text-sm font-medium text-[var(--color-accent)] hover:bg-[var(--color-surface-2)] @6xl/section:hidden"
          >
            <Icon name="chevron-left" size={16} />
            All locations
          </button>
          <h3 className="truncate text-title font-semibold text-[var(--color-ink)]">{location.name}</h3>
          <span className="shrink-0 text-xs text-[var(--color-ink-3)]">
            {index + 1} of {total}
          </span>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" icon="chevron-left" ariaLabel="Previous location" disabled={index === 0} onClick={() => onStep(-1)} />
          <Button size="sm" variant="ghost" icon="chevron-right" ariaLabel="Next location" disabled={index === total - 1} onClick={() => onStep(1)} />
        </div>
      </div>

      {(clientWords || toConfirm > 0) && (
        <Notice
          kind="info"
          title={toConfirm > 0 ? `${toConfirm} value${toConfirm === 1 ? '' : 's'} assumed from the client intake — please confirm` : 'From the client intake'}
          actions={
            toConfirm > 0 ? (
              <Button size="sm" onClick={() => onConfirm([...(assumed?.keys() ?? [])])}>
                Confirm all {toConfirm} for {location.name}
              </Button>
            ) : undefined
          }
        >
          {clientWords && <p>The client asked for: {clientWords}</p>}
          {toConfirm > 0 && <p className="mt-1 text-[var(--color-ink-2)]">Each one is marked on its input. Editing a value confirms it.</p>}
        </Notice>
      )}

      <div className="grid items-start gap-4 @4xl:grid-cols-[22rem_minmax(0,1fr)]">
        <section aria-label={`Inputs for ${location.name}`} className="min-w-0 rounded-card border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
          <InputPanel location={location} units={units} onChange={onChange} assumed={assumed} onConfirm={onConfirm} />
        </section>
        <div id="results" className="min-w-0 @4xl:sticky @4xl:top-16">
          <ResultsPanel result={result} location={location} units={units} />
        </div>
      </div>
    </div>
  );
}
