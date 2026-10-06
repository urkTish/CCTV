/**
 * Site map editor (M1–M5): upload a plan — or draw the layout from the size of
 * the building or area, on a canvas sized (with margins) and scaled
 * automatically — calibrate it, place cameras, the NVR and
 * switches, draw cable routes, and draw the site itself (rooms, walls, fences,
 * curves, doors, windows, gates, labels) with undo / redo and a snapping grid.
 * Tables and lists do all of it from the keyboard. An optional OpenStreetMap
 * view (off by default) can supply the calibration length.
 *
 * Every edit is a pure function from `domain/sitePlanEdit.ts` or
 * `domain/layoutShapes.ts`; everything drawn comes from `engine/siteMapView.ts`
 * and `LayoutShapesSvg.tsx`. This component only renders and forwards pointer
 * and keyboard input.
 */

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';

import { checkPlanFile, planImageFromBytes, PLAN_UPLOAD_ACCEPT } from '../domain/planImage.ts';
import { SitePlanError, distancePx, type Point, type SitePlan } from '../domain/sitePlan.ts';
import {
  AREA_FILL_LABEL,
  AREA_FILLS,
  EMPTY_HISTORY,
  LINE_STYLE_LABEL,
  LINE_STYLES,
  OPENING_DEFAULT_WIDTH_M,
  OPENING_LABEL,
  OPENING_VARIANTS,
  addShape,
  angleFromUp,
  canvasCalibration,
  constrainAngle,
  describeShape,
  drawingMetresPerPx,
  gridSpacingPx,
  fitCanvasToShapes,
  layoutOf,
  layoutOverflowMetres,
  localToPlan,
  moveShapeTo,
  openingFromDrag,
  openingGeometry,
  polylinePathD,
  recordHistory,
  rectCorners,
  rectFromCorners,
  redoHistory,
  removeShape,
  resizeRectFromCorner,
  rotateShape,
  shapeAnchor,
  shapeBounds,
  shapeById,
  smoothPathD,
  snapPoint,
  translateShape,
  undoHistory,
  updateShape,
  type AreaFill,
  type History,
  type LayoutShape,
  type LineStyle,
  type OpeningVariant,
} from '../domain/layoutShapes.ts';
import {
  calibrate,
  canvasCentre,
  clearCalibration,
  connectCamera,
  moveDevice,
  placeCamera,
  placeNvr,
  placeSwitch,
  removeDevice,
  removeImage,
  removeRoute,
  renameDevice,
  replaceImage,
  rotateCamera,
  routeBetween,
  setRoute,
  setRunOverride,
} from '../domain/sitePlanEdit.ts';
import { lengthFromMetres, lengthToMetres, lengthUnitLabel, round } from '../domain/units.ts';
import type { RecommendationResult } from '../engine/recommend.ts';
import { siteMapView, type DeviceView, type RunView } from '../engine/siteMapView.ts';
import type { Project, UnitSystemState } from '../state/projectTypes.ts';
import { readFileAsBytes } from './fileIo.ts';
import { OsmReferenceMap } from './OsmReferenceMap.tsx';
import { Icon, type IconName } from './icons.tsx';
import { Button, Card, EstimateBadge, NumberInput } from './primitives.tsx';
import { LayoutCanvasForm, LayoutShapeList, ShapeActions, ShapeFields } from './LayoutShapeEditor.tsx';
import { canvasReadout, overflowText } from './format.ts';
import { GridLines, LayoutDefs, LayoutShapeGraphic } from './LayoutShapesSvg.tsx';
import { THEME_PALETTE, lineStroke } from './planPalette.ts';

type DrawMode = 'draw-rect' | 'draw-line' | 'draw-curve' | 'draw-opening' | 'draw-text';
type Mode = 'select' | 'calibrate' | 'place-camera' | 'place-nvr' | 'place-switch' | 'route' | DrawMode;

const MODE_LABEL: Readonly<Record<Mode, string>> = {
  select: 'Select / move',
  calibrate: 'Calibrate',
  'place-camera': 'Place camera',
  'place-nvr': 'Place NVR / rack',
  'place-switch': 'Place switch',
  route: 'Draw route',
  'draw-rect': 'Rectangle',
  'draw-line': 'Line / wall',
  'draw-curve': 'Curve',
  'draw-opening': 'Door / window / gate',
  'draw-text': 'Label',
};

const MODE_ICON: Readonly<Record<Mode, IconName>> = {
  select: 'arrow-right',
  calibrate: 'edit',
  'place-camera': 'camera',
  'place-nvr': 'recorder',
  'place-switch': 'network',
  route: 'cable',
  'draw-rect': 'square',
  'draw-line': 'polyline',
  'draw-curve': 'curve',
  'draw-opening': 'door',
  'draw-text': 'text',
};

const MODE_HINT: Readonly<Record<Mode, string>> = {
  select:
    'Drag a device or a drawn shape to move it; drag a selected shape’s handles to resize or rotate it (Shift keeps a square / turns freely). Focus a device or shape and use the arrow keys to nudge it; [ and ] rotate; Delete removes a shape. Ctrl+Z / Ctrl+Y undo and redo.',
  calibrate: 'Click the two ends of a dimension you know, then enter its real length below.',
  'place-camera': 'Click the plan where the chosen camera goes.',
  'place-nvr': 'Click the plan where the NVR / rack is.',
  'place-switch': 'Click the plan where the switch / IDF is.',
  route: 'Click along walls and ceilings to add bends, then press Finish route.',
  'draw-rect': 'Drag from corner to corner to draw a room or a wall outline. Hold Shift for a square.',
  'draw-line':
    'Click each corner of the wall, fence or line; Shift keeps 45° angles. Click the first point again to close an area, or press Finish (or Enter, or double-click). Esc cancels.',
  'draw-curve': 'Click the points the curve should pass through, then Finish (or Enter, or double-click). Click the first point to close it into an area. Esc cancels.',
  'draw-opening': 'Drag along a wall from one side of the opening to the other — or click to place one at its usual width — then turn or flip it in the panel.',
  'draw-text': 'Type the label text, then click where it goes.',
};

/** What a phone user should know about each drawing tool (shown below 640 px). */
const TOUCH_HINT: Partial<Readonly<Record<Mode, string>>> = {
  'draw-rect': 'On a phone: drag with one finger.',
  'draw-line': 'On a phone: tap each corner, then Finish. Turn on Snap for straight walls.',
  'draw-curve': 'On a phone: tap the points, then Finish. Freehand drawing is not available.',
  'draw-opening': 'On a phone: tap to place, then set the width and turn it in the panel below the map.',
  select: 'On a phone the handles are small: resize and turn shapes precisely in the panel below the map or in the shape list.',
};

type ShapeHandle = 'move' | 'rotate' | { corner: 0 | 1 | 2 | 3 } | { vertex: number } | { end: 0 | 1 };

interface ShapeDrag {
  readonly id: string;
  readonly handle: ShapeHandle;
  readonly start: Point;
  readonly orig: LayoutShape;
  readonly planAtStart: SitePlan;
  readonly recorded: boolean;
}

interface DeviceDrag {
  readonly id: string;
  readonly planAtStart: SitePlan;
  readonly recorded: boolean;
}

const r2 = (p: Point): Point => ({ x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 });

function isEditableTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  return t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);
}

const inputClass =
  'w-full min-w-0 rounded-control border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2 py-1 text-sm text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:outline-none';

function num(v: string): number {
  return v.trim() === '' ? Number.NaN : Number(v);
}

