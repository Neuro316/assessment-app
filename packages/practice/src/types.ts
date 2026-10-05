// ===== PRACTICE TYPES =====
// The exercise catalogue's shape, who may use an exercise, and the record a
// finished practice session produces. Moved here from the assessment app's
// src/lib/practice/ so the package and its hosts share one definition.

// The exercise's primary effect. Exercises described with two effects (e.g.
// "steady/capacity-building") carry the first one here.
export type PracticeCategory = 'calming' | 'steady' | 'activating';

// Ordered lowest to highest: a person with access to a tier has access to every
// tier before it.
export type PracticeTier = 'insight' | 'practice' | 'mastery';

// Where the person does the exercise. Framing text only — the strap works the same
// either way.
export type SessionContext = 'seated' | 'walking';

// The three source libraries. Breathing is paced by the engine; visualization is
// guided (narration is stage two, the resonance pacer runs underneath until
// then); mindfulness experiments are done during an ordinary day and logged
// afterward, so their "session" is a note, not a pacer run.
export type PracticeFamily = 'breathing' | 'visualization' | 'mindfulness';
export type PracticeKind = 'paced' | 'guided' | 'field';

// What the person wants right now. The library screen groups on this.
export type PracticePurpose = 'settle' | 'steady' | 'energize' | 'recover' | 'prepare' | 'train';

// Which of the measurable axes (fluidity spec, section 2) the exercise trains.
// Free text because several exercises train a pairing, and the spec names six.
export type PracticeAxis = string;

// Evidence tier (fluidity spec, section 12). Governs what a card may claim, not
// what is computed: 1 may be described plainly, 2 as a practice with no claimed
// mechanism, 3 is never surfaced as a claim to a participant.
export type EvidenceTier = 1 | 2 | 3;

export interface PracticeExercise {
  id: string;
  title: string;
  category: PracticeCategory;
  minTier: PracticeTier;
  // Defaults: family 'breathing', kind 'paced'. Set on every library entry.
  family?: PracticeFamily;
  kind?: PracticeKind;
  purpose?: PracticePurpose;
  axis?: PracticeAxis;
  // When it belongs, in the source's own words ("Waiting on a backed-up tee").
  moment?: string;
  evidenceTier?: EvidenceTier;
  // Guided and field exercises carry the source's own instruction and placement
  // text, shown in full on the session screen.
  how?: string;
  where?: string;
  // What the session plays, phase by phase.
  program: PacerProgram;
  narratorAudioKey?: string;
  description: string;
  // Caution text, shown on the screen before the session starts.
  safetyNote?: string;
  // Defaults to 'seated'.
  sessionContext?: SessionContext;
  // ⚠ INERT STUB. Marks an exercise as meant to unlock only once real session
  // history shows a steady baseline. No such history exists yet (npu-platform-v2
  // work), so nothing reads this: canUseExercise ignores it entirely.
  requiresBalancedBaseline?: boolean;
}

// ===== PACER PROGRAMS =====
// An exercise's session is an ordered list of phases, played one after another.
// The engine moves between them on its own; each mode decides when its phase ends.

export type BreathRoute = 'nose' | 'mouth';

// The parts of one breath, in the order they happen. A part with 0 seconds is
// skipped.
export type BreathPart = 'inhale' | 'secondInhale' | 'holdIn' | 'exhale' | 'holdOut';

// Metered breathing with an animated pacer. Ends after durationSec (rounded up to
// whole breaths, so a phase never stops mid-breath) or after repCount breaths.
export interface PacedPhase {
  mode: 'paced';
  inhaleSec: number;
  // A second, shorter inhale stacked on the first — the physiological sigh.
  // Omit or 0 for an ordinary breath.
  secondInhaleSec?: number;
  holdAfterInhaleSec: number;
  exhaleSec: number;
  holdAfterExhaleSec: number;
  inhaleRoute: BreathRoute;
  exhaleRoute: BreathRoute;
  // Shown for the whole phase, e.g. 'Slow' / 'Medium' / 'Fast'.
  label?: string;
  // true hides the breath count or time-left line under the pacer. Narrated
  // sessions show only the session total.
  hideTimer?: boolean;
  // Replaces the default on-screen word for a part of the breath, e.g. exhale:
  // 'Open-mouth exhale', or inhale: 'Inhale… now begin on the exhale'.
  cues?: Partial<Record<BreathPart, string>>;
  durationSec?: number;
  repCount?: number;
}

