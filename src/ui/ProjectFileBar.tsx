/**
 * Save / Open project (M6). The file carries everything, including the site
 * map; the shareable link carries everything except the map.
 */

import { useState } from 'react';

import { PROJECT_FILE_MIME, parseProjectFile, projectFileName, serializeProjectFile, type OpenedProject } from '../state/projectFile.ts';
import type { Project, UnitSystemState } from '../state/projectTypes.ts';
import { downloadText, readFileAsText } from './fileIo.ts';
import { Button } from './primitives.tsx';

export const URL_EXCLUDES_MAP_NOTICE =
  'The shareable link carries every location and design setting but not the site map (the plan image is too big for a link). Use Save project to keep or send a project with a map.';

export function ProjectFileBar({
  project,
  units,
  autosaveStatus,
  onOpen,
}: {
  project: Project;
  units: UnitSystemState;
  autosaveStatus: string;
  onOpen: (opened: OpenedProject) => void;
}) {
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);

  const save = () => {
    const name = projectFileName(project);
    const err = downloadText(name, serializeProjectFile(project, units), PROJECT_FILE_MIME);
    setMessage(err ? { kind: 'error', text: err } : { kind: 'info', text: `Saved as ${name}.` });
  };

  const open = async (file: File | undefined) => {
    if (!file) return;
    try {
      const result = parseProjectFile(await readFileAsText(file));
      if (!result.ok) {
        setMessage({ kind: 'error', text: `${file.name} was not opened. ${result.reason}` });
        return;
      }
      onOpen(result.opened);
      setMessage({ kind: 'info', text: [`Opened ${file.name}.`, ...result.notices].join(' ') });
    } catch (err) {
      setMessage({ kind: 'error', text: `Could not read ${file.name}: ${err instanceof Error ? err.message : 'unknown error'}.` });
    }
  };

  return (
    <div className="mt-4 border-t border-[var(--color-border)] pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={save}>Save project (.json)</Button>
        <label className="inline-flex cursor-pointer items-center rounded-control border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-1.5 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-2)] focus-within:border-[var(--color-accent)]">
          Open project
          <input
            type="file"
            accept=".json,application/json"
            className="sr-only"
            onChange={(e) => {
              void open(e.currentTarget.files?.[0]);
              e.currentTarget.value = '';
            }}
          />
        </label>
        <span className="text-xs text-[var(--color-ink-3)]" role="status">
          {autosaveStatus}
        </span>
      </div>
      <p className="mt-2 text-xs text-[var(--color-ink-3)]">{URL_EXCLUDES_MAP_NOTICE}</p>
      {message && (
        <p
          role={message.kind === 'error' ? 'alert' : 'status'}
          className="mt-2 text-sm"
          style={{ color: message.kind === 'error' ? 'var(--color-fail)' : 'var(--color-ink-2)' }}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
