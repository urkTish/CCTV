/**
 * Renovation → Visuals (spec 5; owner decision Q2: manual mode). The portal
 * assembles the brief pack (prompts + before photos + swatch sheet) as one ZIP
 * or as copy-able prompts; the engineer runs Claude and the image tool outside;
 * the "after" images are imported, paired with their before photo by file name,
 * labelled Illustrative (burned in), QA-checked (T8), approved and selected.
 * Every visual keeps its provenance. Nothing is uploaded anywhere.
 */

import { useState } from 'react';

import { todayIso } from '../../client/intakeFile.ts';
import { readFileAsBytes } from '../../ui/fileIo.ts';
import { Icon } from '../../ui/icons.tsx';
import { Button, Card, EmptyState, Notice, StatusBadge } from '../../ui/primitives.tsx';
import { buttonClass } from '../../ui/uiStyles.ts';
import { buildBriefPack, FURNITURE_CAPTION, moodBoardPrompt, narrativePrompt, paletteInUse, qaPrompt, schedulePrompt, swatchSheetSvg, TEMPLATES, viewBriefPrompt, viewFromFileName } from '../briefs.ts';
import { downloadBytes } from '../download.ts';
import { nextId, QA_CHECKS, ROOM_TYPE_LABEL, SURFACE_KINDS, type VisualAsset, type VisualView } from '../model.ts';
import { burnLabel, ILLUSTRATIVE_LABEL, photoFromBytes, PHOTO_ACCEPT } from '../photos.ts';
import { updateLine } from '../rnState.ts';
import { buildZip } from '../zip.ts';
import { Check, Num, Select, Text } from './kit.tsx';
import type { RnSectionProps } from './OverviewSections.tsx';

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <Button
        size="sm"
        icon="copy"
        onClick={() =>
          void navigator.clipboard
            .writeText(text)
            .then(() => setDone('Copied'))
            .catch(() => setDone('Copy failed — use the pack'))
        }
      >
        {label}
      </Button>
      {done && (
        <span role="status" className="text-xs text-[var(--color-ink-3)]">
          {done}
        </span>
      )}
    </span>
  );
}

interface Pending {
  readonly id: string;
  readonly fileName: string;
  readonly dataUri: string;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly guess: string;
}

