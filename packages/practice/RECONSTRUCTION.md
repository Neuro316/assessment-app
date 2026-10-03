# Pacer engine reconstruction — status and spec

This file is the durable record for the breathing-pacer rebuild. It exists
because the original work was lost once already: a prior Claude Code session
built a `PacerSession.tsx` engine, a 16-exercise library (B1-B16), a screen
wake lock, and hold-session recording, tested it, and staged the changes —
but never committed them. The session's container was reclaimed before the
work reached git, and the detailed transcript did not survive either. All
that remained was a short prose summary of the session's *last* change.

**The rule going forward: nothing here is "done" until it is committed and
pushed to `main`, and the push is verified against the remote — not just
trusted locally.** See the commit log for this file's own history of what
landed when.

## What actually survived, verbatim

From the recovered summary (a Claude Code session reporting its own last
change, before the container was lost):

> The tone rule now uses breath length: any breath shorter than 3.5 seconds
> sounds only once, as it begins, and longer breaths sound on every part.

> What changed: only `packages/practice/src/PacerSession.tsx`.
> - The constant is now `MIN_FULLY_CUED_BREATH_MS = 3_500`.
> - A short breath sounds only its opening part. The other parts are still
>   tracked silently, so nothing sounds late.
> - `cueFor` is now exported so it can be tested; it isn't exported from the
>   package itself.

Plus a results table of cue points per exercise:

| Exercise / phase   | Breath | Tones                                                |
|---------------------|--------|-------------------------------------------------------|
| B13                  | 3 s    | inhale only, every 3 s (was every 1.5 s)              |
| B16 Fast             | 2 s    | inhale only, every 2 s                                |
| B16 Medium           | 3 s    | inhale only, every 3 s                                |
| B14 Pulses           | 2 s    | inhale only, every 2 s                                |
| B10 Brisk            | 2.5 s  | inhale only, every 2.5 s                              |
| B2, B3, B12 (sigh)   | 9 s    | inhale at 0 s, top-up at 2 s, exhale at 3 s           |
| B7                   | 8 s    | inhale at 0 s, final pause at 3 s, exhale at 4 s      |
| B5 (box)             | 16 s   | all four parts, every 4 s                             |
| B1                   | 11 s   | inhale and exhale, every 5.5 s                        |

And, from a separate request to test the browser build before approving the
commit (the test that never happened):

> Start B9, tap End early mid-hold, confirm `endedBy: 'abandoned'` shows up
> in the `[stub]` console record.
> Confirm the screen doesn't lock mid-session.

That is the **entire** surviving factual record of the original
implementation. Everything else about it — exact architecture, the other 16
exercises' names and phase structure, the UI, exact wake lock code, the full
hold-record shape — is gone. It was checked for in: git history of this repo
and `capacity-assessment-app` (empty), the Claude Code session transcript
(only this session's own actions were in it), Claude Docs/artifacts owned by
Cameron (two "Capacity Practice" docs exist but are UI mockups with fake
data, not the real implementation), and Vercel's deployment history for this
project (no deployment exists between the commit 12h before this session and
the first commit this session pushed — confirms it was never deployed
either, by git-triggered build or direct CLI push).

## UPDATE 2026-10-03: the real source PDF surfaced

Cameron re-attached `Breathing_library.pdf` ("The Breathing Library") —
this is the authoritative source for B1-B12, not the fragments above. It
resolved most of the open questions from the first pass of this document and
raised one real conflict. Full text is extracted and available in this
session's scratch space if it needs re-checking; the key facts:

- **B1, B5 matched exactly** what the lost-session fragments already gave —
  strong independent confirmation those two survived accurately.
- **B4, B6, B10, B11** now have real specs. B6 is a single cued breath, not
  a loop. B10 and B11 are multi-stage (B10: a fast-breathing phase then a
  return to resonance pace; B11: three fixed one-minute stages at
  increasing exhale ratios), not flat single-rate patterns.
- **B8 (Nasal Only Walking) and B9 (The Carbon Dioxide Tolerance Walk)** are
  both walking-based. Per Cameron (2026-10-03): remove walking exercises
  from the app for now. Neither is implemented. Note: B9 is the exercise
  named in the lost session's hold-recording test — that specific test
  can't be re-run until walking exercises are back in scope, but the
  hold-recording mechanism itself is still exercised by B5's hold phases
  and by the new activating exercises (see below).
- **B7 conflict, unresolved**: the PDF's real B7 ("Breath to Tempo
  Coupling") is tied to golf-swing timing with no fixed duration at all —
  it cannot be the lost session's recovered 8s fixed-duration pattern. That
  recovered pattern is kept in `extended-breath-patterns.ts` as a comment
  only, explicitly not wired up as B7, pending Cameron clarifying what it
  actually was.
- **B2, B3, B12 confirmed as a sigh family**, exactly as grouped in the
  first pass — B3 is the physiological sigh repeated for 5 minutes, B12 is
  the sigh repeated exactly 3 times, B2 is "1 to 3 cycles." The lost
  session's 9s/2s/3s sigh timing isn't contradicted by the PDF (which gives
  no exact seconds) and is kept, still flagged as assumed precision.
- **B13-B16 are confirmed NOT in this PDF** — it's the original 12-technique
  library only. The activating set (previously guessed at under those
  codes) was a separate, later, unreviewed addition with no surviving spec
  anywhere checked, Cameron included ("I hadn't seen it yet... it's in this
  chat somewhere or it doesn't exist" — it doesn't exist). Checked for a
  live Claude Code session on this project to query for residual context —
  none was running. So the activating set is designed fresh in
  `activating-patterns.ts`, coded A1/A2 rather than continuing the B13-B16
  numbering, from real technique research (Wim Hof Method's own guide,
  a Tummo breathing structure guide) rather than guessed at.
- **Session-length selection**: per Cameron (2026-10-03), exercises that
  aren't extremely activating should offer a duration picker (3/5/10/20
  min) rather than one fixed length. Modeled as `selectableDurationsMin` on
  `PracticeBreathExercise`. Extremely activating exercises (A1, A2) keep
  their own fixed round structure instead, via `extremelyActivating: true`.

