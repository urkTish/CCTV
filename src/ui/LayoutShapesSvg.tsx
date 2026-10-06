/**
 * Draws the site layout (rooms, walls, fences, curves, doors, windows, gates,
 * labels) inside an SVG whose user units are plan pixels. Used by the Site map
 * editor (theme colours) and by the client report (fixed print colours), so the
 * two always draw the same plan. Geometry comes from `domain/layoutShapes.ts`.
 *
 * Every symbol stays readable in greyscale: walls are thick, fences ticked,
 * boundaries dashed, the car park hatched.
 */

import type { ReactNode } from 'react';
import {
  openingGeometry,
  polylinePathD,
  rectCorners,
  smoothPathD,
  type AreaFill,
  type LayoutShape,
} from '../domain/layoutShapes.ts';
import { lineStroke, type PlanPalette } from './planPalette.ts';

function pathOf(shape: Extract<LayoutShape, { kind: 'rect' | 'polyline' | 'curve' }>): { d: string; closed: boolean } {
  if (shape.kind === 'rect') return { d: polylinePathD(rectCorners(shape), true), closed: true };
  if (shape.kind === 'polyline') return { d: polylinePathD(shape.points, shape.closed), closed: shape.closed };
  return { d: smoothPathD(shape.points, shape.closed), closed: shape.closed };
}

/** Pattern definitions (car-park hatch). `idBase` must be unique on the page. */
export function LayoutDefs({ idBase, palette, unit }: { idBase: string; palette: PlanPalette; unit: number }) {
  const s = unit * 1.2;
  return (
    <defs>
      <pattern id={`${idBase}-car-park`} patternUnits="userSpaceOnUse" width={s} height={s} patternTransform="rotate(45)">
        <rect width={s} height={s} fill={palette.fills['car-park']} />
        <line x1={0} y1={0} x2={0} y2={s} stroke={palette.hatch} strokeWidth={unit * 0.15} />
      </pattern>
    </defs>
  );
}

function fillOf(fill: AreaFill, palette: PlanPalette, idBase: string): string {
  if (fill === 'none') return 'none';
  if (fill === 'car-park') return `url(#${idBase}-car-park)`;
  return palette.fills[fill];
}

/**
 * One shape. With `hit`, an invisible wide stroke is added so thin lines are
 * easy to pick with a finger or a mouse.
 */
