// ===== AUDIO SYSTEM =====
// Voice guidance via pre-recorded clips in public/Audio + bell tones via Web Audio API.
//
// The recorded track replaces the old Web Speech synthesis: a fixed voice keeps the
// protocol identical for every participant, which matters when readings are being
// compared across sessions. speak() is kept below as a fallback for callers that
// have no recording to play.

// The clip currently playing, so a new prompt can cut off a stale one and a restart
// can silence the assessment entirely.
let currentAudio: HTMLAudioElement | null = null;
let currentResolve: (() => void) | null = null;

// Resolves when the clip finishes. Never rejects, and resolves immediately on any
// failure — a missing or blocked file must not stall the assessment.
export function playAudio(filename: string): Promise<void> {
  return new Promise((resolve) => {
    // Two prompts talking over each other would be worse than a missed cue.
    cancelAudio();

    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      if (currentAudio === audio) {
        currentAudio = null;
        currentResolve = null;
      }
      resolve();
    };

    const audio = new Audio(`/Audio/${filename}`);
    currentAudio = audio;
    currentResolve = done;

    audio.onended = done;
    audio.onerror = done;
    audio.play().catch(done);
  });
}

// Stops whatever is playing and settles its promise, so nothing is left pending.
// Callers that chain off playAudio must guard their continuation — see the run
// generation check in the assessment's RF handoff.
export function cancelAudio(): void {
  const audio = currentAudio;
  const resolve = currentResolve;
  currentAudio = null;
  currentResolve = null;

  if (audio) {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch (e) {}
  }
  resolve?.();
}

export function speak(text: string): void {
  try {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.85;
      utterance.pitch = 1.0;
      utterance.volume = 1;
      window.speechSynthesis.speak(utterance);
    }
  } catch (e) {
    // TTS not available — participant will rely on on-screen text
  }
}

export function bell(): void {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 528;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 3);
  } catch (e) {
    // Audio not available
  }
}

export function doubleBell(): void {
  bell();
  setTimeout(bell, 600);
}

export function cancelSpeech(): void {
  try {
    window.speechSynthesis?.cancel();
  } catch (e) {}
}
