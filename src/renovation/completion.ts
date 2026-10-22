/**
 * The renovation completion / photo report: generated in one click from the
 * proposal (its Concept sections and its scope by room), so nothing is typed
 * twice; the engineer then adds the actual photos and marks each item done or
 * snag. Draft / Final and the company stamp follow the proposal's rules: Final
 * is a deliberate, confirmed step, blocked while anything below is open, and
 * returning it to draft moves to the next revision letter.
 */

import type { EngineerProfile } from '../state/engineerProfile.ts';
import {
  addImage,
  hasContent,
  newPictureSection,
  nextFreeId,
  statusCounts,
  type CompletionReport,
  type PictureSection,
} from '../pictures/pictureSection.ts';
import type { RnDerived, RnStatus } from './derive.ts';
import type { PortalData } from './model.ts';
import { num } from './trace.ts';

/** The room's first "before" photo (client or survey), to pre-fill an item's Before picture. */
function beforePhotoOf(portal: PortalData, roomId: string | null) {
  if (!roomId) return null;
  return portal.photos.find((p) => p.roomId === roomId && p.purpose === 'before') ?? portal.photos.find((p) => p.roomId === roomId && p.purpose === 'survey') ?? null;
}

function withBefore(portal: PortalData, item: PictureSection): PictureSection {
  const ph = beforePhotoOf(portal, item.roomId);
  if (!ph) return item;
  return addImage(item, { role: 'before', fileName: ph.fileName, dataUri: ph.dataUri, widthPx: ph.widthPx, heightPx: ph.heightPx, caption: ph.facing, takenOn: ph.addedOn, metadataStripped: ph.metadataStripped });
}

/**
 * One completion item per Concept section (title, description and links
 * carried over; concept pictures are illustrative and are NOT carried over as
 * evidence), then one per room with scope in the BOQ that no Concept section
 * already covers (its BOQ lines as bullets), then the whole-project items.
 * Each item gets the room's before photo when there is one.
 */
export function createCompletionReport(portal: PortalData, derived: RnDerived, today: string): CompletionReport {
  const line = portal.renovation!;
  const items: PictureSection[] = [];
  const take = (title: string) => newPictureSection(nextFreeId('item', items.map((i) => i.id)), 'actual', title.slice(0, 200));
  const concepts = (line.concepts ?? []).filter(hasContent);
  for (const c of concepts) {
    items.push(withBefore(portal, { ...take(c.title || 'Concept item'), description: c.description, roomId: c.roomId, scopeRef: c.scopeRef, scopeText: c.scopeText, layout: 'two' }));
  }
  const covered = new Set(concepts.map((c) => c.roomId).filter((x): x is string => !!x));
  // Rooms first, in the survey's order; the whole-project items (preliminaries, cleaning) last.
  const groups = [...(derived.boq?.byRoom ?? [])].sort((a, b) => Number(a.id === 'project') - Number(b.id === 'project'));
  for (const g of groups) {
    const roomId = g.id === 'project' ? null : g.id;
    if (roomId && covered.has(roomId)) continue;
    const bullets = g.lines.map((l) => `- ${l.description} — ${num(l.quantity.value)} ${l.unit}`).join('\n');
    const title = roomId ? `${g.label} — works` : 'General works (whole project)';
    items.push(
      withBefore(portal, {
        ...take(title),
        description: bullets.slice(0, 6000),
        roomId,
        scopeRef: g.lines.length === 1 ? g.lines[0]!.ref : g.lines.length ? `${g.lines[0]!.ref}–${g.lines[g.lines.length - 1]!.ref}`.slice(0, 40) : '',
        scopeText: `${g.lines.length} BOQ item${g.lines.length === 1 ? '' : 's'}`,
        layout: 'two',
      }),
    );
  }
  return {
    createdOn: today,
    source: { proposalStatus: line.proposal.status, proposalRevision: line.proposal.revision },
    summary: '',
    items,
    state: { status: 'draft', finalisedOn: null, revision: '', preparedBy: null },
  };
}

export interface CompletionBlocker {
  readonly text: string;
  readonly itemId?: string;
}

