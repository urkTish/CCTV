/**
 * One job, opened from the Jobs section: where it stands, what happens next, the
 * client's details and its history. Edits apply as you type (as everywhere in
 * the Admin); there is no Save button. Deleting asks once more.
 */

import { useState } from 'react';

import { longDate } from '../../report/reportModel.ts';
import { Button, Dialog, Fieldset, SelectField, TextField } from '../../ui/primitives.tsx';
import { suggestedNextStage, type JobPatch } from '../jobsState.ts';
import {
  JOB_STAGES,
  LOG_KIND_LABEL,
  PAYMENT_TERMS,
  SERVICE_LABEL,
  SERVICES,
  STAGE_HELP,
  STAGE_LABEL,
  TERMS_LABEL,
  type Job,
  type JobStage,
  type LogKind,
  type PaymentTerms,
} from '../model.ts';
import { AmountField, DateField, TextAreaField } from './fields.tsx';

const STAGE_OPTIONS = JOB_STAGES.map((s) => ({ value: s, label: STAGE_LABEL[s] }));
const SERVICE_OPTIONS = SERVICES.map((s) => ({ value: s, label: SERVICE_LABEL[s] }));
const TERMS_OPTIONS: readonly { value: PaymentTerms | 'unset'; label: string }[] = [{ value: 'unset', label: 'Not set yet' }, ...PAYMENT_TERMS.map((t) => ({ value: t, label: TERMS_LABEL[t] }))];
const ENTRY_KINDS: readonly { value: Exclude<LogKind, 'stage'>; label: string }[] = [
  { value: 'follow-up', label: LOG_KIND_LABEL['follow-up'] },
  { value: 'note', label: LOG_KIND_LABEL.note },
];

