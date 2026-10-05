/**
 * One location's results, beside its inputs: the verdict, the models, and the
 * honest no-result path, organised as tabs rather than one long column.
 *
 * Four states, all real:
 *   error      — the geometry itself is invalid; say which field and stop.
 *   no result  — nothing satisfies the constraints; name the binding one, show
 *                the nearest misses and what to change.
 *   result     — primary plus alternatives.
 *   (empty)    — handled upstream; a project always has one location.
 */

import { useState } from 'react';

import { capabilityLabel } from '../engine/recommend.ts';
import type { RecommendationResult } from '../engine/recommend.ts';
import type { Location, UnitSystemState } from '../state/projectTypes.ts';
import { GeometrySketch } from './GeometrySketch.tsx';
import { Card, EmptyState, EstimateBadge, Explain, Notice, TabPanel, Tabs, VerdictBadge } from './primitives.tsx';
import {
  AlternativeCard,
  CalcWarnings,
  CalculationRows,
  EngineerNote,
  OrderingFacts,
  RecommendationHeading,
  SpecSheetTable,
  WhyAndWeakPoint,
} from './ResultCard.tsx';

export type ResultTab = 'recommendation' | 'spec' | 'calculation' | 'sketch' | 'alternatives' | 'excluded';

export function ResultsPanel({
  result,
  location,
  units,
}: {
  result: RecommendationResult;
  location: Location;
  units: UnitSystemState;
}) {
  const [tab, setTab] = useState<ResultTab>('recommendation');

  if (result.error) {
    return (
      <Card title="Check the inputs">
        <Notice kind="error" role="alert" title="This scenario cannot be calculated yet.">
          <p>{result.error}</p>
        </Notice>
      </Card>
    );
  }

  const primary = result.primary;
  const idBase = `results-${location.id}`;
  const count = (n: number) => <span className="text-xs font-normal text-[var(--color-ink-3)]">{n}</span>;

  return (
    <section aria-label={`Results for ${location.name}`} className="min-w-0 rounded-card border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
      <div className="px-4 pt-3">
        <Tabs
          label={`Results for ${location.name}`}
          idBase={idBase}
          active={tab}
          onChange={setTab}
          wrap
          tabs={[
            { id: 'recommendation', label: primary ? 'Recommendation' : 'No result' },
            { id: 'spec', label: 'Spec sheet' },
            { id: 'calculation', label: 'Calculation' },
            { id: 'sketch', label: 'Sketch' },
            { id: 'alternatives', label: 'Alternatives', badge: count(result.alternatives.length) },
            { id: 'excluded', label: 'Excluded', badge: count(result.rejections.length) },
          ]}
        />
      </div>

      <TabPanel idBase={idBase} id={tab} className="grid gap-4 p-4">
        {tab === 'recommendation' &&
          (primary ? (
            <>
              <RecommendationHeading rec={primary} />
              <WhyAndWeakPoint rec={primary} />
              <OrderingFacts rec={primary} />
              <CalcWarnings rec={primary} />
              <EngineerNote rec={primary} />
              <RequirementRows result={result} compact />
            </>
          ) : (
            <NoResult result={result} />
          ))}

        {tab === 'spec' &&
          (primary ? (
            <>
              <RecommendationHeading rec={primary} />
              <SpecSheetTable rec={primary} />
            </>
          ) : (
            <EmptyState icon="camera" title="No recommended model">
              Nothing in the catalogue meets this location as stated, so there is no spec sheet. See the No result tab for what to change.
            </EmptyState>
          ))}

        {tab === 'calculation' && (
          <>
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-ink)]">What this location requires</h3>
              <p className="mb-2 text-xs text-[var(--color-ink-3)]">Derived from the geometry and the purpose alone. No camera involved.</p>
              <RequirementRows result={result} />
            </div>
            {primary && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-[var(--color-ink)]">
                  Calculation summary for {primary.calculation.camera.model} ({primary.calculation.rows.length} figures)
                </h3>
                <CalculationRows rec={primary} location={location} units={units} />
              </div>
            )}
          </>
        )}

        {tab === 'sketch' &&
          (primary ? (
            <GeometrySketch
              calc={primary.calculation}
              targetDistanceMetres={location.geometry.targetDistanceMetres}
              mountHeightMetres={location.geometry.mountHeightMetres}
              targetHeightMetres={location.geometry.targetHeightMetres}
              units={units}
            />
          ) : (
            <EmptyState icon="camera" title="Nothing to draw yet">
              The sketch shows the recommended camera&rsquo;s field of view; there is no recommended camera for this location.
            </EmptyState>
          ))}

        {tab === 'alternatives' &&
          (result.alternatives.length > 0 ? (
            result.alternatives.map((alt) => <AlternativeCard key={alt.calculation.camera.id} rec={alt} location={location} units={units} />)
          ) : (
            <EmptyState icon="camera" title="No alternatives">
              {primary ? 'Only one model satisfies this location.' : 'No model satisfies this location.'}
            </EmptyState>
          ))}

        {tab === 'excluded' && (
          <>
            <p className="text-sm text-[var(--color-ink-2)]">
              {result.rejections.length === 0
                ? 'No model was excluded.'
                : `${result.rejections.length} model${result.rejections.length === 1 ? '' : 's'} excluded — every exclusion has a reason you can repeat to a client. ${summariseRejections(result)}`}
            </p>
            {result.rejections.length > 0 && (
              <ul className="grid gap-1.5" aria-label="Excluded models">
                {result.rejections.map((r) => (
                  <li key={`${r.cameraId}-${r.constraint}`} className="rounded-control border border-[var(--color-border)] px-3 py-2 text-sm">
                    <span className="font-medium text-[var(--color-ink)]">{r.model}</span>
                    <span className="ml-2 text-[var(--color-ink-2)]">{r.reason}</span>
                  </li>
                ))}
              </ul>
            )}
            {location.requirements.requiredCapabilities.length > 0 && (
              <p className="text-xs text-[var(--color-ink-3)]">
                Hard-filtered on: {location.requirements.requiredCapabilities.map((c) => capabilityLabel(c)).join(', ')}.
              </p>
            )}
          </>
        )}
      </TabPanel>
    </section>
  );
}

