/**
 * Search / jump (Ctrl K or ⌘ K): sections, locations and placed devices by
 * name. Typing filters; ↑ ↓ move; Enter goes there. Built on the shared modal
 * dialog, so focus is trapped and returns on close.
 */

import { useMemo, useState, type KeyboardEvent } from 'react';

import type { SiteMapView } from '../../engine/siteMapView.ts';
import type { Project } from '../../state/projectTypes.ts';
import { Icon, type IconName } from '../icons.tsx';
import { Dialog } from '../primitives.tsx';
import { SECTIONS, SETTINGS_SECTION, type SectionId } from './sections.ts';

export type JumpTarget =
  | { readonly kind: 'section'; readonly id: SectionId }
  | { readonly kind: 'location'; readonly id: string }
  | { readonly kind: 'device'; readonly id: string };

interface Entry {
  readonly key: string;
  readonly label: string;
  readonly hint: string;
  readonly icon: IconName;
  readonly target: JumpTarget;
}

export function JumpPalette({
  open,
  onClose,
  project,
  mapView,
  onJump,
}: {
  open: boolean;
  onClose: () => void;
  project: Project;
  mapView: SiteMapView;
  onJump: (t: JumpTarget) => void;
}) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);

  const entries = useMemo<Entry[]>(
    () => [
      ...[...SECTIONS, SETTINGS_SECTION].map((s) => ({ key: `s-${s.id}`, label: s.label, hint: 'Section', icon: s.icon, target: { kind: 'section' as const, id: s.id } })),
      ...project.locations.map((l) => ({
        key: `l-${l.id}`,
        label: l.name,
        hint: `Location · ${l.requirements.cameraCount} camera${l.requirements.cameraCount === 1 ? '' : 's'}`,
        icon: 'camera' as const,
        target: { kind: 'location' as const, id: l.id },
      })),
      ...mapView.devices.map((d) => ({
        key: `d-${d.device.id}`,
        label: d.label,
        hint: `On the site map · ${d.device.kind === 'nvr' ? 'NVR / rack' : d.device.kind}`,
        icon: d.device.kind === 'camera' ? ('pin' as const) : d.device.kind === 'nvr' ? ('recorder' as const) : ('network' as const),
        target: { kind: 'device' as const, id: d.device.id },
      })),
    ],
    [project.locations, mapView.devices],
  );

  const q = query.trim().toLowerCase();
  const matches = q ? entries.filter((e) => e.label.toLowerCase().includes(q) || e.hint.toLowerCase().includes(q)) : entries;
  const active = Math.min(index, Math.max(0, matches.length - 1));

  const close = () => {
    setQuery('');
    setIndex(0);
    onClose();
  };
  const go = (e: Entry | undefined) => {
    if (!e) return;
    close();
    onJump(e.target);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(matches[active]);
    }
  };

  return (
    <Dialog title="Jump to" open={open} onClose={close}>
      <label className="sr-only" htmlFor="jump-query">
        Search sections, locations and devices
      </label>
      <div className="flex items-center gap-2 rounded-control border border-[var(--color-border-strong)] px-2.5 focus-within:border-[var(--color-brand)]">
        <Icon name="search" size={16} />
        <input
          id="jump-query"
          data-autofocus
          type="search"
          autoComplete="off"
          role="combobox"
          aria-expanded="true"
          aria-controls="jump-results"
          aria-activedescendant={matches[active] ? `jump-${matches[active].key}` : undefined}
          placeholder="Type a location, a device or a section…"
          className="w-full bg-transparent py-2 text-sm text-[var(--color-ink)] outline-none"
          value={query}
          onChange={(e) => {
            setQuery(e.currentTarget.value);
            setIndex(0);
          }}
          onKeyDown={onKey}
        />
      </div>
      <ul id="jump-results" role="listbox" aria-label="Matches" className="mt-2 grid max-h-80 gap-0.5 overflow-y-auto">
        {matches.length === 0 && <li className="px-2 py-3 text-sm text-[var(--color-ink-3)]">Nothing matches “{query}”.</li>}
        {matches.map((m, i) => (
          <li
            key={m.key}
            id={`jump-${m.key}`}
            role="option"
            aria-selected={i === active}
            onClick={() => go(m)}
            onMouseMove={() => setIndex(i)}
            className={`flex cursor-pointer items-center gap-2.5 rounded-control px-2 py-2 text-sm ${i === active ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]' : 'text-[var(--color-ink)]'}`}
          >
            <Icon name={m.icon} size={16} />
            <span className="min-w-0 flex-1 truncate font-medium">{m.label}</span>
            <span className="shrink-0 text-xs text-[var(--color-ink-3)]">{m.hint}</span>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
