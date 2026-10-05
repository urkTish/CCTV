/**
 * One recommended model, in pieces the results tabs arrange.
 *
 * The fifteen-field table keeps the client's spec-sheet format recognisable:
 * exactly the fields in `CARD_FIELD_ORDER`, "Not specified" where the datasheet
 * is silent, "derived" on the three inferred fields. The ordering facts (lens,
 * PoE, price band, datasheet) sit in a secondary strip; the calculation trace is
 * its own panel with every formula behind "How this was calculated".
 */

import { buildOutputCard } from '../engine/outputCard.ts';
import type { Recommendation } from '../engine/recommend.ts';
import { CODEC_LABELS } from '../domain/bitrate.ts';
import { lengthFromMetres, lengthUnitLabel, round } from '../domain/units.ts';
import type { Location, UnitSystemState } from '../state/projectTypes.ts';
import { VerdictBadge, EstimateBadge, Explain, type Verdict } from './primitives.tsx';
import { Icon } from './icons.tsx';

const TIER_LABEL = { economy: 'Economy', standard: 'Standard', premium: 'Premium' } as const;

function verdictText(v: string): string {
  return v === 'pass' ? 'Pass' : v === 'marginal' ? 'Marginal' : 'Fail';
}

/** "212 px/m · Pass" — the density verdict, in the status colour, with text. */
export function DensityBadge({ rec }: { rec: Recommendation }) {
  const pd = rec.calculation.pixelDensity;
  return (
    <VerdictBadge verdict={pd.verdict as Verdict}>
      {pd.achievedPxPerMetre.toFixed(0)} px/m · {verdictText(pd.verdict)}
    </VerdictBadge>
  );
}