// One sustained instruction, no metered breath. With durationSec it ends on its
// own; without, the person ends it with a button, which unlocks after
// minDurationSec (default 0). Shows elapsed time.
export interface FreeformPhase {
  mode: 'freeform';
  instruction: string;
  route?: BreathRoute;
  label?: string;
  durationSec?: number;
  minDurationSec?: number;
  // Button text when the person ends it, e.g. 'Next round' or 'Finish'.
  continueLabel?: string;
  // 'none' for a phase that must start silently: the quiet after a narration
  // clip, where a tone would land on the listener's settling. Default sounds
  // the soft tone at the start.
  cue?: 'default' | 'none';
  // true hides this phase's own clock. A narrated session shows only the
  // session total; a countdown on every quiet pulls attention to the number.
  hideTimer?: boolean;
}

// A hold the person ends themselves with a release button. Never a countdown,
// never a target: safetyCapSec is a backstop that releases automatically and is
// never shown.
export interface SelfPacedHoldPhase {
  mode: 'self-paced-hold';
  // 'exhale' = holding with empty lungs, 'inhale' = holding with full lungs.
  holdOn: 'inhale' | 'exhale';
  instruction: string;
  safetyCapSec: number;
  label?: string;
}

// Set by the rounds() helper on every phase it repeats, so the session can show
// "Round 2 of 4". Not written by hand.
export interface PhaseRound {
  round?: { current: number; total: number };
}

// One piece of uploaded content: an audio or video track, an image, or a block of
// text. Media is referenced by URL; the package never fetches or stores it.
export interface MediaAsset {
  kind: 'audio' | 'video' | 'image' | 'text';
  // URL for audio, video and image. Signed storage URLs are fine.
  src?: string;
  // The text itself, for kind 'text'.
  text?: string;
  // Known length of an audio or video track, when the host has it.
  durationSec?: number;
  title?: string;
}

// Plays or shows one MediaAsset while the strap records. This is the custom-
// exercise mode: a facilitator's uploaded track, or a step in a text and image
// sequence. Audio and video end the phase when the track ends (or at durationSec
// as a cap); image and text end at durationSec, or by the person's button when no
// duration is set. Every position tick, pause, play and seek is logged as a
// SessionEvent on the session clock, which is what lets a session be analysed in
// track time rather than wall time.
export interface MediaPhase {
  mode: 'media';
  asset: MediaAsset;
  label?: string;
  // Shown above the media, e.g. "Listen with your eyes closed."
  instruction?: string;
  // 'none' for a clip that must start silently (a narration segment: a tone
  // under the first words is a second stimulus). Default sounds the soft tone.
  cue?: 'default' | 'none';
  durationSec?: number;
  minDurationSec?: number;
  // Button text for an untimed image or text step, or to skip a track.
  continueLabel?: string;
}

export type PacerPhase = (PacedPhase | FreeformPhase | SelfPacedHoldPhase | MediaPhase) & PhaseRound;

// ===== SESSION EVENTS =====
// Everything that happened in a session, on the SAME clock as the RR series: t is
// wall-clock ms (Date.now), the clock the strap data is stamped with. Keeping one
// clock is a convention the writer holds; nothing enforces it.
export type SessionEvent =
  | { t: number; type: 'session-start' }
  | { t: number; type: 'session-end'; endedBy: 'completed' | 'abandoned' }
  | { t: number; type: 'phase-start'; index: number; mode: PacerPhase['mode']; label?: string }
  | { t: number; type: 'phase-end'; index: number; endedBy: 'auto' | 'person' }
  | { t: number; type: 'hold-release'; index: number }
  // Sampled from the player element itself, never inferred from a start time.
  | { t: number; type: 'media-position'; index: number; positionMs: number }
  | { t: number; type: 'media-play' | 'media-pause' | 'media-seek' | 'media-ended'; index: number; positionMs: number }
  | { t: number; type: 'strap-connect' | 'strap-drop' };

// One beat of the RR series, with the moment it happened. t is reconstructed per
// beat by walking back through each packet's intervals from the packet's arrival,
// so beats inside a multi-interval packet are not all stamped with one time.
export interface RRSample {
  t: number;
  rr: number;
}

export interface PacerProgram {
  phases: PacerPhase[];
}

// Which arm of canUseExercise granted the session.
export type PracticeAccessArm = 'program' | 'superadmin' | 'tier';

export interface PracticePerson {
  isSuperadmin: boolean;
  enrolledPracticePrograms: string[];
}

