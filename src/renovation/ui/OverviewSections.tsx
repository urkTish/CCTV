/**
 * Renovation → Overview and → Client & intake.
 */

import { useState, type ReactNode } from 'react';

import type { ProjectExtras } from '../../state/workspace.ts';
import { CLIENT_RENOVATION_HASH } from '../../ui/route.ts';
import { Button, Card, Notice, StatusBadge } from '../../ui/primitives.tsx';
import { buttonClass } from '../../ui/uiStyles.ts';
import { sectionLabel, type RnDerived, type RnSectionId } from '../derive.ts';
import { money, moneyRound } from '../format.ts';
import { paletteHexes } from '../library.ts';
import {
  BUDGET_LABEL,
  BUDGET_TIERS,
  BUILDING_AGE_LABEL,
  BUILDING_AGES,
  MOOD_LABEL,
  MOODS,
  OCCUPANCY,
  OCCUPANCY_LABEL,
  PALETTE_LABEL,
  PALETTES,
  PROPERTY_LABEL,
  PROPERTY_TYPES,
  STYLE_LABEL,
  STYLES,
  type PortalData,
  type StyleProfile,
} from '../model.ts';
import { removeLine, updateLine, type PortalUpdate } from '../rnState.ts';
import { num } from '../trace.ts';
import { Check, RnWarningList, Select, Text, Tile } from './kit.tsx';
import { PaintChips } from './StyleArt.tsx';

export interface RnSectionProps {
  readonly portal: PortalData;
  readonly onPortal: PortalUpdate;
  readonly derived: RnDerived;
  readonly onNavigate: (id: RnSectionId | 'settings') => void;
}

export function RnOverview({
  portal,
  derived,
  onNavigate,
  extras,
  onExtras,
  projectName,
  onProjectName,
  projectFile,
}: RnSectionProps & { extras: ProjectExtras; onExtras: (e: ProjectExtras) => void; projectName: string; onProjectName: (n: string) => void; projectFile: ReactNode }) {
  const line = portal.renovation!;
  const area = (derived.quantities?.rooms ?? []).reduce((s, r) => s + (r.geometry?.floorArea.value ?? 0), 0);
  const boq = derived.boq;
  const cur = line.settings.currency;
  const assumed = portal.rooms.reduce((n, r) => n + Object.keys(r.assumed).length, 0);
  const approved = line.assets.filter((a) => a.approvedOn && a.selected).length;
  return (
    <div className="grid gap-4">
      {line.intakeAnswers && (
        <Notice
          kind={assumed > 0 ? 'warning' : 'success'}
          title={assumed > 0 ? `Draft from a client intake — ${assumed} assumed value${assumed === 1 ? '' : 's'} to confirm` : 'Draft from a client intake — every assumed value confirmed'}
          actions={
            assumed > 0 ? (
              <Button size="sm" onClick={() => onNavigate('rn-survey')}>
                Review in the Survey
              </Button>
            ) : undefined
          }
        >
          <p>
            {portal.rooms.length} room{portal.rooms.length === 1 ? '' : 's'} and {portal.photos.length} photo{portal.photos.length === 1 ? '' : 's'} from the client
            {line.intakeSubmittedOn ? `, sent ${line.intakeSubmittedOn}` : ''}. Quantities and prices are preliminary until the survey confirms the dimensions; until then the client sees a price range only.
          </p>
        </Notice>
      )}
      <section aria-labelledby="rn-totals">
        <h3 id="rn-totals" className="mb-2 text-sm font-semibold tracking-wide text-[var(--color-ink-3)] uppercase">
          Totals
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 @5xl/section:grid-cols-5">
          <Tile label="Rooms" value={String(portal.rooms.length)} note={`${num(area, 1)} m² of floor`} onClick={() => onNavigate('rn-survey')} />
          <Tile
            label={derived.firm ? 'Total incl. VAT' : 'Estimate (range)'}
            value={boq && boq.lines.length ? (derived.firm ? moneyRound(boq.total, cur) : `${moneyRound(derived.range?.low ?? 0, '')}–${moneyRound(derived.range?.high ?? 0, cur)}`) : '—'}
            note={boq && boq.lines.length ? (derived.firm ? `${boq.lines.length} BOQ lines` : `subject to survey · estimate ${money(boq.total, cur)}`) : 'nothing priced yet'}
            onClick={() => onNavigate('rn-boq')}
          />
          <Tile label="Programme" value={derived.programme?.totalDays ? `${num(derived.programme.totalDays, 1)} days` : '—'} note="working days, one crew per trade" onClick={() => onNavigate('rn-boq')} />
          <Tile label="Visuals" value={`${approved} / ${line.views.length}`} note="views with an approved after image" onClick={() => onNavigate('rn-visuals')} />
          <Tile label="Proposal" value={line.proposal.status === 'final' ? 'Final' : 'Draft'} note={`${derived.finalBlockers.length} item${derived.finalBlockers.length === 1 ? '' : 's'} before Final`} onClick={() => onNavigate('rn-proposal')} />
        </div>
      </section>
      <div className="grid gap-4 @4xl/section:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card title={`Open items (${derived.warnings.length})`} subtitle="Everything that needs attention, each linked to where it is fixed.">
          <RnWarningList warnings={derived.warnings} onGo={(w) => onNavigate(w.section)} labelOf={sectionLabel} empty="Every room is surveyed, specified and priced from your own rates." />
        </Card>
        <div className="grid content-start gap-4">
          <Card title="Project">
            <div className="grid gap-3">
              <Text label="Project name" value={projectName} max={120} onChange={onProjectName} />
              <Text label="Client" value={extras.clientName} max={160} onChange={(clientName) => onExtras({ ...extras, clientName })} />
            </div>
          </Card>
          <Card title="Project file" subtitle="Save the whole project — CCTV and renovation, photos and visuals included — or open one.">
            {projectFile}
          </Card>
          <ClientLinkCard />
        </div>
      </div>
    </div>
  );
}

