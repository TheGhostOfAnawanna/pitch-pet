// Self-test for solfege.ts (Doc, 2026-09-11).
// D-S: run this before every push that touches audio. 65 assertions, <1s.
// Run from the REPO ROOT. TypeScript >=6 needs --ignoreConfig or it errors TS5112:
//   rm -rf /tmp/sfg && mkdir -p /tmp/sfg \
//     && npx tsc src/solfege.ts --ignoreConfig --target es2020 --module es2020 --outDir /tmp/sfg \
//     && cp src/solfege.selftest.mjs /tmp/sfg/ && node /tmp/sfg/solfege.selftest.mjs
import {
  DEFAULT_DEGREES, DEFAULT_TABLE, buildDegreeTable,
  frequencyToSolfege, centsFromTarget, scoreCents,
  noteNameToHz, degreeToHz, displaySyllable,
} from './solfege.js';

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; } else { fail++; console.log(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};
const near = (name, got, want, tol) => {
  const ok = got !== null && Math.abs(got - want) <= tol;
  if (ok) { pass++; } else { fail++; console.log(`FAIL ${name}: got ${got}, want ~${want} (+/-${tol})`); }
};

const C4 = noteNameToHz('C4');
near('C4 = 261.63Hz', C4, 261.6256, 0.001);
near('A4 = 440Hz', noteNameToHz('A4'), 440, 1e-9);
near('C5 = 2x C4', noteNameToHz('C5'), C4 * 2, 1e-9);
near('F#3', noteNameToHz('F#3'), 184.9972, 0.001);
near('Bb4 == A#4', noteNameToHz('Bb4'), noteNameToHz('A#4'), 1e-9);
eq('garbage note name -> null', noteNameToHz('H9'), null);

// --- D-K: the whole major scale, in the key of C4. This is the regression that
// both shipped bugs failed. %7 gave mi/sol/la for re/mi/fa; %12 into a 7-array
// gave undefined for sol/la/ti.
const scale = [
  [0,  'do'], [2,  're'], [4,  'mi'], [5,  'fa'],
  [7,  'sol'], [9, 'la'], [11, 'ti'],
];
for (const [semis, want] of scale) {
  const hz = degreeToHz(C4, semis);
  const r = frequencyToSolfege(hz, C4);
  eq(`degree ${semis} -> ${want}`, r && r.syllable, want);
  eq(`degree ${semis} octaveOffset 0`, r && r.octaveOffset, 0);
}

// Octave above: 12 semitones is do, offset +1, displayed do'
const up = frequencyToSolfege(degreeToHz(C4, 12), C4);
eq('12 semis -> do', up && up.syllable, 'do');
eq('12 semis -> offset +1', up && up.octaveOffset, 1);
eq("12 semis -> display do'", up && up.display, "do'");

// Sol an octave up
const sol1 = frequencyToSolfege(degreeToHz(C4, 19), C4);
eq('19 semis -> sol', sol1 && sol1.syllable, 'sol');
eq("19 semis -> display sol'", sol1 && sol1.display, "sol'");

// Below the tonic: -1 semitone is ti, one octave down.
const below = frequencyToSolfege(degreeToHz(C4, -1), C4);
eq('-1 semi -> ti', below && below.syllable, 'ti');
eq('-1 semi -> offset -1', below && below.octaveOffset, -1);
eq('-1 semi -> display ti,', below && below.display, 'ti,');

// --- Chromatic must be null, never snapped.
for (const semis of [1, 3, 6, 8, 10]) {
  eq(`chromatic ${semis} -> null`, frequencyToSolfege(degreeToHz(C4, semis), C4), null);
}

// --- Movable do: the SAME Hz reads differently in a different key.
const G4 = noteNameToHz('G4');
const aInC = frequencyToSolfege(noteNameToHz('A4'), C4);
const aInG = frequencyToSolfege(noteNameToHz('A4'), G4);
eq('A4 in key of C -> la', aInC && aInC.syllable, 'la');
eq('A4 in key of G -> re', aInG && aInG.syllable, 're');

// --- Bad input
eq('0 Hz -> null', frequencyToSolfege(0, C4), null);
eq('NaN -> null', frequencyToSolfege(NaN, C4), null);
eq('bad tonic -> null', frequencyToSolfege(440, 0), null);

// --- Rounding: halfway between do and re still resolves to a degree, not a crash.
const quarterTone = C4 * Math.pow(2, 1 / 12);   // exactly 100 cents = chromatic
eq('exact +100c -> null (chromatic)', frequencyToSolfege(quarterTone, C4), null);
const nearlyRe = C4 * Math.pow(2, 1.6 / 12);    // rounds to 2 semitones
eq('+160c rounds to re', frequencyToSolfege(nearlyRe, C4).syllable, 're');

// --- D-L: cents measured against the INTENDED target, signed.
near('same note -> 0 cents', centsFromTarget(C4, C4), 0, 1e-9);
near('semitone up -> +100', centsFromTarget(degreeToHz(C4, 1), C4), 100, 1e-9);
near('octave up -> +1200', centsFromTarget(C4 * 2, C4), 1200, 1e-9);
near('flat -> negative', centsFromTarget(C4 * Math.pow(2, -0.5 / 12), C4), -50, 1e-9);
eq('cents bad input -> null', centsFromTarget(-1, C4), null);

// The D-L trap, made concrete: a learner 70 cents flat of MI.
// Measured against mi (the intended target) it is -70 => 'off'.
// Snap to the NEAREST SEMITONE first (3 semitones, a chromatic note 30c below)
// and the same performance reads +30 => 'good'. The app would congratulate a
// learner for missing the note by most of a quarter tone. Never snap first.
const miHz = degreeToHz(C4, 4);
const sungFlat = miHz * Math.pow(2, -0.70 / 12);
near('70c flat of mi measures -70', centsFromTarget(sungFlat, miHz), -70, 1e-9);
eq('70c flat of mi scores off', scoreCents(centsFromTarget(sungFlat, miHz)), 'off');
const nearestSemitone = degreeToHz(C4, 3);
near('...reads +30 if snapped to nearest semitone', centsFromTarget(sungFlat, nearestSemitone), 30, 1e-9);
eq('...and would no longer score off', scoreCents(centsFromTarget(sungFlat, nearestSemitone)) !== 'off', true);

// --- Scoring bands (pool: 15 / 30 / 50)
eq('0c -> perfect',    scoreCents(0), 'perfect');
eq('15c -> perfect',   scoreCents(15), 'perfect');
eq('-15c -> perfect',  scoreCents(-15), 'perfect');
eq('15.1c -> good',    scoreCents(15.1), 'good');
eq('30c -> good',      scoreCents(-30), 'good');
eq('30.1c -> close',   scoreCents(30.1), 'close');
eq('50c -> close',     scoreCents(50), 'close');
eq('50.1c -> off',     scoreCents(-50.1), 'off');
eq('null -> null',     scoreCents(null), null);

// --- Table construction: sparse over 12, do wins the pitch-class slot over do'.
eq('table size 7', DEFAULT_TABLE.size, 7);
eq('pc 0 is do (not do-prime)', DEFAULT_TABLE.get(0).syllable, 'do');
eq('pc 1 absent', DEFAULT_TABLE.get(1), undefined);
eq('pc 7 is sol', DEFAULT_TABLE.get(7).syllable, 'sol');
eq('degrees list length 8', DEFAULT_DEGREES.length, 8);
const custom = buildDegreeTable([{ syllable: 'do', scale_degree: 1, semitones_from_do: 0 }]);
eq('custom table honoured', custom.size, 1);
eq('display strips existing marks', displaySyllable("do'", 0), 'do');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
