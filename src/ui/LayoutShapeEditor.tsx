/**
 * Editing drawn layout shapes without a pointer: the fields for one shape
 * (shared by the Site map's side panel and the shape list, so the two cannot
 * drift apart), the shape list with its "Add …" buttons, the form that starts
 * a drawn layout from the place's size (canvas, grid and scale automatic), and
 * the canvas panel that adds margin later.
 *
 * Every edit is a pure function from `domain/layoutShapes.ts`.
 */

import { useId, useState } from 'react';

import {
  AREA_FILL_LABEL,
  AREA_FILLS,
  DEFAULT_PLACE_NAME,
  LINE_STYLE_LABEL,
  LINE_STYLES,
  MAX_CANVAS_METRES,
  MAX_LABEL_CHARS,
  MAX_PLACE_METRES,
  MIN_CANVAS_METRES,
  MIN_MARGIN_METRES,
  MIN_PLACE_METRES,
  OPENING_LABEL,
  OPENING_VARIANTS,
  addShape,
  autoCanvasForPlace,
  ceilToStep,
  defaultShape,
  describeShape,
  duplicateShape,
  extendLayoutCanvas,
  fitCanvasToShapes,
  formatPoints,
  layoutOf,
  layoutOverflowMetres,
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
  startLayoutFromPlace,
  updateShape,
  type AreaFill,
  type AutoCanvas,
  type DrawTool,
  type LayoutCanvas,
  type LayoutShape,
  type LineStyle,
  type OpeningVariant,
} from '../domain/layoutShapes.ts';
import type { Point, SitePlan } from '../domain/sitePlan.ts';
import { lengthFromMetres, lengthToMetres, lengthUnitLabel, round } from '../domain/units.ts';
import type { UnitSystemState } from '../state/projectTypes.ts';
import { canvasReadout, overflowText } from './format.ts';
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
 * Start a drawn layout, or change its canvas. With no canvas yet it asks only
 * for the PLACE (the building or area itself) and its name; the canvas, grid
 * and scale follow automatically, and the place is drawn for the engineer.
 * Once there is a canvas it offers "Add margin", "Extend canvas to fit" and,
 * under Advanced, the exact canvas size and grid.
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
  /** `selectId`: a shape to select (the place drawn for the engineer). */
  onDone: (text: string, selectId?: string) => void;
  onCancel: () => void;
}) {
  const layout = layoutOf(plan);
  return layout.canvas ? (
    <CanvasPanel plan={plan} canvas={layout.canvas} gridMetres={layout.gridMetres} units={units} edit={edit} onDone={onDone} onCancel={onCancel} />
  ) : (
    <NewLayoutForm units={units} edit={edit} onDone={onDone} onCancel={onCancel} />
  );
}

