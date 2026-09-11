/**
 * solfege.ts — REFERENCE IMPLEMENTATION of the pitch→solfège contract.
 *
 * Authored by Doc, 2026-09-11. This is the canonical implementation of build-log
 * decisions D-K (degree mapping) and D-L (cents). Do not re-derive it by hand.
 *
 * The contract lives in the CONTENT POOL, not in this file:
 *   pitch-pet-content-pools-v1.json → solfege.degrees        (semitones_from_do)
 *   pitch-pet-content-pools-v1.json → solfege.tolerance_cents (scoring bands)
 * The constants below mirror that pool so the module runs standalone, but
 * `buildDegreeTable(pool.solfege.degrees)` is the intended production path:
 * if the pool changes, the code must follow it, not fight it.
 *
 * THE TWO BUGS THIS FILE EXISTS TO KILL — both shipped, both caught:
 *   1. `semitones % 7`  — semitones are a 12-step unit. Indexing a 7-element
 *      array with them is wrong for every degree except `do`.
 *   2. `semitones % 12` into a 7-element array — "fixes" the modulus and
 *      leaves the array short, so sol/la/ti return `undefined` while the
 *      TypeScript signature still claims `string`. Worse than the original,
 *      because it type-checks.
 * The degree table is SPARSE over 12 pitch classes. 5 of the 12 have no
 * syllable. That sparseness is the whole point; encode it, don't index past it.
 */

export interface SolfegeDegree {
  syllable: string;
  scale_degree: number;
  semitones_from_do: number;
}

export interface ToleranceBands {
  perfect: number;
  good: number;
  close: number;
}

/** Mirrors pitch-pet-content-pools-v1.json → solfege.degrees (movable-do, major). */
export const DEFAULT_DEGREES: readonly SolfegeDegree[] = Object.freeze([
  { syllable: 'do',  scale_degree: 1, semitones_from_do: 0 },
  { syllable: 're',  scale_degree: 2, semitones_from_do: 2 },
  { syllable: 'mi',  scale_degree: 3, semitones_from_do: 4 },
  { syllable: 'fa',  scale_degree: 4, semitones_from_do: 5 },
  { syllable: 'sol', scale_degree: 5, semitones_from_do: 7 },
  { syllable: 'la',  scale_degree: 6, semitones_from_do: 9 },
  { syllable: 'ti',  scale_degree: 7, semitones_from_do: 11 },
  { syllable: "do'", scale_degree: 8, semitones_from_do: 12 },
]);

/** Mirrors pitch-pet-content-pools-v1.json → solfege.tolerance_cents. */
export const DEFAULT_TOLERANCE: ToleranceBands = Object.freeze({
  perfect: 15,
  good: 30,
  close: 50,
});

/**
 * Build the pitch-class → degree lookup.
 *
 * NOTE ON do': the pool carries scale_degree 8 at semitones_from_do 12, which is
 * the SAME pitch class as do. Octave is carried separately (octaveOffset), so the
 * lower entry wins the pitch-class slot and the prime mark is applied at display
 * time. Collapsing them here instead would make `do` unreachable above the tonic.
 */
export function buildDegreeTable(
  degrees: readonly SolfegeDegree[] = DEFAULT_DEGREES,
): Map<number, SolfegeDegree> {
  const table = new Map<number, SolfegeDegree>();
  for (const deg of degrees) {
    const pc = mod12(deg.semitones_from_do);
    const existing = table.get(pc);
    if (!existing || deg.semitones_from_do < existing.semitones_from_do) {
      table.set(pc, deg);
    }
  }
  return table;
}

export const DEFAULT_TABLE: Map<number, SolfegeDegree> = buildDegreeTable();

function mod12(n: number): number {
  return ((n % 12) + 12) % 12;
}

export interface SolfegeReading {
  /** Base syllable from the pool, e.g. "sol". Never undefined. */
  syllable: string;
  scale_degree: number;
  /** Signed semitones from the tonic, octaves included. */
  semitones_from_do: number;
  /** 0 = tonic octave, +1 = one octave up, -1 = one below. */
  octaveOffset: number;
  /** Display form: "sol", "do'", "mi," — prime up, comma down. */
  display: string;
}

