/**
 * The project-wide results (N1), one card per Admin section: storage and the
 * drive set, the recorder with its checks, the PoE switches, and the CAT6 plan.
 * Each renders part of the `ProjectDesign` object and nothing else — no figure
 * is computed here.
 */

import { NVR_ANALYTIC_LABELS } from '../domain/designSettings.ts';
import { lengthFromMetres, lengthUnitLabel, round } from '../domain/units.ts';
import type { NvrCheck, NvrRecommendation } from '../engine/nvrEngine.ts';
import type { ProjectDesign } from '../engine/projectDesign.ts';
import type { SwitchCheck } from '../engine/switchEngine.ts';
import type { UnitSystemState } from '../state/projectTypes.ts';
import { Card, EmptyState, EstimateBadge, Explain, Notice, Stat, VerdictBadge } from './primitives.tsx';

function Datasheet({ url }: { url: string }) {
  return (
    <a href={url} target="_blank" rel="noreferrer noopener" className="text-xs text-[var(--color-accent)] underline">
      Datasheet
    </a>
  );
}

function ChecksTable({ checks, caption }: { checks: readonly (NvrCheck | SwitchCheck)[]; caption: string }) {
  return (
    <div className="relative overflow-x-auto">
      <table className="stack-table w-full text-left text-sm sm:min-w-[640px]">
        <caption className="sr-only">{caption}</caption>
        <thead className="text-xs text-[var(--color-ink-3)]">
          <tr>
            <th scope="col" className="py-1 pr-2">Check</th>
            <th scope="col" className="py-1 pr-2">Required</th>
            <th scope="col" className="py-1 pr-2">Offered</th>
            <th scope="col" className="py-1 pr-2">Margin</th>
            <th scope="col" className="py-1">Verdict</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((c) => (
            <tr key={c.id} className="border-t border-[var(--color-border)] align-top">
              <th scope="row" className="py-1 pr-2 font-medium text-[var(--color-ink)]">{c.label}</th>
              <td data-label="Required" className="py-1 pr-2 text-[var(--color-ink-2)]">{c.required}</td>
              <td data-label="Offered" className="py-1 pr-2 text-[var(--color-ink-2)]">{c.offered}</td>
              <td data-label="Margin" className="py-1 pr-2 font-mono text-xs text-[var(--color-ink-2)]">{c.margin}</td>
              <td data-label="Verdict" className="py-1">
                <VerdictBadge verdict={c.verdict} />
                {'isEstimate' in c && c.isEstimate && <EstimateBadge />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NvrSummary({ rec }: { rec: NvrRecommendation }) {
  const n = rec.evaluation.nvr;
  return (
    <div>
      <p className="text-sm text-[var(--color-ink)]">
        <span className="font-semibold">{n.model}</span> <span className="text-[var(--color-ink-3)]">({rec.label})</span>{' '}
        <Datasheet url={n.datasheetUrl} />
      </p>
      <p className="mt-1 text-sm text-[var(--color-ink-2)]">{rec.why}</p>
      <p className="mt-1 text-sm text-[var(--color-marginal)]">Weak point: {rec.weakPoint}</p>
    </div>
  );
}

interface ResultProps {
  design: ProjectDesign;
  units: UnitSystemState;
}

function useLen(units: UnitSystemState) {
  const u = lengthUnitLabel(units);
  return (m: number) => `${round(lengthFromMetres(m, units), 1)} ${u}`;
}

/** Stage failures (a setting out of range…), shown where they stop the design. */
export function DesignErrors({ design }: { design: ProjectDesign }) {
  if (design.errors.length === 0) return null;
  return (
    <Notice kind="error" role="alert" title="Part of the design could not be computed">
      {design.errors.map((e) => (
        <p key={e}>{e}</p>
      ))}
    </Notice>
  );
}

function NoCameras() {
  return (
    <EmptyState icon="camera" title="No cameras to design for yet">
      No location has a recommended camera yet, so there is nothing to record, power or cable.
    </EmptyState>
  );
}

function WarningList({ items }: { items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="grid gap-1 text-sm text-[var(--color-marginal)]" aria-label="Warnings">
      {items.map((w) => (
        <li key={w} className="flex gap-2">
          <span aria-hidden="true">•</span>
          <span>{w}</span>
        </li>
      ))}
    </ul>
  );
}

/** Storage needed, the trace, and the drive set that fits the chosen recorder. */
export function StorageResults({ design }: ResultProps) {
  const { storage, nvr } = design;
  const drivePlan = nvr?.primary?.evaluation.drivePlan ?? null;
  return (
    <Card title="Storage" subtitle="Σ bitrate × recording time × retention, then growth headroom, then formatting.">
      {design.instances.length === 0 ? (
        <NoCameras />
      ) : (
        <div className="grid gap-4">
          {storage && drivePlan?.ok && (
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Usable needed" value={`${storage.requiredUsableTb.toFixed(2)} TB`} note="after headroom and formatting" />
              <Stat label="Usable installed" value={`${round(drivePlan.config.usableTb, 2)} TB`} note={`${drivePlan.config.rawTb} TB raw`} />
              <Stat label="Drives" value={`${drivePlan.config.totalDrives} × ${drivePlan.config.drive.capacityTb} TB`} note={drivePlan.config.drive.model} />
            </div>
          )}
          {storage && (
            <div className="grid gap-2">
              {storage.rows.map((r) => (
                <div key={r.label} className="text-sm">
                  <span className="text-[var(--color-ink-2)]">{r.label}: </span>
                  <span className="font-mono text-[var(--color-ink)]">{r.display}</span> {r.isEstimate && <EstimateBadge />}
                  <Explain formula={r.formula} sourceUrl={r.sourceUrl} />
                </div>
              ))}
            </div>
          )}
          {drivePlan?.ok ? (
            <div className="text-sm">
              <p className="text-[var(--color-ink)]">
                <span className="font-semibold">
                  {drivePlan.config.totalDrives} × {drivePlan.config.drive.capacityTb} TB {drivePlan.config.drive.marketingName}
                </span>{' '}
                ({drivePlan.config.drive.model}) — {drivePlan.config.rawTb} TB raw, {round(drivePlan.config.usableTb, 2)} TB usable{' '}
                <Datasheet url={drivePlan.config.drive.datasheetUrl} />
              </p>
              <Explain formula={drivePlan.config.explanation} sourceUrl={drivePlan.config.drive.datasheetUrl} />
              {drivePlan.alternatives.length > 0 && (
                <p className="mt-1 text-xs text-[var(--color-ink-3)]">
                  Also fits: {drivePlan.alternatives.map((a) => `${a.totalDrives} × ${a.drive.model} (${a.drive.marketingName})`).join('; ')}.
                </p>
              )}
              <WarningList items={drivePlan.config.warnings} />
            </div>
          ) : (
            nvr?.storageAdvice && (
              <Notice kind="error" title={nvr.storageAdvice.message}>
                <ul className="mt-1 list-disc pl-5 text-[var(--color-ink-2)]">
                  {nvr.storageAdvice.suggestions.map((sg) => (
                    <li key={sg}>{sg}</li>
                  ))}
                </ul>
              </Notice>
            )
          )}
        </div>
      )}
    </Card>
  );
}

/** The recorder: primary with every check, alternatives, rejections, near misses. */
export function RecorderResults({ design }: ResultProps) {
  const { nvr } = design;
  const primary = nvr?.primary ?? null;
  return (
    <Card title="Recorder (NVR)" subtitle={nvr ? `${nvr.channelsNeeded} channels needed. ${design.poeMode.reason}` : design.poeMode.reason}>
      {design.instances.length === 0 ? (
        <NoCameras />
      ) : (
        <div className="grid gap-3">
          {primary ? (
            <>
              <NvrSummary rec={primary} />
              <ChecksTable checks={primary.evaluation.checks} caption={`Recorder checks for ${primary.evaluation.nvr.model}`} />
              {nvr && nvr.alternatives.length > 0 && (
                <details className="text-sm">
                  <summary className="cursor-pointer font-medium text-[var(--color-accent)]">Alternatives ({nvr.alternatives.length})</summary>
                  <div className="mt-2 grid gap-3">
                    {nvr.alternatives.map((a) => (
                      <NvrSummary key={a.evaluation.nvr.id} rec={a} />
                    ))}
                  </div>
                </details>
              )}
            </>
          ) : (
            nvr && (
              <div className="text-sm">
                <Notice kind="error" title="No recorder in the catalogue passes every check." />
                <ul className="mt-2 list-disc pl-5 text-[var(--color-ink-2)]">
                  {nvr.suggestedFixes.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                {nvr.nearMisses.map((e) => (
                  <p key={e.nvr.id} className="mt-1 text-xs text-[var(--color-ink-3)]">
                    Near miss {e.nvr.model}: fails {e.failed.map((c) => c.label).join(', ')}.
                  </p>
                ))}
              </div>
            )
          )}
          {nvr && <WarningList items={nvr.notices} />}
          {nvr && nvr.rejections.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer font-medium text-[var(--color-accent)]">Rejected recorders ({nvr.rejections.length})</summary>
              <ul className="mt-1 list-disc pl-5 text-xs text-[var(--color-ink-2)]">
                {nvr.rejections.map((r) => (
                  <li key={r.nvr.id}>
                    {r.nvr.model}: {r.reasons.join('; ')}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {primary && primary.evaluation.nvr.analytics.length > 0 && (
            <p className="text-xs text-[var(--color-ink-3)]">
              Recorder analytics on {primary.evaluation.nvr.model}: {primary.evaluation.nvr.analytics.map((a) => NVR_ANALYTIC_LABELS[a]).join(', ')}.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

/** PoE switches per group (the rack and each IDF placed on the map). */
export function SwitchResults({ design, units }: ResultProps) {
  const { switches } = design;
  const len = useLen(units);
  return (
    <Card title="PoE switches" subtitle={design.poeMode.reason}>
      {design.instances.length === 0 ? (
        <NoCameras />
      ) : (
        <div className="grid gap-3">
          {switches && switches.groups.length === 0 && (
            <p className="text-sm text-[var(--color-ink-2)]">No external switch needed: every camera is powered by the recorder&rsquo;s own PoE ports.</p>
          )}
          {switches && switches.groups.length > 0 && (
            <p className="text-sm text-[var(--color-ink)]">
              {switches.switchCount} switch{switches.switchCount === 1 ? '' : 'es'} at {switches.groups.length} point{switches.groups.length === 1 ? '' : 's'} (the rack and any IDF placed on the site map).
            </p>
          )}
          {switches?.groups.map((g) => (
            <div key={g.group.id} className="rounded-control border border-[var(--color-border)] p-3">
              <p className="text-sm font-medium text-[var(--color-ink)]">
                {g.group.label}
                {g.group.uplinkMetres !== null && <span className="font-normal text-[var(--color-ink-3)]"> — uplink {len(g.group.uplinkMetres)} installed</span>}
              </p>
              <p className="text-xs text-[var(--color-ink-3)]">{g.managementReason}</p>
              {g.switches.map((s) => (
                <div key={s.id} className="mt-2">
                  <p className="text-sm text-[var(--color-ink)]">
                    <span className="font-semibold">{s.evaluation.model.model}</span> <Datasheet url={s.evaluation.model.datasheetUrl} />
                    <span className="text-[var(--color-ink-3)]"> — {s.groupLabel}</span>
                  </p>
                  <p className="text-xs text-[var(--color-ink-2)]">{s.why}</p>
                  <p className="text-xs text-[var(--color-ink-2)]">Cameras: {s.cameras.map((c) => `${c.label} (${len(c.runMetres)})`).join(', ')}</p>
                  <details className="mt-1 text-sm">
                    <summary className="cursor-pointer text-xs font-medium text-[var(--color-accent)]">Checks</summary>
                    <ChecksTable checks={s.evaluation.checks} caption={`Switch checks for ${s.evaluation.model.model}`} />
                  </details>
                </div>
              ))}
              {g.failure && (
                <div className="mt-2">
                  <Notice kind="error" title={g.failure.message}>
                    <ul className="list-disc pl-5 text-[var(--color-ink-2)]">
                      {g.failure.fixes.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  </Notice>
                </div>
              )}
            </div>
          ))}
          {switches && <WarningList items={switches.warnings} />}
        </div>
      )}
    </Card>
  );
}

/** The CAT6 plan: what to buy, then every run against TIA-568. */
export function CableResults({ design, units }: ResultProps) {
  const { cables } = design;
  const len = useLen(units);
  return (
    <Card title="CAT6 cable plan" subtitle="Whole runs packed into boxes (first-fit decreasing) — a run cannot be spliced across two boxes.">
      {!cables || cables.runs.length === 0 ? (
        <NoCameras />
      ) : (
        <div className="grid gap-4">
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 xl:grid-cols-6">
            {(
              [
                ['Boxes to buy', `${cables.packing.boxes.length} × ${cables.boxMetres} m`],
                ['Total ÷ box (naive)', String(cables.packing.naiveBoxCount)],
                ['Cable to buy', len(cables.packing.totalMetres)],
                ['RJ45 connectors', String(cables.connectors)],
                ['Patch cords', String(cables.patchCords)],
                ['Fibre uplinks', String(cables.fibreUplinks.length)],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="rounded-control bg-[var(--color-surface-2)] px-3 py-2">
                <dt className="text-xs text-[var(--color-ink-3)]">{k}</dt>
                <dd className="font-mono text-[var(--color-ink)]">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-[var(--color-ink-3)]">
            Offcut per box: {cables.packing.boxes.map((b) => len(b.offcutMetres)).join(', ') || 'none'}.
            {cables.isEstimate && ' Some runs are estimates; see the flags below.'}
          </p>
          {cables.fibreUplinks.length > 0 && (
            <Notice kind="warning" title="Fibre, not CAT6">
              {cables.fibreUplinks.map((f) => `${f.label} ${len(f.installedMetres)}`).join(', ')}.
            </Notice>
          )}
          <div className="relative overflow-x-auto">
            <table className="stack-table w-full text-left text-sm sm:min-w-[640px]">
              <caption className="sr-only">Cable runs</caption>
              <thead className="text-xs text-[var(--color-ink-3)]">
                <tr>
                  <th scope="col" className="py-1 pr-2">Run</th>
                  <th scope="col" className="py-1 pr-2">Installed</th>
                  <th scope="col" className="py-1 pr-2">To buy</th>
                  <th scope="col" className="py-1 pr-2">TIA-568</th>
                  <th scope="col" className="py-1">Basis</th>
                </tr>
              </thead>
              <tbody>
                {cables.runs.map((r) => (
                  <tr key={r.id} className="border-t border-[var(--color-border)] align-top">
                    <th scope="row" className="py-1.5 pr-2 font-medium text-[var(--color-ink)]">
                      {r.label}
                      <Explain formula={r.formula} sourceUrl={null} />
                    </th>
                    <td data-label="Installed" className="py-1.5 pr-2 font-mono">{len(r.installedMetres)}</td>
                    <td data-label="To buy" className="py-1.5 pr-2 font-mono">{len(r.purchasedMetres)}</td>
                    <td data-label="TIA-568" className="py-1.5 pr-2">
                      <VerdictBadge verdict={r.tia.verdict} />
                      {r.tia.verdict !== 'pass' && <p className="mt-0.5 text-xs text-[var(--color-ink-2)]">{r.tia.message} {r.tia.remedies.join(' ')}</p>}
                    </td>
                    <td data-label="Basis" className="py-1.5 text-xs text-[var(--color-ink-2)]">
                      <span>
                        {r.basis === 'entered' ? 'typed in' : r.basis === 'unplaced' || r.basis === 'uncalibrated' ? 'placeholder' : r.basis}{' '}
                        {r.isEstimate && <EstimateBadge />}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <WarningList items={cables.warnings} />
        </div>
      )}
    </Card>
  );
}
