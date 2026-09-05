// ===== AUDIO SYSTEM =====
// Voice guidance via Web Speech API + bell tones via Web Audio API

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