export function SiteMapPanel({
  project,
  units,
  results,
  onPlanChange,
  selectRequest = null,
}: {
  project: Project;
  units: UnitSystemState;
  results: ReadonlyMap<string, RecommendationResult>;
  onPlanChange: (next: SitePlan) => void;
  /** Ask the panel to select a device (from the jump palette); `seq` makes repeats count. */
  selectRequest?: { readonly id: string; readonly seq: number } | null;
}) {
  const plan = project.sitePlan;
  const view = useMemo(() => siteMapView(project, results), [project, results]);
  const u = lengthUnitLabel(units);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [mode, setMode] = useState<Mode>('select');
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const [selected, setSelected] = useState<string | null>(selectRequest?.id ?? null);
  const [lastRequest, setLastRequest] = useState(selectRequest?.seq ?? 0);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  if (selectRequest && selectRequest.seq !== lastRequest) {
    // Adjusting state while rendering (React's documented pattern for "reset on prop change").
    setLastRequest(selectRequest.seq);
    setSelected(selectRequest.id);
    setSelectedShapeId(null);
  }
  const [deviceDrag, setDeviceDrag] = useState<DeviceDrag | null>(null);
  const [shapeDrag, setShapeDrag] = useState<ShapeDrag | null>(null);
  /** Rectangle or opening being dragged out. */
  const [dragDraft, setDragDraft] = useState<{ a: Point; b: Point; square: boolean } | null>(null);
  /** Points of a line or curve being drawn, and where the pointer is. */
  const [pathDraft, setPathDraft] = useState<Point[]>([]);
  const [hover, setHover] = useState<Point | null>(null);
  const [lineStyle, setLineStyle] = useState<LineStyle>('wall');
  const [areaFill, setAreaFill] = useState<AreaFill>('none');
  const [closePath, setClosePath] = useState(false);
  const [openingVariant, setOpeningVariant] = useState<OpeningVariant>('door');
  const [labelText, setLabelText] = useState('');
  const [showGrid, setShowGrid] = useState(true);
  const [snapOn, setSnapOn] = useState(true);
  const [locked, setLocked] = useState(false);
  const [canvasFormOpen, setCanvasFormOpen] = useState(false);

  // ---- undo / redo ---------------------------------------------------------
  // Every edit made here records the plan before it. A plan that changes from
  // outside (a file opened, an autosave restored) clears the history, so undo
  // can never bring back another project's plan (ASSUMPTIONS 13.5).
  const [history, setHistory] = useState<History<SitePlan>>(EMPTY_HISTORY);
  const [knownPlan, setKnownPlan] = useState(plan);
  const [emitted, setEmitted] = useState<SitePlan | null>(null);
  if (plan !== knownPlan) {
    setKnownPlan(plan);
    if (plan !== emitted) setHistory(EMPTY_HISTORY);
  }
  const emit = (next: SitePlan) => {
    setEmitted(next);
    onPlanChange(next);
  };
  const [cameraToPlace, setCameraToPlace] = useState<string>('');
  const [routeCameraId, setRouteCameraId] = useState<string>('');
  const [routeDraft, setRouteDraft] = useState<Point[]>([]);
  const calDraft = (c: SitePlan['calibration']) => ({
    ax: c?.a.x ?? Number.NaN,
    ay: c?.a.y ?? Number.NaN,
    bx: c?.b.x ?? Number.NaN,
    by: c?.b.y ?? Number.NaN,
    /** Held in metres so a units switch mid-calibration cannot change it. */
    metres: c?.metres ?? Number.NaN,
    next: 'a' as 'a' | 'b',
  });
  const [cal, setCal] = useState(() => calDraft(plan.calibration));
  /** Start (re)calibrating from `from` — the current scale, or nothing for a new image. */
  const startCalibrating = (from: SitePlan['calibration'] = plan.calibration) => {
    setCal(calDraft(from));
    setMode('calibrate');
  };

  const { widthPx, heightPx } = view;
  const unit = Math.max(widthPx, heightPx) / 100; // marker size, in image px
  const layout = layoutOf(plan);
  const drawMpp = drawingMetresPerPx(plan.calibration);
  const gridPx = gridSpacingPx(layout.gridMetres, view.metresPerPx);
  const snapPx = snapOn ? gridPx : null;
  const snap = (p: Point) => r2(snapPoint(p, snapPx));
  const selectedShape = selectedShapeId ? shapeById(plan, selectedShapeId) : null;
  // The scale a blank drawn layout set itself: its line runs along the top edge, so it is not drawn.
  /** Sides drawn shapes reach past the blank canvas ("left 2 m, top 1 m"), or ''. */
  const overflow = overflowText(layoutOverflowMetres(plan), units);
  const canvasScale =
    !plan.image && layout.canvas !== null && plan.calibration !== null && JSON.stringify(plan.calibration) === JSON.stringify(canvasCalibration(layout.canvas));
  const idBase = `lay${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  // Over an image the fills let the plan show through and doors do not paint over it.
  const palette = plan.image ? { ...THEME_PALETTE, fillOpacity: 0.45, cutOpenings: false } : THEME_PALETTE;

  const undo = () => {
    const r = undoHistory(history, plan);
    if (!r) return;
    setHistory(r.history);
    emit(r.state);
  };
  const redo = () => {
    const r = redoHistory(history, plan);
    if (!r) return;
    setHistory(r.history);
    emit(r.state);
  };
  const cancelDrafts = () => {
    setPathDraft([]);
    setDragDraft(null);
    setHover(null);
  };
  /** Switch to a drawing tool with sensible starting styles (rooms filled, curves as fences). */
  const chooseDrawTool = (m: DrawMode) => {
    setMode(m);
    setRouteDraft([]);
    cancelDrafts();
    if (m === 'draw-curve' && lineStyle === 'wall') setLineStyle('fence');
    if (m === 'draw-rect' && areaFill === 'none') setAreaFill('room');
  };
  const selectShape = (id: string | null) => {
    setSelectedShapeId(id);
    if (id) setSelected(null);
  };

  /** Finish the line or curve being drawn; `closed` when the first point was clicked again. */
  const finishPath = (closedByClick = false) => {
    const pts = pathDraft.filter((p, i) => i === 0 || distancePx(p, pathDraft[i - 1]!) > 0.5);
    if (pts.length < 2) {
      setMessage({ kind: 'error', text: 'A line needs at least two points: click on the plan to add them.' });
      return;
    }
    const closed = (closedByClick || closePath) && pts.length >= 3;
    const kind = mode === 'draw-curve' ? 'curve' : 'polyline';
    const box: { id: string | null } = { id: null };
    const ok = edit((pl) => {
      // The fill is chosen with "Close into an area"; closing by clicking the first point keeps it unfilled.
      const r = addShape(pl, { kind, id: 'new', points: pts, closed, stroke: lineStyle, fill: closed && closePath ? areaFill : 'none' });
      box.id = r.shape.id;
      return r.plan;
    });
    if (ok) {
      cancelDrafts();
      if (box.id) selectShape(box.id);
    }
  };

  const addAndSelect = (shape: LayoutShape) => {
    const box: { id: string | null } = { id: null };
    const ok = edit((pl) => {
      const r = addShape(pl, shape);
      box.id = r.shape.id;
      return r.plan;
    });
    if (ok && box.id) selectShape(box.id);
  };
  const unplacedKey = (l: string, i: number) => `${l}#${i}`;
  const chosenUnplaced = view.unplaced.find((c) => unplacedKey(c.locationId, c.index) === cameraToPlace) ?? view.unplaced[0] ?? null;
  const cameraViews = view.devices.filter((d) => d.device.kind === 'camera');

  /**
   * Apply an edit; a refused edit becomes an on-screen message, never a crash.
   * `record: false` is for the second and later steps of one drag.
   */
  const edit = (f: (p: SitePlan) => SitePlan, record = true) => {
    try {
      const next = f(plan);
      if (next === plan) return true;
      if (record) setHistory((h) => recordHistory(h, plan));
      emit(next);
      return true;
    } catch (err) {
      if (err instanceof SitePlanError) {
        setMessage({ kind: 'error', text: err.message });
        return false;
      }
      throw err;
    }
  };

  // ---- M1: upload ----------------------------------------------------------
  const onUpload = async (file: File | undefined) => {
    if (!file) return;
    const pre = checkPlanFile(file);
    if (pre) {
      setMessage({ kind: 'error', text: pre });
      return;
    }
    try {
      const result = planImageFromBytes(file.name, await readFileAsBytes(file));
      if (!result.ok) {
        setMessage({ kind: 'error', text: result.reason });
        return;
      }
      const hadScale = plan.calibration !== null;
      onPlanChange(replaceImage(plan, result.image));
      setMessage({
        kind: 'info',
        text: `Loaded ${result.image.fileName} (${result.image.widthPx} × ${result.image.heightPx} px).${hadScale ? ' The old scale was cleared — calibrate again on this image.' : ' Now calibrate the scale.'}`,
      });
      startCalibrating(null);
    } catch (err) {
      setMessage({ kind: 'error', text: `Could not read ${file.name}: ${err instanceof Error ? err.message : 'unknown error'}.` });
    }
  };

  // ---- M2: calibration -----------------------------------------------------
  const applyCalibration = () => {
    const ok = edit((p) => calibrate(p, { a: { x: cal.ax, y: cal.ay }, b: { x: cal.bx, y: cal.by }, metres: cal.metres }));
    if (ok) {
      setMessage({ kind: 'info', text: 'Scale set. Every distance on the plan now derives from it.' });
      setMode('select');
    }
  };

  // ---- M5: a length measured on the OpenStreetMap view ---------------------
  const calibrateFromMap = (metres: number) => {
    setCal((c) => (mode === 'calibrate' ? { ...c, metres } : { ...calDraft(plan.calibration), metres }));
    setMode('calibrate');
    setMessage({
      kind: 'info',
      text: `Real length set to ${round(lengthFromMetres(metres, units), 1)} ${u} from the OpenStreetMap measurement. Click the same two points on your plan, then Apply calibration.`,
    });
  };

  // ---- pointer input -------------------------------------------------------
  const toImage = (e: PointerEvent<SVGElement>): Point | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) return null;
    return { x: ((e.clientX - r.left) * widthPx) / r.width, y: ((e.clientY - r.top) * heightPx) / r.height };
  };

  const onCanvasDown = (e: PointerEvent<SVGSVGElement>) => {
    const p = toImage(e);
    if (!p) return;
    const at = { x: Math.round(p.x), y: Math.round(p.y) };
    const sp = snap(p);
    const capture = () => svgRef.current?.setPointerCapture?.(e.pointerId);
    switch (mode) {
      case 'calibrate':
        setCal((c) => (c.next === 'a' ? { ...c, ax: at.x, ay: at.y, next: 'b' } : { ...c, bx: at.x, by: at.y, next: 'a' }));
        break;
      case 'place-camera':
        if (chosenUnplaced) edit((pl) => placeCamera(pl, chosenUnplaced.locationId, chosenUnplaced.index, at));
        break;
      case 'place-nvr':
        edit((pl) => placeNvr(pl, at));
        setMode('select');
        break;
      case 'place-switch':
        edit((pl) => placeSwitch(pl, at));
        setMode('select');
        break;
      case 'route':
        setRouteDraft((d) => [...d, at]);
        break;
      case 'select':
        setSelected(null);
        setSelectedShapeId(null);
        break;
      case 'draw-rect':
      case 'draw-opening':
        setDragDraft({ a: sp, b: sp, square: e.shiftKey });
        capture();
        break;
      case 'draw-line':
      case 'draw-curve': {
        const last = pathDraft[pathDraft.length - 1];
        const q = e.shiftKey && last ? r2(constrainAngle(last, sp)) : sp;
        const first = pathDraft[0];
        if (first && pathDraft.length >= 3 && distancePx(q, first) < unit * 1.2) {
          finishPath(true);
          break;
        }
        if (last && distancePx(last, q) < 0.5) break; // the second click of a double-click
        setPathDraft([...pathDraft, q]);
        break;
      }
      case 'draw-text':
        if (labelText.trim() === '') {
          setMessage({ kind: 'error', text: 'Type the label text in the toolbar first, then click where it goes.' });
          break;
        }
        addAndSelect({ kind: 'text', id: 'new', x: sp.x, y: sp.y, text: labelText.trim(), sizePx: unit * 1.8, rotationDeg: 0 });
        break;
    }
  };

  const onDeviceDown = (e: PointerEvent<SVGGElement>, id: string) => {
    if (mode !== 'select') return;
    e.stopPropagation();
    setSelected(id);
    setSelectedShapeId(null);
    setDeviceDrag({ id, planAtStart: plan, recorded: false });
    svgRef.current?.setPointerCapture?.(e.pointerId);
  };

  const onShapeDown = (e: PointerEvent<SVGElement>, shape: LayoutShape, handle: ShapeHandle) => {
    if (mode !== 'select' || locked) return;
    e.stopPropagation();
    const p = toImage(e);
    if (!p) return;
    selectShape(shape.id);
    setShapeDrag({ id: shape.id, handle, start: p, orig: shape, planAtStart: plan, recorded: false });
    svgRef.current?.setPointerCapture?.(e.pointerId);
  };

  /** The shape a drag on `handle` produces with the pointer at `p`. */
  const draggedShape = (d: ShapeDrag, p: Point, shift: boolean): LayoutShape => {
    const o = d.orig;
    const h = d.handle;
    if (h === 'move') {
      // Snap the offset, not the position: a shape drawn on the grid stays on it.
      const off = snap({ x: p.x - d.start.x, y: p.y - d.start.y });
      return translateShape(o, off.x, off.y);
    }
    if (h === 'rotate') {
      const c = shapeAnchor(o);
      const deg = angleFromUp(c, p);
      return rotateShape(o, shift ? Math.round(deg) : Math.round(deg / 15) * 15);
    }
    if ('corner' in h && o.kind === 'rect') return resizeRectFromCorner(o, h.corner, snap(p), shift, 1);
    if ('vertex' in h && (o.kind === 'polyline' || o.kind === 'curve')) {
      return { ...o, points: o.points.map((q, i) => (i === h.vertex ? snap(p) : q)) };
    }
    if ('end' in h && o.kind === 'opening') {
      const [left, right] = openingGeometry(o, o.widthMetres / drawMpp).gap;
      const q = snap(p);
      return { ...o, ...(h.end === 0 ? openingFromDrag(o.variant, q, right, drawMpp) : openingFromDrag(o.variant, left, q, drawMpp)) };
    }
    return o;
  };

  const onCanvasMove = (e: PointerEvent<SVGSVGElement>) => {
    const p = toImage(e);
    if (!p) return;
    if (dragDraft) {
      setDragDraft({ ...dragDraft, b: snap(p), square: e.shiftKey });
      return;
    }
    if ((mode === 'draw-line' || mode === 'draw-curve') && pathDraft.length > 0) {
      const last = pathDraft[pathDraft.length - 1]!;
      const sp = snap(p);
      setHover(e.shiftKey ? r2(constrainAngle(last, sp)) : sp);
      return;
    }
    if (shapeDrag) {
      const next = draggedShape(shapeDrag, p, e.shiftKey);
      if (edit((pl) => updateShape(pl, next), false) && !shapeDrag.recorded) {
        setHistory((h) => recordHistory(h, shapeDrag.planAtStart));
        setShapeDrag({ ...shapeDrag, recorded: true });
      }
      return;
    }
    if (!deviceDrag) return;
    if (edit((pl) => moveDevice(pl, deviceDrag.id, { x: Math.round(p.x), y: Math.round(p.y) }), false) && !deviceDrag.recorded) {
      setHistory((h) => recordHistory(h, deviceDrag.planAtStart));
      setDeviceDrag({ ...deviceDrag, recorded: true });
    }
  };

  const onCanvasUp = () => {
    if (dragDraft) {
      const { a, b, square } = dragDraft;
      setDragDraft(null);
      if (mode === 'draw-rect') {
        const r = rectFromCorners(a, b, square);
        if (r.width < unit * 0.5 || r.height < unit * 0.5) {
          setMessage({ kind: 'info', text: 'Drag from one corner to the opposite corner to draw a rectangle.' });
        } else {
          addAndSelect({ kind: 'rect', id: 'new', ...r, rotationDeg: 0, stroke: lineStyle, fill: areaFill });
        }
      } else if (mode === 'draw-opening') {
        const tap = distancePx(a, b) < unit * 0.8;
        const geom = tap
          ? { cx: a.x, cy: a.y, widthMetres: OPENING_DEFAULT_WIDTH_M[openingVariant], rotationDeg: 0 }
          : openingFromDrag(openingVariant, a, b, drawMpp);
        addAndSelect({ kind: 'opening', id: 'new', variant: openingVariant, ...geom, widthMetres: Math.round(geom.widthMetres * 100) / 100, flip: false });
      }
    }
    setDeviceDrag(null);
    setShapeDrag(null);
  };

  const onDeviceKey = (e: KeyboardEvent<SVGGElement>, d: DeviceView) => {
    const step = (e.shiftKey ? 5 : 1) * unit;
    const moves: Record<string, Point> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    };
    const m = moves[e.key];
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelected(d.device.id);
      setSelectedShapeId(null);
    } else if (m) {
      e.preventDefault();
      edit((pl) => moveDevice(pl, d.device.id, { x: Math.round(d.device.x + m.x), y: Math.round(d.device.y + m.y) }));
    } else if (d.device.kind === 'camera' && (e.key === '[' || e.key === ']')) {
      e.preventDefault();
      const rot = d.device.rotationDeg + (e.key === ']' ? 15 : -15);
      edit((pl) => rotateCamera(pl, d.device.id, rot));
    }
  };

  const onShapeKey = (e: KeyboardEvent<SVGGElement>, s: LayoutShape) => {
    const base = snapPx ?? unit;
    const step = (e.shiftKey ? 5 : 1) * base;
    const moves: Record<string, Point> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    };
    const m = moves[e.key];
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectShape(s.id);
    } else if (m) {
      e.preventDefault();
      const a = shapeAnchor(s);
      edit((pl) => updateShape(pl, moveShapeTo(s, r2({ x: a.x + m.x, y: a.y + m.y }))));
    } else if ((e.key === '[' || e.key === ']') && s.kind !== 'polyline' && s.kind !== 'curve') {
      e.preventDefault();
      edit((pl) => updateShape(pl, rotateShape(s, s.rotationDeg + (e.key === ']' ? 15 : -15))));
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      if (edit((pl) => removeShape(pl, s.id))) setSelectedShapeId(null);
    }
  };

  // Ctrl/⌘+Z, Ctrl+Y / Ctrl+Shift+Z, Esc, Enter and Delete while the Site map is open
  // (not while typing in a field). The listener reads the latest handler from a ref.
  const onWindowKey = (e: globalThis.KeyboardEvent) => {
    if (e.defaultPrevented || isEditableTarget(e.target)) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (mod && k === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
    } else if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) {
      e.preventDefault();
      redo();
    } else if (e.key === 'Escape') {
      if (pathDraft.length > 0 || dragDraft) cancelDrafts();
      else setSelectedShapeId(null);
    } else if (e.key === 'Enter' && (mode === 'draw-line' || mode === 'draw-curve') && pathDraft.length > 0) {
      e.preventDefault();
      finishPath();
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedShape && !(e.target instanceof SVGElement)) {
      e.preventDefault();
      if (edit((pl) => removeShape(pl, selectedShape.id))) setSelectedShapeId(null);
    }
  };
  const keyRef = useRef(onWindowKey);
  useEffect(() => {
    keyRef.current = onWindowKey;
  });
  useEffect(() => {
    const listener = (e: globalThis.KeyboardEvent) => keyRef.current(e);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  // ---- routes --------------------------------------------------------------
  const routeCamera = cameraViews.find((c) => c.device.id === routeCameraId) ?? cameraViews[0] ?? null;
  const finishRoute = () => {
    if (!routeCamera || !routeCamera.endpointId) {
      setMessage({ kind: 'error', text: 'Place the NVR (or cable the camera to a switch) before drawing its route.' });
      return;
    }
    const endId = routeCamera.endpointId;
    if (edit((pl) => setRoute(pl, routeCamera.device.id, endId, routeDraft))) {
      setRouteDraft([]);
      setMode('select');
    }
  };

  const sig = (v: number) => Number(v.toPrecision(3));
  const scaleText =
    view.metresPerPx === null
      ? null
      : `1 px = ${sig(lengthFromMetres(view.metresPerPx, units))} ${u} · 100 px = ${sig(lengthFromMetres(view.metresPerPx * 100, units))} ${u}`;

  const selectedView = view.devices.find((d) => d.device.id === selected) ?? null;

  return (
    <div className="grid gap-4">
      {/* --- plan and scale ---------------------------------------------------- */}
      <Card
        title="Plan and scale"
        subtitle="Upload a floor or site plan (PNG or JPG) and set its scale from a dimension you know — or, with no plan, enter the size of the building or area and the layout is drawn for you, with room around it and the scale set."
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="plan-upload" className="block text-sm font-medium text-[var(--color-ink)]">
                Plan image (PNG or JPG)
              </label>
              <input
                id="plan-upload"
                type="file"
                accept={PLAN_UPLOAD_ACCEPT}
                className="mt-1 max-w-full text-sm text-[var(--color-ink-2)] file:mr-3 file:rounded-control file:border file:border-[var(--color-border-strong)] file:bg-[var(--color-surface)] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[var(--color-ink)]"
                onChange={(e) => {
                  void onUpload(e.currentTarget.files?.[0]);
                  e.currentTarget.value = '';
                }}
              />
              <p className="mt-1 text-xs text-[var(--color-ink-3)]">PDF is not supported — export the page as PNG or JPG first.</p>
            </div>
            {plan.image && (
              <Button variant="ghost" icon="trash" onClick={() => edit(removeImage)}>
                Remove image
              </Button>
            )}
            {!plan.image && (
              <div>
                <span className="block text-sm font-medium text-[var(--color-ink)]">No plan to upload?</span>
                <Button className="mt-1" icon={layout.canvas ? 'edit' : 'square'} ariaExpanded={canvasFormOpen} onClick={() => setCanvasFormOpen((o) => !o)}>
                  {layout.canvas ? `Layout size: ${round(lengthFromMetres(layout.canvas.widthMetres, units), 1)} × ${round(lengthFromMetres(layout.canvas.heightMetres, units), 1)} ${u}` : 'Draw a new layout'}
                </Button>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium text-[var(--color-ink)]">Scale:</span>
            <span data-testid="plan-scale" className="font-mono text-[var(--color-ink-2)]">
              {scaleText ?? 'not calibrated — distances cannot be measured on the plan yet'}
            </span>
            <Button onClick={() => startCalibrating()}>{plan.calibration ? 'Recalibrate' : 'Calibrate scale'}</Button>
            {plan.calibration && (
              <Button variant="ghost" onClick={() => edit(clearCalibration)}>
                Clear scale
              </Button>
            )}
          </div>
        </div>

        {message && (
          <p
            role={message.kind === 'error' ? 'alert' : 'status'}
            className="mt-3 rounded-control border-l-4 px-3 py-2 text-sm"
            style={{
              borderColor: message.kind === 'error' ? 'var(--color-fail)' : 'var(--color-brand)',
              background: message.kind === 'error' ? 'var(--color-fail-soft)' : 'var(--color-accent-soft)',
              color: message.kind === 'error' ? 'var(--color-fail)' : 'var(--color-ink)',
            }}
          >
            {message.text}
          </p>
        )}

        {canvasFormOpen && !plan.image && (
          <LayoutCanvasForm
            plan={plan}
            units={units}
            edit={edit}
            onCancel={() => setCanvasFormOpen(false)}
            onDone={(text, selectId) => {
              setCanvasFormOpen(false);
              setMessage({ kind: 'info', text });
              if (selectId) {
                // The place was drawn for the engineer: select it, ready to edit, move or delete.
                setMode('select');
                setRouteDraft([]);
                cancelDrafts();
                selectShape(selectId);
              }
            }}
          />
        )}
        {plan.image && layout.shapes.length === 0 && (
          <p className="mt-3 text-xs text-[var(--color-ink-3)]">
            You can also draw over the image (rooms, walls, doors, labels) with the drawing tools — calibrate first so door widths and the grid are in
            metres.
          </p>
        )}

        {mode === 'calibrate' && (
          <fieldset className="mt-3 rounded-control border border-[var(--color-border)] p-3">
            <legend className="px-1 text-sm font-semibold text-[var(--color-ink)]">Calibration line</legend>
            <p className="mb-2 text-xs text-[var(--color-ink-3)]">
              Click both ends of a known dimension on the plan (a door, a grid line, a dimensioned wall), or type the two
              points in image pixels. Then enter its real length.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {(
                [
                  ['ax', 'Point A x (px)'],
                  ['ay', 'Point A y (px)'],
                  ['bx', 'Point B x (px)'],
                  ['by', 'Point B y (px)'],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="text-xs text-[var(--color-ink-2)]">
                  {label}
                  <input
                    type="number"
                    className={inputClass}
                    value={Number.isFinite(cal[k]) ? cal[k] : ''}
                    onChange={(e) => {
                      const v = num(e.currentTarget.value);
                      setCal((c) => ({ ...c, [k]: v }));
                    }}
                  />
                </label>
              ))}
              <label className="text-xs text-[var(--color-ink-2)]">
                Real length ({u})
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={Number.isFinite(cal.metres) ? round(lengthFromMetres(cal.metres, units), 4) : ''}
                  onChange={(e) => {
                    const v = num(e.currentTarget.value);
                    setCal((c) => ({ ...c, metres: lengthToMetres(v, units) }));
                  }}
                />
              </label>
            </div>
            <div className="mt-2 flex gap-2">
              <Button variant="primary" onClick={applyCalibration}>
                Apply calibration
              </Button>
              <Button variant="ghost" onClick={() => setMode('select')}>
                Cancel
              </Button>
            </div>
          </fieldset>
        )}
      </Card>

      {/* --- workspace: toolbar, canvas, side panel ----------------------------- */}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-label="Map workspace" className="min-w-0 rounded-card border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] px-3 py-2">
            <div className="flex flex-wrap gap-1" role="group" aria-label="Map tool">
              {(['select', 'place-camera', 'place-nvr', 'place-switch', 'route'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => {
                    setMode(m);
                    setRouteDraft([]);
                    cancelDrafts();
                    if (m !== 'select') setSelectedShapeId(null);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-control border px-2.5 py-1.5 text-sm ${
                    mode === m
                      ? 'border-[var(--color-brand)] bg-[var(--color-accent-soft)] font-medium text-[var(--color-accent)]'
                      : 'border-transparent text-[var(--color-ink-2)] hover:bg-[var(--color-surface-2)]'
                  }`}
                >
                  <Icon name={MODE_ICON[m]} size={16} />
                  {MODE_LABEL[m]}
                </button>
              ))}
            </div>
            {mode === 'place-camera' && (
              <label className="text-sm text-[var(--color-ink-2)]">
                <span className="sr-only">Camera to place</span>
                <select
                  className={inputClass}
                  value={chosenUnplaced ? unplacedKey(chosenUnplaced.locationId, chosenUnplaced.index) : ''}
                  onChange={(e) => setCameraToPlace(e.currentTarget.value)}
                >
                  {view.unplaced.length === 0 && <option value="">Every camera is placed</option>}
                  {view.unplaced.map((c) => (
                    <option key={unplacedKey(c.locationId, c.index)} value={unplacedKey(c.locationId, c.index)}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {mode === 'route' && (
              <>
                <label className="text-sm text-[var(--color-ink-2)]">
                  <span className="sr-only">Camera to route</span>
                  <select className={inputClass} value={routeCamera?.device.id ?? ''} onChange={(e) => setRouteCameraId(e.currentTarget.value)}>
                    {cameraViews.length === 0 && <option value="">Place a camera first</option>}
                    {cameraViews.map((c) => (
                      <option key={c.device.id} value={c.device.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                <Button variant="primary" onClick={finishRoute}>
                  Finish route ({routeDraft.length} bend{routeDraft.length === 1 ? '' : 's'})
                </Button>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] px-3 py-2">
            <div className="flex flex-wrap gap-1" role="group" aria-label="Drawing tool">
              {(['draw-rect', 'draw-line', 'draw-curve', 'draw-opening', 'draw-text'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => chooseDrawTool(m)}
                  className={`inline-flex items-center gap-1.5 rounded-control border px-2.5 py-1.5 text-sm ${
                    mode === m
                      ? 'border-[var(--color-brand)] bg-[var(--color-accent-soft)] font-medium text-[var(--color-accent)]'
                      : 'border-transparent text-[var(--color-ink-2)] hover:bg-[var(--color-surface-2)]'
                  }`}
                >
                  <Icon name={MODE_ICON[m]} size={16} />
                  {MODE_LABEL[m]}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1" role="group" aria-label="History">
              <Button size="sm" variant="ghost" icon="undo" disabled={history.past.length === 0} onClick={undo} title="Undo (Ctrl+Z)">
                Undo
              </Button>
              <Button size="sm" variant="ghost" icon="redo" disabled={history.future.length === 0} onClick={redo} title="Redo (Ctrl+Y)">
                Redo
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--color-ink-2)]">
              <label className="inline-flex items-center gap-1.5" title={gridPx ? undefined : 'Set the scale (or draw a new layout) to use the metre grid'}>
                <input type="checkbox" checked={showGrid && gridPx !== null} disabled={gridPx === null} onChange={(e) => setShowGrid(e.currentTarget.checked)} />
                Grid {round(lengthFromMetres(layout.gridMetres, units), 2)} {u}
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input type="checkbox" checked={snapOn && gridPx !== null} disabled={gridPx === null} onChange={(e) => setSnapOn(e.currentTarget.checked)} />
                Snap to grid
              </label>
              <label className="inline-flex items-center gap-1.5" title="Drawn shapes ignore the pointer, so devices on top are easy to pick and drag">
                <input type="checkbox" checked={locked} onChange={(e) => setLocked(e.currentTarget.checked)} />
                Lock drawing
              </label>
            </div>

            {(mode === 'draw-rect' || mode === 'draw-line' || mode === 'draw-curve') && (
              <div className="flex w-full flex-wrap items-end gap-2" role="group" aria-label="Drawing options">
                <label className="text-xs text-[var(--color-ink-2)]">
                  Line style
                  <select className={inputClass} value={lineStyle} onChange={(e) => setLineStyle(e.currentTarget.value as LineStyle)}>
                    {LINE_STYLES.map((l) => (
                      <option key={l} value={l}>
                        {LINE_STYLE_LABEL[l]}
                      </option>
                    ))}
                  </select>
                </label>
                {mode !== 'draw-rect' && (
                  <label className="inline-flex items-center gap-1.5 pb-1 text-sm text-[var(--color-ink-2)]">
                    <input type="checkbox" checked={closePath} onChange={(e) => setClosePath(e.currentTarget.checked)} />
                    Close into an area
                  </label>
                )}
                <label className="text-xs text-[var(--color-ink-2)]">
                  Fill (closed shapes)
                  <select className={inputClass} value={areaFill} disabled={mode !== 'draw-rect' && !closePath} onChange={(e) => setAreaFill(e.currentTarget.value as AreaFill)}>
                    {AREA_FILLS.map((f) => (
                      <option key={f} value={f}>
                        {AREA_FILL_LABEL[f]}
                      </option>
                    ))}
                  </select>
                </label>
                {mode !== 'draw-rect' && (
                  <>
                    <Button variant="primary" size="sm" disabled={pathDraft.length < 2} onClick={() => finishPath()}>
                      Finish {mode === 'draw-curve' ? 'curve' : 'line'} ({pathDraft.length} point{pathDraft.length === 1 ? '' : 's'})
                    </Button>
                    {pathDraft.length > 0 && (
                      <Button variant="ghost" size="sm" onClick={cancelDrafts}>
                        Cancel
                      </Button>
                    )}
                  </>
                )}
              </div>
            )}
            {mode === 'draw-opening' && (
              <div className="flex w-full flex-wrap items-end gap-2" role="group" aria-label="Drawing options">
                <label className="text-xs text-[var(--color-ink-2)]">
                  Opening
                  <select className={inputClass} value={openingVariant} onChange={(e) => setOpeningVariant(e.currentTarget.value as OpeningVariant)}>
                    {OPENING_VARIANTS.map((v) => (
                      <option key={v} value={v}>
                        {OPENING_LABEL[v]} ({round(lengthFromMetres(OPENING_DEFAULT_WIDTH_M[v], units), 1)} {u})
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            {mode === 'draw-text' && (
              <div className="flex w-full flex-wrap items-end gap-2" role="group" aria-label="Drawing options">
                <label className="text-xs text-[var(--color-ink-2)]">
                  Label text
                  <input className={inputClass} maxLength={120} value={labelText} placeholder="e.g. Reception" onChange={(e) => setLabelText(e.currentTarget.value)} />
                </label>
              </div>
            )}
            <p className="w-full text-xs text-[var(--color-ink-3)]">{MODE_HINT[mode]}</p>
            {TOUCH_HINT[mode] && <p className="w-full text-xs text-[var(--color-ink-3)] sm:hidden">{TOUCH_HINT[mode]}</p>}
          </div>

          <div className="p-3">
            <div className="overflow-hidden rounded-control border border-[var(--color-border)]">
            <svg
              ref={svgRef}
              // Over a plan image the markers keep the light palette in every theme (index.css).
              className={plan.image ? 'plan-on-image' : undefined}
              viewBox={`0 0 ${widthPx} ${heightPx}`}
              preserveAspectRatio="none"
              style={{ width: '100%', height: 'auto', aspectRatio: `${widthPx} / ${heightPx}`, touchAction: 'none', display: 'block' }}
              role="group"
              aria-label={`Site plan, ${view.devices.length} device(s) placed${layout.shapes.length ? `, ${layout.shapes.length} drawn shape(s)` : ''}. The tables below list every device and shape and can edit them without a pointer.`}
              onPointerDown={onCanvasDown}
              onPointerMove={onCanvasMove}
              onPointerUp={onCanvasUp}
              onPointerCancel={() => {
                setDeviceDrag(null);
                setShapeDrag(null);
                setDragDraft(null);
              }}
              onPointerLeave={() => setHover(null)}
              onDoubleClick={() => {
                if ((mode === 'draw-line' || mode === 'draw-curve') && pathDraft.length >= 2) finishPath();
              }}
              data-mode={mode}
            >
              {plan.image ? (
                <image href={plan.image.dataUri} x={0} y={0} width={widthPx} height={heightPx} />
              ) : layout.canvas ? (
                <rect x={0} y={0} width={widthPx} height={heightPx} fill="var(--color-surface)" />
              ) : (
                <>
                  <rect x={0} y={0} width={widthPx} height={heightPx} fill="var(--color-surface-2)" />
                  {layout.shapes.length === 0 && (
                    <text x={widthPx / 2} y={heightPx / 2} textAnchor="middle" fontSize={unit * 2} fill="var(--color-ink-3)">
                      No plan image — devices can still be placed and run lengths typed in the table
                    </text>
                  )}
                </>
              )}
              {showGrid && gridPx !== null && <GridLines widthPx={widthPx} heightPx={heightPx} gridPx={gridPx} unit={unit} />}

              <LayoutDefs idBase={idBase} palette={palette} unit={unit} />
              {layout.shapes.map((sh) => (
                <g
                  key={sh.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`${describeShape(sh, view.metresPerPx)} (${sh.id})${sh.id === selectedShapeId ? ', selected' : ''}`}
                  data-shape-id={sh.id}
                  onPointerDown={(e) => onShapeDown(e, sh, 'move')}
                  onKeyDown={(e) => onShapeKey(e, sh)}
                  pointerEvents={mode === 'select' && !locked ? undefined : 'none'}
                  style={{ cursor: mode === 'select' && !locked ? 'move' : undefined }}
                >
                  {/* Hit areas only while shapes can be picked: their own pointer-events would override the group's "none". */}
                  <LayoutShapeGraphic shape={sh} palette={palette} unit={unit} metresPerPx={drawMpp} idBase={idBase} hit={mode === 'select' && !locked} />
                </g>
              ))}

              {view.devices.map((d) =>
                d.cone.length > 2 ? (
                  <polygon
                    key={`cone-${d.device.id}`}
                    points={d.cone.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="var(--color-brand)"
                    fillOpacity={0.18}
                    stroke="var(--color-brand)"
                    strokeWidth={unit * 0.15}
                  />
                ) : null,
              )}

              {view.lines.map((l) => {
                const a = l.points[0]!;
                const b = l.points[l.points.length - 1]!;
                return (
                  <g key={l.id}>
                    <polyline
                      points={l.points.map((p) => `${p.x},${p.y}`).join(' ')}
                      fill="none"
                      // Accent, not ink: a drawn layout's walls are ink, and a route must not read as a wall.
                      stroke={l.kind === 'drawn' ? 'var(--color-accent)' : 'var(--color-estimate)'}
                      strokeWidth={unit * 0.3}
                      strokeDasharray={l.kind === 'estimated' ? `${unit} ${unit * 0.7}` : undefined}
                    />
                    {l.kind === 'estimated' && (
                      <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - unit * 0.5} textAnchor="middle" fontSize={unit * 1.4} fill="var(--color-estimate)">
                        estimated route
                      </text>
                    )}
                  </g>
                );
              })}

              {plan.calibration && !canvasScale && (
                <line
                  x1={plan.calibration.a.x}
                  y1={plan.calibration.a.y}
                  x2={plan.calibration.b.x}
                  y2={plan.calibration.b.y}
                  stroke="var(--color-marginal)"
                  strokeWidth={unit * 0.3}
                />
              )}
              {mode === 'calibrate' &&
                [
                  [cal.ax, cal.ay],
                  [cal.bx, cal.by],
                ].map(([x, y], i) =>
                  Number.isFinite(x) && Number.isFinite(y) ? (
                    <circle key={i} cx={x} cy={y} r={unit * 0.6} fill="var(--color-marginal)" />
                  ) : null,
                )}

              {mode === 'route' && routeCamera && routeDraft.length > 0 && (
                <polyline
                  points={[routeCamera.device, ...routeDraft].map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke="var(--color-accent)"
                  strokeWidth={unit * 0.3}
                />
              )}

              <DrawDrafts
                mode={mode}
                dragDraft={dragDraft}
                pathDraft={pathDraft}
                hover={hover}
                closePath={closePath}
                lineStyle={lineStyle}
                openingVariant={openingVariant}
                unit={unit}
                metresPerPx={view.metresPerPx}
                drawMpp={drawMpp}
                units={units}
              />

              {view.devices.map((d) => (
                <g
                  key={d.device.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`${d.label} (${d.device.kind}) at ${Math.round(d.device.x)}, ${Math.round(d.device.y)} px`}
                  onPointerDown={(e) => onDeviceDown(e, d.device.id)}
                  onKeyDown={(e) => onDeviceKey(e, d)}
                  style={{ cursor: mode === 'select' ? 'move' : 'crosshair' }}
                >
                  {d.device.kind === 'camera' ? (
                    <circle cx={d.device.x} cy={d.device.y} r={unit * 0.9} fill="var(--color-accent)" stroke={selected === d.device.id ? 'var(--color-ink)' : 'white'} strokeWidth={unit * 0.25} />
                  ) : (
                    <rect
                      x={d.device.x - unit}
                      y={d.device.y - unit}
                      width={unit * 2}
                      height={unit * 2}
                      fill={d.device.kind === 'nvr' ? 'var(--color-ink)' : 'var(--color-pass)'}
                      stroke={selected === d.device.id ? 'var(--color-accent)' : 'white'}
                      strokeWidth={unit * 0.25}
                    />
                  )}
                  <text x={d.device.x + unit * 1.3} y={d.device.y + unit * 0.5} fontSize={unit * 1.5} fill="var(--color-ink)" stroke="var(--color-surface)" strokeWidth={unit * 0.3} paintOrder="stroke">
                    {d.label}
                  </text>
                </g>
              ))}

              {selectedShape && mode === 'select' && !locked && (
                <ShapeHandles shape={selectedShape} unit={unit} drawMpp={drawMpp} onHandleDown={onShapeDown} />
              )}
            </svg>
            </div>
            {layout.canvas && !plan.image && (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-ink-2)]">
                <span data-testid="canvas-readout" className="font-medium">
                  {canvasReadout(layout.canvas, layout.gridMetres, units)}
                </span>
                {overflow && (
                  <span className="inline-flex flex-wrap items-center gap-2 text-[var(--color-marginal)]">
                    <Icon name="alert" size={14} />
                    Drawing reaches past the canvas edge ({overflow}).
                    <Button size="sm" variant="secondary" onClick={() => edit(fitCanvasToShapes)}>
                      Extend canvas to fit
                    </Button>
                  </span>
                )}
                {!overflow && !canvasFormOpen && (
                  <Button size="sm" variant="ghost" icon="plus" onClick={() => setCanvasFormOpen(true)}>
                    Add margin…
                  </Button>
                )}
              </div>
            )}
            {view.warnings.map((w) => (
              <p key={w} className="mt-2 flex gap-1.5 text-xs text-[var(--color-marginal)]">
                <Icon name="alert" size={14} />
                {w}
              </p>
            ))}
          </div>
        </section>

        {selectedShape ? (
          <aside aria-label="Selected shape" className="rounded-card border border-[var(--color-brand)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-raised)]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-ink)]">{describeShape(selectedShape, view.metresPerPx)}</h3>
                <p className="text-xs text-[var(--color-ink-3)]">Drawn shape · {selectedShape.id}</p>
              </div>
              <Button variant="ghost" size="sm" icon="close" ariaLabel="Deselect shape" onClick={() => setSelectedShapeId(null)} />
            </div>
            <div className="mt-3">
              <ShapeFields shape={selectedShape} name={selectedShape.id} units={units} metresPerPx={view.metresPerPx} edit={edit} />
            </div>
            <div className="mt-3">
              <ShapeActions shape={selectedShape} name={selectedShape.id} edit={edit} offset={unit * 2} onRemoved={() => setSelectedShapeId(null)} />
            </div>
          </aside>
        ) : (
          <SidePanel selected={selectedView} plan={plan} switches={view.switches} units={units} edit={edit} onClose={() => setSelected(null)} />
        )}
      </div>

      {/* --- M4: keyboard / list alternative ---------------------------------- */}
      <Card title="Device list" subtitle="Everything the map does, without a pointer: place, move, rotate, cable and type a run length.">
        <div className="flex flex-wrap items-center gap-2">
          <Button icon="plus" onClick={() => edit((p) => placeNvr(p, canvasCentre(p)))}>Add NVR / rack</Button>
          <Button icon="plus" onClick={() => edit((p) => placeSwitch(p, canvasCentre(p)))}>Add switch</Button>
          {view.unplaced.length > 0 && <span className="text-sm text-[var(--color-ink-3)]">Not yet placed:</span>}
          {view.unplaced.map((c) => (
            <Button key={unplacedKey(c.locationId, c.index)} variant="ghost" onClick={() => edit((p) => placeCamera(p, c.locationId, c.index, canvasCentre(p)))}>
              Place {c.label}
            </Button>
          ))}
        </div>

        {view.devices.length > 0 && (
          // relative: the sr-only "Actions" header is absolutely positioned; without a
          // positioned scroll box it escaped the overflow clip and widened the page on a phone.
          <div className="relative mt-3 overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <caption className="sr-only">Placed devices — editable without a pointer</caption>
              <thead className="text-xs text-[var(--color-ink-3)]">
                <tr>
                  <th scope="col" className="py-1 pr-2">Device</th>
                  <th scope="col" className="py-1 pr-2">x (px)</th>
                  <th scope="col" className="py-1 pr-2">y (px)</th>
                  <th scope="col" className="py-1 pr-2">Facing (°)</th>
                  <th scope="col" className="py-1 pr-2">Cabled to</th>
                  <th scope="col" className="py-1 pr-2">Horizontal run</th>
                  <th scope="col" className="py-1 pr-2">Typed run ({u})</th>
                  <th scope="col" className="py-1"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {view.devices.map((d) => (
                  <DeviceRow
                    key={d.device.id}
                    d={d}
                    plan={plan}
                    switches={view.switches}
                    units={units}
                    edit={edit}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* --- keyboard / list alternative for the drawn layout -------------------- */}
      <Card title="Drawn layout" subtitle="Everything the drawing tools do, without a pointer: add a shape, then edit its position, size, rotation, points, text and style, or delete it.">
        <LayoutShapeList plan={plan} units={units} metresPerPx={view.metresPerPx} canvas={{ widthPx, heightPx }} edit={edit} unit={unit} />
      </Card>

      {/* --- M5: optional online reference map (off by default) --------------- */}
      <Card title="Online reference map" subtitle="Optional. Look the site up on OpenStreetMap and measure a known distance for the calibration.">
        <OsmReferenceMap units={units} onUseAsCalibrationLength={calibrateFromMap} />
      </Card>
    </div>
  );
}

const LEGEND: readonly { readonly label: string; readonly swatch: ReactNode }[] = [
  { label: 'Camera', swatch: <circle cx="10" cy="10" r="6" fill="var(--color-accent)" stroke="white" strokeWidth="2" /> },
  { label: 'Field of view', swatch: <path d="M3 17 10 3l7 14z" fill="var(--color-brand)" fillOpacity="0.2" stroke="var(--color-brand)" /> },
  { label: 'NVR / rack', swatch: <rect x="4" y="4" width="12" height="12" fill="var(--color-ink)" /> },
  { label: 'Switch', swatch: <rect x="4" y="4" width="12" height="12" fill="var(--color-pass)" /> },
  { label: 'Drawn route', swatch: <path d="M2 10h16" stroke="var(--color-accent)" strokeWidth="2.5" /> },
  { label: 'Estimated route', swatch: <path d="M2 10h16" stroke="var(--color-estimate)" strokeWidth="2.5" strokeDasharray="4 3" /> },
  { label: 'Drawn wall', swatch: <path d="M2 10h16" stroke="var(--color-ink)" strokeWidth="4" /> },
  {
    label: 'Drawn fence',
    swatch: (
      <>
        <path d="M2 10h16" stroke="var(--color-ink)" strokeWidth="1.2" />
        <path d="M2 10h16" stroke="var(--color-ink)" strokeWidth="6" strokeDasharray="1 3.5" />
      </>
    ),
  },
  { label: 'Door', swatch: <path d="M3 17h14M5 17V5M5 5a12 12 0 0 1 12 12" fill="none" stroke="var(--color-ink)" strokeWidth="1.5" /> },
];

/** The selected device, editable; with nothing selected, the legend. */
function SidePanel({
  selected,
  plan,
  switches,
  units,
  edit,
  onClose,
}: {
  selected: DeviceView | null;
  plan: SitePlan;
  switches: readonly { readonly id: string; readonly label: string }[];
  units: UnitSystemState;
  edit: (f: (p: SitePlan) => SitePlan) => boolean;
  onClose: () => void;
}) {
  if (!selected) {
    return (
      <aside aria-label="Selected device" className="rounded-card border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
        <h3 className="text-sm font-semibold text-[var(--color-ink)]">No device selected</h3>
        <p className="mt-1 text-sm text-[var(--color-ink-2)]">
          Click a device on the plan (or focus it and press Enter) to edit it here. The device list below does the same without a pointer.
        </p>
        <h4 className="mt-4 text-xs font-semibold tracking-wide text-[var(--color-ink-3)] uppercase">Legend</h4>
        <ul className="mt-2 grid gap-1.5 text-sm text-[var(--color-ink-2)]">
          {LEGEND.map((l) => (
            <li key={l.label} className="flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" className="plan-on-image shrink-0">
                {l.swatch}
              </svg>
              {l.label}
            </li>
          ))}
        </ul>
      </aside>
    );
  }
  const dev = selected.device;
  const route = selected.endpointId ? routeBetween(plan, dev.id, selected.endpointId) : null;
  const setNumber = (f: (v: number) => (p: SitePlan) => SitePlan) => (v: number) => {
    if (Number.isFinite(v)) edit(f(v));
  };
  const u = lengthUnitLabel(units);
  return (
    <aside aria-label="Selected device" className="rounded-card border border-[var(--color-brand)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-raised)]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-ink)]">{selected.label}</h3>
          <p className="text-xs text-[var(--color-ink-3)]">{dev.kind === 'nvr' ? 'NVR / rack' : dev.kind}</p>
        </div>
        <Button variant="ghost" size="sm" icon="close" ariaLabel="Deselect device" onClick={onClose} />
      </div>
      {selected.coneNote && <p className="mt-2 text-xs text-[var(--color-ink-3)]">{selected.coneNote}</p>}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {dev.kind !== 'camera' && (
          <label className="col-span-2 text-xs text-[var(--color-ink-2)]">
            Device name
            <input className={inputClass} value={dev.label} onChange={(e) => edit((p) => renameDevice(p, dev.id, e.currentTarget.value))} />
          </label>
        )}
        <label className="text-xs text-[var(--color-ink-2)]">
          x (px)
          <NumberInput className={inputClass} value={Math.round(dev.x)} onValueChange={setNumber((v) => (p) => moveDevice(p, dev.id, { x: v, y: dev.y }))} />
        </label>
        <label className="text-xs text-[var(--color-ink-2)]">
          y (px)
          <NumberInput className={inputClass} value={Math.round(dev.y)} onValueChange={setNumber((v) => (p) => moveDevice(p, dev.id, { x: dev.x, y: v }))} />
        </label>
        {dev.kind === 'camera' && (
          <>
            <label className="col-span-2 text-xs text-[var(--color-ink-2)]">
              Facing (degrees clockwise from up)
              <div className="flex gap-1">
                <Button size="sm" ariaLabel="Rotate 15 degrees anticlockwise" onClick={() => edit((p) => rotateCamera(p, dev.id, dev.rotationDeg - 15))}>
                  −15°
                </Button>
                <NumberInput step={15} className={inputClass} value={Math.round(dev.rotationDeg)} onValueChange={setNumber((v) => (p) => rotateCamera(p, dev.id, v))} />
                <Button size="sm" ariaLabel="Rotate 15 degrees clockwise" onClick={() => edit((p) => rotateCamera(p, dev.id, dev.rotationDeg + 15))}>
                  +15°
                </Button>
              </div>
            </label>
            <label className="col-span-2 text-xs text-[var(--color-ink-2)]">
              Cabled to
              <select
                className={inputClass}
                value={dev.connectTo ?? ''}
                onChange={(e) => {
                  const v = e.currentTarget.value;
                  edit((p) => connectCamera(p, dev.id, v === '' ? null : v));
                }}
              >
                <option value="">NVR / rack</option>
                {switches.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.label}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        {dev.kind !== 'nvr' && (
          <label className="col-span-2 text-xs text-[var(--color-ink-2)]">
            Typed run ({u})
            <NumberInput
              min={0}
              placeholder="from plan"
              className={inputClass}
              value={dev.runMetresOverride === null ? Number.NaN : round(lengthFromMetres(dev.runMetresOverride, units), 1)}
              onValueChange={(v, raw) => {
                if (raw.trim() === '') edit((p) => setRunOverride(p, dev.id, null));
                else if (Number.isFinite(v)) edit((p) => setRunOverride(p, dev.id, lengthToMetres(v, units)));
              }}
            />
          </label>
        )}
      </div>
      {selected.run && (
        <p className="mt-3 text-sm text-[var(--color-ink-2)]">
          {dev.kind === 'switch' ? 'Uplink' : 'Horizontal run'}: <RunCell run={selected.run} units={units} />
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {route && (
          <Button variant="ghost" size="sm" onClick={() => edit((p) => removeRoute(p, route.id))}>
            Remove its route
          </Button>
        )}
        <Button
          variant="danger"
          size="sm"
          icon="trash"
          onClick={() => {
            if (edit((p) => removeDevice(p, dev.id))) onClose();
          }}
        >
          Remove device
        </Button>
      </div>
    </aside>
  );
}

function RunCell({ run, units }: { run: RunView | null; units: UnitSystemState }) {
  if (!run) return <span className="text-[var(--color-ink-3)]">—</span>;
  const label = { drawn: 'drawn', entered: 'typed in', estimated: 'estimated route', unplaced: 'placeholder', uncalibrated: 'placeholder' }[run.basis];
  return (
    <span title={run.explanation}>
      <span className="font-mono">
        {round(lengthFromMetres(run.metres, units), 1)} {lengthUnitLabel(units)}
      </span>{' '}
      <span className="text-xs text-[var(--color-ink-3)]">{label}</span> {run.isEstimate && <EstimateBadge title={run.explanation} />}
    </span>
  );
}

function DeviceRow({
  d,
  plan,
  switches,
  units,
  edit,
}: {
  d: DeviceView;
  plan: SitePlan;
  switches: readonly { readonly id: string; readonly label: string }[];
  units: UnitSystemState;
  edit: (f: (p: SitePlan) => SitePlan) => boolean;
}) {
  const dev = d.device;
  const route = d.endpointId ? routeBetween(plan, dev.id, d.endpointId) : null;
  const setNumber = (f: (v: number) => (p: SitePlan) => SitePlan) => (v: number) => {
    if (Number.isFinite(v)) edit(f(v));
  };
  return (
    <tr className="border-t border-[var(--color-border)] align-top">
      <th scope="row" className="py-1.5 pr-2 font-medium text-[var(--color-ink)]">
        {dev.kind === 'camera' ? (
          d.label
        ) : (
          <input aria-label={`Name of ${d.label}`} className={inputClass} value={dev.label} onChange={(e) => edit((p) => renameDevice(p, dev.id, e.currentTarget.value))} />
        )}
        <span className="block text-xs font-normal text-[var(--color-ink-3)]">{dev.kind === 'nvr' ? 'NVR / rack' : dev.kind}</span>
        {d.coneNote && <span className="block text-xs font-normal text-[var(--color-ink-3)]">{d.coneNote}</span>}
      </th>
      <td className="py-1.5 pr-2">
        <NumberInput aria-label={`x of ${d.label} (px)`} className={inputClass} value={Math.round(dev.x)} onValueChange={setNumber((v) => (p) => moveDevice(p, dev.id, { x: v, y: dev.y }))} />
      </td>
      <td className="py-1.5 pr-2">
        <NumberInput aria-label={`y of ${d.label} (px)`} className={inputClass} value={Math.round(dev.y)} onValueChange={setNumber((v) => (p) => moveDevice(p, dev.id, { x: dev.x, y: v }))} />
      </td>
      <td className="py-1.5 pr-2">
        {dev.kind === 'camera' ? (
          <NumberInput step={15} aria-label={`Facing of ${d.label} (degrees clockwise from up)`} className={inputClass} value={Math.round(dev.rotationDeg)} onValueChange={setNumber((v) => (p) => rotateCamera(p, dev.id, v))} />
        ) : (
          <span className="text-[var(--color-ink-3)]">—</span>
        )}
      </td>
      <td className="py-1.5 pr-2">
        {dev.kind === 'camera' ? (
          <select
            aria-label={`Cable ${d.label} to`}
            className={inputClass}
            value={dev.connectTo ?? ''}
            onChange={(e) => {
              const v = e.currentTarget.value;
              edit((p) => connectCamera(p, dev.id, v === '' ? null : v));
            }}
          >
            <option value="">NVR / rack</option>
            {switches.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
        ) : dev.kind === 'switch' ? (
          <span className="text-[var(--color-ink-2)]">NVR (uplink)</span>
        ) : (
          <span className="text-[var(--color-ink-3)]">—</span>
        )}
      </td>
      <td className="py-1.5 pr-2">
        <RunCell run={d.run} units={units} />
      </td>
      <td className="py-1.5 pr-2">
        {dev.kind === 'nvr' ? (
          <span className="text-[var(--color-ink-3)]">—</span>
        ) : (
          <NumberInput
            min={0}
            aria-label={`Typed run length for ${d.label}`}
            placeholder="from plan"
            className={inputClass}
            value={dev.runMetresOverride === null ? Number.NaN : round(lengthFromMetres(dev.runMetresOverride, units), 1)}
            onValueChange={(v, raw) => {
              if (raw.trim() === '') edit((p) => setRunOverride(p, dev.id, null));
              else if (Number.isFinite(v)) edit((p) => setRunOverride(p, dev.id, lengthToMetres(v, units)));
            }}
          />
        )}
      </td>
      <td className="py-1.5 whitespace-nowrap">
        {route && (
          <Button variant="ghost" onClick={() => edit((p) => removeRoute(p, route.id))}>
            Remove route
          </Button>
        )}
        <Button variant="ghost" onClick={() => edit((p) => removeDevice(p, dev.id))}>
          Remove
        </Button>
      </td>
    </tr>
  );
}

/** Live preview of the shape being drawn, with its size in the length unit. */
function DrawDrafts({
  mode,
  dragDraft,
  pathDraft,
  hover,
  closePath,
  lineStyle,
  openingVariant,
  unit,
  metresPerPx,
  drawMpp,
  units,
}: {
  mode: Mode;
  dragDraft: { a: Point; b: Point; square: boolean } | null;
  pathDraft: readonly Point[];
  hover: Point | null;
  closePath: boolean;
  lineStyle: LineStyle;
  openingVariant: OpeningVariant;
  unit: number;
  metresPerPx: number | null;
  drawMpp: number;
  units: UnitSystemState;
}) {
  const len = (px: number) =>
    metresPerPx ? `${round(lengthFromMetres(px * metresPerPx, units), 1)} ${lengthUnitLabel(units)}` : `${Math.round(px)} px`;
  const st = lineStroke(lineStyle, unit);
  const label = (x: number, y: number, text: string) => (
    <text x={x} y={y} fontSize={unit * 1.4} textAnchor="middle" fill="var(--color-accent)" stroke="var(--color-surface)" strokeWidth={unit * 0.3} paintOrder="stroke" pointerEvents="none">
      {text}
    </text>
  );
  if (dragDraft && mode === 'draw-rect') {
    const r = rectFromCorners(dragDraft.a, dragDraft.b, dragDraft.square);
    return (
      <g pointerEvents="none" data-testid="draw-draft">
        <path d={polylinePathD(rectCorners({ ...r, rotationDeg: 0 }), true)} fill="var(--color-accent)" fillOpacity={0.08} stroke="var(--color-accent)" strokeWidth={st.width} strokeDasharray={`${unit * 0.6} ${unit * 0.4}`} />
        {label(r.cx, r.cy - r.height / 2 - unit * 0.8, `${len(r.width)} × ${len(r.height)}`)}
      </g>
    );
  }
  if (dragDraft && mode === 'draw-opening') {
    const { a, b } = dragDraft;
    const w = distancePx(a, b);
    return (
      <g pointerEvents="none" data-testid="draw-draft">
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--color-accent)" strokeWidth={unit * 0.4} />
        {w > unit * 0.8 && label((a.x + b.x) / 2, (a.y + b.y) / 2 - unit, `${OPENING_LABEL[openingVariant]} ${round(lengthFromMetres(w * drawMpp, units), 2)} ${lengthUnitLabel(units)}`)}
      </g>
    );
  }
  if ((mode === 'draw-line' || mode === 'draw-curve') && pathDraft.length > 0) {
    const pts = hover ? [...pathDraft, hover] : [...pathDraft];
    const closed = closePath && pts.length >= 3;
    const d = mode === 'draw-curve' ? smoothPathD(pts, closed) : polylinePathD(pts, closed);
    const last = pts[pts.length - 1]!;
    const prev = pts[pts.length - 2];
    let total = 0;
    for (let i = 1; i < pathDraft.length; i++) total += distancePx(pathDraft[i - 1]!, pathDraft[i]!);
    return (
      <g pointerEvents="none" data-testid="draw-draft">
        {pts.length > 1 && <path d={d} fill="none" stroke="var(--color-accent)" strokeWidth={st.width} strokeDasharray={`${unit * 0.6} ${unit * 0.4}`} />}
        {pathDraft.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={i === 0 && pathDraft.length >= 3 ? unit * 0.9 : unit * 0.45} fill={i === 0 && pathDraft.length >= 3 ? 'var(--color-surface)' : 'var(--color-accent)'} stroke="var(--color-accent)" strokeWidth={unit * 0.2} />
        ))}
        {prev && label(last.x, last.y - unit * 1.2, `${len(distancePx(prev, last))} · total ${len(total + (hover ? distancePx(pathDraft[pathDraft.length - 1]!, hover) : 0))}`)}
      </g>
    );
  }
  return null;
}

/** Resize / rotate / point handles for the selected shape. */
function ShapeHandles({
  shape,
  unit,
  drawMpp,
  onHandleDown,
}: {
  shape: LayoutShape;
  unit: number;
  drawMpp: number;
  onHandleDown: (e: PointerEvent<SVGElement>, shape: LayoutShape, handle: ShapeHandle) => void;
}) {
  const r = unit * 0.6;
  const hitR = unit * 1.3;
  const square = (p: Point, handle: ShapeHandle, key: string, label: string) => (
    <g key={key} onPointerDown={(e) => onHandleDown(e, shape, handle)} style={{ cursor: 'pointer' }} aria-label={label}>
      <circle cx={p.x} cy={p.y} r={hitR} fill="transparent" />
      <rect x={p.x - r} y={p.y - r} width={r * 2} height={r * 2} fill="var(--color-surface)" stroke="var(--color-accent)" strokeWidth={unit * 0.2} />
    </g>
  );
  const rotator = (centre: Point, handlePoint: Point) => (
    <g key="rot" onPointerDown={(e) => onHandleDown(e, shape, 'rotate')} style={{ cursor: 'grab' }} aria-label="Rotate">
      <line x1={centre.x} y1={centre.y} x2={handlePoint.x} y2={handlePoint.y} stroke="var(--color-accent)" strokeWidth={unit * 0.12} strokeDasharray={`${unit * 0.3} ${unit * 0.3}`} pointerEvents="none" />
      <circle cx={handlePoint.x} cy={handlePoint.y} r={hitR} fill="transparent" />
      <circle cx={handlePoint.x} cy={handlePoint.y} r={r * 1.1} fill="var(--color-accent)" stroke="var(--color-surface)" strokeWidth={unit * 0.2} />
    </g>
  );
  const b = shapeBounds(shape, drawMpp);
  const outline = (
    <rect
      key="sel"
      x={b.minX - unit * 0.6}
      y={b.minY - unit * 0.6}
      width={b.maxX - b.minX + unit * 1.2}
      height={b.maxY - b.minY + unit * 1.2}
      fill="none"
      stroke="var(--color-accent)"
      strokeWidth={unit * 0.12}
      strokeDasharray={`${unit * 0.5} ${unit * 0.4}`}
      pointerEvents="none"
    />
  );
  const parts: ReactNode[] = [outline];
  const c = shapeAnchor(shape);
  switch (shape.kind) {
    case 'rect': {
      rectCorners(shape).forEach((p, i) => parts.push(square(p, { corner: i as 0 | 1 | 2 | 3 }, `c${i}`, `Resize corner ${i + 1}`)));
      parts.push(rotator(c, localToPlan(c, shape.rotationDeg, { x: 0, y: -shape.height / 2 - unit * 3 })));
      break;
    }
    case 'polyline':
    case 'curve':
      shape.points.forEach((p, i) => parts.push(square(p, { vertex: i }, `v${i}`, `Move point ${i + 1}`)));
      break;
    case 'opening': {
      const w = shape.widthMetres / drawMpp;
      const [left, right] = openingGeometry(shape, w).gap;
      parts.push(square(left, { end: 0 }, 'e0', 'Move one end'), square(right, { end: 1 }, 'e1', 'Move the other end'));
      parts.push(rotator(c, localToPlan(c, shape.rotationDeg, { x: 0, y: (shape.flip ? -1 : 1) * (unit * 2.5) })));
      break;
    }
    case 'text':
      parts.push(rotator(c, localToPlan(c, shape.rotationDeg, { x: 0, y: -shape.sizePx - unit * 2 })));
      break;
  }
  return <g data-testid="shape-handles">{parts}</g>;
}