/** What blocks issuing the completion report as Final (names are checked by the screen, as for the proposal). */
export function completionBlockers(report: CompletionReport): CompletionBlocker[] {
  const out: CompletionBlocker[] = [];
  if (report.items.length === 0) out.push({ text: 'The report has no items.' });
  for (const it of report.items) {
    const name = it.title.trim() || 'Untitled item';
    if (it.status === 'proposed' || it.status === 'in-progress') out.push({ text: `${name}: still ${it.status === 'proposed' ? 'proposed' : 'in progress'} — mark it done, or snag if work is outstanding.`, itemId: it.id });
    if (it.status === 'done' && !it.images.some((im) => im.role === 'after')) out.push({ text: `${name}: done but has no After photo.`, itemId: it.id });
    if (it.status === 'done' && !it.doneOn) out.push({ text: `${name}: done but the completion date is not set.`, itemId: it.id });
  }
  return out;
}

export function completionStatus(report: CompletionReport | undefined): RnStatus {
  if (!report) return { kind: 'not-started', text: 'Not created' };
  if (report.state.status === 'final') return { kind: 'complete', text: `Final${report.state.revision ? ` Rev ${report.state.revision}` : ''}` };
  const c = statusCounts(report.items);
  const n = report.items.length;
  if (c.snag > 0) return { kind: 'attention', text: `${c.done} of ${n} done · ${c.snag} snag${c.snag === 1 ? '' : 's'}` };
  return { kind: c.done === n && n > 0 ? 'complete' : 'in-progress', text: `${c.done} of ${n} done` };
}

export interface CompletionModel {
  readonly final: boolean;
  readonly revision: string;
  readonly date: string;
  readonly projectName: string;
  readonly clientName: string;
  readonly clientContact: string;
  readonly site: string;
  readonly preparedBy: EngineerProfile;
  readonly lang: 'en' | 'ar';
  readonly summary: string;
  readonly facts: readonly { readonly label: string; readonly value: string }[];
  readonly done: readonly PictureSection[];
  readonly snags: readonly PictureSection[];
  readonly open: readonly PictureSection[];
  readonly roomName: (id: string | null) => string;
  readonly hero: { readonly src: string; readonly caption: string } | null;
}

export function buildCompletionModel(portal: PortalData, opts: { projectName: string; clientName: string; clientContact: string; profile: EngineerProfile; today: string }): CompletionModel {
  const line = portal.renovation!;
  const r = line.completion!;
  const final = r.state.status === 'final';
  const date = final && r.state.finalisedOn ? r.state.finalisedOn : opts.today;
  const done = r.items.filter((i) => i.status === 'done');
  const snags = r.items.filter((i) => i.status === 'snag');
  const open = r.items.filter((i) => i.status === 'proposed' || i.status === 'in-progress');
  const dates = done.map((i) => i.doneOn).filter((x): x is string => !!x).sort();
  const crews = [...new Set(r.items.map((i) => i.doneBy.trim()).filter(Boolean))];
  const roomName = (id: string | null) => (id ? (portal.rooms.find((x) => x.id === id)?.name ?? '') : '');
  const heroItem = done.find((i) => i.images.some((im) => im.role === 'after'));
  const heroImg = heroItem?.images.find((im) => im.role === 'after');
  const proposalRef = `${r.source.proposalStatus === 'final' ? 'Final' : 'Draft'} proposal${r.source.proposalRevision ? `, revision ${r.source.proposalRevision}` : ''}`;
  return {
    final,
    revision: r.state.revision,
    date,
    projectName: opts.projectName,
    clientName: opts.clientName,
    clientContact: opts.clientContact,
    site: [portal.site.name, portal.site.address, portal.site.city].filter((x) => x.trim()).join(', '),
    preparedBy: final && r.state.preparedBy ? r.state.preparedBy : opts.profile,
    lang: line.settings.proposalLanguage,
    summary: r.summary.trim(),
    facts: [
      { label: 'Items completed', value: `${done.length} of ${r.items.length}` },
      { label: 'Outstanding snags', value: String(snags.length) },
      { label: 'Works carried out', value: dates.length ? (dates[0] === dates[dates.length - 1] ? dates[0]! : `${dates[0]} to ${dates[dates.length - 1]}`) : '—' },
      { label: 'Based on', value: proposalRef },
      ...(crews.length ? [{ label: 'Work by', value: crews.join(', ') }] : []),
    ],
    done,
    snags,
    open,
    roomName,
    hero: heroItem && heroImg ? { src: heroImg.dataUri, caption: heroItem.title } : null,
  };
}
