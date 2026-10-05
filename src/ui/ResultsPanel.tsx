/**
 * The right-hand column: the verdict, the models, and the honest no-result path.
 *
 * Four states, all real:
 *   error      — the geometry itself is invalid; say which field and stop.
 *   no result  — nothing satisfies the constraints; name the binding one, show
 *                the nearest misses and what to change.
 *   result     — primary plus alternatives.
 *   (empty)    — handled upstream; a project always has one location.
 */

import { Card, VerdictBadge, EstimateBadge, Explain, Button } from './primitives.tsx';
import { ResultCard } from './ResultCard.tsx';
import { capabilityLabel } from '../engine/recommend.ts';
import type { RecommendationResult } from '../engine/recommend.ts';
import type { Location, UnitSystemState } from '../state/projectTypes.ts';
import { useState } from 'react';

export function ResultsPanel({
  result,
  location,
  units,
}: {
  result: RecommendationResult;
  location: Location;
  units: UnitSystemState;
}) {
  const [showRejections, setShowRejections] = useState(false);

  if (result.error) {
    return (
      <Card title="Check the inputs">
        <div
          className="rounded-control border-l-4 px-3 py-3 text-sm"
          style={{
            borderColor: 'var(--color-fail)',
            background: 'var(--color-fail-soft)',
            color: 'var(--color-fail)',
          }}
          role="alert"
        >
          <p className="font-semibold">This scenario cannot be calculated yet.</p>
          <p className="mt-1">{result.error}</p>
        </div>
      </Card>
    );
  }

  const scenario = result.scenario;

  return (
    <div className="grid gap-4">
      {/* --- what the job requires, before any camera is involved ----------- */}
      <Card
        title="What this location requires"
        subtitle="Derived from the geometry and the purpose alone. No camera involved."
      >
        <div className="grid gap-2">
          {scenario.rows.map((row) => (
            <div
              key={row.label}
              className="rounded-control border border-[var(--color-border)] px-3 py-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-[var(--color-ink)]">{row.label}</span>
                <span className="flex items-center gap-2">
                  <span className="font-mono text-sm text-[var(--color-ink)]">{row.display}</span>
                  {row.isEstimate && <EstimateBadge />}
                </span>
              </div>
              <Explain formula={row.formula} sourceUrl={row.sourceUrl} />
            </div>
          ))}
        </div>
      </Card>

      {/* --- no result -------------------------------------------------------- */}
      {!result.primary && (
        <Card title="No model satisfies these constraints">
          <div
            className="rounded-control border-l-4 px-3 py-3 text-sm"
            style={{
              borderColor: 'var(--color-fail)',
              background: 'var(--color-fail-soft)',
              color: 'var(--color-fail)',
            }}
            role="status"
          >
            <p className="font-semibold">
              Nothing in the verified catalogue meets this requirement as stated.
            </p>
            <p className="mt-1">
              That is a real answer, not a bug. Here is what is blocking it and what to change.
            </p>
          </div>

          <h3 className="mt-4 text-sm font-semibold text-[var(--color-ink)]">What to change</h3>
          <ul className="mt-1 grid list-disc gap-1 pl-5 text-sm text-[var(--color-ink-2)]">
            {result.suggestedFixes.map((fix) => (
              <li key={fix}>{fix}</li>
            ))}
          </ul>

          {result.nearMisses.length > 0 && (
            <>
              <h3 className="mt-4 text-sm font-semibold text-[var(--color-ink)]">Nearest misses</h3>
              <ul className="mt-1 grid gap-2">
                {result.nearMisses.map((miss) => (
                  <li
                    key={miss.calculation.camera.id}
                    className="rounded-control border border-[var(--color-border)] px-3 py-2 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <a
                        href={miss.calculation.camera.datasheetUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="font-medium text-[var(--color-accent)] underline"
                      >
                        {miss.calculation.camera.model}
                      </a>
                      <VerdictBadge verdict="fail" />
                    </div>
                    <p className="mt-1 text-[var(--color-ink-2)]">{miss.shortfall}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      )}

      {/* --- the recommendations --------------------------------------------- */}
      {result.primary && (
        <ResultCard rec={result.primary} location={location} units={units} showSketch />
      )}
      {result.alternatives.map((alt) => (
        <ResultCard
          key={alt.calculation.camera.id}
          rec={alt}
          location={location}
          units={units}
          showSketch={false}
        />
      ))}

      {/* --- what was rejected, and why -------------------------------------- */}
      {result.rejections.length > 0 && (
        <Card
          title={`Excluded: ${result.rejections.length} model${result.rejections.length === 1 ? '' : 's'}`}
          subtitle="Every exclusion has a reason you can repeat to a client."
          actions={
            <Button onClick={() => setShowRejections((v) => !v)}>
              {showRejections ? 'Hide' : 'Show'}
            </Button>
          }
        >
          {showRejections ? (
            <ul className="grid gap-1.5">
              {result.rejections.map((r) => (
                <li
                  key={`${r.cameraId}-${r.constraint}`}
                  className="rounded-control border border-[var(--color-border)] px-3 py-2 text-sm"
                >
                  <span className="font-medium text-[var(--color-ink)]">{r.model}</span>
                  <span className="ml-2 text-[var(--color-ink-2)]">{r.reason}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--color-ink-3)]">
              {summariseRejections(result)} Open this panel for the model-by-model reasons.
            </p>
          )}
        </Card>
      )}

      {location.requirements.requiredCapabilities.length > 0 && (
        <p className="text-xs text-[var(--color-ink-3)]">
          Hard-filtered on:{' '}
          {location.requirements.requiredCapabilities.map((c) => capabilityLabel(c)).join(', ')}.
        </p>
      )}
    </div>
  );
}

function summariseRejections(result: RecommendationResult): string {
  const counts = new Map<string, number>();
  for (const r of result.rejections) counts.set(r.constraint, (counts.get(r.constraint) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const LABELS: Record<string, string> = {
    'ingress-protection': 'ingress protection',
    'vandal-resistance': 'vandal resistance',
    'indoor-outdoor': 'indoor-only rating',
    'form-factor-ptz': 'PTZ ruled out',
    'lens-preference': 'lens preference',
    'colour-at-night': 'cannot do colour at night',
    wdr: 'insufficient WDR',
    audio: 'no microphone',
    'two-way-audio': 'no two-way audio',
    capability: 'missing a required feature',
    budget: 'above the budget tier',
    'optics-unavailable': 'optics could not be evaluated',
  };
  return top.map(([k, n]) => `${n} on ${LABELS[k] ?? k}`).join(', ') + '.';
}