// Whether a person may open a given exercise, and on what grounds: the arm that
// granted access, or null for no access. Three arms, checked in order; the first
// that applies wins. Exported so a host builds the function it hands to
// PracticeInstrument from this, rather than reimplementing the arms.
export function canUseExercise(
  person: PracticePerson,
  exercise: PracticeExercise
): PracticeAccessArm | null {
  // Arm 1: superadmins see everything.
  if (person.isSuperadmin) return 'superadmin';

  // Arm 2: an enrolled program covers the exercise's tier.
  // STUB: any enrollment counts as covering every tier. The real program-to-tier
  // mapping lands with the tier system, and will compare against exercise.minTier.
  if (person.enrolledPracticePrograms.length > 0) return 'program';

  // Arm 3: membership tier.
  // waits on membership-tier system, see npu-platform-v2
  return null;
}

export interface PracticeSessionMetrics {
  rmssd: number | null;
  sdnn: number | null;
  meanHR: number | null;
  meanRR: number | null;
  // An ESTIMATE from zero crossings of the detrended RR series, not a measured
  // breath rate. Clamped to 6-25 br/min, so anything breathed below 6 br/min —
  // which includes most slow paced practice — reads as 6. Do not treat it as exact.
  breathRate: number | null;
  coherence: number | null;
  // ALWAYS null. Practice exercises run at a prescribed rate rather than searching
  // for one, so there is nothing to measure here the way the assessment's
  // six-segment sweep does: that compares several paced rates against each other,
  // and one session has nothing to compare against. A real per-session resonance
  // reading would need actual spectral analysis of the RR stream (Lomb-Scargle, or
  // resampling plus FFT), which does not exist anywhere in this repo yet and is
  // future work.
  resonanceFreq: number | null;
}

// What happened in a session's RR stream, without shipping every beat.
//   rrCount       — RR intervals recorded (after the strap's 200-2000 ms artifact filter)
//   minRR, maxRR  — extremes in ms; null when no beats were recorded
//   strapMode     — 'ble' for a real strap, 'none' when Bluetooth was unavailable
//                   or never connected (the pacer ran alone)
//   disconnects   — unexpected strap drops during the session
export interface PracticeSamplesSummary {
  rrCount: number;
  minRR: number | null;
  maxRR: number | null;
  strapMode: 'ble' | 'none';
  disconnects: number;
}

// One self-paced hold, as it actually happened.
//   round    — the round it belonged to, or null outside a rounds() group
//   heldMs   — how long it lasted
//   endedBy  — 'person' when they released it; 'safety-cap' when the backstop did;
//              'abandoned' when the session ended early while the hold was still
//              open (heldMs is then the time held up to that moment)
export interface PracticeHoldRecord {
  round: number | null;
  heldMs: number;
  endedBy: 'person' | 'safety-cap' | 'abandoned';
}

// Handed to the host's onRecordSession when a session ends. The host decides what
// to do with it; the package makes no network calls.
export interface PracticeSessionRecord {
  exerciseId: string;
  // ISO 8601
  startedAt: string;
  endedAt: string;
  durationMs: number;
  // false when no strap data was recorded; every metric is then null.
  hrvAvailable: boolean;
  metrics: PracticeSessionMetrics;
  samplesSummary: PracticeSamplesSummary;
  narratorId: string | null;
  accessArm: PracticeAccessArm;
  // Every self-paced hold completed in the session, in order. Empty for exercises
  // without one.
  holds: PracticeHoldRecord[];
  // The full RR series with per-beat timestamps, never truncated. Empty when no
  // strap was connected. Hosts should store this in object storage with a pointer
  // on the session row, not inline.
  rrSeries: RRSample[];
  // Everything that happened, on the same clock as rrSeries.
  events: SessionEvent[];
  // How many times this person has done this exercise before, including this
  // one, when the host knows. The first listen is not the same stimulus as the
  // eighth. null when the host did not say.
  listenNumber: number | null;
  // A field experiment's write-up, entered on the finished screen. null for
  // everything else, and when the person wrote nothing.
  note?: string | null;
  // How the person feels, on four quick scales, asked once before the session
  // starts (on the intro screen) and once after (on the finished screen). Each
  // is 1 to 5, low to high, as of that moment, so after minus before is the
  // shift. null when skipped. The host collects these across sessions for the
  // Feedback review; the package only asks.
  ratingsBefore: SessionRatings | null;
  ratingsAfter: SessionRatings | null;
  ratingNote: string | null;
}

export type RatingScale = 'grounded' | 'focused' | 'energy' | 'presence';
export type SessionRatings = Record<RatingScale, number | null>;
