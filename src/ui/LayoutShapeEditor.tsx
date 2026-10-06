/**
 * Editing drawn layout shapes without a pointer: the fields for one shape
 * (shared by the Site map's side panel and the shape list, so the two cannot
 * drift apart), the shape list with its "Add …" buttons, and the form that
 * starts a blank drawn layout from the site's size in metres.
 *
 * Every edit is a pure function from `domain/layoutShapes.ts`.
 */

import { useId, useState } from 'react';

import {
  AREA_FILL_LABEL,
  AREA_FILLS,
  DEFAULT_GRID_METRES,
  LINE_STYLE_LABEL,
  LINE_STYLES,
  MAX_CANVAS_METRES,
  MIN_CANVAS_METRES,
  OPENING_LABEL,
  OPENING_VARIANTS,
  addShape,
  defaultShape,
  describeShape,
  duplicateShape,
  formatPoints,
  layoutOf,
  moveShapeTo,
  parsePoints,
  removeLayoutCanvas,
  removeShape,
  reorderShape,
  rotateShape,
  setGridMetres,
  setLayoutCanvas,
  shapeAnchor,
  shapeAreaPx2,
  shapeLengthPx,
  updateShape,
  type AreaFill,
  type DrawTool,
  type LayoutShape,
  type LineStyle,
  type OpeningVariant,
} from '../domain/layoutShapes.ts';
import type { Point, SitePlan } from '../domain/sitePlan.ts';
import { lengthFromMetres, lengthToMetres, lengthUnitLabel, round } from '../domain/units.ts';
import type { UnitSystemState } from '../state/projectTypes.ts';
import { Button, NumberInput } from './primitives.tsx';

export type Edit = (f: (p: SitePlan) => SitePlan) => boolean;

export const fieldClass =
  'w-full min-w-0 rounded-control border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2 py-1 text-sm text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:outline-none';
const labelClass = 'text-xs text-[var(--color-ink-2)]';

/** Sizes shown in the length unit when the plan has a scale, else in plan pixels. */
function sizeUnits(metresPerPx: number | null, units: UnitSystemState) {
  const u = lengthUnitLabel(units);
  return metresPerPx
    ? {
        label: u,
        show: (px: number) => round(lengthFromMetres(px * metresPerPx, units), 2),
        read: (v: number) => lengthToMetres(v, units) / metresPerPx,
        area: (px2: number) => {
          const m2 = px2 * metresPerPx * metresPerPx;
          return units === 'imperial' ? `${round(m2 * 10.7639, 0)} ft²` : `${round(m2, 1)} m²`;
        },
      }
    : { label: 'px', show: (px: number) => Math.round(px), read: (v: number) => v, area: (px2: number) => `${Math.round(px2)} px²` };
}

