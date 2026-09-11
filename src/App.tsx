/**
 * App.tsx — B-03: live pitch readout from the real microphone.
 *
 * Authored by Doc, 2026-09-11, as the reference wiring for the core loop's
 * input stage. Deliberately unstyled. A number on a page.
 *
 * CONTRACT NOTES (do not "simplify" these away):
 *  - D-Q: ALL pitch->syllable and cents maths comes from ./solfege. This file
 *    computes none of it. If you find yourself writing Math.log2 here, stop.
 *  - D-R: a null reading renders as a visible non-answer ("—"). Never blank,
 *    never a fallback syllable. A silent fallback scores a wrong note as right.
 *  - D-L: cents are measured against the LESSON'S target. There is no lesson
 *    yet, so this screen measures against the nearest in-key degree and SAYS SO
 *    in the label ("nearest degree"). When the lesson runner lands, it passes
 *    its own target into `centsFromTarget` and this fallback goes away. Do not
 *    let "nearest degree" leak into scoring — see `targetHz` below.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { PitchDetector } from 'pitchy';
import {
  centsFromTarget,
  degreeToHz,
  frequencyToSolfege,
  noteNameToHz,
  scoreCents,
} from './solfege';

/** Gate frames we do not trust. Bad frames are dropped, never guessed at. */
const MIN_CLARITY = 0.9;
const MIN_HZ = 80;
const MAX_HZ = 1000;
const FFT_SIZE = 2048;

/** Tonic for this bare readout. The lesson runner will supply the real key. */
const TONIC_NOTE = 'C4';

interface Reading {
  hz: number;
  clarity: number;
  display: string;
  cents: number | null;
  band: string | null;
}

function App() {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState<Reading | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void ctxRef.current?.close();
    ctxRef.current = null;
    setListening(false);
    setReading(null);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    const tonicHz = noteNameToHz(TONIC_NOTE);
    if (tonicHz === null) {
      setError(`Bad tonic: ${TONIC_NOTE}`);
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      // Most common causes: permission denied, or the page is not on
      // https/localhost. getUserMedia is unavailable on plain http origins.
      setError(
        err instanceof Error ? `${err.name}: ${err.message}` : String(err),
      );
      return;
    }
    streamRef.current = stream;

    const ctx = new AudioContext();
    ctxRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    source.connect(analyser);

    const detector = PitchDetector.forFloat32Array(analyser.fftSize);
    detector.clarityThreshold = MIN_CLARITY;
    const buf = new Float32Array(analyser.fftSize);

    setListening(true);

    const tick = () => {
      analyser.getFloatTimeDomainData(buf);
      const [hz, clarity] = detector.findPitch(buf, ctx.sampleRate);

      if (clarity >= MIN_CLARITY && hz >= MIN_HZ && hz <= MAX_HZ) {
        const solfege = frequencyToSolfege(hz, tonicHz);
        if (solfege === null) {
          // Chromatic: a real answer meaning "not a degree of this key" (D-R).
          setReading({ hz, clarity, display: '—', cents: null, band: null });
        } else {
          // D-L placeholder target — nearest in-key degree. See header note.
          const targetHz = degreeToHz(tonicHz, solfege.semitones_from_do);
          const cents =
            targetHz === null ? null : centsFromTarget(hz, targetHz);
          setReading({
            hz,
            clarity,
            display: solfege.display,
            cents,
            band: scoreCents(cents),
          });
        }
      }
      // Untrusted frame: hold the last reading rather than flickering to blank.

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => stop, [stop]);

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <h1>Pitch Pet — pitch readout</h1>
      <p>
        Tonic: <code>{TONIC_NOTE}</code>
      </p>

      <button type="button" onClick={listening ? stop : () => void start()}>
        {listening ? 'Stop' : 'Start listening'}
      </button>

      {error !== null && (
        <p style={{ color: 'crimson' }}>
          <strong>Mic error:</strong> {error}
        </p>
      )}

      <div style={{ marginTop: '2rem', fontVariantNumeric: 'tabular-nums' }}>
        <div style={{ fontSize: '4rem', lineHeight: 1 }}>
          {reading?.display ?? '—'}
        </div>
        <div style={{ fontSize: '2rem' }}>
          {reading?.cents === null || reading === null
            ? '—'
            : `${reading.cents > 0 ? '+' : ''}${Math.round(reading.cents)} cents`}
        </div>
        <div style={{ color: '#666' }}>
          {reading === null
            ? 'not listening'
            : `${reading.hz.toFixed(1)} Hz · clarity ${reading.clarity.toFixed(2)} · ${reading.band ?? 'off-key'} · vs nearest degree`}
        </div>
      </div>
    </main>
  );
}

export default App;
