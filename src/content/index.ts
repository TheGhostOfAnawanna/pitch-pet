// Pitch Pet — content entry point.
// The JSON files in this folder are the SINGLE SOURCE OF TRUTH for all musical
// content and all lesson data. Authored by Doc; see PITCH-PET-BUILD-LOG.md (D-02,
// D-03, D-04). Do not hand-edit them in the app and do not duplicate their values
// in code — import from here.
//
// D-Q applies: src/solfege.ts owns all pitch maths. This file owns all content.
import pools from './content-pools.v1.json';
import lessonsL1L2 from './lessons-L1-L2.v1.json';
import lessonsL3L4 from './lessons-L3-L4.v1.json';

export const contentPools = pools;
export const asrContract = pools.asr_contract;
export const homophoneMap = pools.homophone_map;
export const solfegePool = pools.solfege;
export const melodies = pools.melodies;
export const rhythms = pools.rhythms;
export const progressions = pools.progressions;
export const anchorSongs = pools.anchor_songs;

/** Runner contract lives on the L1-L2 file; L3-L4 carries only a delta. */
export const runnerContract = lessonsL1L2.runner_contract;

/** All levels 1-4, flattened in order. */
export const levels = [...lessonsL1L2.levels, ...lessonsL3L4.levels];

/** Look up a pool entry by id. Returns undefined rather than throwing — the
 *  caller decides what a missing id means. Never invent an id (see D-02 notes). */
export function melodyById(id: string) {
  return melodies.find((m: { id: string }) => m.id === id);
}
export function rhythmById(id: string) {
  return rhythms.find((r: { id: string }) => r.id === id);
}
export function progressionById(id: string) {
  return progressions.find((p: { id: string }) => p.id === id);
}