/** A text field that only applies non-empty text, so clearing it to retype is not an error. */
function LabelTextInput({ value, onApply, ariaLabel }: { value: string; onApply: (t: string) => void; ariaLabel?: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      aria-label={ariaLabel}
      className={fieldClass}
      maxLength={120}
      value={draft ?? value}
      onChange={(e) => {
        const t = e.currentTarget.value;
        setDraft(t);
        if (t.trim() !== '') onApply(t);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

/** "x,y x,y …" in plan pixels, applied on Enter or when the field loses focus. */
function PointsInput({ points, onApply, ariaLabel }: { points: readonly Point[]; onApply: (p: Point[]) => boolean; ariaLabel: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const errId = useId();
  const apply = () => {
    if (draft === null) return;
    const r = parsePoints(draft);
    if (!r.ok) {
      setError(r.reason);
      return;
    }
    if (onApply(r.points)) {
      setDraft(null);
      setError(null);
    }
  };
  return (
    <>
      <textarea
        aria-label={ariaLabel}
        aria-invalid={error !== null}
        aria-describedby={error ? errId : undefined}
        rows={2}
        className={`${fieldClass} font-mono`}
        value={draft ?? formatPoints(points)}
        onChange={(e) => setDraft(e.currentTarget.value)}
        onBlur={apply}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            apply();
          }
        }}
      />
      {error && (
        <span id={errId} role="alert" className="mt-1 block text-xs text-[var(--color-fail)]">
          {error}
        </span>
      )}
    </>
  );
}

/**
 * Every editable property of one shape. `name` prefixes the accessible names
 * so the same fields can appear in the side panel and in the list.
 */
export function ShapeFields({
  shape,
  name,
  units,
  metresPerPx,
  edit,
}: {
  shape: LayoutShape;
  name: string;
  units: UnitSystemState;
  metresPerPx: number | null;
  edit: Edit;
}) {
  const su = sizeUnits(metresPerPx, units);
  const u = lengthUnitLabel(units);
  const put = (next: LayoutShape) => edit((p) => updateShape(p, next));
  const num = (f: (v: number) => LayoutShape) => (v: number) => {
    if (Number.isFinite(v)) put(f(v));
  };
  const anchor = shapeAnchor(shape);
  const hasRotation = shape.kind !== 'polyline' && shape.kind !== 'curve';

  const styleSelects = (s: Extract<LayoutShape, { kind: 'rect' | 'polyline' | 'curve' }>) => (
    <>
      <label className={labelClass}>
        Line
        <select aria-label={`Line style of ${name}`} className={fieldClass} value={s.stroke} onChange={(e) => put({ ...s, stroke: e.currentTarget.value as LineStyle })}>
          {LINE_STYLES.map((l) => (
            <option key={l} value={l}>
              {LINE_STYLE_LABEL[l]}
            </option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        Fill
        <select
          aria-label={`Fill of ${name}`}
          className={fieldClass}
          value={s.fill}
          disabled={s.kind !== 'rect' && !s.closed}
          onChange={(e) => put({ ...s, fill: e.currentTarget.value as AreaFill })}
        >
          {AREA_FILLS.map((f) => (
            <option key={f} value={f}>
              {AREA_FILL_LABEL[f]}
            </option>
          ))}
        </select>
      </label>
    </>
  );

  return (
    <div className="grid grid-cols-2 gap-2">
      {shape.kind === 'text' && (
        <label className={`col-span-2 ${labelClass}`}>
          Text
          <LabelTextInput ariaLabel={`Text of ${name}`} value={shape.text} onApply={(t) => put({ ...shape, text: t })} />
        </label>
      )}
      {shape.kind === 'opening' && (
        <label className={`col-span-2 ${labelClass}`}>
          Type
          <select aria-label={`Type of ${name}`} className={fieldClass} value={shape.variant} onChange={(e) => put({ ...shape, variant: e.currentTarget.value as OpeningVariant })}>
            {OPENING_VARIANTS.map((v) => (
              <option key={v} value={v}>
                {OPENING_LABEL[v]}
              </option>
            ))}
          </select>
        </label>
      )}

      {shape.kind === 'polyline' || shape.kind === 'curve' ? (
        <label className={`col-span-2 ${labelClass}`}>
          Points (x,y in px, separated by spaces)
          <PointsInput ariaLabel={`Points of ${name}`} points={shape.points} onApply={(points) => put({ ...shape, points })} />
        </label>
      ) : (
        <>
          <label className={labelClass}>
            {shape.kind === 'text' ? 'x (px)' : 'Centre x (px)'}
            <NumberInput aria-label={`x of ${name} (px)`} className={fieldClass} value={Math.round(anchor.x)} onValueChange={num((v) => moveShapeTo(shape, { x: v, y: anchor.y }))} />
          </label>
          <label className={labelClass}>
            {shape.kind === 'text' ? 'y (px)' : 'Centre y (px)'}
            <NumberInput aria-label={`y of ${name} (px)`} className={fieldClass} value={Math.round(anchor.y)} onValueChange={num((v) => moveShapeTo(shape, { x: anchor.x, y: v }))} />
          </label>
        </>
      )}

      {shape.kind === 'rect' && (
        <>
          <label className={labelClass}>
            Width ({su.label})
            <NumberInput min={0} aria-label={`Width of ${name} (${su.label})`} className={fieldClass} value={su.show(shape.width)} onValueChange={(v) => v > 0 && put({ ...shape, width: su.read(v) })} />
          </label>
          <label className={labelClass}>
            Height ({su.label})
            <NumberInput min={0} aria-label={`Height of ${name} (${su.label})`} className={fieldClass} value={su.show(shape.height)} onValueChange={(v) => v > 0 && put({ ...shape, height: su.read(v) })} />
          </label>
        </>
      )}
      {shape.kind === 'opening' && (
        <label className={labelClass}>
          Width ({u})
          <NumberInput
            min={0}
            step={0.1}
            aria-label={`Width of ${name} (${u})`}
            className={fieldClass}
            value={round(lengthFromMetres(shape.widthMetres, units), 2)}
            onValueChange={(v) => v > 0 && put({ ...shape, widthMetres: lengthToMetres(v, units) })}
          />
        </label>
      )}
      {shape.kind === 'text' && (
        <label className={labelClass}>
          Text size (px)
          <NumberInput min={1} aria-label={`Text size of ${name} (px)`} className={fieldClass} value={Math.round(shape.sizePx)} onValueChange={(v) => v > 0 && put({ ...shape, sizePx: v })} />
        </label>
      )}

      {hasRotation && (
        <label className={`col-span-2 ${labelClass}`}>
          Rotation (degrees clockwise)
          <div className="flex gap-1">
            <Button size="sm" ariaLabel={`Rotate ${name} 15 degrees anticlockwise`} onClick={() => put(rotateShape(shape, shape.rotationDeg - 15))}>
              −15°
            </Button>
            <NumberInput step={15} aria-label={`Rotation of ${name} (degrees)`} className={fieldClass} value={Math.round(shape.rotationDeg * 10) / 10} onValueChange={num((v) => rotateShape(shape, v))} />
            <Button size="sm" ariaLabel={`Rotate ${name} 90 degrees clockwise`} onClick={() => put(rotateShape(shape, shape.rotationDeg + 90))}>
              +90°
            </Button>
          </div>
        </label>
      )}
      {shape.kind === 'opening' && shape.variant !== 'window' && (
        <div className="col-span-2">
          <Button size="sm" ariaLabel={`Flip the swing of ${name}`} onClick={() => put({ ...shape, flip: !shape.flip })}>
            Flip swing ({shape.flip ? 'down / right' : 'up / left'})
          </Button>
        </div>
      )}

      {(shape.kind === 'polyline' || shape.kind === 'curve') && (
        <label className="col-span-2 flex items-center gap-2 text-sm text-[var(--color-ink-2)]">
          <input
            type="checkbox"
            checked={shape.closed}
            disabled={shape.points.length < 3}
            onChange={(e) => {
              const closed = e.currentTarget.checked;
              put({ ...shape, closed, fill: closed ? shape.fill : 'none' });
            }}
          />
          Closed (an area){shape.points.length < 3 ? ' — needs 3 points' : ''}
        </label>
      )}
      {(shape.kind === 'rect' || shape.kind === 'polyline' || shape.kind === 'curve') && styleSelects(shape)}

      {(shape.kind === 'rect' || shape.kind === 'polyline' || shape.kind === 'curve') && (
        <p className="col-span-2 text-xs text-[var(--color-ink-3)]" data-testid="shape-measure">
          {shape.kind !== 'rect' && !shape.closed ? 'Length' : 'Perimeter'}: {metresPerPx ? `${round(lengthFromMetres(shapeLengthPx(shape) * metresPerPx, units), 1)} ${u}` : `${Math.round(shapeLengthPx(shape))} px`}
          {(shape.kind === 'rect' || shape.closed) && ` · Area: ${su.area(shapeAreaPx2(shape))}`}
          {!metresPerPx && ' — set the scale to see metres'}
        </p>
      )}
      {shape.kind === 'opening' && !metresPerPx && (
        <p className="col-span-2 text-xs text-[var(--color-ink-3)]">The plan has no scale yet, so this is drawn at 1 m = 20 px.</p>
      )}
    </div>
  );
}

/** Duplicate / order / delete buttons for one shape. */
export function ShapeActions({ shape, name, edit, onRemoved, offset }: { shape: LayoutShape; name: string; edit: Edit; onRemoved?: () => void; offset: number }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="ghost" icon="copy" ariaLabel={`Duplicate ${name}`} onClick={() => edit((p) => duplicateShape(p, shape.id, { x: offset, y: offset }).plan)}>
        Duplicate
      </Button>
      <Button size="sm" variant="ghost" ariaLabel={`Bring ${name} to the front`} onClick={() => edit((p) => reorderShape(p, shape.id, 'front'))}>
        To front
      </Button>
      <Button size="sm" variant="ghost" ariaLabel={`Send ${name} to the back`} onClick={() => edit((p) => reorderShape(p, shape.id, 'back'))}>
        To back
      </Button>
      <Button
        size="sm"
        variant="danger"
        icon="trash"
        ariaLabel={`Delete ${name}`}
        onClick={() => {
          if (edit((p) => removeShape(p, shape.id))) onRemoved?.();
        }}
      >
        Delete
      </Button>
    </div>
  );
}

const ADD_TOOLS: readonly { readonly tool: DrawTool; readonly label: string }[] = [
  { tool: 'rect', label: 'Room / rectangle' },
  { tool: 'polyline', label: 'Line / wall' },
  { tool: 'curve', label: 'Curve' },
  { tool: 'door', label: 'Door' },
  { tool: 'double-door', label: 'Double door' },
  { tool: 'window', label: 'Window' },
  { tool: 'gate', label: 'Gate' },
  { tool: 'text', label: 'Label' },
];

/**
 * The keyboard / list alternative for the drawing: add any shape at the
 * centre of the plan, and expand any row to edit or delete it.
 */
export function LayoutShapeList({
  plan,
  units,
  metresPerPx,
  canvas,
  edit,
  unit,
}: {
  plan: SitePlan;
  units: UnitSystemState;
  metresPerPx: number | null;
  canvas: { readonly widthPx: number; readonly heightPx: number };
  edit: Edit;
  unit: number;
}) {
  const shapes = layoutOf(plan).shapes;
  const [open, setOpen] = useState<string | null>(null);
  const baseId = useId();
  const centre = { x: Math.round(canvas.widthPx / 2), y: Math.round(canvas.heightPx / 2) };
  return (
    <>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Add a shape at the centre of the plan">
        {ADD_TOOLS.map(({ tool, label }) => (
          <Button
            key={tool}
            size="sm"
            icon="plus"
            ariaLabel={`Add ${label.toLowerCase()}`}
            onClick={() => {
              const box: { id: string | null } = { id: null };
              const ok = edit((p) => {
                const r = addShape(p, defaultShape(tool, centre, metresPerPx, canvas));
                box.id = r.shape.id;
                return r.plan;
              });
              if (ok && box.id) setOpen(box.id);
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      {shapes.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--color-ink-3)]">Nothing drawn yet. Use the drawing tools on the map, or the buttons above.</p>
      ) : (
        <ul className="mt-3 grid gap-2" aria-label="Drawn shapes">
          {shapes.map((s) => {
            const name = describeShape(s, metresPerPx);
            const expanded = open === s.id;
            const panelId = `${baseId}-${s.id}`;
            return (
              <li key={s.id} className="rounded-control border border-[var(--color-border)]">
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <span className="text-sm text-[var(--color-ink)]">
                    {name} <span className="text-xs text-[var(--color-ink-3)]">({s.id})</span>
                  </span>
                  <div className="flex gap-1">
                    <Button size="sm" variant={expanded ? 'secondary' : 'ghost'} ariaExpanded={expanded} ariaControls={panelId} ariaLabel={`Edit ${name}`} onClick={() => setOpen(expanded ? null : s.id)}>
                      {expanded ? 'Close' : 'Edit'}
                    </Button>
                    <Button size="sm" variant="ghost" icon="trash" ariaLabel={`Delete ${name}`} onClick={() => edit((p) => removeShape(p, s.id))}>
                      Delete
                    </Button>
                  </div>
                </div>
                {expanded && (
                  <div id={panelId} className="grid gap-3 border-t border-[var(--color-border)] px-3 py-3">
                    <ShapeFields shape={s} name={s.id} units={units} metresPerPx={metresPerPx} edit={edit} />
                    <ShapeActions shape={s} name={s.id} edit={edit} offset={unit * 2} onRemoved={() => setOpen(null)} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

/**
 * Start a blank drawn layout (or change its size): the site's width × height
 * and the grid square, which together set the scale — no calibration step.
 */
export function LayoutCanvasForm({
  plan,
  units,
  edit,
  onDone,
  onCancel,
}: {
  plan: SitePlan;
  units: UnitSystemState;
  edit: Edit;
  onDone: (text: string) => void;
  onCancel: () => void;
}) {
  const layout = layoutOf(plan);
  const u = lengthUnitLabel(units);
  const [w, setW] = useState(layout.canvas?.widthMetres ?? 40);
  const [h, setH] = useState(layout.canvas?.heightMetres ?? 25);
  const [grid, setGrid] = useState(layout.gridMetres ?? DEFAULT_GRID_METRES);
  const show = (m: number) => round(lengthFromMetres(m, units), 2);
  const apply = () => {
    const ok = edit((p) => setGridMetres(setLayoutCanvas(p, w, h), grid));
    if (ok) onDone(`Drawn layout ${show(w)} × ${show(h)} ${u}, grid ${show(grid)} ${u}. The scale is set from this size — draw rooms, walls and doors with the tools above the map.`);
  };
  return (
    <fieldset className="mt-3 rounded-control border border-[var(--color-border)] p-3">
      <legend className="px-1 text-sm font-semibold text-[var(--color-ink)]">{layout.canvas ? 'Drawn layout size' : 'Draw a new layout'}</legend>
      <p className="mb-2 text-xs text-[var(--color-ink-3)]">
        Enter the size of the area to draw (the whole site, with a margin). The scale follows from it, so distances and cable runs work
        straight away. Between {show(MIN_CANVAS_METRES)} and {show(MAX_CANVAS_METRES)} {u}.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <label className={labelClass}>
          Site width ({u})
          <NumberInput min={0} className={fieldClass} value={show(w)} onValueChange={(v) => Number.isFinite(v) && setW(lengthToMetres(v, units))} />
        </label>
        <label className={labelClass}>
          Site height ({u})
          <NumberInput min={0} className={fieldClass} value={show(h)} onValueChange={(v) => Number.isFinite(v) && setH(lengthToMetres(v, units))} />
        </label>
        <label className={labelClass}>
          Grid square ({u})
          <NumberInput min={0} step={0.5} className={fieldClass} value={show(grid)} onValueChange={(v) => Number.isFinite(v) && setGrid(lengthToMetres(v, units))} />
        </label>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button variant="primary" onClick={apply}>
          {layout.canvas ? 'Apply size' : 'Start drawing'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        {layout.canvas && (
          <Button
            variant="ghost"
            icon="trash"
            onClick={() => {
              if (edit(removeLayoutCanvas)) onDone('The blank canvas was removed; drawn shapes are kept. Upload a plan or draw a new layout.');
            }}
          >
            Remove blank canvas
          </Button>
        )}
      </div>
    </fieldset>
  );
}
