/**
 * Site map editor (M1–M4): upload a plan, calibrate its scale, place cameras,
 * the NVR and switches, draw cable routes — and a table that does all of it
 * from the keyboard.
 *
 * Every edit is a pure function from `domain/sitePlanEdit.ts`; everything drawn
 * comes from `engine/siteMapView.ts`. This component only renders and forwards
 * pointer and keyboard input.
 */

import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

import { checkPlanFile, planImageFromBytes, PLAN_UPLOAD_ACCEPT } from '../domain/planImage.ts';
import { SitePlanError, type Point, type SitePlan } from '../domain/sitePlan.ts';
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
import { Button, Card, EstimateBadge } from './primitives.tsx';

type Mode = 'select' | 'calibrate' | 'place-camera' | 'place-nvr' | 'place-switch' | 'route';

const MODE_LABEL: Readonly<Record<Mode, string>> = {
  select: 'Select / move',
  calibrate: 'Calibrate',
  'place-camera': 'Place camera',
  'place-nvr': 'Place NVR / rack',
  'place-switch': 'Place switch',
  route: 'Draw route',
};

const MODE_HINT: Readonly<Record<Mode, string>> = {
  select: 'Drag a device to move it. Focus a device and use the arrow keys to nudge it; [ and ] rotate a camera.',
  calibrate: 'Click the two ends of a dimension you know, then enter its real length below.',
  'place-camera': 'Click the plan where the chosen camera goes.',
  'place-nvr': 'Click the plan where the NVR / rack is.',
  'place-switch': 'Click the plan where the switch / IDF is.',
  route: 'Click along walls and ceilings to add bends, then press Finish route.',
};

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
}: {
  project: Project;
  units: UnitSystemState;
  results: ReadonlyMap<string, RecommendationResult>;
  onPlanChange: (next: SitePlan) => void;
}) {
  const plan = project.sitePlan;
  const view = useMemo(() => siteMapView(project, results), [project, results]);
  const u = lengthUnitLabel(units);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [mode, setMode] = useState<Mode>('select');
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
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
  const unplacedKey = (l: string, i: number) => `${l}#${i}`;
  const chosenUnplaced = view.unplaced.find((c) => unplacedKey(c.locationId, c.index) === cameraToPlace) ?? view.unplaced[0] ?? null;
  const cameraViews = view.devices.filter((d) => d.device.kind === 'camera');

  /** Apply an edit; a refused edit becomes an on-screen message, never a crash. */
  const edit = (f: (p: SitePlan) => SitePlan) => {
    try {
      onPlanChange(f(plan));
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
        break;
    }
  };

  const onDeviceDown = (e: PointerEvent<SVGGElement>, id: string) => {
    if (mode !== 'select') return;
    e.stopPropagation();
    setSelected(id);
    setDragId(id);
    svgRef.current?.setPointerCapture?.(e.pointerId);
  };

  const onCanvasMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!dragId) return;
    const p = toImage(e);
    if (p) edit((pl) => moveDevice(pl, dragId, { x: Math.round(p.x), y: Math.round(p.y) }));
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
    } else if (m) {
      e.preventDefault();
      edit((pl) => moveDevice(pl, d.device.id, { x: Math.round(d.device.x + m.x), y: Math.round(d.device.y + m.y) }));
    } else if (d.device.kind === 'camera' && (e.key === '[' || e.key === ']')) {
      e.preventDefault();
      const rot = d.device.rotationDeg + (e.key === ']' ? 15 : -15);
      edit((pl) => rotateCamera(pl, d.device.id, rot));
    }
  };

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

  return (
    <Card
      title="Site map"
      subtitle="Upload a floor or site plan, set its scale, place the cameras, NVR and switches, and draw the cable routes. Cable lengths, switch grouping and the bill of materials use what is placed here."
    >
      {/* --- upload ------------------------------------------------------------ */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="plan-upload" className="block text-sm font-medium text-[var(--color-ink)]">
            Plan image (PNG or JPG)
          </label>
          <input
            id="plan-upload"
            type="file"
            accept={PLAN_UPLOAD_ACCEPT}
            className="mt-1 text-sm text-[var(--color-ink-2)]"
            onChange={(e) => {
              void onUpload(e.currentTarget.files?.[0]);
              e.currentTarget.value = '';
            }}
          />
          <p className="mt-1 text-xs text-[var(--color-ink-3)]">PDF is not supported — export the page as PNG or JPG first.</p>
        </div>
        {plan.image && (
          <Button variant="ghost" onClick={() => edit(removeImage)}>
            Remove image
          </Button>
        )}
      </div>

      {message && (
        <p
          role={message.kind === 'error' ? 'alert' : 'status'}
          className="mt-3 rounded-control border-l-4 px-3 py-2 text-sm"
          style={{
            borderColor: message.kind === 'error' ? 'var(--color-fail)' : 'var(--color-accent)',
            background: message.kind === 'error' ? 'var(--color-fail-soft)' : 'var(--color-accent-soft)',
            color: message.kind === 'error' ? 'var(--color-fail)' : 'var(--color-ink)',
          }}
        >
          {message.text}
        </p>
      )}

      {/* --- scale ------------------------------------------------------------- */}
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
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

      {/* --- tools ------------------------------------------------------------- */}
      <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Map tool">
        {(['select', 'place-camera', 'place-nvr', 'place-switch', 'route'] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => {
              setMode(m);
              setRouteDraft([]);
            }}
            className={`rounded-control border px-3 py-1.5 text-sm ${
              mode === m
                ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] font-medium text-[var(--color-accent)]'
                : 'border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-ink-2)]'
            }`}
          >
            {MODE_LABEL[m]}
          </button>
        ))}
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
      <p className="mt-1 text-xs text-[var(--color-ink-3)]">{MODE_HINT[mode]}</p>

      {/* --- canvas ------------------------------------------------------------ */}
      <div className="mt-3 overflow-hidden rounded-control border border-[var(--color-border)]">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${widthPx} ${heightPx}`}
          preserveAspectRatio="none"
          style={{ width: '100%', height: 'auto', aspectRatio: `${widthPx} / ${heightPx}`, touchAction: 'none', display: 'block' }}
          role="group"
          aria-label={`Site plan, ${view.devices.length} device(s) placed. The table below lists every device and can edit it without a pointer.`}
          onPointerDown={onCanvasDown}
          onPointerMove={onCanvasMove}
          onPointerUp={() => setDragId(null)}
          onPointerCancel={() => setDragId(null)}
        >
          {plan.image ? (
            <image href={plan.image.dataUri} x={0} y={0} width={widthPx} height={heightPx} />
          ) : (
            <>
              <rect x={0} y={0} width={widthPx} height={heightPx} fill="var(--color-surface-2)" />
              <text x={widthPx / 2} y={heightPx / 2} textAnchor="middle" fontSize={unit * 2} fill="var(--color-ink-3)">
                No plan image — devices can still be placed and run lengths typed in the table
              </text>
            </>
          )}

          {view.devices.map((d) =>
            d.cone.length > 2 ? (
              <polygon
                key={`cone-${d.device.id}`}
                points={d.cone.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="var(--color-accent)"
                fillOpacity={0.15}
                stroke="var(--color-accent)"
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
                  stroke={l.kind === 'drawn' ? 'var(--color-ink)' : 'var(--color-estimate)'}
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

          {plan.calibration && (
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
        </svg>
      </div>

      {view.warnings.map((w) => (
        <p key={w} className="mt-2 text-xs text-[var(--color-marginal)]">
          {w}
        </p>
      ))}

      {/* --- M4: keyboard / list alternative ---------------------------------- */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button onClick={() => edit((p) => placeNvr(p, canvasCentre(p)))}>Add NVR / rack</Button>
        <Button onClick={() => edit((p) => placeSwitch(p, canvasCentre(p)))}>Add switch</Button>
        {view.unplaced.length > 0 && <span className="text-sm text-[var(--color-ink-3)]">Not yet placed:</span>}
        {view.unplaced.map((c) => (
          <Button key={unplacedKey(c.locationId, c.index)} variant="ghost" onClick={() => edit((p) => placeCamera(p, c.locationId, c.index, canvasCentre(p)))}>
            Place {c.label}
          </Button>
        ))}
      </div>

      {view.devices.length > 0 && (
        <div className="mt-3 overflow-x-auto">
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
  const setNumber = (f: (v: number) => (p: SitePlan) => SitePlan) => (e: { currentTarget: HTMLInputElement }) => {
    const v = num(e.currentTarget.value);
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
        <input type="number" aria-label={`x of ${d.label} (px)`} className={inputClass} value={Math.round(dev.x)} onChange={setNumber((v) => (p) => moveDevice(p, dev.id, { x: v, y: dev.y }))} />
      </td>
      <td className="py-1.5 pr-2">
        <input type="number" aria-label={`y of ${d.label} (px)`} className={inputClass} value={Math.round(dev.y)} onChange={setNumber((v) => (p) => moveDevice(p, dev.id, { x: dev.x, y: v }))} />
      </td>
      <td className="py-1.5 pr-2">
        {dev.kind === 'camera' ? (
          <input type="number" step={15} aria-label={`Facing of ${d.label} (degrees clockwise from up)`} className={inputClass} value={Math.round(dev.rotationDeg)} onChange={setNumber((v) => (p) => rotateCamera(p, dev.id, v))} />
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
          <input
            type="number"
            min={0}
            aria-label={`Typed run length for ${d.label}`}
            placeholder="from plan"
            className={inputClass}
            value={dev.runMetresOverride === null ? '' : round(lengthFromMetres(dev.runMetresOverride, units), 1)}
            onChange={(e) => {
              const v = num(e.currentTarget.value);
              if (e.currentTarget.value.trim() === '') edit((p) => setRunOverride(p, dev.id, null));
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
