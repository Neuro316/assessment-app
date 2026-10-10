// ===== AGE BAND =====
// An age RANGE and nothing finer. It comes from the launch link (age_band=...) or,
// when the link has none, from one question on the welcome screen, which can be skipped.
//
// What leaves the app:
// - `ageBand` (top level of assessment-complete): ONLY when the person answered the
//   question. Absent when they skipped it, and absent when the launch supplied the band
//   (the platform already has it).
// - `context.age_band` (the scored result's context): whenever a band is known, from
//   either source. A pace-finder sitting has no scored result, so it carries no context.
//
// Pure, so the tests can load it directly.

export const AGE_BANDS = ['under30', '30s', '40s', '50s', '60plus'] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

export const AGE_BAND_LABELS: Record<AgeBand, string> = {
  under30: 'Under 30',
  '30s': '30 to 39',
  '40s': '40 to 49',
  '50s': '50 to 59',
  '60plus': '60 and over',
};

// The welcome question's answer: a band, 'skip', or null while unanswered.
export type AgeAnswer = AgeBand | 'skip' | null;

export function isAgeBand(v: unknown): v is AgeBand {
  return typeof v === 'string' && (AGE_BANDS as readonly string[]).includes(v);
}

// An unknown value on the link is ignored, so the question is asked instead.
export function launchAgeBand(params: URLSearchParams): AgeBand | null {
  const v = params.get('age_band');
  return isAgeBand(v) ? v : null;
}

// The question is shown only when the launch did not supply a band.
export function ageQuestionNeeded(launch: AgeBand | null): boolean {
  return launch === null;
}

export function knownAgeBand(launch: AgeBand | null, answer: AgeAnswer): AgeBand | null {
  if (launch) return launch;
  return isAgeBand(answer) ? answer : null;
}

// The fields added to an assessment-complete message. `scored` is true for a message
// carrying a scored result (the full assessment), which alone gets `context`.
export function ageFields(
  launch: AgeBand | null,
  answer: AgeAnswer,
  scored: boolean
): { ageBand?: AgeBand; context?: { age_band: AgeBand } } {
  const out: { ageBand?: AgeBand; context?: { age_band: AgeBand } } = {};
  if (!launch && isAgeBand(answer)) out.ageBand = answer;
  const known = knownAgeBand(launch, answer);
  if (scored && known) out.context = { age_band: known };
  return out;
}
