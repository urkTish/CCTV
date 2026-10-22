/**
 * The picture-section editor (Admin). One card per section, in the order it
 * prints: title, then the pictures, then the description and the optional
 * links. Sections are added, reordered (drag by the handle, or the up / down
 * buttons for the keyboard), duplicated and deleted (with Undo rather than a
 * confirmation). Pictures come from the upload button or a drop onto the
 * card's drop area; each is stripped of its location and camera metadata and
 * compressed on import (photos.ts), and kept in the project file.
 *
 * Line-agnostic: the caller passes the rooms and the scope lines that may be
 * linked, so civil and maintenance can reuse it as is.
 */

import { useId, useRef, useState, type DragEvent, type ReactNode } from 'react';

import { preparePhoto, PHOTO_ACCEPT } from '../../renovation/photos.ts';
import { Check, Select, Text } from '../../renovation/ui/kit.tsx';
import { readFileAsBytes } from '../../ui/fileIo.ts';
import { Icon, type IconName } from '../../ui/icons.tsx';
import { Button, EmptyState, Notice } from '../../ui/primitives.tsx';
import {
  addImage,
  addSection,
  doneDateFor,
  duplicateSection,
  exifDateTaken,
  IMAGE_ROLE_LABEL,
  IMAGE_ROLES,
  imageLabel,
  MAX_SECTION_IMAGES,
  MAX_SECTIONS,
  moveSection,
  removeSection,
  SECTION_LAYOUT_LABEL,
  SECTION_LAYOUTS,
  SECTION_STATUS_LABEL,
  SECTION_STATUSES,
  toggleBullets,
  updateSection,
  type ImageRole,
  type PictureSection,
  type SectionKind,
  type SectionStatus,
} from '../pictureSection.ts';

export type SectionsUpdate = (fn: (list: PictureSection[]) => PictureSection[]) => void;

export interface PictureSectionEditorProps {
  readonly sections: readonly PictureSection[];
  readonly onChange: SectionsUpdate;
  readonly kind: SectionKind;
  /** "concept section" / "item": used in labels and messages. */
  readonly noun: string;
  readonly rooms: readonly { readonly id: string; readonly name: string }[];
  readonly scopeOptions: readonly { readonly ref: string; readonly text: string }[];
  readonly lang: 'en' | 'ar';
  readonly today: string;
  /** Extra controls in the toolbar (e.g. "Recreate from proposal"). */
  readonly toolbar?: ReactNode;
  /** Shown when there are no sections, above the Add button. */
  readonly emptyText?: ReactNode;
}

