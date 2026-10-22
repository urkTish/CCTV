/**
 * Renovation → Library (spec 6.1, 6.7, 5.2.5; owner decision Q5): materials,
 * colours with codes, unit rates and rule constants. Every entry shows its
 * source and an Unverified flag; seeded entries are marked Sample. Editing a
 * sample rate's price or source makes it the engineer's own entry. The
 * project file carries its own copy; "Save as my default" keeps this library
 * in this browser for new renovation projects.
 */

import { useState } from 'react';

import { todayIso } from '../../client/intakeFile.ts';
import { Button, Card, EstimateBadge, Notice, TabPanel, Tabs } from '../../ui/primitives.tsx';
import { MATERIAL_CATEGORIES, MATERIAL_CATEGORY_LABEL, rateExpired, sampleLibrary, UNITS, type ColourRef, type Library, type Material, type RateItem, type RuleConstant } from '../library.ts';
import { nextId, TRADE_LABEL, TRADES } from '../model.ts';
import { saveHouseLibrary, updateLine } from '../rnState.ts';
import { Check, Num, SampleBadge, Select, Text } from './kit.tsx';
import type { RnSectionProps } from './OverviewSections.tsx';
import { Swatch } from './StyleArt.tsx';

type Tab = 'rates' | 'materials' | 'colours' | 'rules';

export function LibrarySection({ portal, onPortal, derived }: RnSectionProps) {
  const [tab, setTab] = useState<Tab>('rates');
  const [msg, setMsg] = useState<string | null>(null);
  const lib = portal.renovation!.library;
  const today = todayIso();
  const setLib = (fn: (l: Library) => Library) => onPortal((p) => updateLine(p, (l) => ({ ...l, library: fn(l.library) })));
  const sampleCount = lib.rates.filter((r) => r.sample).length;
  return (
    <div className="grid gap-4">
      {sampleCount > 0 && (
        <Notice kind="warning" title={`${sampleCount} of ${lib.rates.length} rates are SAMPLE rates — sample, replace with your rates`}>
          They are placeholders so the portal can be tried end to end, not market prices. A proposal priced with any sample rate cannot be made Final.
          {derived.boq && derived.boq.sampleRateLines > 0 && ` This project uses them on ${derived.boq.sampleRateLines} BOQ line(s).`}
        </Notice>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          icon="download"
          onClick={() => {
            const err = saveHouseLibrary(lib);
            setMsg(err ?? 'Saved in this browser as the default library for new renovation projects.');
          }}
        >
          Save as my default for new projects
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            if (window.confirm('Replace this project’s library with the sample library? Your edits in this project are lost.')) setLib(() => sampleLibrary());
          }}
        >
          Reset to the sample library
        </Button>
        {msg && (
          <span role="status" className="text-sm text-[var(--color-ink-2)]">
            {msg}
          </span>
        )}
      </div>
      <Tabs
        label="Library"
        idBase="lib"
        tabs={[
          { id: 'rates', label: `Rates (${lib.rates.length})` },
          { id: 'materials', label: `Materials (${lib.materials.length})` },
          { id: 'colours', label: `Colours (${lib.colours.length})` },
          { id: 'rules', label: `Rule constants (${lib.rules.length})` },
        ]}
        active={tab}
        onChange={setTab}
      />
      <TabPanel idBase="lib" id={tab}>
        {tab === 'rates' && <Rates lib={lib} setLib={setLib} today={today} />}
        {tab === 'materials' && <Materials lib={lib} setLib={setLib} />}
        {tab === 'colours' && <Colours lib={lib} setLib={setLib} />}
        {tab === 'rules' && <Rules lib={lib} setLib={setLib} />}
      </TabPanel>
    </div>
  );
}

type SetLib = (fn: (l: Library) => Library) => void;

function Provenance({ e, onChange }: { e: { source: string; date: string | null; unverified: boolean; sample: boolean }; onChange: (patch: { source?: string; date?: string | null; unverified?: boolean; sample?: boolean }) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_8rem_auto] sm:items-end">
      <Text label="Source" value={e.source} max={300} onChange={(source) => onChange({ source, sample: false, unverified: source.trim() === '' ? true : e.unverified })} placeholder="supplier quote ref, past project, TDS link…" />
      <Text label="Date" value={e.date ?? ''} max={10} onChange={(v) => onChange({ date: /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : v === '' ? null : e.date })} placeholder="YYYY-MM-DD" />
      <div className="flex flex-wrap items-center gap-2 pb-1">
        <Check label="Unverified" checked={e.unverified} onChange={(unverified) => onChange({ unverified })} />
        {e.sample && <SampleBadge />}
      </div>
    </div>
  );
}

