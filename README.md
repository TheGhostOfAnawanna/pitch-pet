# 🐣 Pitch Pet

**The Duolingo of singing — a voice-pet that listens to you sing, teaches you music from absolute zero, and grows up alongside your skill.**

You don't tap through Pitch Pet. You *talk and sing to your pet*. It hears you, tutors you back in its own voice, quizzes you out loud, and evolves as you master real music.

Built for the **lablab AssemblyAI Voice Agent Hackathon**, on a $35 Raspberry Pi, on a $0 budget.

---

## Where this build actually is

This section is deliberately honest. Everything below is either ✅ working in this repo, or 📋 specified and not yet built. Nothing is claimed twice.

| | Piece | State |
|---|---|---|
| ✅ | **Live pitch detection in the browser** — mic → `AnalyserNode` → NSDF pitch tracking | working, `src/App.tsx` |
| ✅ | **Pitch → solfège → cents contract** — movable-do, 12 pitch classes, chromatic-safe | working, `src/solfege.ts`, 65/65 self-test |
| ✅ | **Sung-audio STT gate** — proven that AssemblyAI transcribes a *sung* phrase reliably when sent whole | proven, see "The B-04 gate" below |
| ✅ | **Curriculum, Levels 1–4** — units, lessons, exercises, authored and validated as JSON | authored |
| ✅ | **Content pools** — solfège degrees, tolerance bands, melodies, rhythms, keys | authored |
| 📋 | Lesson runner, pet, scoring UI | specified |
| 📋 | AssemblyAI streaming STT wired into the sing loop | specified |
| 📋 | Talk-to-your-tutor (LeMUR) | specified |
| 📋 | Levels 5–10 | specified as roadmap |

---

## How AssemblyAI is used

Most singing apps stop at pitch — a DSP problem, solved decades ago. Pitch tells you *whether you hit the note*. It cannot tell you **what you sang, what you asked, or how you felt**.

That is the whole design premise here: **pitch is the ears, AssemblyAI is the language brain.**

1. **Sing-the-syllables (streaming STT).** During solfège and lyric exercises, AssemblyAI transcribes what you actually *sang* — "do re mi", vowels, words — and we score the syllables against the target, alongside the pitch. A sung-language use of streaming STT, not a spoken one.
2. **Talk to your tutor (LeMUR).** "Teach me major scales." "Quiz me on intervals." "I don't get key signatures." → STT → LeMUR generates the lesson → the pet speaks it back. This is the literal voice agent.
3. **Spoken quizzes.** The pet asks a theory question aloud; you answer by voice, hands free at the piano.
4. **Counting aloud as a rhythm check.** Level 3 asks the learner to count "one and two and" over a rhythm. Spoken digits are AssemblyAI's native domain and give us a language-level read on timing.
5. **Diction coaching.** Transcription confidence as a proxy for vowel and consonant clarity.
6. **Practice reflection.** A spoken voice-note after a session → sentiment + summarization → the pet remembers that your high notes frustrated you last time, and warms you up first.

### The B-04 gate

Before committing to this design we tested the risky assumption rather than hoping: *does AssemblyAI transcribe singing at all?* Singing stretches vowels, flattens consonants and destroys normal speech prosody, so this was not a given.

**Finding: it does — but only if you send the whole sung phrase.** Slicing the audio into per-note segments and transcribing each one destroys the linguistic context the model relies on, and accuracy collapses. Send the phrase; align the words to notes afterwards. That result is load-bearing for the entire sing loop and is why the architecture looks the way it does.

---

## Design decisions worth reading

A few choices here are deliberate and easy to "fix" into being wrong.

**Chromatic notes return `null`, and `null` is rendered as `—`.** `frequencyToSolfege` maps twelve pitch classes onto seven syllables. Five of them have no syllable in the current key. It would be easy to snap those to the nearest neighbour — and that would turn a wrong note into a right one, which is the exact opposite of an ear trainer. The degree table is a sparse `Map`, not a dense array, for this reason. The UI must show the non-answer.

**Cents are measured against the note the lesson asked for — never the nearest semitone.** A learner singing 70 cents flat of *mi* is nearest to a chromatic pitch. Snap first and you would report them as "30 cents sharp" of something, and congratulate them for missing. Measure against the target and you report them as 70 cents flat of *mi*, which is the truth and is also the thing worth teaching.

**Rhythm timing is 100% local DSP.** AssemblyAI is never asked when a tap landed. Bands: 60 ms tight / 100 ms good / 160 ms loose.

**Beginner tolerance bands are wide on purpose** — 15 / 30 / 50 cents. A beginner who is punished for 12 cents quits.

---

## Run it

Requires Node 20+.

```bash
npm install
npm run dev      # http://localhost:5173
```

Click **Start listening** and sing. You'll get a live solfège syllable and a signed cents readout, relative to a C4 tonic.

> **Microphone access requires a secure context.** `getUserMedia` works on `https://` and on `localhost`, and is blocked on plain `http://` origins. If the mic button errors, check that first.

```bash
npm run build    # typecheck + production build
```

### Self-test

`src/solfege.ts` carries the one piece of maths the headline feature cannot survive being wrong, so it has its own test, and that test runs before any push that touches audio:

```bash
rm -rf /tmp/sfg && mkdir -p /tmp/sfg \
  && npx tsc src/solfege.ts --ignoreConfig --target es2020 --module es2020 --outDir /tmp/sfg \
  && cp src/solfege.selftest.mjs /tmp/sfg/ && node /tmp/sfg/solfege.selftest.mjs
```

65 assertions: every diatonic degree in two keys, both octave directions, all five chromatic classes returning `null`, the scoring bands at their exact edges, and explicit regressions for two bugs that shipped during development.

---

## Layout

```
src/
  App.tsx                 mic → pitchy → solfege → screen
  solfege.ts              pitch → syllable → cents. Single source of truth.
  solfege.selftest.mjs    65 assertions
```

---

## Built with

- [pitchy](https://github.com/ianprime0509/pitchy) (MIT) — NSDF pitch detection with a clarity signal
- React 19 + TypeScript + Vite
- [AssemblyAI](https://www.assemblyai.com/) — streaming STT, LeMUR, sentiment

## Licence

MIT — see [LICENSE](./LICENSE).

All musical content in this repository is original or public-domain.