const SECTION_MIME = 'application/x-contractech-picture-section';
const iconBtn =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-control text-[var(--color-ink-2)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-9 sm:min-w-9';

function IconButton({ icon, label, onClick, disabled, danger }: { icon: IconName; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button type="button" className={`${iconBtn} ${danger ? 'hover:text-[var(--color-fail)]' : ''}`} aria-label={label} title={label} onClick={onClick} disabled={disabled}>
      <Icon name={icon} size={18} />
    </button>
  );
}

function fileDate(f: File): string | null {
  if (!f.lastModified) return null;
  const d = new Date(f.lastModified);
  if (Number.isNaN(d.getTime())) return null;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function PictureSectionEditor({ sections, onChange, kind, noun, rooms, scopeOptions, lang, today, toolbar, emptyText }: PictureSectionEditorProps) {
  const [announce, setAnnounce] = useState('');
  const [deleted, setDeleted] = useState<{ section: PictureSection; index: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const Noun = noun.charAt(0).toUpperCase() + noun.slice(1);

  const focusSection = (id: string, selector = '[data-title-input]') => {
    window.setTimeout(() => cardRefs.current.get(id)?.querySelector<HTMLElement>(selector)?.focus(), 0);
  };

  const add = () => {
    if (sections.length >= MAX_SECTIONS) {
      setError(`At most ${MAX_SECTIONS} ${noun}s.`);
      return;
    }
    const r = addSection(sections, kind);
    onChange(() => r.list);
    setAnnounce(`${Noun} ${r.list.length} added.`);
    focusSection(r.id);
  };

  const move = (from: number, to: number, focusSelector?: string) => {
    if (to < 0 || to >= sections.length || from === to) return;
    const s = sections[from]!;
    onChange((list) => moveSection(list, from, to));
    setAnnounce(`Moved “${s.title || `${Noun} ${from + 1}`}” to position ${to + 1} of ${sections.length}.`);
    if (focusSelector) focusSection(s.id, focusSelector);
  };

  const duplicate = (id: string) => {
    const r = duplicateSection(sections, id);
    if (!r.id) return;
    onChange(() => r.list);
    setAnnounce(`${Noun} duplicated.`);
    focusSection(r.id);
  };

  const remove = (id: string) => {
    const index = sections.findIndex((s) => s.id === id);
    const section = sections[index];
    if (!section) return;
    onChange((list) => removeSection(list, id));
    setDeleted({ section, index });
    setAnnounce(`${Noun} “${section.title || 'untitled'}” deleted. Undo is available.`);
  };

  const undo = () => {
    if (!deleted) return;
    const { section, index } = deleted;
    onChange((list) => {
      const out = [...list];
      out.splice(Math.min(index, out.length), 0, section);
      return out;
    });
    setDeleted(null);
    setAnnounce(`${Noun} “${section.title || 'untitled'}” restored.`);
    focusSection(section.id);
  };

  const importFiles = async (sectionId: string, files: readonly File[]) => {
    setError(null);
    const target = sections.find((s) => s.id === sectionId);
    if (!target) return;
    const room = MAX_SECTION_IMAGES - target.images.length;
    if (room <= 0) {
      setError(`A ${noun} holds at most ${MAX_SECTION_IMAGES} pictures.`);
      return;
    }
    const errors: string[] = [];
    let added = 0;
    for (const f of files.slice(0, room)) {
      try {
        const bytes = await readFileAsBytes(f);
        const takenOn = kind === 'actual' ? (exifDateTaken(bytes) ?? fileDate(f) ?? today) : null;
        const r = await preparePhoto(f.name, bytes);
        if (!r.ok) {
          errors.push(r.reason);
          continue;
        }
        const p = r.photo;
        onChange((list) =>
          updateSection(list, sectionId, (s) => addImage(s, { fileName: f.name.slice(0, 200), dataUri: p.dataUri, widthPx: p.widthPx, heightPx: p.heightPx, caption: '', takenOn, metadataStripped: p.metadataStripped })),
        );
        added += 1;
      } catch (e) {
        errors.push(`${f.name} could not be read (${e instanceof Error ? e.message : 'unknown error'}).`);
      }
    }
    if (files.length > room) errors.push(`Only ${room} more picture${room === 1 ? '' : 's'} fit in this ${noun} (at most ${MAX_SECTION_IMAGES}).`);
    if (errors.length) setError(errors.join(' '));
    if (added) setAnnounce(`${added} picture${added === 1 ? '' : 's'} added; location data removed.`);
  };

  const onCardDragOver = (e: DragEvent<HTMLElement>, index: number) => {
    if (dragFrom === null || !e.dataTransfer.types.includes(SECTION_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOver !== index) setDragOver(index);
  };
  const onCardDrop = (e: DragEvent<HTMLElement>, index: number) => {
    if (dragFrom === null || !e.dataTransfer.types.includes(SECTION_MIME)) return;
    e.preventDefault();
    move(dragFrom, index);
    setDragFrom(null);
    setDragOver(null);
  };

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" icon="plus" onClick={add}>
          Add {noun}
        </Button>
        {toolbar}
        <span className="text-sm text-[var(--color-ink-3)]">
          {sections.length} {noun}
          {sections.length === 1 ? '' : 's'}
          {sections.length > 1 && ' · reorder by dragging the handle, with the arrows, or Alt + ↑ / ↓'}
        </span>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>
      {deleted && (
        <Notice
          kind="info"
          title={`${Noun} “${deleted.section.title || 'untitled'}” deleted`}
          actions={
            <>
              <Button size="sm" icon="undo" onClick={undo}>
                Undo
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDeleted(null)}>
                Dismiss
              </Button>
            </>
          }
        />
      )}
      {error && (
        <Notice kind="error" role="alert" actions={<Button size="sm" variant="ghost" onClick={() => setError(null)}>Dismiss</Button>}>
          {error}
        </Notice>
      )}
      {sections.length === 0 ? (
        <EmptyState icon="image" title={`No ${noun}s yet`} action={<Button icon="plus" onClick={add}>Add the first {noun}</Button>}>
          {emptyText}
        </EmptyState>
      ) : (
        <ol className="grid gap-3" aria-label={`${Noun}s`}>
          {sections.map((s, i) => (
            <li
              key={s.id}
              ref={(el) => {
                if (el) cardRefs.current.set(s.id, el);
                else cardRefs.current.delete(s.id);
              }}
              onDragOver={(e) => onCardDragOver(e, i)}
              onDrop={(e) => onCardDrop(e, i)}
              onDragLeave={() => dragOver === i && setDragOver(null)}
              onKeyDown={(e) => {
                // Alt + ↑ / ↓ anywhere in a card moves it; focus returns to the same field.
                if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
                e.preventDefault();
                const el = e.target instanceof HTMLElement ? e.target : null;
                const sel = el?.id ? `#${CSS.escape(el.id)}` : '[data-title-input]';
                move(i, i + (e.key === 'ArrowUp' ? -1 : 1), sel);
              }}
              className={`min-w-0 rounded-card border bg-[var(--color-surface)] shadow-[var(--shadow-card)] transition-colors ${
                dragOver === i && dragFrom !== i ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent-soft)]' : 'border-[var(--color-border)]'
              } ${dragFrom === i ? 'opacity-60' : ''}`}
              aria-label={`${Noun} ${i + 1}: ${s.title || 'untitled'}`}
            >
              <SectionCard
                section={s}
                index={i}
                count={sections.length}
                kind={kind}
                noun={Noun}
                rooms={rooms}
                scopeOptions={scopeOptions}
                lang={lang}
                today={today}
                onChange={(fn) => onChange((list) => updateSection(list, s.id, fn))}
                onMove={(to, sel) => move(i, to, sel)}
                onDuplicate={() => duplicate(s.id)}
                onDelete={() => remove(s.id)}
                onFiles={(files) => void importFiles(s.id, files)}
                onDragStart={(e) => {
                  e.dataTransfer.setData(SECTION_MIME, s.id);
                  e.dataTransfer.effectAllowed = 'move';
                  setDragFrom(i);
                }}
                onDragEnd={() => {
                  setDragFrom(null);
                  setDragOver(null);
                }}
              />
            </li>
          ))}
        </ol>
      )}
      {sections.length > 2 && (
        <div>
          <Button icon="plus" onClick={add}>
            Add {noun}
          </Button>
        </div>
      )}
    </div>
  );
}

function SectionCard({
  section: s,
  index,
  count,
  kind,
  noun,
  rooms,
  scopeOptions,
  lang,
  today,
  onChange,
  onMove,
  onDuplicate,
  onDelete,
  onFiles,
  onDragStart,
  onDragEnd,
}: {
  section: PictureSection;
  index: number;
  count: number;
  kind: SectionKind;
  noun: string;
  rooms: PictureSectionEditorProps['rooms'];
  scopeOptions: PictureSectionEditorProps['scopeOptions'];
  lang: 'en' | 'ar';
  today: string;
  onChange: (fn: (s: PictureSection) => PictureSection) => void;
  onMove: (to: number, focusSelector?: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onFiles: (files: File[]) => void;
  onDragStart: (e: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
}) {
  const n = index + 1;
  const titleId = useId();
  const descId = useId();
  const fileId = useId();
  const descRef = useRef<HTMLTextAreaElement | null>(null);
  const [dropping, setDropping] = useState(false);
  const full = s.images.length >= MAX_SECTION_IMAGES;
  const set = (patch: Partial<PictureSection>) => onChange((x) => ({ ...x, ...patch }));
  const scopeValue = scopeOptions.some((o) => o.ref === s.scopeRef) ? s.scopeRef : '';
  const isFiles = (e: DragEvent<HTMLElement>) => e.dataTransfer.types.includes('Files');

  return (
    <div>
      {/* Header: handle, number, title (the first thing that prints), status, actions */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-[var(--color-border)] px-2 py-2 sm:px-3">
        <span
          draggable
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          className="hidden cursor-grab items-center self-stretch rounded-control px-1 text-[var(--color-ink-3)] hover:bg-[var(--color-surface-2)] active:cursor-grabbing sm:inline-flex"
          title="Drag to reorder"
          aria-hidden="true"
        >
          <Icon name="grip" size={18} />
        </span>
        <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:flex-1">
          <span className="inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-control border border-[var(--color-accent)] px-1.5 font-mono text-xs font-bold text-[var(--color-accent)]">{n}</span>
          <label htmlFor={titleId} className="sr-only">
            Title of {noun.toLowerCase()} {n}
          </label>
          <input
            id={titleId}
            data-title-input
            dir="auto"
            value={s.title}
            maxLength={200}
            placeholder={kind === 'concept' ? 'Title, e.g. “Living room — feature wall”' : 'Title of the completed item'}
            onChange={(e) => set({ title: e.currentTarget.value.slice(0, 200) })}
            className="min-w-0 flex-1 rounded-control border border-[var(--color-border)] bg-transparent px-2 py-1.5 text-base font-semibold text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:outline-none sm:border-transparent sm:hover:border-[var(--color-border)]"
          />
        </div>
        <div className="w-36 shrink-0">
          <Select<SectionStatus> label={`Status of ${noun.toLowerCase()} ${n}`} hideLabel value={s.status} options={SECTION_STATUSES.map((v) => ({ value: v, label: SECTION_STATUS_LABEL[v] }))} onChange={(v) => set({ status: v, doneOn: v === 'done' && !s.doneOn ? doneDateFor(s, today) : s.doneOn })} />
        </div>
        <div className="ms-auto flex items-center">
          <span data-move-up>
            <IconButton icon="arrow-up" label={`Move ${noun.toLowerCase()} ${n} up`} disabled={index === 0} onClick={() => onMove(index - 1, index - 1 === 0 ? '[data-move-down] button' : '[data-move-up] button')} />
          </span>
          <span data-move-down>
            <IconButton icon="arrow-down" label={`Move ${noun.toLowerCase()} ${n} down`} disabled={index === count - 1} onClick={() => onMove(index + 1, index + 1 === count - 1 ? '[data-move-up] button' : '[data-move-down] button')} />
          </span>
          <IconButton icon="copy" label={`Duplicate ${noun.toLowerCase()} ${n}`} onClick={onDuplicate} />
          <IconButton icon="trash" label={`Delete ${noun.toLowerCase()} ${n}`} danger onClick={onDelete} />
        </div>
      </div>

      <div className="grid gap-4 p-3 @3xl/section:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] sm:p-4">
        {/* Pictures */}
        <div className="grid content-start gap-2">
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-48">
              <Select
                label="Layout"
                value={s.layout}
                options={SECTION_LAYOUTS.map((v) => ({ value: v, label: SECTION_LAYOUT_LABEL[v] }))}
                onChange={(v) =>
                  onChange((x) => ({
                    ...x,
                    layout: v,
                    // A before/after pair needs roles on its first two pictures.
                    images: v === 'pair' ? x.images.map((im, k) => (im.role === 'main' ? { ...im, role: k === 0 ? 'before' : 'after' } : im)) : x.images,
                  }))
                }
              />
            </div>
            <span className="pb-1.5 text-xs text-[var(--color-ink-3)]">
              {s.images.length} of {MAX_SECTION_IMAGES} pictures
            </span>
          </div>
          {s.images.length > 0 && (
            <ul className={`grid gap-2 ${s.layout === 'one' ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`} aria-label={`Pictures in ${noun.toLowerCase()} ${n}`}>
              {s.images.map((im, k) => (
                <li key={im.id} className="min-w-0 rounded-control border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2">
                  <div className="relative overflow-hidden rounded-control bg-[var(--color-surface-3)]">
                    <img src={im.dataUri} alt={im.caption || `${noun} ${n}, picture ${k + 1}`} className={`mx-auto block w-full object-contain ${s.layout === 'one' ? 'max-h-80' : 'h-40'}`} />
                    <span className="absolute start-1.5 bottom-1.5 max-w-[90%] truncate rounded bg-[rgb(16_21_28/0.72)] px-1.5 py-0.5 text-2xs font-semibold text-white">{imageLabel(kind, im, lang)}</span>
                    {im.role !== 'main' && <span className="absolute start-1.5 top-1.5 rounded bg-[var(--color-surface)] px-1.5 py-0.5 text-2xs font-bold text-[var(--color-ink)]">{IMAGE_ROLE_LABEL[im.role]}</span>}
                  </div>
                  <div className="mt-2 grid gap-2">
                    <Text label={`Caption, picture ${k + 1}`} value={im.caption} max={300} placeholder="Optional" onChange={(v) => onChange((x) => ({ ...x, images: x.images.map((y) => (y.id === im.id ? { ...y, caption: v } : y)) }))} />
                    {(kind === 'actual' || s.layout === 'pair') && (
                      <div className="grid grid-cols-2 gap-2">
                        <Select<ImageRole>
                          label="Shows"
                          value={im.role}
                          options={IMAGE_ROLES.filter((r) => r !== 'main' || kind === 'concept').map((r) => ({ value: r, label: IMAGE_ROLE_LABEL[r] }))}
                          onChange={(v) => onChange((x) => ({ ...x, images: x.images.map((y) => (y.id === im.id ? { ...y, role: v } : y)) }))}
                        />
                        {kind === 'actual' && <DateInput label="Date taken" value={im.takenOn} onChange={(v) => onChange((x) => ({ ...x, images: x.images.map((y) => (y.id === im.id ? { ...y, takenOn: v } : y)) }))} />}
                      </div>
                    )}
                    <div>
                      <Button size="sm" variant="ghost" icon="trash" ariaLabel={`Remove picture ${k + 1} from ${noun.toLowerCase()} ${n}`} onClick={() => onChange((x) => ({ ...x, images: x.images.filter((y) => y.id !== im.id) }))}>
                        Remove
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {!full && (
            <div
              onDragOver={(e) => {
                if (!isFiles(e)) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                setDropping(true);
              }}
              onDragLeave={() => setDropping(false)}
              onDrop={(e) => {
                if (!isFiles(e)) return;
                e.preventDefault();
                e.stopPropagation();
                setDropping(false);
                onFiles([...e.dataTransfer.files]);
              }}
              className={`flex flex-col items-center justify-center gap-2 rounded-control border-2 border-dashed px-3 text-center transition-colors ${s.images.length ? 'py-3' : 'py-8'} ${
                dropping ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]' : 'border-[var(--color-border-strong)] bg-[var(--color-surface-2)]'
              }`}
            >
              <Icon name="image" size={s.images.length ? 20 : 28} className="text-[var(--color-ink-3)]" />
              <p className="text-sm text-[var(--color-ink-2)]">
                <span className="hidden sm:inline">Drop {kind === 'concept' ? 'a photo, drawing or render' : 'photos'} here, or </span>
                <label htmlFor={fileId} className="cursor-pointer font-semibold text-[var(--color-accent)] underline-offset-2 hover:underline">
                  {s.images.length ? 'add more pictures' : 'upload pictures'}
                </label>
              </p>
              <p className="text-xs text-[var(--color-ink-3)]">JPEG or PNG · location data is removed and large pictures are reduced{kind === 'actual' ? ' · the date taken is kept' : ''}</p>
              <input
                id={fileId}
                type="file"
                accept={PHOTO_ACCEPT}
                multiple
                className="sr-only"
                aria-label={`Add pictures to ${noun.toLowerCase()} ${n}`}
                onChange={(e) => {
                  const files = [...(e.currentTarget.files ?? [])];
                  e.currentTarget.value = '';
                  if (files.length) onFiles(files);
                }}
              />
            </div>
          )}
        </div>

        {/* Description and links */}
        <div className="grid content-start gap-3">
          <div>
            <div className="flex items-end justify-between gap-2">
              <label htmlFor={descId} className="block text-xs font-medium text-[var(--color-ink-2)]">
                Description
              </label>
              <Button
                size="sm"
                variant="ghost"
                icon="list"
                ariaLabel={`Bullet list in ${noun.toLowerCase()} ${n}`}
                onClick={() => {
                  const el = descRef.current;
                  const r = toggleBullets(s.description, el?.selectionStart ?? s.description.length, el?.selectionEnd ?? s.description.length);
                  set({ description: r.text.slice(0, 6000) });
                  window.setTimeout(() => {
                    el?.focus();
                    el?.setSelectionRange(r.start, r.end);
                  }, 0);
                }}
              >
                Bullets
              </Button>
            </div>
            <textarea
              id={descId}
              ref={descRef}
              dir="auto"
              rows={6}
              value={s.description}
              maxLength={6000}
              onChange={(e) => set({ description: e.currentTarget.value.slice(0, 6000) })}
              className="mt-0.5 w-full rounded-control border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2 py-1.5 text-sm text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:outline-none"
              aria-describedby={`${descId}-help`}
            />
            <p id={`${descId}-help`} className="mt-0.5 text-xs text-[var(--color-ink-3)]">
              A blank line starts a new paragraph; a line starting with “- ” is a bullet.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Select
              label="Room or area"
              value={s.roomId ?? ''}
              options={[{ value: '', label: 'Not linked' }, ...rooms.map((r) => ({ value: r.id, label: r.name || r.id }))]}
              onChange={(v) => set({ roomId: v || null })}
            />
            <Select
              label="BOQ item or scope line"
              value={scopeValue}
              options={[{ value: '', label: s.scopeRef && !scopeValue ? `${s.scopeRef} (kept)` : 'Not linked' }, ...scopeOptions.map((o) => ({ value: o.ref, label: `${o.ref} — ${o.text}`.slice(0, 90) }))]}
              onChange={(v) => {
                const o = scopeOptions.find((x) => x.ref === v);
                set(o ? { scopeRef: o.ref.slice(0, 40), scopeText: o.text.slice(0, 300) } : { scopeRef: '', scopeText: '' });
              }}
            />
          </div>
          {(s.scopeRef || s.scopeText) && <Text label="Scope line as printed" value={s.scopeText} max={300} onChange={(v) => set({ scopeText: v })} />}
          {kind === 'actual' && (
            <div className="grid gap-2 rounded-control border border-[var(--color-border)] p-2.5">
              <div className="grid gap-2 sm:grid-cols-2">
                <DateInput label="Completed on" value={s.doneOn} onChange={(v) => set({ doneOn: v })} />
                <Text label="Work done by" value={s.doneBy} max={160} placeholder="Crew, trade or subcontractor" onChange={(v) => set({ doneBy: v })} />
              </div>
              <Check label="Print a client sign-off line under this item" checked={s.signOff} onChange={(v) => set({ signOff: v })} />
              {s.status !== 'done' && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" icon="check" onClick={() => set({ status: 'done', doneOn: s.doneOn ?? doneDateFor(s, today) })}>
                    Mark done
                  </Button>
                  {s.status !== 'snag' && (
                    <Button size="sm" variant="ghost" icon="alert" onClick={() => set({ status: 'snag' })}>
                      Mark as snag
                    </Button>
                  )}
                </div>
              )}
              {s.status === 'done' && !s.images.some((im) => im.role === 'after') && <p className="text-xs font-medium text-[var(--color-marginal)]">Add an After photo as evidence before issuing the report as Final.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DateInput({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void }) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-xs font-medium text-[var(--color-ink-2)]">
        {label}
      </label>
      <input
        id={id}
        type="date"
        value={value ?? ''}
        onChange={(e) => {
          const v = e.currentTarget.value;
          onChange(/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
        }}
        className="mt-0.5 w-full rounded-control border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2 py-1.5 text-sm text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:outline-none"
      />
    </div>
  );
}
