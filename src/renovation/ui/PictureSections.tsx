/**
 * Renovation → Concepts (the proposal's Concept chapter) and → Completion
 * report (the photo report at handover). Both use the shared picture-section
 * editor (src/pictures/ui/PictureSectionEditor.tsx).
 */

import { useMemo, useState } from 'react';

import { todayIso } from '../../client/intakeFile.ts';
import { hasContent, statusCounts } from '../../pictures/pictureSection.ts';
import { PictureSectionEditor, type SectionsUpdate } from '../../pictures/ui/PictureSectionEditor.tsx';
import { profileIsEmpty, type EngineerProfile } from '../../state/engineerProfile.ts';
import { Icon } from '../../ui/icons.tsx';
import { Button, Card, Dialog, Notice, StatusBadge } from '../../ui/primitives.tsx';
import { buildCompletionModel, completionBlockers, completionStatus, createCompletionReport } from '../completion.ts';
import { sectionLabel } from '../derive.ts';
import type { PortalData } from '../model.ts';
import { nextRevision } from '../proposal.ts';
import { updateLine } from '../rnState.ts';
import { CompletionView } from './CompletionView.tsx';
import { Text } from './kit.tsx';
import type { RnSectionProps } from './OverviewSections.tsx';

function scopeOptionsOf(derived: RnSectionProps['derived']) {
  return (derived.boq?.lines ?? []).map((l) => ({ ref: l.ref, text: `${l.description}${l.roomName ? ` (${l.roomName})` : ''}` }));
}

function roomsOf(portal: PortalData) {
  return portal.rooms.map((r) => ({ id: r.id, name: r.name }));
}

export function ConceptsSection({ portal, onPortal, derived, onNavigate }: RnSectionProps) {
  const line = portal.renovation!;
  const concepts = line.concepts ?? [];
  const onChange: SectionsUpdate = (fn) =>
    onPortal((p) =>
      updateLine(p, (l) => {
        const next = fn([...(l.concepts ?? [])]);
        // Keep the field absent while empty, so an untouched project file is unchanged.
        return { ...l, concepts: next.length ? next : undefined };
      }),
    );
  const printable = concepts.filter(hasContent).length;
  return (
    <div className="grid gap-4">
      <Card
        title="Concept chapter"
        subtitle="Each section prints in the proposal as its title, then the picture(s), then the description — in the order below."
        actions={
          <Button size="sm" icon="report" onClick={() => onNavigate('rn-proposal')}>
            See it in the proposal
          </Button>
        }
      >
        <p className="text-sm text-[var(--color-ink-2)]">
          Bring a photo, a drawing or a render from outside. Pictures are reduced and their location data removed on import, and they are kept in this project file. Every concept picture prints with the label{' '}
          <strong>“Concept / Illustrative”</strong> burned in. {printable ? `${printable} section${printable === 1 ? '' : 's'} will print.` : 'Nothing prints until a section has a title, a picture or a description.'}
        </p>
      </Card>
      <PictureSectionEditor
        sections={concepts}
        onChange={onChange}
        kind="concept"
        noun="concept section"
        rooms={roomsOf(portal)}
        scopeOptions={scopeOptionsOf(derived)}
        lang={line.settings.proposalLanguage}
        today={todayIso()}
        emptyText="A concept section is one idea for the client: a title, a picture and a few lines on what it means. Link it to a room or a BOQ item if it helps."
      />
    </div>
  );
}