function Rates({ lib, setLib, today }: { lib: Library; setLib: SetLib; today: string }) {
  const set = (code: string, patch: Partial<RateItem>) => setLib((l) => ({ ...l, rates: l.rates.map((r) => (r.code === code ? { ...r, ...patch } : r)) }));
  return (
    <Card title="Unit rates" subtitle="All-in rate per unit (materials, labour, plant, overheads and profit). Nothing is priced without one; an empty rate leaves the BOQ incomplete." flush>
      <ul className="divide-y divide-[var(--color-border)]">
        {lib.rates.map((r) => (
          <li key={r.code} className="grid gap-2 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-semibold text-[var(--color-ink)]">{r.code}</span>
              <span className="text-xs text-[var(--color-ink-3)]">{TRADE_LABEL[r.trade]}</span>
              {r.sample && <SampleBadge />}
              {(r.unverified || !r.source.trim()) && <EstimateBadge title="No supplier or project reference: Unverified." />}
              {rateExpired(r, today) && <span className="text-xs font-semibold text-[var(--color-marginal)]">Rate may be out of date</span>}
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,3fr)_minmax(0,1.4fr)_6rem_8rem_8rem] sm:items-end">
              <Text label={`${r.code}: description`} value={r.description} max={240} onChange={(description) => set(r.code, { description })} />
              <Select label="BOQ section" value={r.trade} options={TRADES.map((t) => ({ value: t, label: TRADE_LABEL[t] }))} onChange={(trade) => set(r.code, { trade })} />
              <Select label="Unit" value={r.unit} options={UNITS.map((u) => ({ value: u, label: u }))} onChange={(unit) => set(r.code, { unit })} />
              <Num label="Rate" unit="per unit" nullable value={r.rate} min={0} max={1e8} onChange={(rate) => set(r.code, { rate, sample: false, date: today })} />
              <Num label="Valid for" unit="days" value={r.validityDays} min={1} max={3650} step={1} onChange={(v) => v !== null && set(r.code, { validityDays: Math.round(v) })} />
            </div>
            <Provenance e={r} onChange={(patch) => set(r.code, patch)} />
          </li>
        ))}
      </ul>
      <AddRate lib={lib} setLib={setLib} />
    </Card>
  );
}

function AddRate({ lib, setLib }: { lib: Library; setLib: SetLib }) {
  const [code, setCode] = useState('');
  const taken = lib.rates.some((r) => r.code === code.trim());
  return (
    <div className="flex flex-wrap items-end gap-2 border-t border-[var(--color-border)] px-4 py-3">
      <div className="w-48">
        <Text label="New rate code" value={code} max={40} onChange={setCode} placeholder="e.g. RN-WAL-PAPER" />
      </div>
      <Button
        icon="plus"
        disabled={!code.trim() || taken}
        onClick={() => {
          setLib((l) => ({ ...l, rates: [...l.rates, { code: code.trim(), description: '', unit: 'm²', trade: 'fixtures', rate: null, validityDays: 90, source: '', date: null, unverified: true, sample: false }] }));
          setCode('');
        }}
      >
        Add rate
      </Button>
      {taken && <span className="text-xs text-[var(--color-fail)]">That code is already in the library.</span>}
    </div>
  );
}