export function RecommendationHeading({ rec, level = 3 }: { rec: Recommendation; level?: 3 | 4 }) {
  const cam = rec.calculation.camera;
  const H = level === 3 ? 'h3' : 'h4';
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <H className="text-base font-semibold text-[var(--color-ink)]">
          {cam.model} — {cam.marketingName}
        </H>
        <p className="text-sm text-[var(--color-ink-3)]">
          {rec.label.charAt(0).toUpperCase() + rec.label.slice(1)} · {cam.series}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <DensityBadge rec={rec} />
        <span className="text-xs text-[var(--color-ink-3)]">score {(rec.score.total * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
}

export function WhyAndWeakPoint({ rec }: { rec: Recommendation }) {
  return (
    <div className="grid gap-2">
      <p className="text-sm text-[var(--color-ink-2)]">
        <span className="font-semibold text-[var(--color-ink)]">Why this one. </span>
        {rec.why}
      </p>
      <p className="text-sm text-[var(--color-ink-2)]">
        <span className="font-semibold text-[var(--color-marginal)]">Weak point. </span>
        {rec.weakPoint}
      </p>
    </div>
  );
}

/** The secondary row: the commercial and ordering facts. */
export function OrderingFacts({ rec }: { rec: Recommendation }) {
  const calc = rec.calculation;
  const cam = calc.camera;
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-control bg-[var(--color-surface-2)] p-3 text-sm sm:grid-cols-4">
      <div>
        <dt className="text-xs text-[var(--color-ink-3)]">Lens / FOV</dt>
        <dd className="text-[var(--color-ink)]">
          {calc.appliedFocalLengthMm.toFixed(1)} mm · {calc.deliveredHorizontalFovDeg.toFixed(0)}&#176; H
          {calc.lens.apertureFNumber !== null && ` · F${calc.lens.apertureFNumber}`}
        </dd>
      </div>
      <div>
        <dt className="text-xs text-[var(--color-ink-3)]">PoE</dt>
        <dd className="text-[var(--color-ink)]">
          {cam.poeMaxWatts === null
            ? `${calc.poe.standard.label}, draw not specified`
            : `${cam.poeMaxWatts} W · ${calc.poe.standard.label}`}
        </dd>
      </div>
      <div>
        <dt className="text-xs text-[var(--color-ink-3)]">Price band (indicative)</dt>
        <dd className="text-[var(--color-ink)]">{TIER_LABEL[cam.priceTier]}</dd>
      </div>
      <div>
        <dt className="text-xs text-[var(--color-ink-3)]">Datasheet</dt>
        <dd>
          <a
            href={cam.datasheetUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-[var(--color-accent)] underline"
          >
            Hikvision PDF
          </a>
          <span className="ml-1 text-xs text-[var(--color-ink-3)]">(verified {cam.verifiedOn})</span>
        </dd>
      </div>
    </dl>
  );
}

/** The client's fifteen fields, in their order. */
export function SpecSheetTable({ rec }: { rec: Recommendation }) {
  const cam = rec.calculation.camera;
  const card = buildOutputCard(cam);
  return (
    <div className="overflow-hidden rounded-control border border-[var(--color-border)]">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Specification for {cam.model}, in the client spec-sheet field order</caption>
        <tbody>
          {card.map((field, i) => (
            <tr key={field.name} className={i % 2 === 0 ? 'bg-[var(--color-surface)]' : 'bg-[var(--color-surface-2)]'}>
              <th
                scope="row"
                className="w-2/5 border-b border-[var(--color-border)] px-3 py-2 text-left align-top font-medium text-[var(--color-ink)]"
              >
                {field.name}
                {field.derived && (
                  <span
                    className="ml-1.5 align-middle text-[10px] font-semibold tracking-wide text-[var(--color-estimate)] uppercase"
                    title="Inferred from other verified fields, not stated on the datasheet."
                  >
                    derived
                  </span>
                )}
              </th>
              <td className="border-b border-[var(--color-border)] px-3 py-2 align-top text-[var(--color-ink-2)]">{field.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EngineerNote({ rec }: { rec: Recommendation }) {
  const notes = rec.calculation.camera.notes;
  if (!notes) return null;
  return (
    <p className="rounded-control border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-sm text-[var(--color-ink-2)]">
      <span className="font-semibold text-[var(--color-ink)]">Engineer&rsquo;s note. </span>
      {notes}
    </p>
  );
}

export function CalcWarnings({ rec }: { rec: Recommendation }) {
  const warnings = rec.calculation.warnings;
  if (warnings.length === 0) return null;
  return (
    <ul className="grid gap-1.5" aria-label="Warnings">
      {warnings.map((w) => (
        <li
          key={w}
          className="flex gap-2 rounded-control border-l-4 px-3 py-2 text-sm"
          style={{ borderColor: 'var(--color-marginal)', background: 'var(--color-marginal-soft)', color: 'var(--color-marginal)' }}
        >
          <Icon name="alert" size={16} className="mt-0.5" />
          <span>{w}</span>
        </li>
      ))}
    </ul>
  );
}

/** The calculation, with every formula. */
export function CalculationRows({ rec, location, units }: { rec: Recommendation; location: Location; units: UnitSystemState }) {
  const calc = rec.calculation;
  const u = lengthUnitLabel(units);
  const fmt = (m: number) => `${round(lengthFromMetres(m, units), 1)} ${u}`;
  return (
    <div className="grid gap-2">
      {calc.rows.map((row) => (
        <div key={row.label} className="rounded-control border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-[var(--color-ink)]">{row.label}</span>
            <span className="flex items-center gap-2">
              <span className="font-mono text-sm text-[var(--color-ink)]">{row.display}</span>
              {row.verdict && row.verdict !== 'info' && <VerdictBadge verdict={row.verdict as Verdict} />}
              {row.isEstimate && <EstimateBadge />}
            </span>
          </div>
          <Explain formula={row.formula} sourceUrl={row.sourceUrl} />
        </div>
      ))}

      <div className="rounded-control border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm">
        <p className="font-medium text-[var(--color-ink)]">Score breakdown</p>
        <ul className="mt-1 grid gap-0.5 text-xs text-[var(--color-ink-2)]">
          <li>Pixel density {(rec.score.pixelDensity * 100).toFixed(0)}% (weight 35%)</li>
          <li>Lens fit {(rec.score.lensFit * 100).toFixed(0)}% (weight 20%)</li>
          <li>Low light {(rec.score.lowLight * 100).toFixed(0)}% (weight 20%)</li>
          <li>Feature match {(rec.score.featureMatch * 100).toFixed(0)}% (weight 15%)</li>
          <li>Budget {(rec.score.budget * 100).toFixed(0)}% (weight 10%)</li>
          <li className="mt-1 font-semibold text-[var(--color-ink)]">Total {(rec.score.total * 100).toFixed(1)}%</li>
        </ul>
      </div>

      <p className="text-xs text-[var(--color-ink-3)]">
        Recording at {CODEC_LABELS[calc.bitrate.codec]} {calc.bitrate.fps} fps, {location.requirements.motionLevel} motion.{' '}
        {location.requirements.cameraCount > 1 && (
          <>
            {location.requirements.cameraCount} cameras at this location:{' '}
            {((calc.bitrate.targetKbps * location.requirements.cameraCount) / 1000).toFixed(1)} Mbps and{' '}
            {(calc.storageGbForRetention * location.requirements.cameraCount).toFixed(0)} GB over {location.requirements.retentionDays} days.{' '}
          </>
        )}
        Target distance {fmt(location.geometry.targetDistanceMetres)}.
      </p>
    </div>
  );
}

/**
 * An alternative, compact: heading, the case for and against, the ordering
 * facts and warnings; the spec sheet and the calculation behind disclosures so
 * alternatives can be compared without scrolling past three full cards.
 */
export function AlternativeCard({ rec, location, units }: { rec: Recommendation; location: Location; units: UnitSystemState }) {
  return (
    <article className="grid gap-3 rounded-card border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <RecommendationHeading rec={rec} level={4} />
      <WhyAndWeakPoint rec={rec} />
      <OrderingFacts rec={rec} />
      <CalcWarnings rec={rec} />
      <details>
        <summary className="cursor-pointer text-sm font-semibold text-[var(--color-accent)]">Spec sheet (15 fields)</summary>
        <div className="mt-2 grid gap-2">
          <SpecSheetTable rec={rec} />
          <EngineerNote rec={rec} />
        </div>
      </details>
      <details>
        <summary className="cursor-pointer text-sm font-semibold text-[var(--color-accent)]">
          Calculation summary ({rec.calculation.rows.length} figures)
        </summary>
        <div className="mt-2">
          <CalculationRows rec={rec} location={location} units={units} />
        </div>
      </details>
    </article>
  );
}