export function JobDialog({
  job,
  onUpdate,
  onMove,
  onLog,
  onDelete,
  onClose,
}: {
  job: Job;
  onUpdate: (patch: JobPatch) => void;
  onMove: (stage: JobStage) => void;
  onLog: (kind: Exclude<LogKind, 'stage'>, text: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [entryKind, setEntryKind] = useState<Exclude<LogKind, 'stage'>>('follow-up');
  const [entryText, setEntryText] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const next = suggestedNextStage(job);
  const history = [...job.log].reverse();

  const footer = confirmDelete ? (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <span className="text-sm text-[var(--color-ink-2)]">Delete {job.id} for good? This cannot be undone.</span>
      <Button onClick={() => setConfirmDelete(false)}>Keep it</Button>
      <Button variant="danger" icon="trash" onClick={onDelete}>
        Delete job
      </Button>
    </div>
  ) : (
    <div className="flex w-full flex-wrap items-center justify-between gap-2">
      <Button variant="ghost" icon="trash" onClick={() => setConfirmDelete(true)}>
        Delete…
      </Button>
      <Button variant="primary" onClick={onClose}>
        Done
      </Button>
    </div>
  );

  return (
    <Dialog title={`${job.id} · ${job.client || 'Client not named'}`} open onClose={onClose} footer={footer} wide>
      <div className="grid gap-5">
        <Fieldset legend="Where it stands">
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField label="Stage" helper={STAGE_HELP[job.stage]} value={job.stage} options={STAGE_OPTIONS} onChange={onMove} />
            {next && (
              <div className="flex items-start pt-0 sm:pt-6">
                <Button icon="arrow-right" onClick={() => onMove(next)}>
                  Move to {STAGE_LABEL[next]}
                </Button>
              </div>
            )}
          </div>
          {job.stage === 'lost' && (
            <div className="mt-3">
              <TextField
                label="Why it was lost"
                helper={job.lostReason.trim() ? 'One line is enough. It is how the register learns.' : 'Add the reason: price, timing, went with another company… It is how the register learns.'}
                value={job.lostReason}
                onChange={(v) => onUpdate({ lostReason: v.slice(0, 300) })}
              />
            </div>
          )}
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_12rem]">
            <TextField
              label="Next step"
              helper="What happens next and who does it, e.g. “Call Ahmed to confirm the PO”."
              value={job.nextStep}
              onChange={(v) => onUpdate({ nextStep: v.slice(0, 300) })}
            />
            <DateField label="Due" helper="The day for the next step." value={job.nextDue} onChange={(v) => onUpdate({ nextDue: v })} />
          </div>
        </Fieldset>

        <Fieldset legend="Client and job">
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Job" helper="What the job is, in a few words." value={job.title} onChange={(v) => onUpdate({ title: v.slice(0, 160) })} />
            <TextField label="Client" helper="Company or person." value={job.client} onChange={(v) => onUpdate({ client: v.slice(0, 160) })} />
            <TextField label="Contact person" helper="Who you deal with." value={job.contact} onChange={(v) => onUpdate({ contact: v.slice(0, 160) })} />
            <TextField label="Phone" helper="With the country code, e.g. +966 5…" type="tel" value={job.phone} onChange={(v) => onUpdate({ phone: v.slice(0, 40) })} />
            <TextField label="Email" helper="Where proposals and invoices go." type="email" value={job.email} onChange={(v) => onUpdate({ email: v.slice(0, 160) })} />
            <TextField label="City" helper="Where the site is." value={job.city} onChange={(v) => onUpdate({ city: v.slice(0, 80) })} />
            <SelectField label="Service" helper="The main kind of work." value={job.service} options={SERVICE_OPTIONS} onChange={(v) => onUpdate({ service: v })} />
            <AmountField label="Value" helper="As quoted. Leave empty until there is a figure." value={job.value} onChange={(v) => onUpdate({ value: v })} />
            <SelectField
              label="Payment terms"
              helper="On credit, a job goes from the PO straight to work. Otherwise it waits for the transfer."
              value={job.terms ?? 'unset'}
              options={TERMS_OPTIONS}
              onChange={(v) => onUpdate({ terms: v === 'unset' ? null : v })}
            />
          </div>
          <div className="mt-3 grid gap-3">
            <TextAreaField label="Documents" helper="Where the proposal, BOQ and photos are: file names or links." value={job.documents} max={1000} onChange={(v) => onUpdate({ documents: v })} />
            <TextAreaField label="Notes" helper="Anything worth remembering about this client or site." value={job.notes} max={2000} onChange={(v) => onUpdate({ notes: v })} />
          </div>
        </Fieldset>

        <Fieldset legend="History" helper="Every stage change is recorded here by itself. Add follow-ups and notes as they happen.">
          <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
            <SelectField label="Kind" helper="A follow-up is a contact with the client." value={entryKind} options={ENTRY_KINDS} onChange={setEntryKind} />
            <TextField label="What happened" helper="e.g. “Called; PO expected next week”." value={entryText} onChange={(v) => setEntryText(v.slice(0, 1000))} />
          </div>
          <div className="mt-2 flex justify-end">
            <Button
              icon="plus"
              disabled={!entryText.trim()}
              onClick={() => {
                onLog(entryKind, entryText);
                setEntryText('');
              }}
            >
              Add to history
            </Button>
          </div>
          <ol className="mt-3 grid gap-2" aria-label={`History of ${job.id}`}>
            {history.map((e, i) => (
              <li key={`${e.on}-${i}`} className="rounded-control border border-[var(--color-border)] px-3 py-2 text-sm">
                <span className="font-medium text-[var(--color-ink)]">{longDate(e.on)}</span>
                <span className="text-[var(--color-ink-3)]"> · {LOG_KIND_LABEL[e.kind]}</span>
                <p className="mt-0.5 text-[var(--color-ink-2)]" dir="auto">
                  {e.text}
                </p>
              </li>
            ))}
          </ol>
        </Fieldset>
      </div>
    </Dialog>
  );
}
