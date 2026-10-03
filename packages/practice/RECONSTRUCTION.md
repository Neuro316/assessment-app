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

## Confirmed domain context (from Cameron's project notes, not this session)

- The original breathing library is B1-B12, documented in a PDF
  (`Breathing_library.pdf`) with mechanism/research/golf-application per
  technique — not currently attached to this rebuild. The matching
  visualization (V1-V12) and mindfulness (M1-M12) libraries exist in the same
  document set but have never been located.
- B13+ are later additions: Cameron asked (2026-10-02) for the library to be
  expanded with genuinely activating/state-shifting techniques, naming Tummo
  breath and Wim Hof-style breathing by name, with the evoked state framed as
  hypothesized where evidence is thin.
- Activating/high-intensity techniques should be gated on a person's recent
  biometrics showing a balanced baseline, not on membership tier alone.
- No exercise should be excluded from the app for not fitting the pacer's
  original (rate-paced) design — this explicitly includes walking-based and
  self-paced breath-hold techniques, which is almost certainly what B9's
  "hold" is.
- Package name: `@neuroprogeny/practice`, built with `tsup`, consumed by this
  app's own `/practice` page and (eventually) by `npu-platform-v2` as an
  imported React component — not an iframe. As of this rebuild, npu-hub-v2
  has no reference to the package anywhere; that integration was decided but
  never built, in either the lost session or before it.

## What's been rebuilt so far (this is the live status — update it as work lands)

| Piece | File | Status | Confidence |
|---|---|---|---|
| Cue-timing rule | `pacer-engine.ts` | Done, committed | High — matches all 6 table rows exactly, verified by script |
| B1, B2/B3/B12, B5, B7 patterns | `extended-breath-patterns.ts` | Done, committed | High for totals/cue points; phase-internal split for the sigh pattern is the simplest reading of 3 cue points, not independently confirmed |
| B10, B13, B14, B16 Fast/Medium patterns | `extended-breath-patterns.ts` | Done, committed | Low — only total duration confirmed; internal inhale/exhale split is ASSUMED even, almost certainly wrong for B14 "Pulses" |
| Wake lock | `use-wake-lock.ts` | Done, committed | New code, not recovered — standard Screen Wake Lock API usage |
| Phase runner (drives a pattern over time, fires cues) | `use-breath-pattern.ts` | Done, committed | New code, not recovered |
| Hold recording (`endedBy: 'abandoned'`) | `hold-recording.ts` | Done, committed | Matches the one concrete detail that survived (`[stub]` console record, `endedBy: 'abandoned'`); everything else in the record shape is invented to fit |

## What's NOT rebuilt — real gaps, not yet started

- **B4, B6, B8, B9, B11, B15, and any B16 "Slow" variant** — zero surviving
  data. B4 existing in the original 12-technique library but having no
  recovered pacer timing is a special case worth flagging to Cameron
  directly, since it suggests the gap in the summary isn't "doesn't exist,"
  just "wasn't mentioned in that one change's report."
- **The actual `PacerSession.tsx`-equivalent UI component** that renders a
  running exercise (visual phase indicator, tone playback wiring, start/stop)
  using the pieces above. Right now `PracticeInstrument.tsx` still only
  knows the old simple-rate `BreathPacer`, not phase patterns.
- **Wiring `EXTENDED_BREATH_PATTERNS` into the exercise list** so an exercise
  with a phase pattern actually runs through the new engine instead of (or
  alongside) a flat `pacerRate`.
- **Tone/audio playback itself** — nothing here plays a sound yet; `cueFor`
  only says *when* a cue should fire.
- **The `npu-hub-v2` integration** — importing `@neuroprogeny/practice` as a
  component there. Not started in this rebuild or in the original lost work.

## Open questions for Cameron

1. Does `Breathing_library.pdf` still exist somewhere you can re-attach? It
   would upgrade B1-B12 from partially-assumed to confirmed, and might
   independently cover B4.
2. What are B6, B8, B9, B11, B15 actually called and structured? (B9 is
   specifically referenced as having a "hold" — confirming its real pattern
   would also validate the hold-recording wiring end to end.)
3. Is a B16 "Slow" variant real, or was Fast/Medium the whole set?
4. Confirm or correct the ASSUMED even inhale/exhale splits for B10, B13,
   B14, B16 Fast/Medium — B14 "Pulses" in particular is very likely not a
   plain two-phase breath.