export function VisualsSection({ portal, onPortal, projectName, engineerName }: RnSectionProps & { projectName: string; engineerName: string }) {
  const line = portal.renovation!;
  const [msg, setMsg] = useState<{ kind: 'info' | 'error' | 'success'; text: string } | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [provider, setProvider] = useState('');
  const [modelName, setModelName] = useState('');
  const today = todayIso();
  const consent = portal.client.consent.photoUse;
  const viewIds = line.views.map((v) => v.id);
  const lang = line.settings.proposalLanguage;

  const exportPack = () => {
    try {
      const { entries, manifest } = buildBriefPack(portal, projectName, today);
      const bytes = buildZip(entries, new Date());
      const name = `brief-pack-${projectName.replace(/[^\w-]+/g, '-').slice(0, 40)}-${today}.zip`;
      const err = downloadBytes(name, bytes, 'application/zip');
      setMsg(err ? { kind: 'error', text: err } : { kind: 'success', text: `Exported ${name}: ${entries.length} files, ${manifest.views.length} photo view(s), ${manifest.planBriefs.length} plan-based brief(s).` });
    } catch (e) {
      setMsg({ kind: 'error', text: e instanceof Error ? e.message : 'The pack could not be built.' });
    }
  };

  const addAsset = async (viewId: string, file: { fileName: string; dataUri: string; widthPx: number; heightPx: number }, variant: number) => {
    const view = line.views.find((v) => v.id === viewId);
    if (!view) return;
    const burned = await burnLabel(file.dataUri, ILLUSTRATIVE_LABEL[lang]).catch(() => null);
    const asset: VisualAsset = {
      id: nextId('visual', line.assets.map((a) => a.id)),
      viewId,
      fileName: file.fileName.slice(0, 200),
      dataUri: burned?.dataUri ?? file.dataUri,
      widthPx: burned?.widthPx ?? file.widthPx,
      heightPx: burned?.heightPx ?? file.heightPx,
      labelBurned: burned !== null,
      variant,
      provider: provider.trim(),
      modelName: modelName.trim(),
      templateId: TEMPLATES.T2.id,
      templateVersion: TEMPLATES.T2.version,
      promptText: viewBriefPrompt(portal, view).slice(0, 20000),
      inputPhotoIds: [view.photoId],
      importedOn: today,
      qa: [null, null, null, null, null, null, null, null],
      qaNotes: '',
      recommend: null,
      overrideReason: '',
      approvedBy: '',
      approvedOn: null,
      selected: false,
    };
    onPortal((p) =>
      updateLine(p, (l) => {
        const id = nextId('visual', l.assets.map((a) => a.id));
        return { ...l, assets: [...l.assets, { ...asset, id }] };
      }),
    );
    return asset.labelBurned;
  };

  const importFiles = async (files: File[]) => {
    let paired = 0;
    let unlabelled = 0;
    const unmatched: Pending[] = [];
    for (const f of files) {
      const r = photoFromBytes(f.name, await readFileAsBytes(f));
      if (!r.ok) {
        setMsg({ kind: 'error', text: r.reason });
        continue;
      }
      const m = viewFromFileName(f.name, viewIds);
      if (m) {
        const ok = await addAsset(m.viewId, { fileName: f.name, ...r.photo }, m.variant);
        paired += 1;
        if (ok === false) unlabelled += 1;
      } else unmatched.push({ id: `${f.name}-${unmatched.length}`, fileName: f.name, ...r.photo, guess: viewIds[0] ?? '' });
    }
    setPending((p) => [...p, ...unmatched]);
    setMsg({
      kind: unlabelled ? 'error' : 'success',
      text: `${paired} image(s) paired with their before photo by file name${unmatched.length ? `; ${unmatched.length} need a view chosen below` : ''}.${unlabelled ? ` ${unlabelled} could not be labelled in this browser and will not appear in the proposal.` : ' Each was labelled “Illustrative”.'}`,
    });
  };

  const setAsset = (id: string, patch: Partial<VisualAsset>) => onPortal((p) => updateLine(p, (l) => ({ ...l, assets: l.assets.map((a) => (a.id === id ? { ...a, ...patch } : a)) })));
  const setView = (id: string, patch: Partial<VisualView>) => onPortal((p) => updateLine(p, (l) => ({ ...l, views: l.views.map((v) => (v.id === id ? { ...v, ...patch } : v)) })));
  const beforeWithoutView = portal.photos.filter((ph) => ph.purpose === 'before' && ph.roomId && !line.views.some((v) => v.photoId === ph.id));
  const palette = paletteInUse(portal);
  const swatchUri = palette.length ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(swatchSheetSvg(palette, 'Colour schedule'))}` : null;

  return (
    <div className="grid gap-4">
      {!consent && portal.photos.length > 0 && (
        <Notice kind="error" title="No photo consent recorded">
          The client’s consent to use their photos is not recorded (Client & intake). The brief pack carries their photos, so it cannot be exported until it is.
        </Notice>
      )}
      <div className="grid gap-4 @4xl/section:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card title="1. Brief pack" subtitle="Prompts (T0–T5, T8) and the before photos, as one ZIP. Run them in Claude and your image tool, outside the portal.">
          <dl className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <dt className="text-xs text-[var(--color-ink-3)]">Photo views</dt>
              <dd className="font-mono text-lg font-semibold text-[var(--color-ink)]">{line.views.length}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--color-ink-3)]">Rooms without a photo</dt>
              <dd className="font-mono text-lg font-semibold text-[var(--color-ink)]">{portal.rooms.filter((r) => !line.views.some((v) => v.roomId === r.id)).length}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--color-ink-3)]">Templates</dt>
              <dd className="font-mono text-xs text-[var(--color-ink)]">{Object.values(TEMPLATES).map((t) => `${t.id} ${t.version}`).join(', ')}</dd>
            </div>
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="primary" icon="download" onClick={exportPack} disabled={!consent && portal.photos.length > 0}>
              Export brief pack (.zip)
            </Button>
            <CopyButton text={narrativePrompt(portal)} label="Copy narrative prompt" />
            <CopyButton text={moodBoardPrompt(portal)} label="Copy mood-board prompt" />
            <CopyButton text={schedulePrompt(portal)} label="Copy schedule check" />
          </div>
          {msg && (
            <div className="mt-3">
              <Notice kind={msg.kind === 'error' ? 'error' : msg.kind === 'success' ? 'success' : 'info'} role="status">
                {msg.text}
              </Notice>
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--color-ink-3)]">
            <span>Free design rounds: {line.settings.freeDesignRounds} (Settings). Used so far:</span>
            <span className="w-20">
              <Num label="Design rounds used" hideLabel value={line.designRoundsUsed} min={0} max={50} step={1} onChange={(v) => v !== null && onPortal((p) => updateLine(p, (l) => ({ ...l, designRoundsUsed: Math.round(v) })))} />
            </span>
          </div>
        </Card>
        <Card title="Colour swatches" subtitle="Drawn by the portal from the library’s hex values — never AI-painted. Exported as swatches.svg.">
          {swatchUri ? <img src={swatchUri} alt={`Swatch sheet: ${palette.map((c) => `${c.code} ${c.name}`).join(', ')}`} className="w-full rounded-control border border-[var(--color-border)]" /> : <p className="text-sm text-[var(--color-ink-3)]">No colours specified yet.</p>}
        </Card>
      </div>

      <Card title="2. Import the after images" subtitle="Name each file after its view, e.g. view-1-v1.jpg, and it pairs with its before photo automatically. The portal burns the Illustrative label into each one.">
        <div className="grid gap-3 sm:grid-cols-2 @4xl/section:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] @4xl/section:items-end">
          <Text label="Image tool / provider" value={provider} max={120} onChange={setProvider} placeholder="as used for these images" />
          <Text label="Model name and version" value={modelName} max={120} onChange={setModelName} />
          <label className={`${buttonClass('primary')} cursor-pointer focus-within:outline-2 focus-within:outline-[var(--color-brand)]`}>
            <Icon name="upload" size={16} />
            Import after images
            <input
              type="file"
              multiple
              accept={PHOTO_ACCEPT}
              className="sr-only"
              onChange={(e) => {
                const files = [...(e.currentTarget.files ?? [])];
                e.currentTarget.value = '';
                void importFiles(files);
              }}
            />
          </label>
        </div>
        {pending.length > 0 && (
          <ul className="mt-3 grid gap-2" aria-label="Images to pair">
            {pending.map((p) => (
              <li key={p.id} className="flex flex-wrap items-end gap-2 rounded-control border border-[var(--color-marginal)] p-2">
                <img src={p.dataUri} alt={p.fileName} className="h-14 w-20 rounded-control object-cover" />
                <span className="min-w-0 flex-1 text-sm text-[var(--color-ink)]">{p.fileName}</span>
                <div className="w-56">
                  <Select
                    label={`View for ${p.fileName}`}
                    value={p.guess}
                    options={line.views.map((v) => ({ value: v.id, label: `${v.id} — ${portal.rooms.find((r) => r.id === v.roomId)?.name ?? ''}` }))}
                    onChange={(guess) => setPending((x) => x.map((y) => (y.id === p.id ? { ...y, guess } : y)))}
                  />
                </div>
                <Button
                  size="sm"
                  disabled={!p.guess}
                  onClick={() => {
                    void addAsset(p.guess, p, 1);
                    setPending((x) => x.filter((y) => y.id !== p.id));
                  }}
                >
                  Pair
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setPending((x) => x.filter((y) => y.id !== p.id))}>
                  Discard
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {beforeWithoutView.length > 0 && (
        <Notice
          kind="info"
          actions={
            <Button
              size="sm"
              onClick={() =>
                onPortal((p) =>
                  updateLine(p, (l) => {
                    const views = [...l.views];
                    for (const ph of beforeWithoutView) views.push({ id: nextId('view', views.map((v) => v.id)), roomId: ph.roomId!, photoId: ph.id, facing: ph.facing, visibleSurfaces: ['walls', 'floor', 'ceiling'], timeOfDay: 'daytime', cameraNotes: 'phone photo, eye level' });
                    return { ...l, views };
                  }),
                )
              }
            >
              Create views
            </Button>
          }
        >
          {beforeWithoutView.length} before photo(s) have no view yet.
        </Notice>
      )}

      <h3 className="text-title font-semibold text-[var(--color-ink)]">3. Views — pair, check, approve</h3>
      {line.views.length === 0 ? (
        <EmptyState icon="camera" title="No photo views yet">
          Views come from the client’s room photos, or from before photos added in the Survey.
        </EmptyState>
      ) : (
        line.views.map((v) => {
          const room = portal.rooms.find((r) => r.id === v.roomId);
          const photo = portal.photos.find((p) => p.id === v.photoId);
          const assets = line.assets.filter((a) => a.viewId === v.id);
          return (
            <Card key={v.id} title={`${v.id} · ${room?.name ?? 'Unknown room'}`} subtitle={room ? `${ROOM_TYPE_LABEL[room.type]} · ${v.facing || 'facing not recorded'}` : undefined}>
              <div className="grid gap-4 @4xl/section:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
                <div className="grid content-start gap-2">
                  {photo && (
                    <figure>
                      <img src={photo.dataUri} alt={`Before: ${room?.name ?? ''}, ${v.facing}`} className="w-full rounded-control border border-[var(--color-border)]" />
                      <figcaption className="mt-1 text-xs text-[var(--color-ink-3)]">Before — untouched client photo</figcaption>
                    </figure>
                  )}
                  <Text label="Camera position (facing)" value={v.facing} max={200} onChange={(facing) => setView(v.id, { facing })} />
                  <fieldset>
                    <legend className="text-xs font-medium text-[var(--color-ink-2)]">Visible in this photo</legend>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                      {SURFACE_KINDS.map((s) => (
                        <Check key={s} label={s} checked={v.visibleSurfaces.includes(s)} onChange={(on) => setView(v.id, { visibleSurfaces: on ? [...v.visibleSurfaces, s] : v.visibleSurfaces.filter((x) => x !== s) })} />
                      ))}
                    </div>
                  </fieldset>
                  <Select label="Time of day" value={v.timeOfDay} options={[{ value: 'daytime', label: 'Daytime' }, { value: 'evening', label: 'Evening, lights on' }]} onChange={(timeOfDay) => setView(v.id, { timeOfDay })} />
                  <div className="flex flex-wrap gap-2">
                    <CopyButton text={viewBriefPrompt(portal, v)} label="Copy image brief (T2)" />
                    <CopyButton text={qaPrompt(portal, v)} label="Copy QA prompt (T8)" />
                  </div>
                </div>
                <div className="grid content-start gap-3">
                  {assets.length === 0 ? (
                    <p className="rounded-control border border-dashed border-[var(--color-border-strong)] p-4 text-sm text-[var(--color-ink-3)]">No after image yet. Import {v.id}-v1.jpg.</p>
                  ) : (
                    assets.map((a) => <AssetCard key={a.id} a={a} engineerName={engineerName} onChange={(patch) => setAsset(a.id, patch)} onSelect={() => onPortal((p) => updateLine(p, (l) => ({ ...l, assets: l.assets.map((x) => (x.viewId === v.id ? { ...x, selected: x.id === a.id } : x)) })))} onRemove={() => onPortal((p) => updateLine(p, (l) => ({ ...l, assets: l.assets.filter((x) => x.id !== a.id) })))} furniture={line.style.furniture === 'suggest'} />)
                  )}
                </div>
              </div>
            </Card>
          );
        })
      )}

      <Card title="4. Narrative — “Your new home” (T1)" subtitle="Paste Claude’s answer to the narrative prompt. It appears in the proposal only once you have reviewed it.">
        <div className="grid gap-3">
          <Text
            label="Narrative text"
            multiline
            max={20000}
            value={line.narrative.text}
            onChange={(t) => onPortal((p) => updateLine(p, (l) => ({ ...l, narrative: { ...l.narrative, text: t, reviewed: false, importedOn: today, templateVersion: `${TEMPLATES.T1.id} ${TEMPLATES.T1.version}` } })))}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Text label="Provider" value={line.narrative.provider} max={120} onChange={(provider) => onPortal((p) => updateLine(p, (l) => ({ ...l, narrative: { ...l.narrative, provider } })))} />
            <Text label="Model" value={line.narrative.modelName} max={120} onChange={(m) => onPortal((p) => updateLine(p, (l) => ({ ...l, narrative: { ...l.narrative, modelName: m } })))} />
          </div>
          <Check
            label="I have reviewed this narrative: no invented measurements, prices, products or promises; the MISSING OR UNCLEAR section is removed"
            checked={line.narrative.reviewed}
            onChange={(reviewed) => onPortal((p) => updateLine(p, (l) => ({ ...l, narrative: { ...l.narrative, reviewed } })))}
          />
        </div>
      </Card>
    </div>
  );
}

function AssetCard({ a, onChange, onSelect, onRemove, engineerName, furniture }: { a: VisualAsset; onChange: (p: Partial<VisualAsset>) => void; onSelect: () => void; onRemove: () => void; engineerName: string; furniture: boolean }) {
  const fails = a.qa.filter((q) => q === 'fail').length;
  const answered = a.qa.filter((q) => q !== null).length;
  const canApprove = a.labelBurned && answered === 8 && (fails === 0 || a.overrideReason.trim().length > 0);
  return (
    <div className="grid gap-3 rounded-control border border-[var(--color-border)] p-3 @2xl/section:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <figure>
        <img src={a.dataUri} alt={`After, illustrative: ${a.fileName}`} className="w-full rounded-control border border-[var(--color-border)]" />
        <figcaption className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[var(--color-ink-3)]">
          {a.labelBurned ? <StatusBadge kind="complete" compact>Label burned in</StatusBadge> : <StatusBadge kind="blocked" compact>No label — cannot be used</StatusBadge>}
          {a.approvedOn ? <StatusBadge kind="complete" compact>Approved {a.approvedOn}</StatusBadge> : <StatusBadge kind="in-progress" compact>Not approved</StatusBadge>}
          {a.selected && <StatusBadge kind="complete" compact>Selected</StatusBadge>}
          {furniture && <span>{FURNITURE_CAPTION}</span>}
        </figcaption>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" onClick={onSelect} disabled={a.selected}>
            {a.selected ? 'Selected for the proposal' : 'Select for the proposal'}
          </Button>
          <Button size="sm" variant="ghost" icon="trash" onClick={onRemove}>
            Remove
          </Button>
        </div>
      </figure>
      <div className="grid content-start gap-2">
        <fieldset>
          <legend className="text-sm font-semibold text-[var(--color-ink)]">QA checklist (T8) — {answered}/8 answered{fails ? `, ${fails} FAIL` : ''}</legend>
          <ol className="mt-1 grid gap-1">
            {QA_CHECKS.map((c, i) => (
              <li key={c} className="flex flex-wrap items-center gap-2 text-xs">
                <span className="min-w-0 flex-1 text-[var(--color-ink-2)]">
                  {i + 1}. {c}
                </span>
                <span className="flex gap-0.5" role="radiogroup" aria-label={`Check ${i + 1}`}>
                  {(['pass', 'fail', 'unsure'] as const).map((v) => (
                    <label key={v} className={`cursor-pointer rounded px-1.5 py-0.5 font-semibold uppercase has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--color-brand)] ${a.qa[i] === v ? (v === 'pass' ? 'bg-[var(--color-pass)] text-[var(--color-surface)]' : v === 'fail' ? 'bg-[var(--color-fail)] text-[var(--color-surface)]' : 'bg-[var(--color-marginal)] text-[var(--color-surface)]') : 'border border-[var(--color-border-strong)] text-[var(--color-ink-2)]'}`}>
                      <input type="radio" className="sr-only" name={`${a.id}-qa-${i}`} checked={a.qa[i] === v} onChange={() => onChange({ qa: a.qa.map((q, j) => (j === i ? v : q)), approvedOn: null, approvedBy: '' })} />
                      {v}
                    </label>
                  ))}
                </span>
              </li>
            ))}
          </ol>
        </fieldset>
        <Select label="Recommendation" value={a.recommend ?? ''} options={[{ value: '', label: '—' }, { value: 'use', label: 'Use' }, { value: 'regenerate', label: 'Regenerate' }, { value: 'engineer', label: 'Needs engineer look' }]} onChange={(v) => onChange({ recommend: v === '' ? null : v })} />
        {fails > 0 && <Text label="Override reason (required to approve with a FAIL)" value={a.overrideReason} max={400} onChange={(overrideReason) => onChange({ overrideReason })} />}
        <Text label="QA notes (engineer only)" value={a.qaNotes} max={1000} onChange={(qaNotes) => onChange({ qaNotes })} />
        <div className="flex flex-wrap items-center gap-2">
          {a.approvedOn ? (
            <Button size="sm" onClick={() => onChange({ approvedOn: null, approvedBy: '' })}>
              Withdraw approval
            </Button>
          ) : (
            <Button size="sm" variant="primary" icon="check" disabled={!canApprove} onClick={() => onChange({ approvedOn: todayIso(), approvedBy: engineerName || 'Engineer' })}>
              Approve for proposal
            </Button>
          )}
          {!canApprove && !a.approvedOn && <span className="text-xs text-[var(--color-ink-3)]">{!a.labelBurned ? 'Needs the burned-in label.' : answered < 8 ? 'Answer all 8 checks.' : 'A FAIL needs an override reason.'}</span>}
        </div>
        <details>
          <summary className="cursor-pointer text-xs text-[var(--color-accent)] hover:underline">How this was made (provenance)</summary>
          <dl className="mt-1 grid gap-0.5 rounded-control bg-[var(--color-surface-2)] p-2 text-xs text-[var(--color-ink-2)]">
            <div>Template: {a.templateId} {a.templateVersion}</div>
            <div>Provider / model: {a.provider || 'not recorded'} / {a.modelName || 'not recorded'}</div>
            <div>Variant: {a.variant} · imported {a.importedOn ?? '—'} · file {a.fileName}</div>
            <div>Input photos: {a.inputPhotoIds.join(', ')}</div>
            <div>QA: {a.qa.map((q, i) => `${i + 1}:${q ?? '—'}`).join(' ')}{a.overrideReason ? ` · override: ${a.overrideReason}` : ''}</div>
            <div>Approved by: {a.approvedBy || '—'} {a.approvedOn ?? ''}</div>
            <details>
              <summary className="cursor-pointer">Exact prompt text</summary>
              <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-2xs">{a.promptText}</pre>
            </details>
          </dl>
        </details>
      </div>
    </div>
  );
}