export function LayoutShapeGraphic({
  shape,
  palette,
  unit,
  metresPerPx,
  idBase,
  hit = false,
}: {
  shape: LayoutShape;
  palette: PlanPalette;
  unit: number;
  metresPerPx: number;
  idBase: string;
  hit?: boolean;
}): ReactNode {
  const hitStroke = (d: string, width = unit * 1.6) =>
    hit ? <path d={d} fill="none" stroke="transparent" strokeWidth={width} pointerEvents="stroke" /> : null;

  if (shape.kind === 'rect' || shape.kind === 'polyline' || shape.kind === 'curve') {
    const { d, closed } = pathOf(shape);
    const st = lineStroke(shape.stroke, unit);
    const fill = closed ? fillOf(shape.fill, palette, idBase) : 'none';
    return (
      <>
        <path
          d={d}
          fill={fill}
          fillOpacity={fill === 'none' ? undefined : palette.fillOpacity}
          stroke={palette.ink}
          strokeWidth={st.width}
          strokeDasharray={st.dash}
          strokeLinejoin={shape.stroke === 'wall' ? 'miter' : 'round'}
          strokeLinecap={shape.stroke === 'wall' ? 'square' : 'round'}
          pointerEvents={hit ? (fill === 'none' ? 'stroke' : 'visiblePainted') : undefined}
        />
        {shape.stroke === 'fence' && (
          // Short dashes of a wide stroke read as ticks across the line: the usual fence symbol.
          <path d={d} fill="none" stroke={palette.ink} strokeWidth={unit * 0.9} strokeDasharray={`${unit * 0.14} ${unit * 1.1}`} pointerEvents="none" />
        )}
        {hitStroke(d)}
      </>
    );
  }

  if (shape.kind === 'opening') {
    const g = openingGeometry(shape, shape.widthMetres / metresPerPx);
    const [a, b] = g.gap;
    const gapD = `M${a.x},${a.y} L${b.x},${b.y}`;
    const gate = shape.variant === 'gate';
    return (
      <>
        {palette.cutOpenings && <path d={gapD} stroke={palette.background} strokeWidth={unit * 0.75} pointerEvents="none" />}
        {g.frame.length > 0 && (
          <>
            <path d={polylinePathD(g.frame, true)} fill={palette.background} stroke={palette.ink} strokeWidth={unit * 0.15} />
            <path d={gapD} stroke={palette.ink} strokeWidth={unit * 0.12} />
          </>
        )}
        {g.leaves.map(([p, q], i) => (
          <line key={`l${i}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={palette.ink} strokeWidth={unit * (gate ? 0.3 : 0.22)} strokeLinecap="round" />
        ))}
        {g.arcs.map((d, i) => (
          <path key={`a${i}`} d={d} fill="none" stroke={palette.ink} strokeWidth={unit * 0.1} strokeDasharray={gate ? `${unit * 0.4} ${unit * 0.3}` : undefined} />
        ))}
        {hitStroke(gapD, unit * 2)}
        {hit && g.leaves.map(([p, q], i) => <path key={`h${i}`} d={`M${p.x},${p.y} L${q.x},${q.y}`} stroke="transparent" strokeWidth={unit * 1.4} pointerEvents="stroke" />)}
      </>
    );
  }

  // text
  return (
    <text
      x={shape.x}
      y={shape.y}
      fontSize={shape.sizePx}
      fontWeight={600}
      textAnchor="middle"
      dominantBaseline="central"
      transform={shape.rotationDeg ? `rotate(${shape.rotationDeg} ${shape.x} ${shape.y})` : undefined}
      fill={palette.ink}
      stroke={palette.background}
      strokeWidth={shape.sizePx * 0.2}
      paintOrder="stroke"
      style={{ userSelect: 'none' }}
    >
      {shape.text}
    </text>
  );
}

/** Every shape, in drawing order (first = bottom). For read-only maps such as the report. */
export function LayoutShapesSvg({
  shapes,
  palette,
  unit,
  metresPerPx,
  idBase,
}: {
  shapes: readonly LayoutShape[];
  palette: PlanPalette;
  unit: number;
  metresPerPx: number;
  idBase: string;
}) {
  if (shapes.length === 0) return null;
  return (
    <g aria-hidden="true">
      <LayoutDefs idBase={idBase} palette={palette} unit={unit} />
      {shapes.map((s) => (
        <g key={s.id}>
          <LayoutShapeGraphic shape={s} palette={palette} unit={unit} metresPerPx={metresPerPx} idBase={idBase} />
        </g>
      ))}
    </g>
  );
}

/** Grid lines every `gridPx`, every fifth darker. Skipped when it would be too dense to read. */
export function GridLines({ widthPx, heightPx, gridPx, unit }: { widthPx: number; heightPx: number; gridPx: number; unit: number }) {
  let step = gridPx;
  let major = 5;
  // Thin out a dense grid: show every 5th line (labelled as such by the caller) or none.
  if (widthPx / step + heightPx / step > 300) {
    step *= 5;
    major = 1;
  }
  if (widthPx / step + heightPx / step > 300) return null;
  const lines: ReactNode[] = [];
  const nx = Math.floor(widthPx / step);
  const ny = Math.floor(heightPx / step);
  for (let i = 0; i <= nx; i++) {
    const x = i * step;
    const isMajor = i % major === 0;
    lines.push(<line key={`x${i}`} x1={x} y1={0} x2={x} y2={heightPx} stroke={isMajor ? 'var(--color-border-strong)' : 'var(--color-border)'} strokeOpacity={isMajor ? 0.45 : 0.8} strokeWidth={unit * (isMajor ? 0.08 : 0.06)} />);
  }
  for (let j = 0; j <= ny; j++) {
    const y = j * step;
    const isMajor = j % major === 0;
    lines.push(<line key={`y${j}`} x1={0} y1={y} x2={widthPx} y2={y} stroke={isMajor ? 'var(--color-border-strong)' : 'var(--color-border)'} strokeOpacity={isMajor ? 0.45 : 0.8} strokeWidth={unit * (isMajor ? 0.08 : 0.06)} />);
  }
  return (
    <g aria-hidden="true" pointerEvents="none" data-testid="layout-grid">
      {lines}
    </g>
  );
}
