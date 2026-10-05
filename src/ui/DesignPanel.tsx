/**
 * The project-wide results (N1): storage, the recorder and its drives, PoE
 * switches and the CAT6 plan. Functional, not final layout — it renders the
 * `ProjectDesign` object and nothing else, so it can be rearranged freely.
 */

import type { ReactNode } from 'react';

import { NVR_ANALYTIC_LABELS } from '../domain/designSettings.ts';
import { lengthFromMetres, lengthUnitLabel, round } from '../domain/units.ts';
import type { NvrCheck, NvrRecommendation } from '../engine/nvrEngine.ts';
import type { ProjectDesign } from '../engine/projectDesign.ts';
import type { SwitchCheck } from '../engine/switchEngine.ts';
import type { UnitSystemState } from '../state/projectTypes.ts';
import { Card, EstimateBadge, Explain, VerdictBadge } from './primitives.tsx';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5 first:mt-0">
      <h3 className="mb-2 text-sm font-semibold tracking-wide text-[var(--color-ink)] uppercase">{title}</h3>
      {children}
    </section>
  );
}

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
      <table className="w-full min-w-[640px] text-left text-sm">
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
              <td className="py-1 pr-2 text-[var(--color-ink-2)]">{c.required}</td>
              <td className="py-1 pr-2 text-[var(--color-ink-2)]">{c.offered}</td>
              <td className="py-1 pr-2 font-mono text-xs text-[var(--color-ink-2)]">{c.margin}</td>
              <td className="py-1">
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