function NewLayoutForm({ units, edit, onDone, onCancel }: { units: UnitSystemState; edit: Edit; onDone: (text: string, selectId?: string) => void; onCancel: () => void }) {
  const u = lengthUnitLabel(units);
  const show = (m: number, dp = 2) => round(lengthFromMetres(m, units), dp);
  const [w, setW] = useState(10);
  const [d, setD] = useState(6);
  const [name, setName] = useState('');
  const previewId = useId();
  let preview: { ok: true; auto: AutoCanvas } | { ok: false; reason: string };
  try {
    preview = { ok: true, auto: autoCanvasForPlace(w, d) };
  } catch (err) {
    preview = { ok: false, reason: err instanceof Error ? err.message : 'Check the size.' };
  }
  const apply = () => {
    const box: { r: ReturnType<typeof startLayoutFromPlace> | null } = { r: null };
    const ok = edit((p) => {
      box.r = startLayoutFromPlace(p, { widthMetres: w, depthMetres: d, name });
      return box.r.plan;
    });
    const r = box.r;
    if (!ok || !r) return;
    const placeName = name.trim() || DEFAULT_PLACE_NAME;
    onDone(
      `${placeName} ${show(w)} × ${show(d)} ${u} drawn in the middle of the canvas. ${canvasReadout(r.auto.canvas, r.auto.gridMetres, units)}, at least ${show(r.auto.marginMetres, 1)} ${u} of margin on every side for a fence, gate, car park or cameras. The scale is set — select the ${placeName.toLowerCase()} to edit, move or delete it.`,
      r.placeId,
    );
  };
  return (
    <fieldset className="mt-3 rounded-control border border-[var(--color-border)] p-3">
      <legend className="px-1 text-sm font-semibold text-[var(--color-ink)]">Draw a new layout</legend>
      <p className="mb-2 text-xs text-[var(--color-ink-3)]">
        Enter the size of the building or area itself — not the whole drawing. The canvas is made bigger automatically, with room on every side to add a
        fence, a gate, a car park or perimeter cameras later, and the scale follows from it, so distances and cable runs work straight away. Each side{' '}
        {show(MIN_PLACE_METRES)}–{show(MAX_PLACE_METRES, 0)} {u}.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <label className={labelClass}>
          Place width ({u})
          <NumberInput min={0} step={0.5} aria-describedby={previewId} className={fieldClass} value={show(w)} onValueChange={(v) => setW(Number.isFinite(v) ? lengthToMetres(v, units) : Number.NaN)} />
        </label>
        <label className={labelClass}>
          Place depth ({u})
          <NumberInput min={0} step={0.5} aria-describedby={previewId} className={fieldClass} value={show(d)} onValueChange={(v) => setD(Number.isFinite(v) ? lengthToMetres(v, units) : Number.NaN)} />
        </label>
        <label className={`col-span-2 sm:col-span-1 ${labelClass}`}>
          Name (optional)
          <input className={fieldClass} maxLength={MAX_LABEL_CHARS} value={name} placeholder={DEFAULT_PLACE_NAME} onChange={(e) => setName(e.currentTarget.value)} />
        </label>
      </div>
      <p id={previewId} data-testid="auto-canvas-preview" aria-live="polite" className="mt-2 text-xs text-[var(--color-ink-2)]">
        {preview.ok
          ? `${canvasReadout(preview.auto.canvas, preview.auto.gridMetres, units)} · at least ${show(preview.auto.marginMetres, 1)} ${u} around the place`
          : preview.reason}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button variant="primary" icon="square" onClick={apply}>
          Draw layout
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </fieldset>
  );
}

type Side = 'all' | 'left' | 'right' | 'top' | 'bottom';
const SIDE_LABEL: Readonly<Record<Side, string>> = { all: 'every side', left: 'the left', right: 'the right', top: 'the top', bottom: 'the bottom' };

