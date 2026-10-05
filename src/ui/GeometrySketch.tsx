/**
 * The geometry, drawn. Two views, redrawn live as the inputs change:
 *
 *   Side elevation — mounting height, tilt, the FOV cone, the blind spot and the
 *                    target. This is the one that makes "the camera is too high"
 *                    obvious to someone who has never read a spec sheet.
 *   Plan view      — the coverage width at the target and the footprint on the
 *                    ground.
 *
 * Deliberately a schematic, not a render: one SVG, scaled to the scenario, with
 * every dimension labelled. Colours come from the theme tokens so it reads in
 * both light and dark mode.
 */

import { degToRad } from '../domain/units.ts';
import type { CameraCalculation } from '../domain/calculate.ts';
import { lengthFromMetres, lengthUnitLabel, round } from '../domain/units.ts';
import type { UnitSystemState } from '../state/projectTypes.ts';

interface Props {
  readonly calc: CameraCalculation;
  readonly targetDistanceMetres: number;
  readonly mountHeightMetres: number;
  readonly targetHeightMetres: number;
  readonly units: UnitSystemState;
}

export function GeometrySketch({
  calc,
  targetDistanceMetres,
  mountHeightMetres,
  targetHeightMetres,
  units,
}: Props) {
  const u = lengthUnitLabel(units);
  const fmt = (metres: number) => `${round(lengthFromMetres(metres, units), 1)} ${u}`;

  // --- side elevation ------------------------------------------------------
  const sideW = 680;
  const sideH = 260;
  const padL = 56;
  const padR = 26;
  const padT = 20;
  const padB = 36;
  const plotW = sideW - padL - padR;
  const plotH = sideH - padT - padB;

  // Draw out to 1.25x the target so the far edge of the cone is visible.
  const xMaxM = targetDistanceMetres * 1.25;
  const yMaxM = Math.max(mountHeightMetres * 1.3, 2.5);
  const sx = (m: number) => padL + (m / xMaxM) * plotW;
  const sy = (m: number) => padT + plotH - (m / yMaxM) * plotH;

  const tiltRad = degToRad(calc.tiltDeg);
  const halfVRad = degToRad(calc.deliveredVerticalFovDeg / 2);
  const topRay = tiltRad - halfVRad; // positive = still below horizontal
  const bottomRay = tiltRad + halfVRad;

  /** Where a ray at `angleBelowHorizontal` from the lens meets the floor or the plot edge. */
  function rayEnd(angleBelowHorizontal: number): { x: number; y: number } {
    if (angleBelowHorizontal <= 1e-6) {
      // Pointing at or above the horizon: run to the right-hand edge.
      return { x: xMaxM, y: mountHeightMetres - xMaxM * Math.tan(angleBelowHorizontal) };
    }
    const groundX = mountHeightMetres / Math.tan(angleBelowHorizontal);
    if (groundX <= xMaxM) return { x: groundX, y: 0 };
    return { x: xMaxM, y: mountHeightMetres - xMaxM * Math.tan(angleBelowHorizontal) };
  }

  const top = rayEnd(topRay);
  const bottom = rayEnd(bottomRay);
  const blind = Math.min(calc.blindSpotMetres, xMaxM);

  // --- plan view -----------------------------------------------------------
  const planW = 680;
  const planH = 220;
  const planPadT = 20;
  const planPadB = 34;
  const planPlotH = planH - planPadT - planPadB;
  const halfHRad = degToRad(Math.min(calc.deliveredHorizontalFovDeg, 179) / 2);
  const widthAtTarget = calc.deliveredSceneWidthMetres;
  const planXMaxM = Math.max(widthAtTarget * 1.15, 1);
  const px = (m: number) => planW / 2 + (m / planXMaxM) * (planW / 2 - 30);
  const py = (m: number) => planPadT + (m / xMaxM) * planPlotH;
  const planFarHalfWidth = Math.min(
    xMaxM * Math.tan(halfHRad),
    planXMaxM, // clamp so a 180-degree lens does not run off the canvas
  );

  const line = 'var(--color-border-strong)';
  const ink = 'var(--color-ink-2)';
  const faint = 'var(--color-ink-3)';
  const cone = 'var(--color-accent)';

  return (
    <div className="grid gap-4">
      <figure className="m-0">
        <figcaption className="mb-1 text-sm font-semibold text-[var(--color-ink)]">
          Side elevation
        </figcaption>
        <svg
          viewBox={`0 0 ${sideW} ${sideH}`}
          className="w-full"
          role="img"
          aria-label={`Side elevation: camera at ${fmt(mountHeightMetres)} looking down ${calc.tiltDeg.toFixed(0)} degrees at a target ${fmt(targetDistanceMetres)} away. Blind spot ${fmt(calc.blindSpotMetres)}.`}
        >
          {/* field of view cone */}
          <polygon
            points={`${sx(0)},${sy(mountHeightMetres)} ${sx(top.x)},${sy(Math.max(top.y, 0))} ${sx(bottom.x)},${sy(Math.max(bottom.y, 0))}`}
            fill={cone}
            fillOpacity="0.16"
            stroke={cone}
            strokeOpacity="0.5"
          />

          {/* ground */}
          <line x1={padL} y1={sy(0)} x2={sideW - padR} y2={sy(0)} stroke={line} strokeWidth="1.5" />
          {/* mounting surface */}
          <line
            x1={sx(0)}
            y1={sy(0)}
            x2={sx(0)}
            y2={sy(mountHeightMetres) - 6}
            stroke={line}
            strokeWidth="1.5"
          />

          {/* blind spot */}
          {blind > 0.05 && (
            <>
              <rect
                x={sx(0)}
                y={sy(0) - 8}
                width={sx(blind) - sx(0)}
                height={8}
                fill="var(--color-fail)"
                fillOpacity="0.35"
              />
              <text x={sx(blind / 2)} y={sy(0) + 16} fontSize="11" fill="var(--color-fail)" textAnchor="middle">
                blind {fmt(calc.blindSpotMetres)}
              </text>
            </>
          )}

          {/* camera */}
          <circle cx={sx(0)} cy={sy(mountHeightMetres)} r="6" fill={cone} />
          <text x={sx(0) - 10} y={sy(mountHeightMetres) - 10} fontSize="11" fill={ink} textAnchor="start">
            {fmt(mountHeightMetres)}
          </text>

          {/* target */}
          <line
            x1={sx(targetDistanceMetres)}
            y1={sy(0)}
            x2={sx(targetDistanceMetres)}
            y2={sy(Math.max(targetHeightMetres, 0.2))}
            stroke="var(--color-ink)"
            strokeWidth="3"
          />
          <circle
            cx={sx(targetDistanceMetres)}
            cy={sy(Math.max(targetHeightMetres, 0.2)) - 4}
            r="4"
            fill="var(--color-ink)"
          />
          <text
            x={sx(targetDistanceMetres)}
            y={sy(0) + 16}
            fontSize="11"
            fill={ink}
            textAnchor="middle"
          >
            target {fmt(targetDistanceMetres)}
          </text>

          {/* tilt label */}
          <text x={sx(0) + 14} y={sy(mountHeightMetres) + 16} fontSize="11" fill={faint}>
            {calc.tiltDeg.toFixed(0)}&#176; down, {calc.deliveredVerticalFovDeg.toFixed(0)}&#176; vertical FOV
          </text>

          {/* slant range */}
          <line
            x1={sx(0)}
            y1={sy(mountHeightMetres)}
            x2={sx(targetDistanceMetres)}
            y2={sy(Math.max(targetHeightMetres, 0.2))}
            stroke={faint}
            strokeDasharray="4 3"
          />
        </svg>
      </figure>

      <figure className="m-0">
        <figcaption className="mb-1 text-sm font-semibold text-[var(--color-ink)]">
          Plan view
        </figcaption>
        <svg
          viewBox={`0 0 ${planW} ${planH}`}
          className="w-full"
          role="img"
          aria-label={`Plan view: ${calc.deliveredHorizontalFovDeg.toFixed(0)} degree horizontal field of view covering ${fmt(widthAtTarget)} of width at ${fmt(targetDistanceMetres)}, a ground footprint of about ${calc.coverageAreaSquareMetres.toFixed(0)} square metres.`}
        >
          <polygon
            points={`${px(0)},${py(0)} ${px(-planFarHalfWidth)},${py(xMaxM)} ${px(planFarHalfWidth)},${py(xMaxM)}`}
            fill={cone}
            fillOpacity="0.16"
            stroke={cone}
            strokeOpacity="0.5"
          />

          {/* coverage width at the target distance */}
          <line
            x1={px(-widthAtTarget / 2)}
            y1={py(targetDistanceMetres)}
            x2={px(widthAtTarget / 2)}
            y2={py(targetDistanceMetres)}
            stroke="var(--color-ink)"
            strokeWidth="2"
          />
          <text
            x={planW / 2}
            y={py(targetDistanceMetres) - 7}
            fontSize="11"
            fill={ink}
            textAnchor="middle"
          >
            {fmt(widthAtTarget)} wide at {fmt(targetDistanceMetres)}
          </text>

          <circle cx={px(0)} cy={py(0)} r="6" fill={cone} />
          <text x={px(0) + 12} y={py(0) + 4} fontSize="11" fill={faint}>
            {calc.deliveredHorizontalFovDeg.toFixed(0)}&#176; horizontal
          </text>

          <text x={planW / 2} y={planH - 10} fontSize="11" fill={faint} textAnchor="middle">
            ground footprint about {calc.coverageAreaSquareMetres.toFixed(0)} m&#178; &#183;{' '}
            {calc.pixelDensity.achievedPxPerMetre.toFixed(0)} px/m at the target
          </text>
        </svg>
      </figure>
    </div>
  );
}
