/**
 * The client's indicative summary, in plain language: "8 cameras, a
 * 16-channel recorder, sized for about 30 days of recordings".
 *
 * Built on the same engine as everything else: the answers are mapped
 * (`intakeToProject`) and designed by `buildBillOfMaterials`. Nothing here
 * calculates a figure; it only reads the BOM and puts it into words. It is
 * labelled preliminary wherever it is shown.
 */

import { buildBillOfMaterials } from '../engine/billOfMaterials.ts';
import { intakeToProject, RETENTION_OPTIONS } from './intakeMapping.ts';
import type { ClientAnswers } from './intakeTypes.ts';

export interface IndicativeSummary {
  /** Cameras the client asked for. */
  readonly camerasRequested: number;
  /** Cameras the design could match a model to. */
  readonly camerasDesigned: number;
  readonly recorderChannels: number | null;
  readonly retentionDays: number;
  readonly switches: number;
  /** Areas no camera could be matched to yet, by name. */
  readonly unmatchedAreas: readonly string[];
  /** Set when no recorder in the range matches every answer yet, in plain words. */
  readonly recorderNote: string | null;
  /** The one-line summary. */
  readonly sentence: string;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function indicativeSummary(answers: ClientAnswers): IndicativeSummary | null {
  if (answers.areas.length === 0) return null;
  const { project } = intakeToProject(answers);
  const bom = buildBillOfMaterials(project);
  const recorder = bom.design.nvr?.primary?.evaluation.nvr ?? null;
  const camerasRequested = answers.areas.reduce((n, a) => n + a.cameraCount, 0);
  const retentionDays = RETENTION_OPTIONS[answers.recording.retention].days;
  const parts = [plural(camerasRequested, 'camera')];
  parts.push(recorder ? `a ${recorder.channels}-channel recorder` : 'a recorder the engineer will choose');
  parts.push(`sized for about ${retentionDays} days of recordings`);
  return {
    camerasRequested,
    camerasDesigned: bom.totals.cameras,
    recorderChannels: recorder?.channels ?? null,
    retentionDays,
    switches: bom.totals.switches,
    unmatchedAreas: bom.design.unresolvedLocations,
    recorderNote:
      recorder || camerasRequested === 0 || bom.totals.cameras === 0
        ? null
        : answers.recording.recorderPlace === 'cabinet' && answers.recording.cabinetSpace !== 'any'
          ? 'None of our recorders matches every answer yet — the cabinet size you chose may be one reason. The engineer will suggest the best fit.'
          : 'None of our recorders matches every answer yet. The engineer will suggest the best fit.',
    sentence: parts.join(', '),
  };
}