function Materials({ lib, setLib }: { lib: Library; setLib: SetLib }) {
  const set = (id: string, patch: Partial<Material>) => setLib((l) => ({ ...l, materials: l.materials.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
  const [cat, setCat] = useState<Material['category']>('paint');
  return (
    <Card title="Materials" subtitle="Product data from the manufacturer’s technical data sheet (TDS) overrides the generic rules." flush>
      <ul className="divide-y divide-[var(--color-border)]">
        {lib.materials.map((m) => (
          <li key={m.id} className="grid gap-2 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold tracking-wide text-[var(--color-ink-3)] uppercase">{MATERIAL_CATEGORY_LABEL[m.category]}</span>
              {m.sample && <SampleBadge />}
              {m.unverified && <EstimateBadge />}
              <Button size="sm" variant="ghost" icon="trash" className="ms-auto" ariaLabel={`Remove ${m.name}`} onClick={() => setLib((l) => ({ ...l, materials: l.materials.filter((x) => x.id !== m.id) }))} />
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)_minmax(0,1fr)]">
              <Text label="Name" value={m.name} max={160} onChange={(name) => set(m.id, { name })} />
              <Text label="Manufacturer / range" value={m.manufacturer} max={120} onChange={(manufacturer) => set(m.id, { manufacturer })} />
              <Text label="Finish" value={m.finish} max={80} onChange={(finish) => set(m.id, { finish })} />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(m.category === 'paint' || m.category === 'primer') && (
                <>
                  <Num label="Spreading rate" unit="m²/L per coat" nullable value={m.spreadingM2PerL} min={0.5} max={40} onChange={(spreadingM2PerL) => set(m.id, { spreadingM2PerL })} />
                  <Text label="Pack sizes (L, comma-separated)" value={m.packSizesL.join(', ')} max={60} onChange={(v) => set(m.id, { packSizesL: v.split(/[,\s]+/).map(Number).filter((n) => Number.isFinite(n) && n > 0 && n <= 1000).slice(0, 6) })} />
                </>
              )}
              {m.category === 'tile' && (
                <>
                  <Num label="Length" unit="mm" nullable value={m.tileLengthMm} min={10} max={4000} step={1} onChange={(tileLengthMm) => set(m.id, { tileLengthMm })} />
                  <Num label="Width" unit="mm" nullable value={m.tileWidthMm} min={10} max={4000} step={1} onChange={(tileWidthMm) => set(m.id, { tileWidthMm })} />
                  <Num label="Thickness" unit="mm" nullable value={m.tileThicknessMm} min={2} max={60} step={0.5} onChange={(tileThicknessMm) => set(m.id, { tileThicknessMm })} />
                  <Num label="Tiles per box" nullable value={m.tilesPerBox} min={1} max={500} step={1} onChange={(v) => set(m.id, { tilesPerBox: v === null ? null : Math.round(v) })} />
                </>
              )}
              {m.category === 'adhesive' && (
                <>
                  <Num label="Consumption" unit="kg/m²" nullable value={m.consumptionKgPerM2} min={0.1} max={50} onChange={(consumptionKgPerM2) => set(m.id, { consumptionKgPerM2 })} />
                  <Num label="Bag" unit="kg" nullable value={m.bagKg} min={0.5} max={100} onChange={(bagKg) => set(m.id, { bagKg })} />
                </>
              )}
              {m.category === 'grout' && (
                <>
                  <Num label="Density ρ" unit="kg/dm³" nullable value={m.densityKgPerDm3} min={0.5} max={5} onChange={(densityKgPerDm3) => set(m.id, { densityKgPerDm3 })} />
                  <Num label="Bag" unit="kg" nullable value={m.bagKg} min={0.5} max={100} onChange={(bagKg) => set(m.id, { bagKg })} />
                </>
              )}
              {m.category === 'board' && (
                <>
                  <Num label="Sheet length" unit="m" nullable value={m.boardLengthM} min={0.3} max={6} onChange={(boardLengthM) => set(m.id, { boardLengthM })} />
                  <Num label="Sheet width" unit="m" nullable value={m.boardWidthM} min={0.3} max={3} onChange={(boardWidthM) => set(m.id, { boardWidthM })} />
                </>
              )}
              {m.category === 'skirting' && <Num label="Piece length" unit="m" nullable value={m.pieceLengthM} min={0.1} max={6} onChange={(pieceLengthM) => set(m.id, { pieceLengthM })} />}
            </div>
            <Text label="TDS link" value={m.tdsUrl} max={500} onChange={(tdsUrl) => set(m.id, { tdsUrl })} />
            <Provenance e={m} onChange={(patch) => set(m.id, patch)} />
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-end gap-2 border-t border-[var(--color-border)] px-4 py-3">
        <div className="w-48">
          <Select label="New material category" value={cat} options={MATERIAL_CATEGORIES.map((c) => ({ value: c, label: MATERIAL_CATEGORY_LABEL[c] }))} onChange={setCat} />
        </div>
        <Button
          icon="plus"
          onClick={() =>
            setLib((l) => ({
              ...l,
              materials: [
                ...l.materials,
                {
                  id: nextId('mat', l.materials.map((m) => m.id)),
                  category: cat,
                  name: `New ${MATERIAL_CATEGORY_LABEL[cat].toLowerCase()}`,
                  manufacturer: '',
                  finish: '',
                  spreadingM2PerL: null,
                  packSizesL: [],
                  tileLengthMm: null,
                  tileWidthMm: null,
                  tileThicknessMm: null,
                  tilesPerBox: null,
                  consumptionKgPerM2: null,
                  densityKgPerDm3: null,
                  bagKg: null,
                  boardLengthM: null,
                  boardWidthM: null,
                  pieceLengthM: null,
                  tdsUrl: '',
                  source: '',
                  date: null,
                  unverified: true,
                  sample: false,
                },
              ],
            }))
          }
        >
          Add material
        </Button>
      </div>
    </Card>
  );
}

function Colours({ lib, setLib }: { lib: Library; setLib: SetLib }) {
  const set = (id: string, patch: Partial<ColourRef>) => setLib((l) => ({ ...l, colours: l.colours.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  return (
    <Card title="Colours" subtitle="Codes are never invented: each colour is the manufacturer’s published code (or a public standard such as RAL), with an approximate screen hex — check the physical sample." flush>
      <ul className="divide-y divide-[var(--color-border)]">
        {lib.colours.map((c) => (
          <li key={c.id} className="grid gap-2 px-4 py-3">
            <div className="grid gap-2 sm:grid-cols-[3rem_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_6rem_auto] sm:items-end">
              <Swatch hex={c.hex} />
              <Text label="Code" value={c.code} max={60} onChange={(code) => set(c.id, { code })} />
              <Text label="Name" value={c.name} max={120} onChange={(name) => set(c.id, { name })} />
              <Text label="Manufacturer" value={c.manufacturer} max={120} onChange={(manufacturer) => set(c.id, { manufacturer })} />
              <Text label="Hex (approx.)" value={c.hex} max={7} onChange={(hex) => /^#[0-9a-fA-F]{6}$/.test(hex) && set(c.id, { hex })} />
              <Num label="LRV" nullable value={c.lrv} min={0} max={100} onChange={(lrv) => set(c.id, { lrv })} />
              <Button size="sm" variant="ghost" icon="trash" ariaLabel={`Remove ${c.code}`} onClick={() => setLib((l) => ({ ...l, colours: l.colours.filter((x) => x.id !== c.id) }))} />
            </div>
            <Provenance e={c} onChange={(patch) => set(c.id, patch)} />
          </li>
        ))}
      </ul>
      <div className="border-t border-[var(--color-border)] px-4 py-3">
        <Button
          icon="plus"
          onClick={() =>
            setLib((l) => ({
              ...l,
              colours: [...l.colours, { id: nextId('col', l.colours.map((c) => c.id)), manufacturer: '', collection: '', name: '', code: '', hex: '#cccccc', lrv: null, source: '', date: null, unverified: true, sample: false }],
            }))
          }
        >
          Add colour
        </Button>
      </div>
    </Card>
  );
}

function Rules({ lib, setLib }: { lib: Library; setLib: SetLib }) {
  const set = (key: string, patch: Partial<RuleConstant>) => setLib((l) => ({ ...l, rules: l.rules.map((r) => (r.key === key ? { ...r, ...patch } : r)) }));
  return (
    <Card title="Rule constants" subtitle="Rules of thumb used when a product’s own data is missing (spec Appendix B). All Unverified unless a source says otherwise." flush>
      <ul className="divide-y divide-[var(--color-border)]">
        {lib.rules.map((r) => (
          <li key={r.key} className="grid gap-2 px-4 py-2.5 sm:grid-cols-[minmax(0,2fr)_7rem_minmax(0,2fr)_auto] sm:items-end">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--color-ink)]">{r.label}</p>
              <p className="font-mono text-2xs text-[var(--color-ink-3)]">{r.key}</p>
            </div>
            <Num label={r.label} hideLabel unit={r.unit} value={r.value} min={0} max={1e6} onChange={(v) => v !== null && set(r.key, { value: v })} />
            <Text label={`${r.label}: source`} hideLabel value={r.source} max={300} onChange={(source) => set(r.key, { source })} />
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--color-ink-3)]">{r.unit}</span>
              <Check label="Unverified" checked={r.unverified} onChange={(unverified) => set(r.key, { unverified })} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
