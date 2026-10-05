/**
 * The whole-project design pass: every location's camera recommendation, then
 * the recorder, storage, PoE switching and cabling built on top of them.
 */

import type { Project } from '../domain/types.ts';
import { recommend, type RecommendationResult } from './recommend.ts';

/** Phase-1 recommendation per location id. */
export function recommendAll(project: Pick<Project, 'locations'>): ReadonlyMap<string, RecommendationResult> {
  return new Map(project.locations.map((l) => [l.id, recommend(l)]));
}
