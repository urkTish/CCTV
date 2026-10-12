/**
 * Renovation → Quantities (every figure with "how this was calculated") and
 * → BOQ & programme (by room / by trade, totals, VAT, payment schedule, Gantt).
 */

import { useState } from 'react';

import { Card, EmptyState, EstimateBadge, Notice, TabPanel, Tabs } from '../../ui/primitives.tsx';
import type { Boq, BoqGroup } from '../boq.ts';
import { money, moneyRound } from '../format.ts';
import { DEFAULT_CREW, type Programme } from '../programme.ts';
import { TRADE_LABEL, type Trade } from '../model.ts';
import type { OrderLine } from '../quantities.ts';
import { updateLine } from '../rnState.ts';
import { num } from '../trace.ts';
import { FigureExplain, FigureValue, Num } from './kit.tsx';
import type { RnSectionProps } from './OverviewSections.tsx';

const KIND_LABEL: Readonly<Record<OrderLine['kind'], string>> = {
  'paint-L': 'Paint',
  tiles: 'Tiles',
  'adhesive-kg': 'Adhesive',
  'grout-kg': 'Grout',
  'skirting-pieces': 'Skirting',
  boards: 'Gypsum boards',
  'angle-m': 'Perimeter angle',
};

export function QuantitiesSection({ derived, onNavigate }: RnSectionProps) {
  const q = derived.quantities;
  if (!q || q.rooms.every((r) => r.items.length === 0))
    return (
      <EmptyState icon="square" title="No quantities yet">
        Specify finishes for a room first.{' '}
        <button type="button" className="font-semibold text-[var(--color-accent)] hover:underline" onClick={() => onNavigate('rn-spec')}>
          Go to Specification
        </button>
      </EmptyState>
    );
  return (
    <div className="grid gap-4">
      <Card title="Materials to order" subtitle="Summed across rooms, then rounded up to packs, boxes, bags and boards. Paint of the same product and colour is combined before packs are chosen." flush>
        <div className="overflow-x-auto">
          <table className="stack-table w-full text-sm">
            <thead>
              <tr className="text-xs text-[var(--color-ink-3)]">
                <th className="px-3 py-2 text-start font-medium">Material</th>
                <th className="px-3 py-2 text-start font-medium">Rooms</th>
                <th className="px-3 py-2 text-end font-medium">Needed (net + waste)</th>
                <th className="px-3 py-2 text-end font-medium">To buy</th>
              </tr>
            </thead>
            <tbody>
              {q.order.map((o) => (
                <tr key={o.key} className="border-t border-[var(--color-border)] align-top">
                  <td className="px-3 py-2" data-label="Material">
                    <span className="block text-xs text-[var(--color-ink-3)]">{KIND_LABEL[o.kind]}</span>
                    <span className="font-medium text-[var(--color-ink)]">{o.name}</span>
                    {o.colour && <span className="block text-xs text-[var(--color-ink-2)]">{o.colour}</span>}
                  </td>
                  <td className="px-3 py-2 text-[var(--color-ink-2)]" data-label="Rooms">
                    {o.rooms.join(', ')}
                  </td>
                  <td className="px-3 py-2 text-end" data-label="Needed">
                    <div>
                      <FigureValue f={o.net} />
                      <FigureExplain f={o.net} label={`${o.name} needed`} />
                    </div>
                  </td>
                  <td className="px-3 py-2 text-end" data-label="To buy">
                    <div>
                      <span className="font-mono font-semibold text-[var(--color-ink)]">
                        {num(o.purchase.value)} {o.purchase.unit}
                      </span>
                      {o.packs && <span className="block text-xs text-[var(--color-ink-2)]">{o.packs}</span>}
                      <FigureExplain f={o.purchase} label={`${o.name} to buy`} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {q.rooms.map((r) => (
        <Card key={r.roomId} title={r.roomName} subtitle={r.geometry ? `${num(r.geometry.floorArea.value)} m² floor · ${num(r.geometry.netWall.value)} m² net wall · H ${num(r.geometry.height.value)} m` : 'Not measured'}>
          {r.warnings.length > 0 && (
            <div className="mb-3">
              <Notice kind="warning">
                <ul className="list-disc ps-4">
                  {r.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </Notice>
            </div>
          )}
          {r.items.length === 0 ? (
            <p className="text-sm text-[var(--color-ink-3)]">No work specified in this room.</p>
          ) : (
            <div className="grid gap-4 @4xl/section:grid-cols-2">
              <div>
                <h4 className="mb-1 text-xs font-semibold tracking-wide text-[var(--color-ink-3)] uppercase">Work (to the BOQ)</h4>
                <ul className="grid gap-2">
                  {r.items.map((it) => (
                    <li key={it.key} className="border-b border-[var(--color-border)] pb-2 text-sm last:border-0">
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-[var(--color-ink)]">{it.description}</span>
                        <FigureValue f={it.quantity} strong />
                      </div>
                      <FigureExplain f={it.quantity} label={it.description} />
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="mb-1 text-xs font-semibold tracking-wide text-[var(--color-ink-3)] uppercase">Materials (this room)</h4>
                <ul className="grid gap-2">
                  {r.figures.map((f) => (
                    <li key={f.label} className="border-b border-[var(--color-border)] pb-2 text-sm last:border-0">
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-[var(--color-ink-2)]">{f.label.replace(`${r.roomName} `, '')}</span>
                        <FigureValue f={f.figure} />
                      </div>
                      <FigureExplain f={f.figure} label={f.label} />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function BoqTable({ groups, currency, showRates = true, roomColumn = false }: { groups: readonly BoqGroup[]; currency: string; showRates?: boolean; roomColumn?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="stack-table w-full text-sm">
        <thead>
          <tr className="text-xs text-[var(--color-ink-3)]">
            <th className="px-3 py-2 text-start font-medium">Ref</th>
            <th className="px-3 py-2 text-start font-medium">Description</th>
            {roomColumn && <th className="px-3 py-2 text-start font-medium">Room</th>}
            <th className="px-3 py-2 text-end font-medium">Quantity</th>
            {showRates && (
              <>
                <th className="px-3 py-2 text-end font-medium">Rate</th>
                <th className="px-3 py-2 text-end font-medium">Amount ({currency})</th>
              </>
            )}
          </tr>
        </thead>
        {groups.map((g) => (
          <tbody key={g.id}>
            <tr className="bg-[var(--color-surface-2)]">
              <th colSpan={roomColumn ? 4 : 3} scope="rowgroup" className="px-3 py-1.5 text-start text-xs font-semibold tracking-wide text-[var(--color-ink-2)] uppercase">
                {g.label}
              </th>
              {showRates && (
                <td colSpan={2} className="px-3 py-1.5 text-end font-mono text-xs font-semibold text-[var(--color-ink-2)]">
                  {money(g.subtotal, '')}
                </td>
              )}
            </tr>
            {g.lines.map((l) => (
              <tr key={l.key} className="border-t border-[var(--color-border)] align-top">
                <td className="px-3 py-2 font-mono text-xs" data-label="Ref">
                  {l.ref}
                </td>
                <td className="px-3 py-2" data-label="Description">
                  <span className="text-[var(--color-ink)]">{l.description}</span>
                  <span className="block font-mono text-2xs text-[var(--color-ink-3)]">{l.rateCode}</span>
                </td>
                {roomColumn && (
                  <td className="px-3 py-2 text-[var(--color-ink-2)]" data-label="Room">
                    {l.roomName}
                  </td>
                )}
                <td className="px-3 py-2 text-end" data-label="Quantity">
                  <div>
                    <span className="font-mono">
                      {num(l.quantity.value)} {l.unit}
                    </span>
                    <FigureExplain f={l.quantity} label={`${l.ref} quantity`} />
                  </div>
                </td>
                {showRates && (
                  <>
                    <td className="px-3 py-2 text-end" data-label="Rate">
                      <span className="font-mono">{l.rate === null ? '—' : money(l.rate, '')}</span>
                      {l.rateSample && <span className="block text-2xs font-semibold text-[var(--color-marginal)]">sample rate</span>}
                      {!l.rateSample && l.rateUnverified && l.rate !== null && (
                        <span className="block">
                          <EstimateBadge />
                        </span>
                      )}
                      {l.rateExpired && <span className="block text-2xs font-semibold text-[var(--color-marginal)]">may be out of date</span>}
                    </td>
                    <td className="px-3 py-2 text-end font-mono font-semibold text-[var(--color-ink)]" data-label="Amount">
                      {l.amount === null ? <span className="text-[var(--color-fail)]">not priced</span> : money(l.amount, '')}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

export function BoqTotals({ boq }: { boq: Boq }) {
  const rows: [string, string, boolean?][] = [
    ['Subtotal', money(boq.subtotal, boq.currency)],
    [`Contingency (${num(boq.contingency.constants[0]?.value ?? 0)}%)`, money(boq.contingency.value, boq.currency)],
    ['Total before VAT', money(boq.beforeVat, boq.currency)],
    [`VAT (${num(boq.vat.constants[0]?.value ?? 0)}%)`, money(boq.vat.value, boq.currency)],
    ['Total including VAT', money(boq.total, boq.currency), true],
  ];
  return (
    <dl className="grid gap-1 text-sm">
      {rows.map(([k, v, strong]) => (
        <div key={k} className={`flex justify-between gap-4 ${strong ? 'border-t border-[var(--color-border-strong)] pt-1.5 text-base font-semibold text-[var(--color-ink)]' : 'text-[var(--color-ink-2)]'}`}>
          <dt>{k}</dt>
          <dd className="font-mono">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Gantt({ programme, compact = false }: { programme: Programme; compact?: boolean }) {
  const total = Math.max(1, programme.totalDays);
  const rowH = compact ? 18 : 24;
  const labelW = compact ? 150 : 200;
  const width = 720;
  const chartW = width - labelW - 44;
  const days = Math.ceil(total);
  const step = days > 40 ? 10 : days > 15 ? 5 : 1;
  const h = programme.activities.length * rowH + 28;
  return (
    <svg viewBox={`0 0 ${width} ${h}`} className="h-auto w-full" role="img" aria-label={`Programme: ${programme.activities.length} activities over ${num(total, 1)} working days`}>
      {Array.from({ length: Math.floor(days / step) + 1 }, (_, i) => i * step).map((d) => (
        <g key={d}>
          <line x1={labelW + (d / total) * chartW} x2={labelW + (d / total) * chartW} y1={0} y2={h - 18} stroke="var(--gantt-grid, #d4dae2)" strokeWidth="1" />
          <text x={labelW + (d / total) * chartW} y={h - 4} fontSize="10" textAnchor="middle" fill="var(--gantt-ink-3, #5b6878)">
            {d}
          </text>
        </g>
      ))}
      {programme.activities.map((a, i) => {
        const y = i * rowH + 2;
        const x = labelW + (a.start / total) * chartW;
        const w = Math.max(2, (a.duration.value / total) * chartW);
        return (
          <g key={a.id}>
            <text x={0} y={y + rowH * 0.65} fontSize={compact ? 10 : 12} fill="var(--gantt-ink, #10151c)">
              {a.label}
            </text>
            {a.milestone ? (
              <path d={`M${x} ${y + 3}l${rowH / 2 - 3} ${rowH / 2 - 3}l-${rowH / 2 - 3} ${rowH / 2 - 3}l-${rowH / 2 - 3}-${rowH / 2 - 3}z`} fill="var(--gantt-milestone, #10151c)" />
            ) : (
              <>
                <rect x={x} y={y + 4} width={w} height={rowH - 8} rx="2" fill="var(--gantt-bar, #536ffc)" />
                <text x={x + w + 4} y={y + rowH * 0.65} fontSize="10" fill="var(--gantt-ink-3, #5b6878)">
                  {num(a.duration.value, 1)} d
                </text>
              </>
            )}
          </g>
        );
      })}
      <text x={labelW} y={h - 4} fontSize="10" textAnchor="end" dx="-6" fill="var(--gantt-ink-3, #5b6878)">
        working day
      </text>
    </svg>
  );
}

export function BoqSection({ portal, onPortal, derived, onNavigate }: RnSectionProps) {
  const [view, setView] = useState<'room' | 'trade'>('room');
  const boq = derived.boq;
  const line = portal.renovation!;
  if (!boq || boq.lines.length === 0)
    return (
      <EmptyState icon="list" title="Nothing to price yet">
        Specify finishes for a room first.{' '}
        <button type="button" className="font-semibold text-[var(--color-accent)] hover:underline" onClick={() => onNavigate('rn-spec')}>
          Go to Specification
        </button>
      </EmptyState>
    );
  const prog = derived.programme;
  const trades = [...new Set(prog?.activities.filter((a) => !a.milestone).map((a) => a.trade) ?? [])] as Trade[];
  return (
    <div className="grid gap-4">
      {!boq.complete && (
        <Notice kind="error" title="The BOQ is incomplete">
          <ul className="list-disc ps-4">
            {boq.incompleteReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </Notice>
      )}
      {boq.sampleRateLines > 0 && (
        <Notice kind="warning" title={`${boq.sampleRateLines} line(s) use SAMPLE rates`}>
          Sample, replace with your rates in the Library. The proposal cannot be made Final while any are used.
        </Notice>
      )}
      <div className="grid gap-4 @5xl/section:grid-cols-[minmax(0,1fr)_20rem]">
        <Card title="Bill of quantities" flush>
          <div className="px-4 pt-3">
            <Tabs
              label="BOQ view"
              idBase="boq-view"
              size="sm"
              tabs={[
                { id: 'room', label: 'By room (client view)' },
                { id: 'trade', label: 'By trade (contract view)' },
              ]}
              active={view}
              onChange={setView}
            />
          </div>
          <TabPanel idBase="boq-view" id={view}>
            <BoqTable groups={view === 'room' ? boq.byRoom : boq.byTrade} currency={boq.currency} roomColumn={view === 'trade'} />
          </TabPanel>
        </Card>
        <div className="grid content-start gap-4">
          <Card title="Totals">
            <BoqTotals boq={boq} />
            <p className="mt-3 text-xs text-[var(--color-ink-3)]">
              Totals reconcile to the sum of the lines. {derived.firm ? 'The client sees the firm total.' : `Until the survey confirms every assumed value the client sees ${moneyRound(derived.range?.low ?? 0, '')}–${moneyRound(derived.range?.high ?? 0, boq.currency)}, subject to survey.`}
            </p>
          </Card>
          <Card title="Payment schedule" subtitle="Milestones from Settings (owner to confirm).">
            <ul className="grid gap-1.5 text-sm">
              {derived.payments?.rows.map((r) => (
                <li key={r.milestone.id} className="flex justify-between gap-3">
                  <span className="text-[var(--color-ink-2)]">
                    {r.milestone.label} <span className="text-[var(--color-ink-3)]">({num(r.milestone.percent)}%)</span>
                  </span>
                  <span className="font-mono text-[var(--color-ink)]">{money(r.amount, '')}</span>
                </li>
              ))}
            </ul>
            {derived.payments && !derived.payments.ok && <p className="mt-2 text-xs font-semibold text-[var(--color-fail)]">The milestones add up to {num(derived.payments.percentTotal)}%, not 100%.</p>}
          </Card>
        </div>
      </div>
      {prog && prog.activities.length > 0 && (
        <Card title={`Programme — ${num(prog.totalDays, 1)} working days`} subtitle="Duration = quantity ÷ (productivity × crew), rounded up to half days, plus holds; activities follow the standard renovation sequence.">
          <div className="gantt">
            <Gantt programme={prog} />
          </div>
          <div className="mt-4 grid gap-4 @4xl/section:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <ul className="grid gap-2 text-sm">
              {prog.activities
                .filter((a) => !a.milestone)
                .map((a) => (
                  <li key={a.id} className="border-b border-[var(--color-border)] pb-1.5 last:border-0">
                    <div className="flex justify-between gap-3">
                      <span className="text-[var(--color-ink)]">
                        {a.label} <span className="text-xs text-[var(--color-ink-3)]">· {a.rooms.join(', ')}</span>
                      </span>
                      <FigureValue f={a.duration} dp={1} />
                    </div>
                    <FigureExplain f={a.duration} label={a.label} />
                  </li>
                ))}
            </ul>
            <fieldset className="grid content-start gap-2">
              <legend className="text-sm font-semibold text-[var(--color-ink)]">Crew size per trade</legend>
              <div className="grid grid-cols-2 gap-2">
                {trades.map((t) => (
                  <Num
                    key={t}
                    label={TRADE_LABEL[t].replace(/^\d+ /, '')}
                    value={line.crews[t] ?? DEFAULT_CREW}
                    min={1}
                    max={20}
                    step={1}
                    onChange={(v) => v !== null && onPortal((p) => updateLine(p, (l) => ({ ...l, crews: { ...l.crews, [t]: Math.round(v) } })))}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        </Card>
      )}
    </div>
  );
}
