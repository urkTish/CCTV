/**
 * Admin → Report: the client report's preview, how to print it, and the
 * deliberate switch from Draft to Final. Only a Final report carries the
 * company stamp, and making it Final needs a confirmation that lists what is
 * still open.
 */

import { useMemo, useState } from 'react';

import { todayIso } from '../../client/intakeFile.ts';
import type { BillOfMaterials } from '../../engine/billOfMaterials.ts';
import { buildReport } from '../../report/reportModel.ts';
import { ReportView } from '../../report/ReportView.tsx';
import { profileIsEmpty, type EngineerProfile } from '../../state/engineerProfile.ts';
import type { Project } from '../../state/projectTypes.ts';
import type { ProjectExtras } from '../../state/workspace.ts';
import { Icon } from '../icons.tsx';
import { Button, Card, Dialog, Notice, NumberField, StatusBadge } from '../primitives.tsx';
import type { SectionId } from './sections.ts';

export function ReportSection({
  project,
  extras,
  profile,
  bom,
  assumedLeft,
  onExtras,
  onNavigate,
}: {
  project: Project;
  extras: ProjectExtras;
  profile: EngineerProfile;
  bom: Pick<BillOfMaterials, 'complete' | 'incompleteReasons'>;
  assumedLeft: number;
  onExtras: (next: ProjectExtras) => void;
  onNavigate: (id: SectionId) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [checked, setChecked] = useState(false);
  const today = todayIso();
  const model = useMemo(() => buildReport(project, extras, profile, today), [project, extras, profile, today]);
  const final = extras.report.status === 'final';

  const checks: { ok: boolean; text: string; fix?: { label: string; to: SectionId } }[] = [
    { ok: bom.complete, text: bom.complete ? 'The design is complete.' : `The design has ${bom.incompleteReasons.length} open gap(s).`, fix: { label: 'Bill of materials', to: 'bom' } },
    { ok: assumedLeft === 0, text: assumedLeft === 0 ? 'No value assumed from a client intake is left to confirm.' : `${assumedLeft} value(s) assumed from the client intake are not confirmed.`, fix: { label: 'Locations', to: 'locations' } },
    { ok: !profileIsEmpty(profile) && profile.name.trim() !== '', text: profile.name.trim() ? `Prepared by ${profile.name}.` : 'Your name is not set for "prepared by".', fix: { label: 'Settings', to: 'settings' } },
    { ok: extras.clientName.trim() !== '', text: extras.clientName.trim() ? `Prepared for ${extras.clientName}.` : 'The client’s name is not set.', fix: { label: 'Overview', to: 'overview' } },
  ];

  const issue = () => {
    onExtras({ ...extras, report: { status: 'final', finalisedOn: today, preparedBy: profile } });
    setConfirming(false);
    setChecked(false);
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 print:hidden @4xl/section:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card title="Status">
          <div className="flex flex-wrap items-center gap-3">
            {final ? (
              <StatusBadge kind="complete">Final — issued {extras.report.finalisedOn}</StatusBadge>
            ) : (
              <StatusBadge kind="in-progress">Draft — not for approval</StatusBadge>
            )}
            {final ? (
              <Button onClick={() => onExtras({ ...extras, report: { status: 'draft', finalisedOn: null, preparedBy: null } })}>Return to draft</Button>
            ) : (
              <Button icon="check" onClick={() => setConfirming(true)}>
                Issue as final…
              </Button>
            )}
          </div>
          <p className="mt-2 text-sm text-[var(--color-ink-2)]">
            {final
              ? 'The report carries the company stamp in its approval block. Any change to the project shows here at once — return to draft before changing a final proposal.'
              : 'A draft prints with a “DRAFT — NOT FOR APPROVAL” watermark and no company stamp.'}
          </p>
        </Card>
        <Card title="Print or save as PDF">
          <p className="text-sm text-[var(--color-ink-2)]">
            Use your browser’s print dialog: choose <strong>Save as PDF</strong> and A4. Page numbers and the ContracTech header appear on every page.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <Button variant="primary" icon="printer" onClick={() => window.print()}>
              Print / Save as PDF
            </Button>
            <div className="w-40">
              <NumberField
                label="Valid for"
                unit="days"
                helper=""
                value={extras.validityDays}
                min={1}
                max={3650}
                step={1}
                onChange={(v) => Number.isFinite(v) && v >= 1 && v <= 3650 && onExtras({ ...extras, validityDays: Math.round(v) })}
              />
            </div>
          </div>
        </Card>
      </div>

      <div className="overflow-x-auto rounded-card bg-[var(--color-surface-3)] p-2 sm:p-6 print:overflow-visible print:bg-transparent print:p-0">
        <ReportView model={model} />
      </div>

      <Dialog
        title="Issue the final report?"
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
            <Button variant="primary" icon="check" disabled={!checked} onClick={issue}>
              Issue final report with stamp
            </Button>
          </>
        }
      >
        <p>
          The final report carries the ContracTech company stamp — the company’s mark of commitment to this proposal. Check these before you
          issue it:
        </p>
        <ul className="mt-3 grid gap-2" aria-label="Before issuing">
          {checks.map((c) => (
            <li key={c.text} className="flex items-start gap-2">
              <span style={{ color: c.ok ? 'var(--color-pass)' : 'var(--color-marginal)' }}>
                <Icon name={c.ok ? 'check-circle' : 'alert'} size={18} title={c.ok ? 'Done' : 'Open'} />
              </span>
              <span className="flex-1">{c.text}</span>
              {!c.ok && c.fix && (
                <button
                  type="button"
                  className="shrink-0 text-xs font-semibold text-[var(--color-accent)] hover:underline"
                  onClick={() => {
                    setConfirming(false);
                    onNavigate(c.fix!.to);
                  }}
                >
                  Go to {c.fix.label}
                </button>
              )}
            </li>
          ))}
        </ul>
        {checks.some((c) => !c.ok) && (
          <div className="mt-3">
            <Notice kind="warning">Some items are still open. You can still issue the report, but the client will see them in the notes.</Notice>
          </div>
        )}
        <label className="mt-4 flex items-start gap-2 text-sm text-[var(--color-ink)]">
          <input type="checkbox" className="mt-0.5 size-4 accent-[var(--color-accent)]" checked={checked} onChange={(e) => setChecked(e.currentTarget.checked)} />
          I have reviewed this proposal and want to issue it with the company stamp.
        </label>
      </Dialog>
    </div>
  );
}