export function CompletionSection({ portal, onPortal, derived, onNavigate, projectName, clientName, clientContact, profile }: RnSectionProps & { projectName: string; clientName: string; clientContact: string; profile: EngineerProfile }) {
  const line = portal.renovation!;
  const report = line.completion;
  const today = todayIso();
  const [confirming, setConfirming] = useState(false);
  const [checked, setChecked] = useState(false);
  const [recreating, setRecreating] = useState(false);
  const proposalFinal = line.proposal.status === 'final';
  const preview = useMemo(() => createCompletionReport(portal, derived, today), [portal, derived, today]);
  const model = useMemo(() => (report ? buildCompletionModel(portal, { projectName, clientName, clientContact, profile, today }) : null), [portal, report, projectName, clientName, clientContact, profile, today]);

  const create = () => onPortal((p) => updateLine(p, (l) => ({ ...l, completion: createCompletionReport(p, derived, today) })));

  if (!report || !model) {
    return (
      <div className="grid gap-4">
        <Card title="Create the completion report">
          <p className="text-sm text-[var(--color-ink-2)]">
            One click makes a photo report from the proposal: one item per concept section, and one per room with work in the bill of quantities that no concept section covers. Titles, descriptions, room and BOQ links and the survey’s before photos are filled in, so
            nothing is typed twice. You then add the actual photos and mark each item done or snag.
          </p>
          <p className="mt-2 text-sm text-[var(--color-ink)]">
            <strong>{preview.items.length}</strong> item{preview.items.length === 1 ? '' : 's'} will be created
            {preview.items.length ? `: ${preview.items.map((i) => i.title).slice(0, 4).join('; ')}${preview.items.length > 4 ? '; …' : ''}.` : '.'}
          </p>
          {!proposalFinal && (
            <div className="mt-3">
              <Notice kind="warning" title="The proposal is still a draft">
                Normally the completion report follows the approved (Final) proposal. You can create it now; the report will say it was made from a draft{line.proposal.revision ? `, revision ${line.proposal.revision}` : ''}.
              </Notice>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant={proposalFinal ? 'primary' : 'secondary'} icon="clipboard-check" onClick={create} disabled={preview.items.length === 0}>
              Create completion report from the proposal
            </Button>
            {preview.items.length === 0 && <span className="self-center text-sm text-[var(--color-ink-3)]">Add concept sections or specify the scope first.</span>}
          </div>
        </Card>
      </div>
    );
  }

  const final = report.state.status === 'final';
  const counts = statusCounts(report.items);
  const status = completionStatus(report);
  const blockers = [
    ...completionBlockers(report).map((b) => ({ text: b.text, section: null as null | 'settings' | 'rn-client' })),
    ...(profileIsEmpty(profile) || !profile.name.trim() ? [{ text: 'Your name is not set for “prepared by”.', section: 'settings' as const }] : []),
    ...(!clientName.trim() ? [{ text: 'The client’s name is not set.', section: 'rn-client' as const }] : []),
  ];
  const onItems: SectionsUpdate = (fn) => onPortal((p) => updateLine(p, (l) => (l.completion ? { ...l, completion: { ...l.completion, items: fn([...l.completion.items]) } } : l)));
  const issue = () => {
    onPortal((p) => updateLine(p, (l) => (l.completion ? { ...l, completion: { ...l.completion, state: { ...l.completion.state, status: 'final', finalisedOn: today, preparedBy: profile } } } : l)));
    setConfirming(false);
    setChecked(false);
  };
  const toDraft = () =>
    onPortal((p) => updateLine(p, (l) => (l.completion ? { ...l, completion: { ...l.completion, state: { status: 'draft', finalisedOn: null, preparedBy: null, revision: nextRevision(l.completion.state.revision) } } } : l)));

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 print:hidden @4xl/section:grid-cols-2">
        <Card title="Status">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge kind={status.kind}>{final ? `${status.text} — issued ${report.state.finalisedOn}` : `Draft${report.state.revision ? ` Rev ${report.state.revision}` : ''} · ${status.text}`}</StatusBadge>
            {final ? (
              <Button onClick={toDraft}>Return to draft (next revision)</Button>
            ) : (
              <Button icon="check" onClick={() => setConfirming(true)}>
                Issue as final…
              </Button>
            )}
          </div>
          <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
            {(['done', 'snag', 'in-progress', 'proposed'] as const).map((k) => (
              <div key={k} className="rounded-control bg-[var(--color-surface-2)] px-1 py-1.5">
                <dt className="text-2xs font-medium text-[var(--color-ink-3)]">{k === 'in-progress' ? 'In progress' : k === 'done' ? 'Done' : k === 'snag' ? 'Snags' : 'Proposed'}</dt>
                <dd className="font-mono text-lg font-semibold text-[var(--color-ink)]">{counts[k]}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-sm text-[var(--color-ink-2)]">
            {final
              ? 'The report carries the company stamp. Return to draft before changing it; the next issue gets the next revision letter.'
              : 'A draft prints with the “DRAFT — NOT FOR APPROVAL” watermark and no stamp. Snags are listed at the end as outstanding.'}
          </p>
          <p className="mt-1 text-xs text-[var(--color-ink-3)]">
            Made on {report.createdOn} from the {report.source.proposalStatus === 'final' ? 'Final' : 'draft'} proposal{report.source.proposalRevision ? `, revision ${report.source.proposalRevision}` : ''}.
          </p>
          {!final && blockers.length > 0 && (
            <div className="mt-3">
              <Notice kind="warning" title={`${blockers.length} item${blockers.length === 1 ? '' : 's'} to clear before Final`}>
                <ul className="grid gap-1">
                  {blockers.map((b) => (
                    <li key={b.text} className="flex flex-wrap items-start gap-2">
                      <span className="flex-1">{b.text}</span>
                      {b.section && (
                        <button type="button" className="text-xs font-semibold text-[var(--color-accent)] hover:underline" onClick={() => onNavigate(b.section!)}>
                          Go to {sectionLabel(b.section)}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </Notice>
            </div>
          )}
        </Card>
        <Card title="Print or save as PDF">
          <p className="text-sm text-[var(--color-ink-2)]">
            Use the browser’s print dialog: choose <strong>Save as PDF</strong> and A4. The ContracTech header, page numbers and — on a draft — the watermark appear on every page. Each photo prints with “Actual photo” and the date taken burned in.
          </p>
          <div className="mt-3">
            <Button variant="primary" icon="printer" onClick={() => window.print()}>
              Print / Save as PDF
            </Button>
          </div>
        </Card>
      </div>

      {final ? (
        <Notice kind="info" title="This report is Final">
          Return it to draft to change its items; the next issue gets the next revision letter.
        </Notice>
      ) : (
        <>
          <Card title="Project summary" subtitle="Optional words under the generated facts (items completed, snags, dates, who did the work).">
            <Text
              label="Summary"
              multiline
              max={3000}
              value={report.summary}
              placeholder="e.g. The works were completed on programme. The client asked to keep the old kitchen doors."
              onChange={(v) => onPortal((p) => updateLine(p, (l) => (l.completion ? { ...l, completion: { ...l.completion, summary: v } } : l)))}
            />
          </Card>
          <div className="print:hidden">
            <PictureSectionEditor
              sections={report.items}
              onChange={onItems}
              kind="actual"
              noun="item"
              rooms={roomsOf(portal)}
              scopeOptions={scopeOptionsOf(derived)}
              lang={line.settings.proposalLanguage}
              today={today}
              toolbar={
                <Button variant="ghost" icon="undo" onClick={() => setRecreating(true)}>
                  Recreate from proposal…
                </Button>
              }
            />
          </div>
        </>
      )}

      <div className="overflow-x-auto rounded-card bg-[var(--color-surface-3)] p-2 sm:p-6 print:overflow-visible print:bg-transparent print:p-0">
        <CompletionView model={model} items={report.items} />
      </div>

      <Dialog
        title="Issue the final completion report?"
        open={confirming}
        onClose={() => {
          setConfirming(false);
          setChecked(false);
        }}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button variant="primary" icon="check" disabled={!checked || blockers.length > 0} onClick={issue}>
              Issue final report with stamp
            </Button>
          </>
        }
      >
        {blockers.length > 0 ? (
          <>
            <p>The completion report can only be issued as final once these are cleared:</p>
            <ul className="mt-3 grid gap-2" aria-label="Before issuing">
              {blockers.map((b) => (
                <li key={b.text} className="flex items-start gap-2">
                  <span style={{ color: 'var(--color-fail)' }}>
                    <Icon name="x-circle" size={18} title="Open" />
                  </span>
                  <span className="flex-1">{b.text}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>
            Every item is done or listed as a snag. The final report carries the ContracTech company stamp{counts.snag ? ` and lists ${counts.snag} outstanding snag${counts.snag === 1 ? '' : 's'}` : ''}.
          </p>
        )}
        <label className="mt-4 flex items-start gap-2 text-sm text-[var(--color-ink)]">
          <input type="checkbox" className="mt-0.5 size-4 accent-[var(--color-accent)]" checked={checked} onChange={(e) => setChecked(e.currentTarget.checked)} />
          I have checked every photo and date in this report and want to issue it with the company stamp.
        </label>
      </Dialog>

      <Dialog
        title="Recreate the completion report?"
        open={recreating}
        onClose={() => setRecreating(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRecreating(false)}>
              Keep my report
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                create();
                setRecreating(false);
              }}
            >
              Replace with {preview.items.length} fresh items
            </Button>
          </>
        }
      >
        <p>
          This replaces all {report.items.length} items — with their photos, dates and statuses — by fresh items from the proposal. Use it only if the proposal changed. To add one item, use “Add item” instead.
        </p>
      </Dialog>
    </div>
  );
}

