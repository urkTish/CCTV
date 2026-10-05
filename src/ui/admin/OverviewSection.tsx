/**
 * The Admin home: project and client details, the totals at a glance, cameras
 * by model, and every open warning in one list — each with a button to where it
 * is fixed. Plus the project file (save / open / link) and the autosave offer.
 */

import { useState, type ReactNode } from 'react';

import { cameraDataset } from '../../data/cameras.ts';
import type { BillOfMaterials } from '../../engine/billOfMaterials.ts';
import type { ProjectDesign } from '../../engine/projectDesign.ts';
import type { Project, ProjectTotals } from '../../state/projectTypes.ts';
import type { ProjectExtras } from '../../state/workspace.ts';
import { Icon } from '../icons.tsx';
import { Button, Card, EmptyState, Notice, TextField } from '../primitives.tsx';
import { CLIENT_HASH } from '../route.ts';
import { buttonClass } from '../uiStyles.ts';
import type { ProjectWarning, SectionId } from './sections.ts';
import { sectionDef } from './sections.ts';

function Tile({ label, value, note, go }: { label: string; value: string; note?: string; go?: { label: string; onClick: () => void } }) {
  return (
    <div className="flex flex-col rounded-card border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)]">
      <dt className="text-xs font-medium text-[var(--color-ink-3)]">{label}</dt>
      <dd className="mt-1 font-mono text-lg font-semibold break-words text-[var(--color-ink)]">{value}</dd>
      {note && <dd className="mt-0.5 text-xs text-[var(--color-ink-3)]">{note}</dd>}
      {go && (
        <dd className="mt-auto pt-2">
          <button type="button" onClick={go.onClick} className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-accent)] hover:underline">
            {go.label}
            <Icon name="arrow-right" size={12} />
          </button>
        </dd>
      )}
    </div>
  );
}

/**
 * The project name may be cleared while retyping, but a project always has a
 * name (the link and file schemas require one): an empty field is kept as typed
 * while focused, and shows the stored name again on blur.
 */