/**
 * D-K. Map a measured frequency to a solfège degree, relative to the TONIC OF THE
 * CURRENT EXERCISE'S KEY — never a fixed 261.63.
 *
 * Returns null for: bad input, and for chromatic pitches with no entry in the
 * degree table. Null is a real answer meaning "that is not a degree of this key",
 * and the UI must render it as such. Do NOT snap to the nearest syllable — that
 * silently turns a wrong note into a right one, which is the opposite of an ear
 * trainer. Levels 1–4 never generate a chromatic target; Level 5 will.
 */
export function frequencyToSolfege(
  frequency: number,
  tonicHz: number,
  table: Map<number, SolfegeDegree> = DEFAULT_TABLE,
): SolfegeReading | null {
  if (!Number.isFinite(frequency) || frequency <= 0) return null;
  if (!Number.isFinite(tonicHz) || tonicHz <= 0) return null;

  const semitones = Math.round(12 * Math.log2(frequency / tonicHz));
  const degree = table.get(mod12(semitones));
  if (!degree) return null; // chromatic — not a degree of this key

  const octaveOffset = Math.floor(semitones / 12);
  return {
    syllable: degree.syllable,
    scale_degree: degree.scale_degree,
    semitones_from_do: semitones,
    octaveOffset,
    display: displaySyllable(degree.syllable, octaveOffset),
  };
}

/** "sol" +1 → "sol'", "mi" -1 → "mi,". Standard movable-do octave marks. */
export function displaySyllable(syllable: string, octaveOffset: number): string {
  const base = syllable.replace(/['’,]+$/, '');
  if (octaveOffset > 0) return base + "'".repeat(octaveOffset);
  if (octaveOffset < 0) return base + ','.repeat(-octaveOffset);
  return base;
}

/**
 * D-L. Cents between what was sung and what the LESSON ASKED FOR.
 *
 * `targetHz` is the exercise's intended target. It is NOT the nearest semitone to
 * what the learner sang. Snapping first and measuring second hides the error we
 * are teaching: a learner a flat 70 cents would read as "10 cents sharp" of the
 * note below, i.e. the app would congratulate them for missing.
 *
 * Positive = sharp, negative = flat.
 */
export function centsFromTarget(measuredHz: number, targetHz: number): number | null {
  if (!Number.isFinite(measuredHz) || measuredHz <= 0) return null;
  if (!Number.isFinite(targetHz) || targetHz <= 0) return null;
  return 1200 * Math.log2(measuredHz / targetHz);
}

export type CentsBand = 'perfect' | 'good' | 'close' | 'off';

/** Score |cents| into the pool's bands. Beginners are wide — see the pool note. */
export function scoreCents(
  cents: number | null,
  tol: ToleranceBands = DEFAULT_TOLERANCE,
): CentsBand | null {
  if (cents === null || !Number.isFinite(cents)) return null;
  const abs = Math.abs(cents);
  if (abs <= tol.perfect) return 'perfect';
  if (abs <= tol.good) return 'good';
  if (abs <= tol.close) return 'close';
  return 'off';
}

const NOTE_CLASS: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};

/**
 * "C4" → 261.6256 Hz (A4 = 440). Needed because the pool states default keys as
 * note names ("comfortable_mid": "C4"), and the runner needs a tonic in Hz.
 * Accepts sharps and flats: "F#3", "Bb4".
 */
export function noteNameToHz(noteName: string, a4: number = 440): number | null {
  const m = /^([A-Ga-g])([#b♯♭]*)(-?\d+)$/.exec(noteName.trim());
  if (!m) return null;
  const letter = m[1].toUpperCase();
  let semis = NOTE_CLASS[letter];
  if (semis === undefined) return null;
  for (const ch of m[2]) {
    if (ch === '#' || ch === '♯') semis += 1;
    else if (ch === 'b' || ch === '♭') semis -= 1;
  }
  const octave = parseInt(m[3], 10);
  const midi = (octave + 1) * 12 + semis;
  return a4 * Math.pow(2, (midi - 69) / 12);
}

/** Hz of a scale degree in a given key. Use for the exercise's target frequency. */
export function degreeToHz(
  tonicHz: number,
  semitonesFromDo: number,
): number | null {
  if (!Number.isFinite(tonicHz) || tonicHz <= 0) return null;
  if (!Number.isFinite(semitonesFromDo)) return null;
  return tonicHz * Math.pow(2, semitonesFromDo / 12);
}