function ClientLinkCard() {
  const [copied, setCopied] = useState<string | null>(null);
  const base = `${window.location.origin}${window.location.pathname}`;
  return (
    <Card title="Client questionnaire" subtitle="The phone-first renovation questionnaire, in English or Arabic. The client sends back a file you open with Open project.">
      <p className="font-mono text-xs break-all text-[var(--color-ink-2)]">{`${base}${CLIENT_RENOVATION_HASH}`}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {(['en', 'ar'] as const).map((l) => (
          <Button
            key={l}
            icon="link"
            onClick={() =>
              void navigator.clipboard
                .writeText(`${base}${CLIENT_RENOVATION_HASH}${l === 'ar' ? '?lang=ar' : ''}`)
                .then(() => setCopied(`Link copied (${l === 'ar' ? 'Arabic' : 'English'}) — send it to the client.`))
                .catch((err: unknown) => setCopied(`Could not copy (${err instanceof Error ? err.message : 'unknown error'}); copy it from above.`))
            }
          >
            {l === 'ar' ? 'Copy Arabic link' : 'Copy English link'}
          </Button>
        ))}
        <a href={CLIENT_RENOVATION_HASH} className={buttonClass('ghost')}>
          Preview
        </a>
      </div>
      {copied && (
        <p role="status" className="mt-2 text-sm text-[var(--color-ink-2)]">
          {copied}
        </p>
      )}
    </Card>
  );
}