function RequirementRows({ result, compact = false }: { result: RecommendationResult; compact?: boolean }) {
  if (compact) {
    return (
      <dl className="grid gap-x-4 gap-y-1 border-t border-[var(--color-border)] pt-3 text-sm sm:grid-cols-3">
        {result.scenario.rows.map((row) => (
          <div key={row.label}>
            <dt className="text-xs text-[var(--color-ink-3)]">{row.label}</dt>
            <dd className="flex items-center gap-1.5 font-mono text-[var(--color-ink)]">
              {row.display} {row.isEstimate && <EstimateBadge />}
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  return (
    <div className="grid gap-2">
      {result.scenario.rows.map((row) => (
        <div key={row.label} className="rounded-control border border-[var(--color-border)] px-3 py-2">
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
  );
}

function NoResult({ result }: { result: RecommendationResult }) {
  return (
    <>
      <h3 className="text-base font-semibold text-[var(--color-ink)]">No model satisfies these constraints</h3>
      <Notice kind="error" role="status" title="Nothing in the verified catalogue meets this requirement as stated.">
        That is a real answer, not a bug. Here is what is blocking it and what to change.
      </Notice>
      <div>
        <h4 className="text-sm font-semibold text-[var(--color-ink)]">What to change</h4>
        <ul className="mt-1 grid list-disc gap-1 pl-5 text-sm text-[var(--color-ink-2)]">
          {result.suggestedFixes.map((fix) => (
            <li key={fix}>{fix}</li>
          ))}
        </ul>
      </div>
      {result.nearMisses.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-[var(--color-ink)]">Nearest misses</h4>
          <ul className="mt-1 grid gap-2">
            {result.nearMisses.map((miss) => (
              <li key={miss.calculation.camera.id} className="rounded-control border border-[var(--color-border)] px-3 py-2 text-sm">
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
        </div>
      )}
      <RequirementRows result={result} compact />
    </>
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
  return 'Most often: ' + top.map(([k, n]) => `${n} on ${LABELS[k] ?? k}`).join(', ') + '.';
}
