/**
 * Renovation → Proposal: preview, print / save as PDF, and the deliberate
 * switch from Draft to Final. Unlike the CCTV report, a renovation proposal
 * cannot go Final while anything in `finalBlockers` is open (blocking safety
 * items, assumed values, an incomplete BOQ, sample rates, payment milestones,
 * unapproved legal texts). Returning a Final to draft moves to the next
 * revision letter.
 */

import { useMemo, useState } from 'react';

import { todayIso } from '../../client/intakeFile.ts';
import { profileIsEmpty, type EngineerProfile } from '../../state/engineerProfile.ts';
import { Icon } from '../../ui/icons.tsx';
import { Button, Card, Dialog, Notice, StatusBadge } from '../../ui/primitives.tsx';
import { sectionLabel } from '../derive.ts';
import { buildProposal, nextRevision } from '../proposal.ts';
import { updateLine } from '../rnState.ts';
import type { RnSectionProps } from './OverviewSections.tsx';
import { ProposalView } from './ProposalView.tsx';

export function ProposalSection({ portal, onPortal, derived, onNavigate, projectName, clientName, clientContact, profile }: RnSectionProps & { projectName: string; clientName: string; clientContact: string; profile: EngineerProfile }) {
  const [confirming, setConfirming] = useState(false);
  const [checked, setChecked] = useState(false);
  const today = todayIso();
  const line = portal.renovation!;
  const model = useMemo(() => buildProposal(portal, derived, { projectName, clientName, clientContact, profile, today }), [portal, derived, projectName, clientName, clientContact, profile, today]);
  const final = line.proposal.status === 'final';
  const blockers = [
    ...derived.finalBlockers,
    ...(profileIsEmpty(profile) || !profile.name.trim() ? [{ text: 'Your name is not set for “prepared by”.', section: 'settings' as const }] : []),
    ...(!clientName.trim() ? [{ text: 'The client’s name is not set.', section: 'rn-client' as const }] : []),
  ];
  const visualsMissing = line.views.length > 0 && model.rooms.every((r) => r.pairs.length === 0);
  const issue = () => {
    onPortal((p) => updateLine(p, (l) => ({ ...l, proposal: { ...l.proposal, status: 'final', finalisedOn: today, preparedBy: profile } })));
    setConfirming(false);
    setChecked(false);
  };
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 print:hidden @4xl/section:grid-cols-2">
        <Card title="Status">
          <div className="flex flex-wrap items-center gap-3">
            {final ? <StatusBadge kind="complete">Final{line.proposal.revision ? ` Rev ${line.proposal.revision}` : ''} — issued {line.proposal.finalisedOn}</StatusBadge> : <StatusBadge kind="in-progress">Draft{line.proposal.revision ? ` Rev ${line.proposal.revision}` : ''} — not for approval</StatusBadge>}
            {final ? (
              <Button onClick={() => onPortal((p) => updateLine(p, (l) => ({ ...l, proposal: { status: 'draft', finalisedOn: null, preparedBy: null, revision: nextRevision(l.proposal.revision) } })))}>Return to draft (next revision)</Button>
            ) : (
              <Button icon="check" onClick={() => setConfirming(true)}>
                Issue as final…
              </Button>
            )}
          </div>
          <p className="mt-2 text-sm text-[var(--color-ink-2)]">
            {final
              ? 'The proposal carries the company stamp. Return to draft before changing it; the next issue gets the next revision letter.'
              : derived.firm
                ? 'A draft prints with a “DRAFT — NOT FOR APPROVAL” watermark and no stamp.'
                : 'A draft prints with the watermark and shows the client a price range, “subject to survey”, until every assumed value is confirmed.'}
          </p>
          {!final && blockers.length > 0 && (
            <div className="mt-3">
              <Notice kind="warning" title={`${blockers.length} item${blockers.length === 1 ? '' : 's'} to clear before Final`}>
                <ul className="grid gap-1">
                  {blockers.map((b) => (
                    <li key={b.text} className="flex flex-wrap items-start gap-2">
                      <span className="flex-1">{b.text}</span>
                      <button type="button" className="text-xs font-semibold text-[var(--color-accent)] hover:underline" onClick={() => onNavigate(b.section)}>
                        Go to {sectionLabel(b.section)}
                      </button>
                    </li>
                  ))}
                </ul>
              </Notice>
            </div>
          )}
        </Card>
        <Card title="Print or save as PDF">
          <p className="text-sm text-[var(--color-ink-2)]">
            Use the browser’s print dialog: choose <strong>Save as PDF</strong> and A4. The ContracTech header, page numbers and — on a draft — the watermark appear on every page.
          </p>
          <div className="mt-3">
            <Button variant="primary" icon="printer" onClick={() => window.print()}>
              Print / Save as PDF
            </Button>
          </div>
          {visualsMissing && <p className="mt-3 text-xs text-[var(--color-marginal)]">No visual is approved yet, so the before/after gallery is empty. Only approved, labelled visuals can appear.</p>}
        </Card>
      </div>
      <div className="overflow-x-auto rounded-card bg-[var(--color-surface-3)] p-2 sm:p-6 print:overflow-visible print:bg-transparent print:p-0">
        <ProposalView model={model} />
      </div>
      <Dialog
        title="Issue the final proposal?"
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
              Issue final proposal with stamp
            </Button>
          </>
        }
      >
        {blockers.length > 0 ? (
          <>
            <p>A renovation proposal can only be issued as final once these are cleared:</p>
            <ul className="mt-3 grid gap-2" aria-label="Before issuing">
              {blockers.map((b) => (
                <li key={b.text} className="flex items-start gap-2">
                  <span style={{ color: 'var(--color-fail)' }}>
                    <Icon name="x-circle" size={18} title="Open" />
                  </span>
                  <span className="flex-1">{b.text}</span>
                  <button
                    type="button"
                    className="shrink-0 text-xs font-semibold text-[var(--color-accent)] hover:underline"
                    onClick={() => {
                      setConfirming(false);
                      onNavigate(b.section);
                    }}
                  >
                    Go to {sectionLabel(b.section)}
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>Everything is cleared. The final proposal carries the ContracTech company stamp and a firm price for the scope in the bill of quantities.</p>
        )}
        <label className="mt-4 flex items-start gap-2 text-sm text-[var(--color-ink)]">
          <input type="checkbox" className="mt-0.5 size-4 accent-[var(--color-accent)]" checked={checked} onChange={(e) => setChecked(e.currentTarget.checked)} />
          I have reviewed this proposal, its narrative and every visual, and want to issue it with the company stamp.
        </label>
      </Dialog>
    </div>
  );
}
