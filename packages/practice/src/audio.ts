// ===== TONE CUES =====
// Synthesized tones for the pacer, on the same Web Audio approach as the
// assessment's bell (src/lib/audio.ts): a sine oscillator with a decaying gain.
// Self-contained — nothing imported from the app, no audio files.
//
// Differences from the assessment's bell: one AudioContext shared by every tone
// (rather than a new one per bell, which browsers cap), a few-millisecond attack so
// short tones do not click, and quieter, shorter tones, since these repeat every
// breath.
//
// Browsers only let audio start after a user gesture, so primeAudio() must be
// called from one (the session's Begin tap) before any tone can sound.

type AudioContextCtor = typeof AudioContext;

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (ctx) return ctx;
  if (typeof window === 'undefined') return null;
  const Ctor: AudioContextCtor | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    ctx = null;
  }
  return ctx;
}

// Call from a click/tap handler. Creates the shared context, or wakes a suspended
// one, while the gesture still allows it.
export function primeAudio(): void {
  const c = getContext();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

interface ToneSpec {
  freq: number;
  // Seconds until the tone has decayed away.
  durationSec: number;
  // Peak loudness, 0-1.
  gain: number;
}

export function playTone({ freq, durationSec, gain }: ToneSpec): void {
  const c = getContext();
  if (!c || c.state !== 'running') return;
  try {
    const t = c.currentTime;
    const osc = c.createOscillator();
    const amp = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.linearRampToValueAtTime(gain, t + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + durationSec);
    osc.connect(amp);
    amp.connect(c.destination);
    osc.start(t);
    osc.stop(t + durationSec + 0.05);
    osc.onended = () => {
      osc.disconnect();
      amp.disconnect();
    };
  } catch {
    // Audio unavailable; the session carries on silently.
  }
}

// The end of a session: two rising notes, clearly not a breath cue, loud enough
// to land from a pocket or another tab. Scheduled on the audio clock, so it plays
// whole even if the tab is hidden.
export function playEndChime(): void {
  const c = getContext();
  if (!c || c.state !== 'running') return;
  try {
    const notes: { freq: number; at: number; dur: number }[] = [
      { freq: 528, at: 0, dur: 1.2 },
      { freq: 792, at: 0.42, dur: 2.2 },
    ];
    for (const n of notes) {
      const t = c.currentTime + n.at;
      const osc = c.createOscillator();
      const amp = c.createGain();
      osc.type = 'sine';
      osc.frequency.value = n.freq;
      amp.gain.setValueAtTime(0.0001, t);
      amp.gain.linearRampToValueAtTime(0.22, t + 0.015);
      amp.gain.exponentialRampToValueAtTime(0.0001, t + n.dur);
      osc.connect(amp);
      amp.connect(c.destination);
      osc.start(t);
      osc.stop(t + n.dur + 0.05);
      osc.onended = () => {
        osc.disconnect();
        amp.disconnect();
      };
    }
  } catch {
    // Audio unavailable; the session ends silently.
  }
}

// The cue vocabulary. Inhale rises in pitch, exhale falls, holds sit between — so
// the cues stay distinct with eyes closed.
export const CUE = {
  inhale: { freq: 528, durationSec: 0.45, gain: 0.16 },
  secondInhale: { freq: 660, durationSec: 0.3, gain: 0.13 },
  exhale: { freq: 396, durationSec: 0.55, gain: 0.16 },
  hold: { freq: 440, durationSec: 0.3, gain: 0.1 },
  // Phase changes, and a freeform phase's button becoming available.
  soft: { freq: 528, durationSec: 0.9, gain: 0.07 },
  // During a self-paced hold: low, quiet, long decay. A presence, not a signal.
  presence: { freq: 330, durationSec: 1.6, gain: 0.035 },
} satisfies Record<string, ToneSpec>;