export function DesignPanel({ design, units }: { design: ProjectDesign; units: UnitSystemState }) {
  const u = lengthUnitLabel(units);
  const len = (m: number) => `${round(lengthFromMetres(m, units), 1)} ${u}`;
  const { storage, nvr, switches, cables } = design;
  const primary = nvr?.primary ?? null;
  const drivePlan = primary?.evaluation.drivePlan ?? null;

  return (
    <Card
      title="System design"
      subtitle="Storage, recorder, PoE switching and cabling for the whole project, from every location's recommended camera and the site map."
    >
      {design.errors.length > 0 && (
        <div role="alert" className="mb-4 rounded-control border-l-4 px-3 py-2 text-sm" style={{ borderColor: 'var(--color-fail)', background: 'var(--color-fail-soft)', color: 'var(--color-fail)' }}>
          {design.errors.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </div>
      )}

      {design.instances.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-3)]">No location has a recommended camera yet, so there is nothing to record, power or cable.</p>
      ) : (
        <>
          {/* --- storage ------------------------------------------------------ */}
          <Section title="Storage">
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
              <div className="mt-3 text-sm">
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
              </div>
            ) : (
              nvr?.storageAdvice && (
                <div className="mt-3 text-sm text-[var(--color-fail)]">
                  <p className="font-semibold">{nvr.storageAdvice.message}</p>
                  <ul className="mt-1 list-disc pl-5 text-[var(--color-ink-2)]">
                    {nvr.storageAdvice.suggestions.map((sg) => (
                      <li key={sg}>{sg}</li>
                    ))}
                  </ul>
                </div>
              )
            )}
          </Section>

          {/* --- recorder ----------------------------------------------------- */}
          <Section title="Recorder (NVR)">
            <p className="mb-2 text-xs text-[var(--color-ink-3)]">
              {nvr ? `${nvr.channelsNeeded} channels needed. ` : ''}
              {design.poeMode.reason}
            </p>
            {primary ? (
              <>
                <NvrSummary rec={primary} />
                <div className="mt-2">
                  <ChecksTable checks={primary.evaluation.checks} caption={`Recorder checks for ${primary.evaluation.nvr.model}`} />
                </div>
                {nvr && nvr.alternatives.length > 0 && (
                  <details className="mt-2 text-sm">
                    <summary className="cursor-pointer text-[var(--color-accent)]">Alternatives ({nvr.alternatives.length})</summary>
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
                  <p className="font-semibold text-[var(--color-fail)]">No recorder in the catalogue passes every check.</p>
                  <ul className="mt-1 list-disc pl-5 text-[var(--color-ink-2)]">
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
            {nvr && nvr.notices.length > 0 && nvr.notices.map((x) => <p key={x} className="mt-1 text-xs text-[var(--color-marginal)]">{x}</p>)}
            {nvr && nvr.rejections.length > 0 && (
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer text-[var(--color-accent)]">Rejected recorders ({nvr.rejections.length})</summary>
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
              <p className="mt-1 text-xs text-[var(--color-ink-3)]">
                Recorder analytics on {primary.evaluation.nvr.model}: {primary.evaluation.nvr.analytics.map((a) => NVR_ANALYTIC_LABELS[a]).join(', ')}.
              </p>
            )}
          </Section>

          {/* --- switches ----------------------------------------------------- */}
          <Section title="PoE switches">
            {switches && switches.groups.length === 0 && (
              <p className="text-sm text-[var(--color-ink-2)]">No external switch needed: every camera is powered by the recorder&rsquo;s own PoE ports.</p>
            )}
            {switches && switches.groups.length > 0 && (
              <p className="mb-2 text-sm text-[var(--color-ink)]">
                {switches.switchCount} switch{switches.switchCount === 1 ? '' : 'es'} at {switches.groups.length} point{switches.groups.length === 1 ? '' : 's'} (the rack and any IDF placed on the site map).
              </p>
            )}
            {switches?.groups.map((g) => (
              <div key={g.group.id} className="mb-3 rounded-control border border-[var(--color-border)] p-3">
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
                    <p className="text-xs text-[var(--color-ink-2)]">
                      Cameras: {s.cameras.map((c) => `${c.label} (${len(c.runMetres)})`).join(', ')}
                    </p>
                    <details className="mt-1 text-sm">
                      <summary className="cursor-pointer text-xs text-[var(--color-accent)]">Checks</summary>
                      <ChecksTable checks={s.evaluation.checks} caption={`Switch checks for ${s.evaluation.model.model}`} />
                    </details>
                  </div>
                ))}
                {g.failure && (
                  <div className="mt-2 text-sm text-[var(--color-fail)]">
                    <p className="font-semibold">{g.failure.message}</p>
                    <ul className="list-disc pl-5 text-[var(--color-ink-2)]">
                      {g.failure.fixes.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </Section>

          {/* --- cabling ------------------------------------------------------ */}
          <Section title="CAT6 cabling">
            {cables && (
              <>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-6">
                  <div>
                    <dt className="text-xs text-[var(--color-ink-3)]">Boxes to buy</dt>
                    <dd className="font-mono text-[var(--color-ink)]">
                      {cables.packing.boxes.length} × {cables.boxMetres} m
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--color-ink-3)]">Total ÷ box (naive)</dt>
                    <dd className="font-mono text-[var(--color-ink)]">{cables.packing.naiveBoxCount}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--color-ink-3)]">Cable to buy</dt>
                    <dd className="font-mono text-[var(--color-ink)]">{len(cables.packing.totalMetres)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--color-ink-3)]">RJ45 connectors</dt>
                    <dd className="font-mono text-[var(--color-ink)]">{cables.connectors}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--color-ink-3)]">Patch cords</dt>
                    <dd className="font-mono text-[var(--color-ink)]">{cables.patchCords}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--color-ink-3)]">Fibre uplinks</dt>
                    <dd className="font-mono text-[var(--color-ink)]">{cables.fibreUplinks.length}</dd>
                  </div>
                </dl>
                <p className="mt-2 text-xs text-[var(--color-ink-3)]">
                  Boxes are counted by packing whole runs into {cables.boxMetres} m boxes (first-fit decreasing) — a run cannot be spliced across two boxes.
                  Offcut per box: {cables.packing.boxes.map((b) => len(b.offcutMetres)).join(', ') || 'none'}.
                  {cables.isEstimate && ' Some runs are estimates; see the flags below.'}
                </p>
                {cables.fibreUplinks.length > 0 && (
                  <p className="mt-1 text-sm text-[var(--color-marginal)]">
                    Fibre (not CAT6): {cables.fibreUplinks.map((f) => `${f.label} ${len(f.installedMetres)}`).join(', ')}.
                  </p>
                )}
                <div className="relative mt-3 overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
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
                          <th scope="row" className="py-1 pr-2 font-medium text-[var(--color-ink)]">
                            {r.label}
                            <Explain formula={r.formula} sourceUrl={null} />
                          </th>
                          <td className="py-1 pr-2 font-mono">{len(r.installedMetres)}</td>
                          <td className="py-1 pr-2 font-mono">{len(r.purchasedMetres)}</td>
                          <td className="py-1 pr-2">
                            <VerdictBadge verdict={r.tia.verdict} />
                            {r.tia.verdict !== 'pass' && <p className="mt-0.5 text-xs text-[var(--color-ink-2)]">{r.tia.message} {r.tia.remedies.join(' ')}</p>}
                          </td>
                          <td className="py-1 text-xs text-[var(--color-ink-2)]">
                            {r.basis === 'entered' ? 'typed in' : r.basis === 'unplaced' || r.basis === 'uncalibrated' ? 'placeholder' : r.basis}{' '}
                            {r.isEstimate && <EstimateBadge />}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Section>
        </>
      )}

      {design.warnings.length > 0 && (
        <Section title="Warnings">
          <ul className="list-disc pl-5 text-sm text-[var(--color-marginal)]">
            {design.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Section>
      )}
    </Card>
  );
}
