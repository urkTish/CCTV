/**
 * Renovation → Survey (spec 4): rooms (from the intake, typed, or promoted from
 * the drawn plan), each with geometry, openings, surfaces and condition,
 * defects and photos; the survey details; and the mandatory safety checklist.
 * Every field is reachable without drawing (a form beside the plan, as the
 * site map does). Values assumed from the client's intake carry the
 * "assumed — please confirm" flag until confirmed or edited.
 */

import { useState } from 'react';

import type { SitePlan } from '../../domain/sitePlan.ts';
import { todayIso } from '../../client/intakeFile.ts';
import { AssumedFlag } from '../../ui/AssumedFlag.tsx';
import { readFileAsBytes } from '../../ui/fileIo.ts';
import { Icon } from '../../ui/icons.tsx';
import { Button, Card, EmptyState, Notice, StatusBadge } from '../../ui/primitives.tsx';
import { buttonClass } from '../../ui/uiStyles.ts';
import { roomGeometry } from '../geometry.ts';
import {
  CONDITION_LABEL,
  DEFECT_LABEL,
  DEFECT_TYPES,
  nextId,
  OPENING_TYPE_LABEL,
  OPENING_TYPES,
  ROOM_TYPE_LABEL,
  ROOM_TYPES,
  SAFETY_ITEMS,
  SUBSTRATES,
  SURFACE_KINDS,
  type Defect,
  type Opening,
  type Photo,
  type Room,
  type SafetyAnswer,
} from '../model.ts';
import { preparePhoto, PHOTO_ACCEPT } from '../photos.ts';
import { addRoom, drawnRooms, linkShape, promoteShape, removeRoom, sameAsPrevious, updateLine, updateRoom } from '../rnState.ts';
import { num } from '../trace.ts';
import { Check, FigureExplain, FigureValue, Num, Select, Text } from './kit.tsx';
import type { RnSectionProps } from './OverviewSections.tsx';

const FACINGS = ['From the door', 'From a corner', 'From the window', 'Close-up of a defect', 'Other'];