function CanvasPanel({
  plan,
  canvas,
  gridMetres,
  units,
  edit,
  onDone,
  onCancel,
}: {
  plan: SitePlan;
  canvas: LayoutCanvas;
  gridMetres: number;
  units: UnitSystemState;
  edit: Edit;
  onDone: (text: string) => void;
  onCancel: () => void;
}) {
  const u = lengthUnitLabel(units);
  const show = (m: number, dp = 2) => round(lengthFromMetres(m, units), dp);
  const [amount, setAmount] = useState(() => Math.max(MIN_MARGIN_METRES, ceilToStep(5 * gridMetres, gridMetres)));
  const [side, setSide] = useState<Side>('all');
  const [w, setW] = useState(canvas.widthMetres);
  const [h, setH] = useState(canvas.heightMetres);
  const [grid, setGrid] = useState(gridMetres);
  const overflow = layoutOverflowMetres(plan);
  const over = overflowText(overflow, units);
  const done = (p: SitePlan, what: string) => {
    const l = layoutOf(p);
    onDone(`${what} ${l.canvas ? canvasReadout(l.canvas, l.gridMetres, units) : ''}.`);
  };
  const addMargin = () => {
    if (!(amount > 0)) return;
    const a = (s: Exclude<Side, 'all'>) => (side === 'all' || side === s ? amount : 0);
    const box: { p: SitePlan | null } = { p: null };
    if (edit((p) => (box.p = extendLayoutCanvas(p, { left: a('left'), right: a('right'), top: a('top'), bottom: a('bottom') }))) && box.p) {
      done(box.p, `Added ${show(amount, 1)} ${u} on ${SIDE_LABEL[side]}; nothing moved relative to anything else.`);
    }
  };
  const fit = () => {
    const box: { p: SitePlan | null } = { p: null };
    if (edit((p) => (box.p = fitCanvasToShapes(p))) && box.p) done(box.p, 'The canvas now holds every shape.');
  };
  const applyExact = () => {
    const box: { p: SitePlan | null } = { p: null };
    if (edit((p) => (box.p = setGridMetres(setLayoutCanvas(p, w, h), grid))) && box.p) done(box.p, 'Canvas size set.');
  };
  return (
    <fieldset className="mt-3 rounded-control border border-[var(--color-border)] p-3">
      <legend className="px-1 text-sm font-semibold text-[var(--color-ink)]">Canvas and grid</legend>
      <p className="mb-2 text-sm text-[var(--color-ink)]" data-testid="canvas-panel-readout">
        {canvasReadout(canvas, gridMetres, units)}
      </p>
      <p className="mb-2 text-xs text-[var(--color-ink-3)]">
        Need more room for a fence, a gate, a car park or more cameras? Add margin to the canvas. Everything already drawn or placed moves together, so
        distances and cable runs stay the same.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className={labelClass}>
          Add ({u})
          <NumberInput min={0} step={gridMetres} className={`${fieldClass} w-24`} value={show(amount)} onValueChange={(v) => setAmount(Number.isFinite(v) ? lengthToMetres(v, units) : Number.NaN)} />
        </label>
        <label className={labelClass}>
          On
          <select className={fieldClass} value={side} onChange={(e) => setSide(e.currentTarget.value as Side)}>
            {(Object.keys(SIDE_LABEL) as Side[]).map((s) => (
              <option key={s} value={s}>
                {s === 'all' ? 'Every side' : s[0]!.toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <Button icon="plus" disabled={!(amount > 0)} onClick={addMargin}>
          Add margin
        </Button>
      </div>
      {over && (
        <p className="mt-2 text-xs text-[var(--color-ink-2)]">
          Drawn shapes reach past the canvas edge ({over}).{' '}
          <Button size="sm" variant="secondary" onClick={fit}>
            Extend canvas to fit
          </Button>
        </p>
      )}
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-medium text-[var(--color-accent)]">Advanced: exact canvas size and grid</summary>
        <p className="mt-2 text-xs text-[var(--color-ink-3)]">
          The canvas grows or shrinks from its top-left corner; shapes keep their place and devices outside a smaller canvas are pulled inside.{' '}
          {show(MIN_CANVAS_METRES)}–{show(MAX_CANVAS_METRES, 0)} {u}.
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <label className={labelClass}>
            Canvas width ({u})
            <NumberInput min={0} className={fieldClass} value={show(w)} onValueChange={(v) => setW(Number.isFinite(v) ? lengthToMetres(v, units) : Number.NaN)} />
          </label>
          <label className={labelClass}>
            Canvas height ({u})
            <NumberInput min={0} className={fieldClass} value={show(h)} onValueChange={(v) => setH(Number.isFinite(v) ? lengthToMetres(v, units) : Number.NaN)} />
          </label>
          <label className={labelClass}>
            Grid square ({u})
            <NumberInput min={0} step={0.5} className={fieldClass} value={show(grid)} onValueChange={(v) => setGrid(Number.isFinite(v) ? lengthToMetres(v, units) : Number.NaN)} />
          </label>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button onClick={applyExact}>Apply size</Button>
          <Button
            variant="ghost"
            icon="trash"
            onClick={() => {
              if (edit(removeLayoutCanvas)) onDone('The blank canvas was removed; drawn shapes are kept. Upload a plan or draw a new layout.');
            }}
          >
            Remove blank canvas
          </Button>
        </div>
      </details>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Close
        </Button>
      </div>
    </fieldset>
  );
}
