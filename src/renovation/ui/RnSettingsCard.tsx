/**
 * Settings → Renovation (this project): market defaults (Q4: SAR, VAT 15%,
 * metric — assumptions to confirm), the client range before survey (Q8), free
 * design rounds (Q9), payment milestones, and the legal texts (Q6: placeholder
 * text, to be approved by a lawyer). Saved with the project.
 */

import { Button, Card, Notice } from '../../ui/primitives.tsx';
import { LEGAL_PLACEHOLDER, nextId, type PortalData, type RnSettings } from '../model.ts';
import { updateLine, type PortalUpdate } from '../rnState.ts';
import { num } from '../trace.ts';
import { Check, Num, Select, Text } from './kit.tsx';

export function RnSettingsCard({ portal, onPortal }: { portal: PortalData; onPortal: PortalUpdate }) {
  const s = portal.renovation?.settings;
  if (!s) return null;
  const set = (patch: Partial<RnSettings>) => onPortal((p) => updateLine(p, (l) => ({ ...l, settings: { ...l.settings, ...patch } })));
  const pct = s.milestones.reduce((a, m) => a + m.percent, 0);
  const placeholder = [s.warrantyText, s.termsText].some((t) => t.includes(LEGAL_PLACEHOLDER));
  return (
    <>
      <Card title="Renovation — market and pricing (this project)" subtitle="Gulf defaults recommended in the spec; assumptions to confirm with the owner (ASSUMPTIONS 15). Saved with the project.">
        <div className="grid gap-3 sm:grid-cols-2 @4xl/section:grid-cols-4">
          <Text label="Currency" value={s.currency} max={12} onChange={(currency) => set({ currency })} />
          <Num label="VAT" unit="%" value={s.vatPercent} min={0} max={100} onChange={(v) => v !== null && set({ vatPercent: v })} />
          <Num label="Contingency" unit="%" value={s.contingencyPercent} min={0} max={50} onChange={(v) => v !== null && set({ contingencyPercent: v })} />
          <Num label="Proposal valid for" unit="days" value={s.validityDays} min={1} max={3650} step={1} onChange={(v) => v !== null && set({ validityDays: Math.round(v) })} />
          <Text label="Region (for the visual briefs)" value={s.locale} max={120} onChange={(locale) => set({ locale })} />
          <Select label="Language of the AI briefs and visual label" value={s.proposalLanguage} options={[{ value: 'en', label: 'English' }, { value: 'ar', label: 'Arabic' }]} onChange={(proposalLanguage) => set({ proposalLanguage })} help="The proposal document itself is English in Phase 1." />
          <Num label="Range below estimate, before survey" unit="%" value={s.rangeLowPercent} min={0} max={90} onChange={(v) => v !== null && set({ rangeLowPercent: v })} />
          <Num label="Range above estimate, before survey" unit="%" value={s.rangeHighPercent} min={0} max={300} onChange={(v) => v !== null && set({ rangeHighPercent: v })} />
          <Num label="Free design rounds" value={s.freeDesignRounds} min={0} max={20} step={1} onChange={(v) => v !== null && set({ freeDesignRounds: Math.round(v) })} />
        </div>
        <p className="mt-2 text-xs text-[var(--color-ink-3)]">Units are metric throughout the renovation line.</p>
      </Card>
      <Card title="Payment milestones" subtitle={`Percentages of the total incl. VAT. They add up to ${num(pct)}%${Math.abs(pct - 100) < 1e-9 ? '.' : ' — they must add up to 100%.'}`}>
        <ul className="grid gap-2">
          {s.milestones.map((m, i) => (
            <li key={m.id} className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_6rem_auto] sm:items-end">
              <Text label={`Milestone ${i + 1}`} value={m.label} max={160} onChange={(label) => set({ milestones: s.milestones.map((x) => (x.id === m.id ? { ...x, label } : x)) })} />
              <Text label="When" value={m.trigger} max={160} onChange={(trigger) => set({ milestones: s.milestones.map((x) => (x.id === m.id ? { ...x, trigger } : x)) })} />
              <Num label="%" value={m.percent} min={0} max={100} onChange={(v) => v !== null && set({ milestones: s.milestones.map((x) => (x.id === m.id ? { ...x, percent: v } : x)) })} />
              <Button size="sm" variant="ghost" icon="trash" ariaLabel={`Remove milestone ${i + 1}`} onClick={() => set({ milestones: s.milestones.filter((x) => x.id !== m.id) })} />
            </li>
          ))}
        </ul>
        <Button size="sm" icon="plus" className="mt-2" onClick={() => set({ milestones: [...s.milestones, { id: nextId('ms', s.milestones.map((x) => x.id)), label: 'New milestone', percent: 0, trigger: '' }] })}>
          Add milestone
        </Button>
      </Card>
      <Card title="Legal texts" subtitle="Warranty, terms, exclusions and the visuals disclaimer, printed in the proposal (owner decision Q6).">
        {placeholder && (
          <div className="mb-3">
            <Notice kind="warning" title="Placeholder — to be approved by a lawyer">
              These texts are placeholders written to show where the terms go. Have a lawyer approve one set before the first Final proposal.
            </Notice>
          </div>
        )}
        <div className="grid gap-3 @4xl/section:grid-cols-2">
          <Text label="Warranty" multiline max={4000} value={s.warrantyText} onChange={(warrantyText) => set({ warrantyText, legalApproved: false })} />
          <Text label="Terms" multiline max={6000} value={s.termsText} onChange={(termsText) => set({ termsText, legalApproved: false })} />
          <Text label="Exclusions (one per line)" multiline max={4000} value={s.exclusionsText} onChange={(exclusionsText) => set({ exclusionsText })} />
          <Text label="Visuals disclaimer" multiline max={2000} value={s.visualsDisclaimer} onChange={(visualsDisclaimer) => set({ visualsDisclaimer, legalApproved: false })} />
        </div>
        <div className="mt-3">
          <Check
            label="These legal texts have been approved by a lawyer"
            checked={s.legalApproved}
            onChange={(legalApproved) => set({ legalApproved })}
            help={placeholder ? 'The warranty or terms still contain the placeholder line — remove it once the approved text is in.' : 'Required before a Final proposal. Editing a text clears it.'}
          />
        </div>
      </Card>
    </>
  );
}
