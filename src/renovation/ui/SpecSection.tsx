/**
 * Renovation → Specification: the proposed finishes per room, chosen from the
 * library only (spec 1.5: "if the AI suggests a material, the engineer must
 * select it from the portal's library before it is priced").
 */

import { useState } from 'react';

import { AssumedFlag } from '../../ui/AssumedFlag.tsx';
import { Button, Card, EmptyState, TabPanel, Tabs } from '../../ui/primitives.tsx';
import { colourById, MATERIAL_CATEGORY_LABEL, type Library, type MaterialCategory } from '../library.ts';
import { PAINT_FINISHES, TILE_LAYOUT_LABEL, TILE_LAYOUTS, nextId, specFor, type PaintSpec, type RoomSpec, type TileSpec } from '../model.ts';
import { updateRoom, updateSpec } from '../rnState.ts';
import { Check, Num, Select, Text } from './kit.tsx';
import type { RnSectionProps } from './OverviewSections.tsx';
import { Swatch } from './StyleArt.tsx';

function materialOptions(lib: Library, cats: readonly MaterialCategory[], none?: string) {
  const opts = lib.materials.filter((m) => cats.includes(m.category)).map((m) => ({ value: m.id, label: `${m.name}${m.sample ? ' · sample' : ''}` }));
  return none ? [{ value: '', label: none }, ...opts] : opts;
}

function PaintEditor({ title, value, lib, onChange, defaultProduct }: { title: string; value: PaintSpec | null; lib: Library; onChange: (v: PaintSpec | null) => void; defaultProduct: string | null }) {
  const colour = colourById(lib, value?.colourId ?? null);
  return (
    <fieldset className="grid gap-2 rounded-control border border-[var(--color-border)] p-3">
      <legend className="px-1 text-sm font-semibold text-[var(--color-ink)]">{title}</legend>
      <Check
        label={`Paint the ${title.toLowerCase()}`}
        checked={value !== null}
        onChange={(on) => onChange(on && defaultProduct ? { productId: defaultProduct, colourId: lib.colours[0]?.id ?? null, finish: 'matt', coats: 2, primer: true, roughSurface: false } : null)}
      />
      {value && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Select label="Product" value={value.productId} options={materialOptions(lib, ['paint'])} onChange={(productId) => onChange({ ...value, productId })} />
          <div>
            <Select
              label="Colour"
              value={value.colourId ?? ''}
              options={[{ value: '', label: '— choose a colour —' }, ...lib.colours.map((c) => ({ value: c.id, label: `${c.code} ${c.name}` }))]}
              onChange={(v) => onChange({ ...value, colourId: v || null })}
            />
            {colour && (
              <p className="mt-1 flex items-center gap-2 text-xs text-[var(--color-ink-3)]">
                <Swatch hex={colour.hex} label={colour.code.replace(/^RAL /, '')} />
                {colour.manufacturer} {colour.collection} · screen approximation — check the physical sample
              </p>
            )}
          </div>
          <Select label="Finish" value={value.finish} options={PAINT_FINISHES.map((f) => ({ value: f, label: f }))} onChange={(finish) => onChange({ ...value, finish })} />
          <Num label="Finish coats" value={value.coats} min={1} max={5} step={1} onChange={(v) => v !== null && onChange({ ...value, coats: Math.round(v) })} help="2 on sound same-colour repaint; +1 going dark to light." />
          <Check label="1 coat primer / sealer" checked={value.primer} onChange={(primer) => onChange({ ...value, primer })} help="Default on new or repaired surfaces." />
          <Check label="Rough or porous surface (× 0.8 spreading rate)" checked={value.roughSurface} onChange={(roughSurface) => onChange({ ...value, roughSurface })} />
        </div>
      )}
    </fieldset>
  );
}