function ProjectNameField({ name, onCommit }: { name: string; onCommit: (n: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div onBlur={() => setDraft(null)}>
      <TextField
        label="Project name"
        helper="Shown in the header, the file name and the report."
        value={draft ?? name}
        onChange={(v) => {
          const next = v.slice(0, 160);
          setDraft(next);
          if (next.trim()) onCommit(next);
        }}
      />
    </div>
  );
}

/** The link an engineer sends a client: the plain-language intake wizard. */
function ClientIntakeCard() {
  const [copied, setCopied] = useState<string | null>(null);
  const link = `${window.location.origin}${window.location.pathname}${CLIENT_HASH}`;
  return (
    <Card title="Client intake" subtitle="A short plain-language questionnaire a client can fill in on a phone. They send back a file you open with Open project.">
      <p className="font-mono text-xs break-all text-[var(--color-ink-2)]">{link}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          icon="link"
          onClick={() =>
            void navigator.clipboard
              .writeText(link)
              .then(() => setCopied('Link copied — send it to the client.'))
              .catch((err: unknown) => setCopied(`Could not copy (${err instanceof Error ? err.message : 'unknown error'}); copy it from above.`))
          }
        >
          Copy the client link
        </Button>
        <a href={CLIENT_HASH} className={buttonClass('ghost')}>
          Preview the intake
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

export function OverviewSection({
  project,
  extras,
  totals,
  design,
  bom,
  warnings,
  onProjectName,
  onExtras,
  onNavigate,
  onOpenLocation,
  projectFile,
  intakeNotice,
}: {
  project: Project;
  extras: ProjectExtras;
  totals: ProjectTotals;
  design: ProjectDesign;
  bom: BillOfMaterials;
  warnings: readonly ProjectWarning[];
  onProjectName: (name: string) => void;
  onExtras: (next: ProjectExtras) => void;
  onNavigate: (id: SectionId) => void;
  onOpenLocation: (id: string) => void;
  projectFile: ReactNode;
  intakeNotice: ReactNode;
}) {
  const nvr = design.nvr?.primary ?? null;
  const drivePlan = nvr?.evaluation.drivePlan;
  const cameraLines = bom.lines.filter((l) => l.category === 'camera');
  const go = (id: SectionId) => ({ label: sectionDef(id).label, onClick: () => onNavigate(id) });
  const blocked = warnings.filter((w) => w.severity === 'blocked');
  const attention = warnings.filter((w) => w.severity === 'attention');

  return (
    <div className="grid gap-4">
      {intakeNotice}

      <section aria-labelledby="totals-heading">
        <h3 id="totals-heading" className="mb-2 text-sm font-semibold tracking-wide text-[var(--color-ink-3)] uppercase">
          Totals
        </h3>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 @5xl:grid-cols-4">
          <Tile label="Cameras" value={String(totals.cameraCount)} note={`${totals.locationCount} location${totals.locationCount === 1 ? '' : 's'}`} go={go('locations')} />
          <Tile
            label="Recorder"
            value={nvr?.evaluation.nvr.model ?? '—'}
            note={
              drivePlan?.ok
                ? `${drivePlan.config.totalDrives} × ${drivePlan.config.drive.capacityTb} TB ${drivePlan.config.drive.model}`
                : design.nvr && !design.nvr.primary
                  ? 'no recorder passes every check'
                  : undefined
            }
            go={go('recording')}
          />
          <Tile
            label="Storage needed"
            value={design.storage ? `${design.storage.requiredUsableTb.toFixed(2)} TB` : '—'}
            note={drivePlan?.ok ? `usable, after headroom and formatting · ${drivePlan.config.usableTb.toFixed(2)} TB installed` : 'usable, after headroom and formatting'}
          />
          <Tile label="PoE switches" value={design.switches ? String(design.switches.switchCount) : '—'} note={design.poeMode.mode === 'built-in' ? 'recorder powers the cameras' : undefined} go={go('network')} />
          <Tile
            label="CAT6 boxes"
            value={design.cables ? `${design.cables.packing.boxes.length} × ${design.cables.boxMetres} m` : '—'}
            note={design.cables?.isEstimate ? 'some runs estimated' : undefined}
            go={go('cabling')}
          />
          <Tile label="PoE load" value={`${totals.poeCameraWatts.toFixed(0)} W`} note={`budget ${totals.poeSwitchBudgetWatts.toFixed(0)} W at the switch`} />
          <Tile label="Aggregate bitrate" value={`${totals.aggregateBitrateMbps.toFixed(1)} Mbps`} />
          <Tile label="Bill of materials" value={bom.complete ? 'Complete' : 'Incomplete'} note={`${bom.lines.length} lines`} go={go('bom')} />
        </dl>
        <p className="mt-2 text-xs text-[var(--color-ink-3)]">{totals.poeExplanation}</p>
        {totals.unresolvedLocations.length > 0 && (
          <p className="mt-1 text-xs font-medium text-[var(--color-marginal)]">Not counted, no model satisfies them yet: {totals.unresolvedLocations.join(', ')}.</p>
        )}
      </section>

      <div className="grid gap-4 @4xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card title={`Open warnings (${warnings.length})`} subtitle="Everything that needs attention, each linked to where it is fixed.">
          {warnings.length === 0 ? (
            <EmptyState icon="check-circle" title="Nothing needs attention">
              Every location has a camera that passes, and the recorder, switches and cable plan have no warnings.
            </EmptyState>
          ) : (
            <ul className="grid gap-2" aria-label="Open warnings">
              {[...blocked, ...attention].map((w) => {
                const loc = w.locationId ? project.locations.find((l) => l.id === w.locationId) : undefined;
                return (
                  <li
                    key={w.id}
                    className="flex flex-wrap items-start gap-2 rounded-control border-l-4 px-3 py-2 text-sm"
                    style={{
                      borderColor: w.severity === 'blocked' ? 'var(--color-fail)' : 'var(--color-marginal)',
                      background: w.severity === 'blocked' ? 'var(--color-fail-soft)' : 'var(--color-marginal-soft)',
                    }}
                  >
                    <span style={{ color: w.severity === 'blocked' ? 'var(--color-fail)' : 'var(--color-marginal)' }} className="mt-0.5">
                      <Icon name={w.severity === 'blocked' ? 'x-circle' : 'alert'} size={16} title={w.severity === 'blocked' ? 'Blocked' : 'Needs attention'} />
                    </span>
                    <span className="min-w-0 flex-1 text-[var(--color-ink)]">{w.text}</span>
                    <button
                      type="button"
                      onClick={() => (loc ? onOpenLocation(loc.id) : onNavigate(w.section))}
                      className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--color-accent)] hover:underline"
                    >
                      {loc ? `Open ${loc.name}` : `Go to ${sectionDef(w.section).label}`}
                      <Icon name="arrow-right" size={12} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Cameras by model">
          {cameraLines.length === 0 ? (
            <p className="text-sm text-[var(--color-ink-3)]">No location has a recommended camera yet.</p>
          ) : (
            <ul className="grid gap-2">
              {cameraLines.map((l) => (
                <li key={l.id} className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] pb-2 text-sm last:border-0 last:pb-0">
                  <span className="min-w-0">
                    <span className="block font-medium text-[var(--color-ink)]">{l.model}</span>
                    <span className="block text-xs text-[var(--color-ink-3)]">{l.description}</span>
                    <span className="block text-xs text-[var(--color-ink-3)]">{l.notes.join(' ')}</span>
                  </span>
                  <span className="shrink-0 font-mono text-base font-semibold text-[var(--color-ink)]">×{l.quantity}</span>
                </li>
              ))}
            </ul>
          )}
          {!bom.complete && (
            <div className="mt-3">
              <Notice kind="warning" title="The design is not complete yet">
                <ul className="list-disc pl-4">
                  {bom.incompleteReasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </Notice>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 @4xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card title="Project">
          <div className="grid gap-3 sm:grid-cols-2">
            <ProjectNameField name={project.name} onCommit={onProjectName} />
            <TextField
              label="Client"
              helper="Who the report is prepared for."
              value={extras.clientName}
              onChange={(clientName) => onExtras({ ...extras, clientName: clientName.slice(0, 160) })}
            />
            <div className="sm:col-span-2">
              <TextField
                label="Client contact"
                helper="Phone or email, for the report cover. Optional."
                value={extras.clientContact}
                onChange={(clientContact) => onExtras({ ...extras, clientContact: clientContact.slice(0, 300) })}
              />
            </div>
          </div>
        </Card>
        <div className="grid content-start gap-4">
          <Card title="Project file" subtitle="Save the whole project, map included, or open one.">
            {projectFile}
          </Card>
          <ClientIntakeCard />
        </div>
      </div>

      <p className="text-xs text-[var(--color-ink-3)]">
        {cameraDataset.cameras.length} models, every spec read from the manufacturer datasheet &middot; dataset reviewed {cameraDataset.datasetVerifiedOn}
      </p>
    </div>
  );
}
