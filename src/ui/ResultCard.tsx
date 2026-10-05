/**
 * One recommended model.
 *
 * The fifteen-field table is the card's primary content and keeps the client's
 * spec-sheet format recognisable. Everything else — model number, lens, PoE,
 * price band, datasheet link — sits in a clearly secondary row above it, and the
 * calculation detail collapses into a disclosure below.
 */

import { buildOutputCard } from '../engine/outputCard.ts';
import type { Recommendation } from '../engine/recommend.ts';
import { CODEC_LABELS } from '../domain/bitrate.ts';
import { lengthFromMetres, lengthUnitLabel, round } from '../domain/units.ts';
import type { Location, UnitSystemState } from '../state/projectTypes.ts';
import { Card, VerdictBadge, EstimateBadge, Explain, type Verdict } from './primitives.tsx';
import { GeometrySketch } from './GeometrySketch.tsx';

const TIER_LABEL = { economy: 'Economy', standard: 'Standard', premium: 'Premium' } as const;

export function ResultCard({
  rec,
  location,
  units,
  showSketch,
}: {
  rec: Recommendation;
  location: Location;
  units: UnitSystemState;
  showSketch: boolean;
}) {
  const calc = rec.calculation;
  const cam = calc.camera;
  const card = buildOutputCard(cam);
  const u = lengthUnitLabel(units);
  const fmt = (m: number) => `${round(lengthFromMetres(m, units), 1)} ${u}`;

  return (
    <Card
      title={`${cam.model} — ${cam.marketingName}`}
      subtitle={`${rec.label.charAt(0).toUpperCase() + rec.label.slice(1)} · ${cam.series}`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <VerdictBadge verdict={calc.pixelDensity.verdict as Verdict}>
            {calc.pixelDensity.achievedPxPerMetre.toFixed(0)} px/m ·{' '}
            {calc.pixelDensity.verdict === 'pass'
              ? 'Pass'
              : calc.pixelDensity.verdict === 'marginal'
                ? 'Marginal'
                : 'Fail'}
          </VerdictBadge>
          <span className="text-xs text-[var(--color-ink-3)]">
            score {(rec.score.total * 100).toFixed(0)}%
          </span>
        </div>
      }
    >
      {/* --- the case for and against, in plain language --------------------- */}
      <div className="mb-4 grid gap-2">
        <p className="text-sm text-[var(--color-ink-2)]">
          <span className="font-semibold text-[var(--color-ink)]">Why this one. </span>
          {rec.why}
        </p>
        <p className="text-sm text-[var(--color-ink-2)]">
          <span className="font-semibold text-[var(--color-marginal)]">Weak point. </span>
          {rec.weakPoint}
        </p>
      </div>

      {/* --- secondary row: the commercial and ordering facts ---------------- */}
      <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 rounded-control bg-[var(--color-surface-2)] p-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-[var(--color-ink-3)]">Lens / FOV</dt>
          <dd className="text-[var(--color-ink)]">
            {calc.appliedFocalLengthMm.toFixed(1)} mm ·{' '}
            {calc.deliveredHorizontalFovDeg.toFixed(0)}&#176; H
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
            <span className="ml-1 text-xs text-[var(--color-ink-3)]">
              (verified {cam.verifiedOn})
            </span>
          </dd>
        </div>
      </dl>

      {/* --- the client's fifteen fields, in their order --------------------- */}
      <div className="overflow-hidden rounded-control border border-[var(--color-border)]">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Specification for {cam.model}, in the client spec-sheet field order
          </caption>
          <tbody>
            {card.map((field, i) => (
              <tr
                key={field.name}
                className={i % 2 === 0 ? 'bg-[var(--color-surface)]' : 'bg-[var(--color-surface-2)]'}
              >
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
                <td className="border-b border-[var(--color-border)] px-3 py-2 align-top text-[var(--color-ink-2)]">
                  {field.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {cam.notes && (
        <p className="mt-3 rounded-control border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-sm text-[var(--color-ink-2)]">
          <span className="font-semibold text-[var(--color-ink)]">Engineer's note. </span>
          {cam.notes}
        </p>
      )}

      {/* --- warnings ------------------------------------------------------- */}
      {calc.warnings.length > 0 && (
        <ul className="mt-3 grid gap-1.5">
          {calc.warnings.map((w) => (
            <li
              key={w}
              className="rounded-control border-l-4 px-3 py-2 text-sm"
              style={{
                borderColor: 'var(--color-marginal)',
                background: 'var(--color-marginal-soft)',
                color: 'var(--color-marginal)',
              }}
            >
              {w}
            </li>
          ))}
        </ul>
      )}

      {/* --- the calculation, with every formula ---------------------------- */}
      <details className="mt-4" open={rec.label === 'primary recommendation'}>
        <summary className="cursor-pointer text-sm font-semibold text-[var(--color-accent)]">
          Calculation summary ({calc.rows.length} figures)
        </summary>
        <div className="mt-2 grid gap-2">
          {calc.rows.map((row) => (
            <div
              key={row.label}
              className="rounded-control border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-[var(--color-ink)]">{row.label}</span>
                <span className="flex items-center gap-2">
                  <span className="font-mono text-sm text-[var(--color-ink)]">{row.display}</span>
                  {row.verdict && row.verdict !== 'info' && (
                    <VerdictBadge verdict={row.verdict as Verdict} />
                  )}
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
              <li className="mt-1 font-semibold text-[var(--color-ink)]">
                Total {(rec.score.total * 100).toFixed(1)}%
              </li>
            </ul>
          </div>

          <p className="text-xs text-[var(--color-ink-3)]">
            Recording at {CODEC_LABELS[calc.bitrate.codec]} {calc.bitrate.fps} fps,{' '}
            {location.requirements.motionLevel} motion.{' '}
            {location.requirements.cameraCount > 1 && (
              <>
                {location.requirements.cameraCount} cameras at this location:{' '}
                {((calc.bitrate.targetKbps * location.requirements.cameraCount) / 1000).toFixed(1)} Mbps
                and {(calc.storageGbForRetention * location.requirements.cameraCount).toFixed(0)} GB
                over {location.requirements.retentionDays} days.{' '}
              </>
            )}
            Target distance {fmt(location.geometry.targetDistanceMetres)}.
          </p>
        </div>
      </details>

      {showSketch && (
        <div className="mt-4 rounded-control border border-[var(--color-border)] p-3">
          <GeometrySketch
            calc={calc}
            targetDistanceMetres={location.geometry.targetDistanceMetres}
            mountHeightMetres={location.geometry.mountHeightMetres}
            targetHeightMetres={location.geometry.targetHeightMetres}
            units={units}
          />
        </div>
      )}
    </Card>
  );
}