function TileEditor({ title, value, lib, onChange, wall }: { title: string; value: TileSpec | null; lib: Library; onChange: (v: TileSpec | null) => void; wall?: boolean }) {
  const firstTile = lib.materials.find((m) => m.category === 'tile')?.id ?? null;
  return (
    <fieldset className="grid gap-2 rounded-control border border-[var(--color-border)] p-3">
      <legend className="px-1 text-sm font-semibold text-[var(--color-ink)]">{title}</legend>
      <Check
        label={wall ? 'Tile the walls' : 'New floor tiles'}
        checked={value !== null}
        onChange={(on) =>
          onChange(
            on && firstTile
              ? {
                  materialId: firstTile,
                  layout: 'straight',
                  jointMm: wall ? 2 : 3,
                  adhesiveId: lib.materials.find((m) => m.category === 'adhesive')?.id ?? null,
                  groutId: lib.materials.find((m) => m.category === 'grout')?.id ?? null,
                  manyCutOuts: false,
                  heightM: wall ? 1.2 : null,
                }
              : null,
          )
        }
      />
      {value && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Select label="Tile" value={value.materialId} options={materialOptions(lib, ['tile'])} onChange={(materialId) => onChange({ ...value, materialId })} />
          <Select label="Layout" value={value.layout} options={TILE_LAYOUTS.map((l) => ({ value: l, label: TILE_LAYOUT_LABEL[l] }))} onChange={(layout) => onChange({ ...value, layout })} />
          <Num label="Joint width" unit="mm" value={value.jointMm} min={0.5} max={20} step={0.5} onChange={(v) => v !== null && onChange({ ...value, jointMm: v })} />
          {wall && <Num label="Tiled height from the floor" unit="m" value={value.heightM} min={0.1} max={12} onChange={(v) => v !== null && onChange({ ...value, heightM: v })} />}
          <Select label="Adhesive" value={value.adhesiveId ?? ''} options={materialOptions(lib, ['adhesive'], '— generic consumption —')} onChange={(v) => onChange({ ...value, adhesiveId: v || null })} />
          <Select label="Grout" value={value.groutId ?? ''} options={materialOptions(lib, ['grout'], '— generic density —')} onChange={(v) => onChange({ ...value, groutId: v || null })} />
          <Check label="Many cut-outs (+3% waste)" checked={value.manyCutOuts} onChange={(manyCutOuts) => onChange({ ...value, manyCutOuts })} />
        </div>
      )}
    </fieldset>
  );
}