export function RnClientSection({ portal, onPortal, extras, onExtras, onRemoveLine }: RnSectionProps & { extras: ProjectExtras; onExtras: (e: ProjectExtras) => void; onRemoveLine: () => void }) {
  const line = portal.renovation!;
  const s = line.style;
  const setStyle = (patch: Partial<StyleProfile>) => onPortal((p) => updateLine(p, (l) => ({ ...l, style: { ...l.style, ...patch } })));
  const setSite = (patch: Partial<PortalData['site']>) => onPortal((p) => ({ ...p, site: { ...p.site, ...patch } }));
  const setClient = (patch: Partial<PortalData['client']>) => onPortal((p) => ({ ...p, client: { ...p.client, ...patch } }));
  const a = line.intakeAnswers;
  return (
    <div className="grid gap-4 @4xl/section:grid-cols-2">
      <Card title="Client">
        <div className="grid gap-3 sm:grid-cols-2">
          <Text label="Name" value={extras.clientName} max={160} onChange={(clientName) => onExtras({ ...extras, clientName })} />
          <Text label="Phone" value={portal.client.phone} max={60} onChange={(phone) => setClient({ phone })} />
          <Text label="Email" value={portal.client.email} max={160} onChange={(email) => setClient({ email })} />
          <Select label="Language" value={portal.client.language} options={[{ value: 'en', label: 'English' }, { value: 'ar', label: 'Arabic' }]} onChange={(language) => setClient({ language })} />
        </div>
        <div className="mt-4 grid gap-2 rounded-control border border-[var(--color-border)] p-3">
          <p className="text-sm font-semibold text-[var(--color-ink)]">Consent (spec 13, owner decision Q13)</p>
          <Check
            label="Photos may be used to prepare the proposal and its illustrative visuals"
            checked={portal.client.consent.photoUse}
            onChange={(photoUse) => setClient({ consent: { ...portal.client.consent, photoUse } })}
            help={portal.client.consent.recordedOn ? `Recorded from the client's intake on ${portal.client.consent.recordedOn}.` : 'Record the client’s answer.'}
          />
          <Check
            label="Before / after images may be used in marketing (separate consent, address removed)"
            checked={portal.client.consent.marketing}
            onChange={(marketing) => setClient({ consent: { ...portal.client.consent, marketing } })}
            help="Off unless the client agreed separately."
          />
          {!portal.client.consent.photoUse && portal.photos.length > 0 && (
            <Notice kind="warning">The client’s photo consent is not recorded, but the project holds {portal.photos.length} photo(s). Do not run the brief pack until it is.</Notice>
          )}
        </div>
      </Card>
      <Card title="Site">
        <div className="grid gap-3 sm:grid-cols-2">
          <Text label="Site name" value={portal.site.name} max={160} onChange={(name) => setSite({ name })} />
          <Text label="City" value={portal.site.city} max={120} onChange={(city) => setSite({ city })} />
          <div className="sm:col-span-2">
            <Text label="Address" value={portal.site.address} max={300} onChange={(address) => setSite({ address })} />
          </div>
          <Select label="Property type" value={portal.site.propertyType} options={PROPERTY_TYPES.map((v) => ({ value: v, label: PROPERTY_LABEL[v] }))} onChange={(propertyType) => setSite({ propertyType })} help="Sets the default ceiling height (apartment 2.8 m, villa 3.2 m)." />
          <Select label="Building age" value={portal.site.buildingAge} options={BUILDING_AGES.map((v) => ({ value: v, label: BUILDING_AGE_LABEL[v] }))} onChange={(buildingAge) => setSite({ buildingAge })} />
          <Select label="Occupancy" value={portal.site.occupancy} options={OCCUPANCY.map((v) => ({ value: v, label: OCCUPANCY_LABEL[v] }))} onChange={(occupancy) => setSite({ occupancy })} />
          <Text label="Times we can’t work" value={portal.site.workingRestrictions} max={400} onChange={(workingRestrictions) => setSite({ workingRestrictions })} />
        </div>
      </Card>
      <Card title="Style profile" subtitle="From the client’s style quiz; feeds the visual briefs (spec 5.2.2).">
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="Primary style" value={s.primaryStyle ?? ''} options={[{ value: '', label: '— not chosen —' }, ...STYLES.map((v) => ({ value: v, label: STYLE_LABEL[v] }))]} onChange={(v) => setStyle({ primaryStyle: v === '' ? null : v })} />
          <Select label="Secondary style (30%)" value={s.secondaryStyle ?? ''} options={[{ value: '', label: '— none —' }, ...STYLES.map((v) => ({ value: v, label: STYLE_LABEL[v] }))]} onChange={(v) => setStyle({ secondaryStyle: v === '' ? null : v })} />
          <div className="sm:col-span-2">
            <Select label="Palette card" value={s.palette ?? ''} options={[{ value: '', label: '— not chosen —' }, ...PALETTES.map((v) => ({ value: v, label: PALETTE_LABEL[v] }))]} onChange={(v) => setStyle({ palette: v === '' ? null : v })} />
            {s.palette && (
              <div className="mt-2 max-w-xs">
                <PaintChips chips={paletteHexes(s.palette).map((hex) => ({ hex }))} size="sm" />
              </div>
            )}
          </div>
          <fieldset className="sm:col-span-2">
            <legend className="text-xs font-medium text-[var(--color-ink-2)]">Mood (up to 3)</legend>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              {MOODS.map((m) => (
                <Check key={m} label={MOOD_LABEL[m]} checked={s.moods.includes(m)} onChange={(on) => setStyle({ moods: on ? [...s.moods, m].slice(-3) : s.moods.filter((x) => x !== m) })} />
              ))}
            </div>
          </fieldset>
          <Select label="Lighting mood" value={s.lightingMood} options={[{ value: 'warm', label: 'Warm 2700–3000 K' }, { value: 'neutral', label: 'Neutral 3500–4000 K' }, { value: 'mixed', label: 'Mixed scenes' }]} onChange={(lightingMood) => setStyle({ lightingMood })} />
          <Select label="Furniture in visuals" value={s.furniture} options={[{ value: 'keep', label: 'Keep existing' }, { value: 'suggest', label: 'Suggest new — for illustration, not included' }, { value: 'unfurnished', label: 'Unfurnished' }]} onChange={(furniture) => setStyle({ furniture })} />
          <Select label="Budget tier" value={s.budgetTier ?? ''} options={[{ value: '', label: '— not stated —' }, ...BUDGET_TIERS.map((v) => ({ value: v, label: BUDGET_LABEL[v] }))]} onChange={(v) => setStyle({ budgetTier: v === '' ? null : v })} />
          <Text label="Likes" value={s.likes} max={800} onChange={(likes) => setStyle({ likes })} />
          <Text label="Dislikes" value={s.dislikes} max={800} onChange={(dislikes) => setStyle({ dislikes })} />
          <div className="sm:col-span-2">
            <Text
              label="Must stay as it is, everywhere (one per line)"
              multiline
              max={2000}
              value={s.globalMustKeep.join('\n')}
              onChange={(v) => setStyle({ globalMustKeep: v.split('\n').map((x) => x.slice(0, 200)).slice(0, 20) })}
            />
          </div>
        </div>
      </Card>
      <Card title="What the client asked for" subtitle={a ? `From the intake${line.intakeSubmittedOn ? ` sent ${line.intakeSubmittedOn}` : ''}.` : 'No intake: this renovation was started in Admin.'}>
        {a ? (
          <dl className="grid gap-2 text-sm">
            <Row k="Works">{a.works.join(', ') || '—'}</Row>
            <Row k="Rooms">{a.rooms.map((r) => r.name).join(', ')}</Row>
            <Row k="Budget">{a.budget.tier ? BUDGET_LABEL[a.budget.tier] : '—'}{a.budget.min !== null || a.budget.max !== null ? ` · range ${a.budget.min ?? '?'}–${a.budget.max ?? '?'}` : ''}</Row>
            <Row k="Start">{a.timing.start ?? '—'}{a.timing.finishBy ? ` · finish by ${a.timing.finishBy}` : ''}</Row>
            <Row k="In their words">{s.clientWords.length ? s.clientWords.map((w) => `“${w}”`).join(' ') : '—'}</Row>
            <Row k="Language">{a.lang === 'ar' ? 'Arabic' : 'English'}</Row>
          </dl>
        ) : (
          <p className="text-sm text-[var(--color-ink-3)]">Send the client the questionnaire link from the Overview.</p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] pt-3">
          <StatusBadge kind="in-progress">Lines: {portal.lines.join(' + ')}</StatusBadge>
          {portal.lines.length > 1 && (
            <Button
              variant="danger"
              size="sm"
              icon="trash"
              onClick={() => {
                if (window.confirm('Remove the renovation line from this project? Its rooms and photos stay; its specification, library copy and visuals are removed.')) {
                  onPortal((p) => removeLine(p, 'renovation'));
                  onRemoveLine();
                }
              }}
            >
              Remove renovation line
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

function Row({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-2">
      <dt className="text-[var(--color-ink-3)]">{k}</dt>
      <dd className="text-[var(--color-ink)]" dir="auto">
        {children}
      </dd>
    </div>
  );
}