export function SurveySection({ portal, onPortal, derived, onNavigate, plan }: RnSectionProps & { plan: SitePlan }) {
  const [selected, setSelected] = useState<string | null>(portal.rooms[0]?.id ?? null);
  const [view, setView] = useState<'list' | 'detail'>('list');
  const line = portal.renovation!;
  const room = portal.rooms.find((r) => r.id === selected) ?? null;
  const drawn = drawnRooms(portal, plan);
  const surveyed = portal.rooms.filter((r) => r.surveyed).length;
  const defects = line.survey.defects;

  const open = (id: string) => {
    setSelected(id);
    setView('detail');
  };

  return (
    <div className="grid gap-4">
      <div className="grid items-start gap-4 @5xl/section:grid-cols-[16rem_minmax(0,1fr)]">
        <div className={`${view === 'list' ? '' : 'hidden'} grid min-w-0 gap-3 @5xl/section:sticky @5xl/section:top-16 @5xl/section:grid`}>
          <Card title={`Rooms (${portal.rooms.length})`} subtitle={`${surveyed} surveyed · ${defects.length} defect${defects.length === 1 ? '' : 's'}`} flush>
            {portal.rooms.length === 0 ? (
              <div className="p-3">
                <EmptyState icon="door" title="No rooms yet">
                  Add a room, or draw rooms on the Site map and create them below.
                </EmptyState>
              </div>
            ) : (
              <ul className="divide-y divide-[var(--color-border)]" aria-label="Rooms">
                {portal.rooms.map((r) => {
                  const n = Object.keys(r.assumed).length;
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => open(r.id)}
                        aria-current={r.id === selected ? 'true' : undefined}
                        className={`flex w-full items-center gap-2 px-3 py-2.5 text-start text-sm ${r.id === selected ? 'bg-[var(--color-accent-soft)]' : 'hover:bg-[var(--color-surface-2)]'}`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-[var(--color-ink)]">{r.name}</span>
                          <span className="block text-xs text-[var(--color-ink-3)]">
                            {ROOM_TYPE_LABEL[r.type]} · {r.lengthM && r.widthM ? `${num(r.lengthM)} × ${num(r.widthM)} m` : r.planShapeId ? 'from plan' : 'not measured'}
                          </span>
                        </span>
                        {n > 0 ? <StatusBadge kind="attention" compact>{n} assumed</StatusBadge> : r.surveyed ? <StatusBadge kind="complete" compact>Surveyed</StatusBadge> : <StatusBadge kind="in-progress" compact>Open</StatusBadge>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="border-t border-[var(--color-border)] p-3">
              <Button
                icon="plus"
                className="w-full"
                onClick={() => {
                  let id = '';
                  onPortal((p) => {
                    const r = addRoom(p);
                    id = r.roomId;
                    return r.portal;
                  });
                  window.setTimeout(() => id && open(id), 0);
                }}
              >
                Add room
              </Button>
            </div>
          </Card>
        </div>
        <div className={`${view === 'detail' ? '' : 'hidden'} min-w-0 @5xl/section:block`}>
          {room ? (
            <RoomDetail key={room.id} room={room} portal={portal} onPortal={onPortal} derived={derived} onNavigate={onNavigate} drawn={drawn} onBack={() => setView('list')} onRemoved={() => setSelected(portal.rooms.find((r) => r.id !== room.id)?.id ?? null)} />
          ) : (
            <EmptyState icon="door" title="Select a room">
              Pick a room from the list to survey it.
            </EmptyState>
          )}
        </div>
      </div>

      <Card title="Rooms on the drawn plan" subtitle="Each closed shape drawn on the Site map can become a room record; its area and perimeter then come from the drawing (typed dimensions override).">
        {drawn.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-3)]">
            Nothing drawn yet.{' '}
            <button type="button" className="font-semibold text-[var(--color-accent)] hover:underline" onClick={() => onNavigate('map')}>
              Draw the plan on the Site map
            </button>{' '}
            (rectangles or closed polygons).
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="stack-table w-full text-sm">
              <thead>
                <tr className="text-start text-xs text-[var(--color-ink-3)]">
                  <th className="px-2 py-1 text-start font-medium">Drawn shape</th>
                  <th className="px-2 py-1 text-end font-medium">Area</th>
                  <th className="px-2 py-1 text-end font-medium">Perimeter</th>
                  <th className="px-2 py-1 text-start font-medium">Room</th>
                </tr>
              </thead>
              <tbody>
                {drawn.map((d) => (
                  <tr key={d.shapeId} className="border-t border-[var(--color-border)]">
                    <td className="px-2 py-1.5" data-label="Drawn shape">
                      {d.label}
                    </td>
                    <td className="px-2 py-1.5 text-end font-mono" data-label="Area">
                      {num(d.areaM2)} m²
                    </td>
                    <td className="px-2 py-1.5 text-end font-mono" data-label="Perimeter">
                      {num(d.perimeterM)} m
                    </td>
                    <td className="px-2 py-1.5" data-label="Room">
                      <div className="flex flex-wrap items-center gap-2">
                        <Select
                          label={`Room for ${d.label}`}
                          hideLabel
                          value={d.roomId ?? ''}
                          options={[{ value: '', label: '— not linked —' }, ...portal.rooms.map((r) => ({ value: r.id, label: r.name }))]}
                          onChange={(rid) => onPortal((p) => (rid === '' ? { ...p, rooms: p.rooms.map((r) => (r.planShapeId === d.shapeId ? { ...r, planShapeId: null } : r)) } : linkShape(p, rid, d.shapeId)))}
                        />
                        {!d.roomId && (
                          <Button
                            size="sm"
                            icon="plus"
                            onClick={() => {
                              let id = '';
                              onPortal((p) => {
                                const r = promoteShape(p, d.shapeId, `Room ${p.rooms.length + 1}`);
                                id = r.roomId;
                                return r.portal;
                              });
                              window.setTimeout(() => id && open(id), 0);
                            }}
                          >
                            Create room
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!plan.calibration && drawn.length > 0 && !plan.layout?.canvas && <p className="mt-2 text-xs text-[var(--color-marginal)]">The plan has no scale yet; areas use the drawing’s assumed 20 px/m.</p>}
      </Card>

      <div className="grid gap-4 @4xl/section:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <Card title="Survey details">
          <div className="grid gap-3">
            <Text label="Survey date (YYYY-MM-DD)" value={line.survey.date ?? ''} max={10} onChange={(v) => onPortal((p) => updateLine(p, (l) => ({ ...l, survey: { ...l.survey, date: /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : l.survey.date && v === '' ? null : l.survey.date } })))} placeholder={todayIso()} />
            <Text label="Engineer" value={line.survey.engineer} max={120} onChange={(engineer) => onPortal((p) => updateLine(p, (l) => ({ ...l, survey: { ...l.survey, engineer } })))} />
            <Text label="Access and logistics" multiline max={600} value={line.survey.accessNotes} onChange={(accessNotes) => onPortal((p) => updateLine(p, (l) => ({ ...l, survey: { ...l.survey, accessNotes } })))} help="Lift, stairs, parking, where to store materials, water and power." />
          </div>
        </Card>
        <SafetyChecklist answers={line.survey.safety} onChange={(safety) => onPortal((p) => updateLine(p, (l) => ({ ...l, survey: { ...l.survey, safety } })))} />
      </div>
    </div>
  );
}

function SafetyChecklist({ answers, onChange }: { answers: readonly SafetyAnswer[]; onChange: (a: SafetyAnswer[]) => void }) {
  const get = (id: string) => answers.find((a) => a.itemId === id) ?? { itemId: id, answer: null, action: '', photoId: null };
  const set = (id: string, patch: Partial<SafetyAnswer>) => {
    const others = answers.filter((a) => a.itemId !== id);
    onChange([...others, { ...get(id), ...patch }].sort((a, b) => SAFETY_ITEMS.findIndex((s) => s.id === a.itemId) - SAFETY_ITEMS.findIndex((s) => s.id === b.itemId)));
  };
  const open = SAFETY_ITEMS.filter((s) => !get(s.id).answer).length;
  return (
    <Card title="Safety observations" subtitle={`Mandatory, even if “No”. ${open ? `${open} unanswered.` : 'All answered.'} A Yes on a marked item blocks Final until an action is recorded.`}>
      <ul className="grid gap-3" aria-label="Safety checklist">
        {SAFETY_ITEMS.map((s) => {
          const a = get(s.id);
          return (
            <li key={s.id} className={`rounded-control border p-2.5 ${a.answer === 'yes' ? (s.blocking && !a.action.trim() ? 'border-[var(--color-fail)] bg-[var(--color-fail-soft)]' : 'border-[var(--color-marginal)] bg-[var(--color-marginal-soft)]') : 'border-[var(--color-border)]'}`}>
              <fieldset>
                <legend className="text-sm text-[var(--color-ink)]">
                  {s.text}
                  {s.blocking && (
                    <span className="ms-1.5 inline-flex items-center gap-0.5 text-xs font-semibold text-[var(--color-fail)]">
                      <Icon name="alert" size={12} />
                      blocks Final if Yes
                    </span>
                  )}
                </legend>
                <div className="mt-1.5 flex flex-wrap gap-1" role="radiogroup">
                  {(['yes', 'no', 'na'] as const).map((v) => (
                    <label key={v} className={`cursor-pointer rounded-control border px-3 py-1 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--color-brand)] ${a.answer === v ? 'border-[var(--color-accent)] bg-[var(--color-accent)] font-semibold text-[var(--color-accent-ink)]' : 'border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-ink)]'}`}>
                      <input type="radio" className="sr-only" name={`safety-${s.id}`} checked={a.answer === v} onChange={() => set(s.id, { answer: v })} />
                      {v === 'yes' ? 'Yes' : v === 'no' ? 'No' : 'N/A'}
                    </label>
                  ))}
                </div>
                {a.answer === 'yes' && (
                  <div className="mt-2">
                    <Text label="Action recorded" value={a.action} max={400} onChange={(action) => set(s.id, { action })} placeholder="e.g. Isolated circuit; licensed electrician booked before works start" />
                  </div>
                )}
              </fieldset>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function RoomDetail({
  room,
  portal,
  onPortal,
  derived,
  drawn,
  onBack,
  onRemoved,
}: RnSectionProps & { room: Room; drawn: ReturnType<typeof drawnRooms>; onBack: () => void; onRemoved: () => void }) {
  const line = portal.renovation!;
  const set = (fn: (r: Room) => Room, confirm: readonly string[] = []) => onPortal((p) => updateRoom(p, room.id, fn, confirm));
  const confirm = (keys: string[]) => onPortal((p) => updateRoom(p, room.id, (r) => r, keys));
  const flag = (key: string, label: string) => (room.assumed[key] ? <AssumedFlag reason={room.assumed[key]!} fieldLabel={label} onConfirm={() => confirm(key === 'lengthM' || key === 'widthM' ? ['lengthM', 'widthM'] : [key])} /> : null);
  const g = roomGeometry(room, line.library, portal.site.propertyType, derived.planOf(room));
  const index = portal.rooms.findIndex((r) => r.id === room.id);
  const photos = portal.photos.filter((p) => p.roomId === room.id);
  const roomDefects = line.survey.defects.filter((d) => d.roomId === room.id);
  const [photoMsg, setPhotoMsg] = useState<string | null>(null);

  const setOpening = (id: string, patch: Partial<Opening>) => set((r) => ({ ...r, openings: r.openings.map((o) => (o.id === id ? { ...o, ...patch } : o)) }), ['openings']);
  const addOpening = (type: Opening['type']) =>
    set((r) => ({ ...r, openings: [...r.openings, { id: nextId('op', r.openings.map((o) => o.id)), type, widthM: type === 'window' ? 1.5 : type === 'double-door' ? 1.6 : 0.9, heightM: type === 'window' ? 1.5 : 2.1, sillM: type === 'window' ? 0.9 : 0, wall: '' }] }), ['openings']);

  const addPhotos = async (files: File[]) => {
    const added: Photo[] = [];
    const taken = new Set(portal.photos.map((p) => p.id));
    for (const f of files) {
      const r = await preparePhoto(f.name, await readFileAsBytes(f));
      if (!r.ok) {
        setPhotoMsg(r.reason);
        continue;
      }
      const id = nextId('photo', taken);
      taken.add(id);
      added.push({ id, roomId: room.id, purpose: 'before', facing: FACINGS[0]!, fileName: f.name.slice(0, 200), dataUri: r.photo.dataUri, widthPx: r.photo.widthPx, heightPx: r.photo.heightPx, addedOn: todayIso(), metadataStripped: true, note: '' });
    }
    if (added.length) {
      setPhotoMsg(`Added ${added.length} photo(s); location data removed.`);
      onPortal((p) => {
        const views = [...(p.renovation?.views ?? [])];
        for (const ph of added) views.push({ id: nextId('view', views.map((v) => v.id)), roomId: room.id, photoId: ph.id, facing: ph.facing, visibleSurfaces: ['walls', 'floor', 'ceiling'], timeOfDay: 'daytime', cameraNotes: 'phone photo, eye level' });
        return updateLine({ ...p, photos: [...p.photos, ...added] }, (l) => ({ ...l, views }));
      });
    }
  };

  const setDefect = (id: string, patch: Partial<Defect>) => onPortal((p) => updateLine(p, (l) => ({ ...l, survey: { ...l.survey, defects: l.survey.defects.map((d) => (d.id === id ? { ...d, ...patch } : d)) } })));

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" icon="arrow-left" onClick={onBack} className="@5xl/section:hidden">
          All rooms
        </Button>
        <h3 className="text-title font-semibold text-[var(--color-ink)]">{room.name}</h3>
        <span className="text-sm text-[var(--color-ink-3)]">
          Room {index + 1} of {portal.rooms.length}
        </span>
        <div className="ms-auto flex flex-wrap gap-2">
          {index > 0 && (
            <Button size="sm" icon="copy" onClick={() => onPortal((p) => sameAsPrevious(p, room.id))} title="Copy the height, surfaces and finishes from the previous room">
              Same as previous room
            </Button>
          )}
          <Button
            size="sm"
            variant="danger"
            icon="trash"
            onClick={() => {
              if (window.confirm(`Remove ${room.name}? Its specification, defects and views go too; its photos are kept, unassigned.`)) {
                onPortal((p) => removeRoom(p, room.id));
                onRemoved();
              }
            }}
          >
            Remove
          </Button>
        </div>
      </div>
      {room.clientNotes && (
        <Notice kind="info" title="The client said">
          <span dir="auto">{room.clientNotes}</span>
        </Notice>
      )}

      <Card title="Identity and geometry">
        <div className="grid gap-3 sm:grid-cols-2 @4xl/section:grid-cols-4">
          <Text label="Name" value={room.name} max={120} onChange={(name) => set((r) => ({ ...r, name }))} />
          <Select label="Type" value={room.type} options={ROOM_TYPES.map((t) => ({ value: t, label: ROOM_TYPE_LABEL[t] }))} onChange={(type) => set((r) => ({ ...r, type }))} />
          <Text label="Floor" value={room.floor} max={40} onChange={(floor) => set((r) => ({ ...r, floor }))} />
          <div className="self-end">
            <Check label="Occupied during the works" checked={room.occupiedDuringWorks} onChange={(occupiedDuringWorks) => set((r) => ({ ...r, occupiedDuringWorks }))} />
          </div>
          <Num label="Length" unit="m" value={room.lengthM} nullable min={0.3} max={200} onChange={(lengthM) => set((r) => ({ ...r, lengthM }), ['lengthM', 'widthM'])} flag={flag('lengthM', 'length and width')} />
          <Num label="Width" unit="m" value={room.widthM} nullable min={0.3} max={200} onChange={(widthM) => set((r) => ({ ...r, widthM }), ['lengthM', 'widthM'])} />
          <Num label="Clear height" unit="m" value={room.heightM} nullable min={1.8} max={12} onChange={(heightM) => set((r) => ({ ...r, heightM }), ['heightM'])} flag={flag('heightM', 'height')} />
          <Select
            label="Drawn shape on the plan"
            value={room.planShapeId ?? ''}
            options={[{ value: '', label: drawn.length ? '— none —' : '— nothing drawn —' }, ...drawn.map((d) => ({ value: d.shapeId, label: `${d.label}: ${num(d.areaM2)} m²` }))]}
            onChange={(v) => onPortal((p) => linkShape(p, room.id, v === '' ? null : v))}
            help={room.lengthM && room.widthM && room.planShapeId ? 'Typed L × W override the drawing.' : undefined}
          />
        </div>
        <div className="mt-4 border-t border-[var(--color-border)] pt-3">
          {g.ok ? (
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2 @4xl/section:grid-cols-4">
              {(
                [
                  ['Floor area A_f', g.geo.floorArea],
                  ['Perimeter P', g.geo.perimeter],
                  ['Net wall area A_w', g.geo.netWall],
                  ['Skirting length S', g.geo.skirting],
                  ['Height H', g.geo.height],
                  ['Gross wall A_wg', g.geo.grossWall],
                  ['Openings deducted A_o', g.geo.openingArea],
                  ['Ceiling A_c', g.geo.ceilingArea],
                ] as const
              ).map(([k, f]) => (
                <div key={k}>
                  <dt className="text-xs text-[var(--color-ink-3)]">{k}</dt>
                  <dd>
                    <FigureValue f={f} strong />
                    <FigureExplain f={f} label={k} />
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <Notice kind="error">{g.reason}</Notice>
          )}
          {g.ok && g.geo.source === 'plan' && <p className="mt-2 text-xs text-[var(--color-ink-3)]">Area and perimeter measured from the drawn plan.</p>}
        </div>
        <div className="mt-3">
          <Check label="Surveyed on site — dimensions, openings and surfaces checked" checked={room.surveyed} onChange={(surveyed) => set((r) => ({ ...r, surveyed }))} />
        </div>
      </Card>

      <Card title={`Openings (${room.openings.length})`} subtitle="Deducted from the wall area when 0.5 m² or more (measurement convention); doors and arches interrupt the skirting.">
        {room.assumed.openings && <div className="mb-3">{flag('openings', 'openings')}</div>}
        {room.openings.length > 0 && (
          <div className="overflow-x-auto">
            <table className="stack-table w-full text-sm">
              <thead>
                <tr className="text-xs text-[var(--color-ink-3)]">
                  <th className="px-1 py-1 text-start font-medium">Type</th>
                  <th className="px-1 py-1 text-start font-medium">Width (m)</th>
                  <th className="px-1 py-1 text-start font-medium">Height (m)</th>
                  <th className="px-1 py-1 text-start font-medium">Sill (m)</th>
                  <th className="px-1 py-1 text-start font-medium">Wall</th>
                  <th className="px-1 py-1" />
                </tr>
              </thead>
              <tbody>
                {room.openings.map((o, i) => (
                  <tr key={o.id} className="border-t border-[var(--color-border)]">
                    <td className="px-1 py-1" data-label="Type">
                      <Select label={`Opening ${i + 1} type`} hideLabel value={o.type} options={OPENING_TYPES.map((t) => ({ value: t, label: OPENING_TYPE_LABEL[t] }))} onChange={(type) => setOpening(o.id, { type })} />
                    </td>
                    <td className="px-1 py-1" data-label="Width (m)">
                      <Num label={`Opening ${i + 1} width`} hideLabel value={o.widthM} min={0.1} max={20} onChange={(v) => v !== null && setOpening(o.id, { widthM: v })} />
                    </td>
                    <td className="px-1 py-1" data-label="Height (m)">
                      <Num label={`Opening ${i + 1} height`} hideLabel value={o.heightM} min={0.1} max={10} onChange={(v) => v !== null && setOpening(o.id, { heightM: v })} />
                    </td>
                    <td className="px-1 py-1" data-label="Sill (m)">
                      <Num label={`Opening ${i + 1} sill`} hideLabel value={o.sillM} min={0} max={5} onChange={(v) => v !== null && setOpening(o.id, { sillM: v })} />
                    </td>
                    <td className="px-1 py-1" data-label="Wall">
                      <Text label={`Opening ${i + 1} wall`} hideLabel value={o.wall} max={60} onChange={(wall) => setOpening(o.id, { wall })} placeholder="e.g. north" />
                    </td>
                    <td className="px-1 py-1 text-end">
                      <Button size="sm" variant="ghost" icon="trash" ariaLabel={`Remove opening ${i + 1}`} onClick={() => set((r) => ({ ...r, openings: r.openings.filter((x) => x.id !== o.id) }), ['openings'])} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" icon="plus" onClick={() => addOpening('door')}>
            Door
          </Button>
          <Button size="sm" icon="plus" onClick={() => addOpening('window')}>
            Window
          </Button>
          <Button size="sm" icon="plus" onClick={() => addOpening('arch')}>
            Arch / opening
          </Button>
        </div>
      </Card>

      <Card title="Surfaces and condition" subtitle="Condition 5 Good · 4 Fair · 3 Worn · 2 Poor · 1 Failed / unsafe (spec 4.3).">
        <div className="grid gap-3">
          {SURFACE_KINDS.map((k) => {
            const s = room.surfaces[k];
            const setS = (patch: Partial<typeof s>) => set((r) => ({ ...r, surfaces: { ...r.surfaces, [k]: { ...r.surfaces[k], ...patch } } }));
            return (
              <fieldset key={k} className="grid gap-2 sm:grid-cols-2 @4xl/section:grid-cols-[6rem_repeat(4,minmax(0,1fr))] @4xl/section:items-end">
                <legend className="sr-only">{k}</legend>
                <span className="text-sm font-semibold text-[var(--color-ink)] capitalize @4xl/section:pb-2" aria-hidden="true">
                  {k}
                </span>
                <Select label={`${k}: substrate`} value={s.substrate} options={SUBSTRATES.map((v) => ({ value: v, label: v }))} onChange={(substrate) => setS({ substrate })} />
                <Text label={`${k}: current finish`} value={s.existingFinish} max={120} onChange={(existingFinish) => setS({ existingFinish })} placeholder="e.g. emulsion, ceramic tile" />
                <Text label={`${k}: current colour`} value={s.existingColour} max={120} onChange={(existingColour) => setS({ existingColour })} placeholder="code or description" />
                <Select
                  label={`${k}: condition`}
                  value={s.condition === null ? '' : String(s.condition)}
                  options={[{ value: '', label: '— not rated —' }, ...[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: CONDITION_LABEL[n] ?? String(n) }))]}
                  onChange={(v) => setS({ condition: v === '' ? null : Number(v) })}
                />
              </fieldset>
            );
          })}
        </div>
      </Card>

      <Card
        title={`Defects (${roomDefects.length})`}
        subtitle="With photos and sizes; recommended action and whether to fix now (spec 4.4)."
        actions={
          <Button
            size="sm"
            icon="plus"
            onClick={() =>
              onPortal((p) =>
                updateLine(p, (l) => ({
                  ...l,
                  survey: {
                    ...l.survey,
                    defects: [
                      ...l.survey.defects,
                      { id: nextId('defect', l.survey.defects.map((d) => d.id)), roomId: room.id, type: 'crack', surface: 'walls', location: '', widthMm: null, lengthM: null, moisturePct: null, severity: 3, probableCause: '', action: '', fixNow: true, specialist: '', photoIds: [] },
                    ],
                  },
                })),
              )
            }
          >
            Add defect
          </Button>
        }
      >
        {roomDefects.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-3)]">No defects recorded in this room.</p>
        ) : (
          <ul className="grid gap-3">
            {roomDefects.map((d, i) => (
              <li key={d.id} className="grid gap-2 rounded-control border border-[var(--color-border)] p-3 sm:grid-cols-2 @4xl/section:grid-cols-4">
                <Select label={`Defect ${i + 1}: type`} value={d.type} options={DEFECT_TYPES.map((t) => ({ value: t, label: DEFECT_LABEL[t] }))} onChange={(type) => setDefect(d.id, { type })} />
                <Select label="Surface" value={d.surface} options={SURFACE_KINDS.map((s) => ({ value: s, label: s }))} onChange={(surface) => setDefect(d.id, { surface })} />
                <Text label="Where" value={d.location} max={200} onChange={(location) => setDefect(d.id, { location })} placeholder="e.g. above the window" />
                <Select label="Severity" value={String(d.severity)} options={[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: CONDITION_LABEL[n] ?? String(n) }))} onChange={(v) => setDefect(d.id, { severity: Number(v) })} />
                <Num label="Width" unit="mm" nullable value={d.widthMm} min={0} max={500} onChange={(widthMm) => setDefect(d.id, { widthMm })} help={d.type === 'crack' && d.widthMm !== null ? crackBand(d.widthMm) : undefined} />
                <Num label="Length" unit="m" nullable value={d.lengthM} min={0} max={500} onChange={(lengthM) => setDefect(d.id, { lengthM })} />
                <Num label="Moisture" unit="%" nullable value={d.moisturePct} min={0} max={100} onChange={(moisturePct) => setDefect(d.id, { moisturePct })} />
                <Text label="Specialist needed" value={d.specialist} max={160} onChange={(specialist) => setDefect(d.id, { specialist })} placeholder="e.g. structural engineer" />
                <div className="sm:col-span-2">
                  <Text label="Probable cause" value={d.probableCause} max={300} onChange={(probableCause) => setDefect(d.id, { probableCause })} />
                </div>
                <div className="sm:col-span-2">
                  <Text label="Recommended action" value={d.action} max={400} onChange={(action) => setDefect(d.id, { action })} help="Shown to the client in the survey findings." />
                </div>
                <Check label="Fix now (else: can wait)" checked={d.fixNow} onChange={(fixNow) => setDefect(d.id, { fixNow })} />
                <Select
                  label="Photo"
                  value={d.photoIds[0] ?? ''}
                  options={[{ value: '', label: '— none —' }, ...photos.map((p, j) => ({ value: p.id, label: `Photo ${j + 1} (${p.facing || p.fileName})` }))]}
                  onChange={(v) => setDefect(d.id, { photoIds: v ? [v] : [] })}
                />
                <div className="flex items-end justify-end sm:col-span-2">
                  <Button size="sm" variant="ghost" icon="trash" onClick={() => onPortal((p) => updateLine(p, (l) => ({ ...l, survey: { ...l.survey, defects: l.survey.defects.filter((x) => x.id !== d.id) } })))}>
                    Remove defect
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={`Photos (${photos.length})`} subtitle="Tagged to this room. A before photo becomes a view for the visual brief pack. Location data is stripped on import.">
        {photos.length > 0 && (
          <ul className="mb-3 grid grid-cols-2 gap-3 @3xl/section:grid-cols-4">
            {photos.map((p, i) => (
              <li key={p.id} className="overflow-hidden rounded-control border border-[var(--color-border)]">
                <img src={p.dataUri} alt={`${room.name}, photo ${i + 1}`} className="aspect-[4/3] w-full object-cover" />
                <div className="grid gap-1 p-2">
                  <Select
                    label="Purpose"
                    value={p.purpose}
                    options={[
                      { value: 'before', label: 'Before (visual)' },
                      { value: 'survey', label: 'Survey' },
                      { value: 'defect', label: 'Defect' },
                    ]}
                    onChange={(purpose) => onPortal((x) => ({ ...x, photos: x.photos.map((ph) => (ph.id === p.id ? { ...ph, purpose } : ph)) }))}
                  />
                  <Select
                    label="Taken from"
                    value={FACINGS.includes(p.facing) ? p.facing : 'Other'}
                    options={FACINGS.map((f) => ({ value: f, label: f }))}
                    onChange={(facing) => onPortal((x) => ({ ...x, photos: x.photos.map((ph) => (ph.id === p.id ? { ...ph, facing } : ph)) }))}
                  />
                  <p className="text-2xs text-[var(--color-ink-3)]">
                    {p.widthPx} × {p.heightPx} px{p.metadataStripped ? ' · location data removed' : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <label className={`${buttonClass('secondary')} cursor-pointer focus-within:outline-2 focus-within:outline-[var(--color-brand)]`}>
          <Icon name="camera" size={16} />
          Add photos
          <input
            type="file"
            multiple
            accept={PHOTO_ACCEPT}
            className="sr-only"
            onChange={(e) => {
              const files = [...(e.currentTarget.files ?? [])];
              e.currentTarget.value = '';
              void addPhotos(files);
            }}
          />
        </label>
        {photoMsg && (
          <p role="status" className="mt-2 text-sm text-[var(--color-ink-2)]">
            {photoMsg}
          </p>
        )}
      </Card>

      <Card title="Notes">
        <Text label="Engineer’s notes for this room" multiline max={1000} value={room.notes} onChange={(notes) => set((r) => ({ ...r, notes }))} />
      </Card>
    </div>
  );
}

/** Crack width banding (spec 4.4; a common practical banding, Unverified). */
function crackBand(mm: number): string {
  const band = mm < 0.3 ? 'hairline (< 0.3 mm)' : mm <= 1 ? 'fine (0.3–1 mm)' : mm <= 5 ? 'medium (1–5 mm)' : 'wide (> 5 mm) — consider a structural engineer';
  return `${band} — banding Unverified`;
}