export function SpecSection({ portal, onPortal }: RnSectionProps) {
  const line = portal.renovation!;
  const lib = line.library;
  const [active, setActive] = useState(portal.rooms[0]?.id ?? '');
  if (portal.rooms.length === 0)
    return (
      <EmptyState icon="edit" title="No rooms to specify">
        Add rooms in the Survey first.
      </EmptyState>
    );
  const roomId = portal.rooms.some((r) => r.id === active) ? active : portal.rooms[0]!.id;
  const room = portal.rooms.find((r) => r.id === roomId)!;
  const spec = specFor(line, roomId);
  const set = (patch: Partial<RoomSpec>) => {
    onPortal((p) => updateRoom(updateSpec(p, roomId, (s) => ({ ...s, ...patch })), roomId, (r) => r, ['spec']));
  };
  const paintDefault = lib.materials.find((m) => m.category === 'paint')?.id ?? null;
  const rateOptions = lib.rates.map((r) => ({ value: r.code, label: `${r.code} — ${r.description.slice(0, 60)} (${r.unit})` }));
  return (
    <div className="grid gap-4">
      <Tabs label="Rooms" idBase="spec-rooms" tabs={portal.rooms.map((r) => ({ id: r.id, label: r.name }))} active={roomId} onChange={setActive} wrap />
      <TabPanel idBase="spec-rooms" id={roomId}>
        {room.assumed.spec && <AssumedFlag reason={room.assumed.spec} fieldLabel={`${room.name} finishes`} onConfirm={() => onPortal((p) => updateRoom(p, roomId, (r) => r, ['spec']))} />}
        <div className="mt-3 grid gap-4 @4xl/section:grid-cols-2">
          <Card title="Walls">
            <div className="grid gap-3">
              <PaintEditor title="Walls" value={spec.wallPaint} lib={lib} defaultProduct={paintDefault} onChange={(wallPaint) => set({ wallPaint })} />
              <TileEditor title="Wall tiles" wall value={spec.wallTiles} lib={lib} onChange={(wallTiles) => set({ wallTiles })} />
              <Check label="Remove the existing wall tiles" checked={spec.removeWallTiles} onChange={(removeWallTiles) => set({ removeWallTiles })} />
            </div>
          </Card>
          <Card title="Floor">
            <div className="grid gap-3">
              <TileEditor title="Floor tiles" value={spec.floorTiles} lib={lib} onChange={(floorTiles) => set({ floorTiles })} />
              <Select label="Skirting" value={spec.skirtingId ?? ''} options={materialOptions(lib, ['skirting'], '— no new skirting —')} onChange={(v) => set({ skirtingId: v || null })} />
              <Check label="Remove the existing floor finish and bed" checked={spec.removeFloor} onChange={(removeFloor) => set({ removeFloor })} />
            </div>
          </Card>
          <Card title="Ceiling">
            <div className="grid gap-3">
              <Select label="Gypsum board ceiling" value={spec.gypsumBoardId ?? ''} options={materialOptions(lib, ['board'], '— keep the existing ceiling —')} onChange={(v) => set({ gypsumBoardId: v || null })} />
              <PaintEditor title="Ceiling" value={spec.ceilingPaint} lib={lib} defaultProduct={lib.materials.find((m) => m.id === 'mat-ceiling-white')?.id ?? paintDefault} onChange={(ceilingPaint) => set({ ceilingPaint })} />
              <Text label="Lighting (for the visual brief)" value={spec.lighting} max={300} onChange={(lighting) => set({ lighting })} placeholder="e.g. warm 3000 K LED cove along the ceiling edge, recessed downlights" />
            </div>
          </Card>
          <Card title="Other items" subtitle="Doors, downlights, repairs… The quantity is typed; the rate comes from the library.">
            <div className="grid gap-2">
              {spec.items.map((it, i) => (
                <div key={it.id} className="grid gap-2 rounded-control border border-[var(--color-border)] p-2 sm:grid-cols-[minmax(0,2fr)_6rem_auto] sm:items-end">
                  <Select label={`Item ${i + 1}: rate`} value={it.rateCode} options={rateOptions} onChange={(rateCode) => set({ items: spec.items.map((x) => (x.id === it.id ? { ...x, rateCode, description: '' } : x)) })} />
                  <Num label="Quantity" value={it.quantity} min={0} max={1e6} step={1} onChange={(v) => v !== null && set({ items: spec.items.map((x) => (x.id === it.id ? { ...x, quantity: v } : x)) })} />
                  <Button size="sm" variant="ghost" icon="trash" ariaLabel={`Remove item ${i + 1}`} onClick={() => set({ items: spec.items.filter((x) => x.id !== it.id) })} />
                  <div className="sm:col-span-3">
                    <Text label="Description (optional, else the rate’s)" value={it.description} max={200} onChange={(description) => set({ items: spec.items.map((x) => (x.id === it.id ? { ...x, description } : x)) })} />
                  </div>
                </div>
              ))}
              <Button size="sm" icon="plus" disabled={rateOptions.length === 0} onClick={() => set({ items: [...spec.items, { id: nextId('item', spec.items.map((x) => x.id)), rateCode: lib.rates.find((r) => r.trade === 'joinery')?.code ?? lib.rates[0]?.code ?? '', description: '', quantity: 1 }] })}>
                Add item
              </Button>
            </div>
          </Card>
          <Card title="Must stay as it is (this room)" subtitle="Goes into the visual brief’s PRESERVE list.">
            <Text label="One per line" multiline max={2000} value={spec.mustKeep.join('\n')} onChange={(v) => set({ mustKeep: v.split('\n').map((x) => x.slice(0, 200)).slice(0, 20) })} />
          </Card>
        </div>
        <p className="mt-3 text-xs text-[var(--color-ink-3)]">
          Only items in the library can be specified ({MATERIAL_CATEGORY_LABEL.paint.toLowerCase()}, tiles, adhesives, grouts, skirting, boards). Add a product in the Library first, with its source.
        </p>
      </TabPanel>
    </div>
  );
}
