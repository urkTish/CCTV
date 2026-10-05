/**
 * Save / Open project (M6), and the shareable link. The file carries
 * everything, including the site map and the project's extras (client, prices,
 * report state, intake marks); the link carries every location and design
 * setting but not those. *Open project* also opens a client's intake file.
 */

import { useState } from 'react';

import { PROJECT_FILE_MIME, projectFileName } from '../state/projectFile.ts';
import type { Project, UnitSystemState } from '../state/projectTypes.ts';
import { serializeWorkspace, type ProjectExtras } from '../state/workspace.ts';
import { downloadText, readFileAsText } from './fileIo.ts';
import { Button } from './primitives.tsx';
import { buttonClass } from './uiStyles.ts';
import { Icon } from './icons.tsx';

export const URL_EXCLUDES_MAP_NOTICE =
  'The shareable link carries every location and design setting but not the site map (the plan image is too big for a link), the client details, prices, report state or intake marks. Use Save project to keep or send all of it.';

export type OpenOutcome = { readonly ok: true; readonly message: string } | { readonly ok: false; readonly message: string };

export function ProjectFileBar({
  project,
  units,
  extras,
  autosaveStatus,
  onOpenText,
  onCopyLink,
  copied,
}: {
  project: Project;
  units: UnitSystemState;
  extras: ProjectExtras;
  autosaveStatus: string;
  /** Open a file's text (a project, a workspace or a client intake). */
  onOpenText: (text: string, fileName: string) => OpenOutcome;
  onCopyLink: () => void;
  copied: boolean;
}) {
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);

  const save = () => {
    const name = projectFileName(project);
    const err = downloadText(name, serializeWorkspace(project, units, extras), PROJECT_FILE_MIME);
    setMessage(err ? { kind: 'error', text: err } : { kind: 'info', text: `Saved as ${name}.` });
  };

  const open = async (file: File | undefined) => {
    if (!file) return;
    try {
      const outcome = onOpenText(await readFileAsText(file), file.name);
      setMessage({ kind: outcome.ok ? 'info' : 'error', text: outcome.message });
    } catch (err) {
      setMessage({ kind: 'error', text: `Could not read ${file.name}: ${err instanceof Error ? err.message : 'unknown error'}.` });
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" icon="download" onClick={save}>
          Save project (.json)
        </Button>
        <label className={`${buttonClass('secondary')} cursor-pointer focus-within:outline-2 focus-within:outline-[var(--color-brand)]`}>
          <Icon name="upload" size={16} />
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
        <Button icon="link" onClick={onCopyLink}>
          {copied ? 'Link copied' : 'Copy shareable link'}
        </Button>
      </div>
      <p className="mt-2 text-xs text-[var(--color-ink-3)]" role="status">
        {autosaveStatus}
      </p>
      <p className="mt-1 text-xs text-[var(--color-ink-3)]">{URL_EXCLUDES_MAP_NOTICE}</p>
      <p className="mt-1 text-xs text-[var(--color-ink-3)]">Open project also opens a client&rsquo;s intake file as a draft project.</p>
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