## Confirmed domain context (from Cameron's project notes, not this session)

- The matching visualization (V1-V12) and mindfulness (M1-M12) libraries are
  in the same PDF as the breathing library (confirmed 2026-10-03) — not yet
  pulled into the package; this rebuild has only touched the breathing side.
- Activating/high-intensity techniques should be gated on a person's recent
  biometrics showing a balanced baseline, not on membership tier alone
  (`activating-patterns.ts` marks eligibility via `extremelyActivating`; the
  actual gating is a host/UI decision, not yet built).
- Package name: `@neuroprogeny/practice`, built with `tsup`, consumed by this
  app's own `/practice` page and (eventually) by `npu-platform-v2` as an
  imported React component — not an iframe. As of this rebuild, npu-hub-v2
  has no reference to the package anywhere; that integration was decided but
  never built, in either the lost session or before it.

## What's been rebuilt so far (this is the live status — update it as work lands)

| Piece | File | Status | Confidence |
|---|---|---|---|
| Cue-timing rule | `pacer-engine.ts` | Done, committed | High — matches all 6 recovered table rows exactly, verified by script |
| B1-B6, B10-B12 patterns | `extended-breath-patterns.ts` | Done, committed | High — direct from the real PDF; sigh-family internal timing still assumed-precision |
| B7 | `extended-breath-patterns.ts` | Deliberately NOT wired up | Conflict between PDF and recovered data, unresolved — see above |
| B8, B9 (walking) | — | Deliberately NOT included | Out of scope per Cameron 2026-10-03 |
| A1 (Wim Hof-style), A2 (Tummo-style) | `activating-patterns.ts` | Done, committed | New design from real technique research, not recovery — see sources in the file |
| Wake lock | `use-wake-lock.ts` | Done, committed | New code, not recovered — standard Screen Wake Lock API usage |
| Phase runner (drives a pattern over time, fires cues) | `use-breath-pattern.ts` | Done, committed | New code, not recovered; does not yet understand multi-stage exercises or openEndedHold |
| Hold recording (`endedBy: 'abandoned'`) | `hold-recording.ts` | Done, committed | Matches the one concrete detail that survived; doesn't yet distinguish openEndedHold (always 'completed') from a fixed hold ended early |

## What's NOT rebuilt — real gaps, not yet started

- **B15, and any B16 variant** — still zero surviving data, and not in the
  PDF either (B16 was never B-library at all, same situation as the rest of
  the activating set) — fold any further activating ideas into the A-series
  instead of resurrecting B13-B16 codes.
- **The actual `PacerSession.tsx`-equivalent UI component** that renders a
  running exercise (visual phase indicator, tone playback wiring, start/stop,
  duration picker, multi-stage progression) using the pieces above. Right
  now `PracticeInstrument.tsx` still only knows the old simple-rate
  `BreathPacer`, not phase patterns or multi-stage exercises.
- **`useBreathPattern` doesn't yet run multi-stage exercises** (B10, B11,
  A1, A2) — it currently drives one `BreathPattern` in a loop. Needs
  extending to walk a `PracticeBreathExercise`'s `stages[]` in sequence,
  respecting `durationMs` / `repeatCycles` / `openEndedHold` per stage.
- **Wiring the libraries into the exercise list** so `BREATHING_LIBRARY` and
  `ACTIVATING_PATTERNS` entries actually appear and run, instead of (or
  alongside) the old flat `pacerRate` placeholder exercises.
- **Tone/audio playback itself** — nothing here plays a sound yet; `cueFor`
  only says *when* a cue should fire.
- **The `npu-hub-v2` integration** — importing `@neuroprogeny/practice` as a
  component there. Not started in this rebuild or in the original lost work.
- **V1-V12 (visualization) and M1-M12 (mindfulness) libraries** — confirmed
  to exist in the same source PDF, not yet pulled into the package at all.

## Open questions for Cameron

1. What was the real B7, if the recovered 8s fixed pattern isn't "Breath to
   Tempo Coupling"? Was it a training-mode stand-in, or something else
   entirely?
2. A1/A2's exact timing (breath pace, round/retention lengths) came from
   general practice guides, not a fixed canonical source — want a specific
   pace, or is the commonly-taught baseline fine to ship with?
3. When should B8/B9 (walking) come back into scope, and should they reuse
   the same self-paced/openEndedHold mechanism as A1's retention?
