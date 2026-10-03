// ===== NARRATION SCRIPTS =====
// The spoken segments for each guided visualization (V1-V12), written from the
// source library's "How" and "Where it is used" text in Neuro Progeny's voice:
// speak to the listener as "you", validate before explaining, frame from
// capacity, plain sentences, no em dashes.
//
// A guided session is NOT one long track. It is a sequence of short clips with
// engine-timed quiet between them, inside the paced pre-roll and quiet post-roll
// that withBookends() adds. That keeps the pauses exact and editable without
// regenerating audio, needs no stitching, and makes every clip a labeled segment
// for event-locked analysis.
//
// The package carries the words and the timing only. Audio files live with the
// host (the platform's media bucket); the host resolves a segment's clip URL by
// its id at render time. See guidedProgram() for how a script becomes phases.
//
// These are the GENERAL set: no sport, no setting, no named kind of moment. The
// listener supplies their own situation. The source library is golf-specific;
// a golf variant set belongs to The Composed Player course and is written
// separately.
//
// pauseAfterSec is the quiet that follows the clip, before the next one begins.

import type { PacerPhase, PacerProgram, PracticeExercise } from './types';
import { withBookends } from './pacer';

export interface NarrationSegment {
  // Stable id, e.g. 'V1-3'. The host's asset key.
  id: string;
  // Shown on screen while the clip plays, and the text sent to the narrator.
  text: string;
  pauseAfterSec: number;
}

/**
 * Which narrator reads a script. Three voices, chosen by what the script asks
 * of the listener rather than by exercise family:
 *  - interoceptive: body scans and felt-sense work (slow, low, unhurried)
 *  - curious: observing, reviewing, widening (warm, lightly engaged)
 *  - active: rehearsal, priming and precise attention (clear, articulate)
 */
export type NarratorRole = 'interoceptive' | 'curious' | 'active';

/** ElevenLabs voice ids per role, approved 2026-10-03. Hosts key clip storage on the role, not the id. */
export const NARRATOR_VOICES: Record<NarratorRole, { voiceId: string; name: string }> = {
  interoceptive: { voiceId: 'aZmUfPlx1GDZ4UDKlP7Q', name: 'Calm Meditative Steve' },
  curious: { voiceId: 'Jx35Jvky2ob4xi16g1ha', name: 'Miss La' },
  active: { voiceId: 'lqydY2xVUkg9cEIFmFMU', name: 'Angela' },
};

export interface NarrationScript {
  exerciseId: string;
  narrator: NarratorRole;
  segments: NarrationSegment[];
}

const seg = (id: string, text: string, pauseAfterSec: number): NarrationSegment => ({ id, text, pauseAfterSec });

export const NARRATION: Record<string, NarrationScript> = {
  V1: {
    exerciseId: 'V1',
    narrator: 'interoceptive',
    segments: [
      seg('V1-1', 'Let your eyes close. For the next few minutes there is nothing to do except notice. Start at the soles of your feet. Feel where they meet the ground. The pressure. The temperature. The texture of whatever is under them.', 15),
      seg('V1-2', 'Let your attention rise into your ankles and your lower legs. You are not trying to change anything. You are taking an inventory of contact. Where the body touches the chair, the floor, your own clothes.', 15),
      seg('V1-3', 'Up through the knees and the thighs. Notice the weight of your legs being held. Notice the places that press down, and the places that are free.', 15),
      seg('V1-4', 'Let attention move through your hips and the base of your spine, into your belly and your lower back. The breath is moving there on its own. Let it.', 15),
      seg('V1-5', 'Up through your chest and your shoulders, down the length of your arms to your fingertips. Then your neck, your jaw, your face. The small muscles around your eyes.', 15),
      seg('V1-6', 'And finally the top of your head. Take one more breath with the whole body in view. You have just moved your attention out of commentary and into the body. That is where this practice begins.', 5),
    ],
  },
  V2: {
    exerciseId: 'V2',
    narrator: 'active',
    segments: [
      seg('V2-1', 'Bring to mind one moment coming up that you want to meet well. A conversation, a decision, a task, a situation you can already picture. One moment, with a beginning and an end.', 10),
      seg('V2-2', 'Now see it from inside your own eyes. Not watching yourself from across the room. Looking out, the way you will when it happens. What is in front of you? Who is there? What are your hands doing?', 15),
      seg('V2-3', 'Feel the chair or the ground under you. Feel the temperature of the room in the picture. Let the body be inside the scene, not just the picture of it.', 15),
      seg('V2-4', 'Run the moment through once, at real speed, from the inside. Start to finish. Let it go the way you intend it to go.', 25),
      seg('V2-5', 'Run it once more. Same view, same speed. Seeing it from the inside is what recruits the body most directly. That is why we rehearse this way.', 25),
      seg('V2-6', 'Let the picture fade and come back to the room. The moment is a little more familiar to your system now than it was five minutes ago.', 5),
    ],
  },
  V3: {
    exerciseId: 'V3',
    narrator: 'curious',
    segments: [
      seg('V3-1', 'This one is for learning, not for rehearsing. Bring to mind something you did recently that you want to understand better. It can be something that went well, or something that did not.', 10),
      seg('V3-2', 'Now step back from it. Watch yourself from about ten feet away, as if on video. No commentary. No judgment. Just observe what you did and how you did it.', 20),
      seg('V3-3', 'Notice the sequence. What happened first. What came next. Where it moved smoothly, and where it caught. You are studying this the way you would study anyone else.', 25),
      seg('V3-4', 'If a judgment arrives, let it pass and go back to watching. Distance is useful for understanding. It is not where you rehearse, and we will not use it that way.', 20),
      seg('V3-5', 'Take what you noticed and set the picture down. Open your eyes when you are ready.', 5),
    ],
  },
  V4: {
    exerciseId: 'V4',
    narrator: 'active',
    segments: [
      seg('V4-1', 'Choose one thing you are about to begin. Something with a clear start and a clear finish. Most people stop picturing at the start. This practice is about seeing the whole of it.', 10),
      seg('V4-2', 'See the first move. Then the middle, where the effort is. Then the point where it turns toward finishing. Then the finish itself. Then the moment after, when it has come to rest. In that order, at real speed.', 25),
      seg('V4-3', 'Again. The start, the middle, the turn, the finish, the rest. Let each part take exactly as long as it really would.', 25),
      seg('V4-4', 'Once more. The aim is to see the whole arc before anything begins. When you can, the body has a map to follow.', 25),
      seg('V4-5', 'Let the picture go and come back to the breath. The whole of it is a little more familiar now than it was.', 5),
    ],
  },
  V5: {
    exerciseId: 'V5',
    narrator: 'active',
    segments: [
      seg('V5-1', 'Open your eyes if they are closed, and choose one small, specific point in front of you. A mark on the wall. A thread. The edge of something. Smaller than you think it should be.', 10),
      seg('V5-2', 'Rest your gaze on it and hold it steady. Two or three seconds of stillness. The eyes stop searching, and the rest of the system takes the hint.', 15),
      seg('V5-3', 'Let the gaze soften for a moment, then come back to the same point and hold again. Steady. A stable gaze steadies the whole system. This is the smallest anchor in the library, and one of the strongest.', 20),
      seg('V5-4', 'One more time. Find the point. Hold it. Notice what happens to the breath while you do.', 15),
      seg('V5-5', 'Release the gaze. You can use this anywhere, in the two seconds before anything that matters.', 5),
    ],
  },
  V6: {
    exerciseId: 'V6',
    narrator: 'interoceptive',
    segments: [
      seg('V6-1', 'This one asks something of you. Bring to mind a moment when things did not go the way you wanted. A real one, from your own life. Let it be specific.', 10),
      seg('V6-2', 'Now let yourself feel the drop. In the chest, in the stomach, wherever it lands for you. Do not edit it. The drop is real, and it is allowed.', 20),
      seg('V6-3', 'Now the recovery. One full breath in through the nose. A second, smaller breath on top. Then a long, slow breath out through the mouth until you are empty.', 15),
      seg('V6-4', 'See yourself moving on from that moment. Shoulders down. Eyes up. The next thing is coming, and you are moving toward it settled enough to meet it.', 20),
      seg('V6-5', 'And see yourself meeting the next thing, from the inside. Not perfectly. Fully. The drop and the return are now one trained sequence, rather than a hope.', 20),
      seg('V6-6', 'Let the scene go. What you just rehearsed is recovery, and recovery is the part that can be trained.', 5),
    ],
  },
  V7: {
    exerciseId: 'V7',
    narrator: 'curious',
    segments: [
      seg('V7-1', 'Bring to mind a moment coming up where you will be seen, by people whose opinion matters to you. Now populate it. Put the specific people there. Name them to yourself.', 15),
      seg('V7-2', 'See where each of them is. Notice what happens in your body when they are present. That reaction is information, not a problem.', 20),
      seg('V7-3', 'Now go through the moment, from the inside, with them watching. Start to finish. Let any tightness be there, and go through it anyway.', 25),
      seg('V7-4', 'Again, with them still there. Notice whether the body has already started to treat their presence as familiar.', 25),
      seg('V7-5', 'Let them fade, then let the scene fade. Being watched changes the body before it changes thought. You just gave your system a rehearsal.', 5),
    ],
  },
  V8: {
    exerciseId: 'V8',
    narrator: 'active',
    segments: [
      seg('V8-1', 'Bring back one real moment from your own life that went exactly as you intended. Not a highlight someone else chose. One of yours. Any part of life counts.', 10),
      seg('V8-2', 'Rebuild it with as much detail as you can recover. The light. The sounds. What you could feel in your body as it was working. Let it play through once.', 25),
      seg('V8-3', 'Now a second one. A different day, the same quality. Find the sensory detail again, especially the feeling of the moment it came together.', 25),
      seg('V8-4', 'And a third. Three real moments, from your own body, in a row. This is not pretending. This is remembering what you are capable of.', 25),
      seg('V8-5', 'Let the last one settle. Carry it with you.', 5),
    ],
  },
  V9: {
    exerciseId: 'V9',
    narrator: 'interoceptive',
    segments: [
      seg('V9-1', 'This one is not about the effort. It is about the minute after. Picture yourself just after something that took something out of you. The thing is done.', 10),
      seg('V9-2', 'See the shoulders drop. Not forced. Just the weight coming off them. See the eyes lift and take in something further away.', 20),
      seg('V9-3', 'See the breath lengthen on its own. In through the nose. Longer out. The mind going quiet without being told to.', 25),
      seg('V9-4', 'That is the walk. Most of any demanding day is the recovery between efforts, and recovery is the part you can train. Rehearse it once more.', 25),
      seg('V9-5', 'Let it go. You now have a picture of what settling looks like from the inside.', 5),
    ],
  },
  V10: {
    exerciseId: 'V10',
    narrator: 'interoceptive',
    segments: [
      seg('V10-1', 'Build a place. Real or imagined, it does not matter. One place where your system settles the moment you arrive. Choose it now, and stay with it.', 15),
      seg('V10-2', 'Add the detail. What is under your feet. What the air is like. What you can hear. The further away the horizon, the better.', 25),
      seg('V10-3', 'Find where you sit or stand in it. Feel the support under you. Let the breath find its own slow rhythm here.', 30),
      seg('V10-4', 'This is your sanctuary. The aim is to be able to reach it in three breaths, anywhere, with your eyes open. That takes repetition, and this is one.', 25),
      seg('V10-5', 'Take three breaths here. Then come back to the room, and know the way.', 5),
    ],
  },
  V11: {
    exerciseId: 'V11',
    narrator: 'curious',
    segments: [
      seg('V11-1', 'Open your eyes. Let your attention go wide. Take in the whole room. The edges of your vision. The ceiling. The sounds from outside. Everything at once, nothing in particular.', 20),
      seg('V11-2', 'Now narrow. One point, close, specific. Hold it. Everything else drops away.', 15),
      seg('V11-3', 'Wide again. The whole field. Notice how different the body feels when attention is open.', 20),
      seg('V11-4', 'Narrow. One point. And wide. One more cycle. Narrow. And wide.', 30),
      seg('V11-5', 'Attention width is a control you operate, not a condition that happens to you. You just moved it six times on purpose.', 5),
    ],
  },
  V12: {
    exerciseId: 'V12',
    narrator: 'active',
    segments: [
      seg('V12-1', 'See yourself finishing something that mattered to you. Not the result. The finish. The way you carry yourself in the last minute of it.', 15),
      seg('V12-2', 'Now make it specific. Decide how you want to be known for finishing, whatever the outcome. See that version of you walk away from it.', 25),
      seg('V12-3', 'Run it again, and this time let the outcome be a good one. The finish looks the same.', 20),
      seg('V12-4', 'Run it once more, and let the outcome be a poor one. The finish still looks the same. That is the point of this practice. It is an identity, not a mood.', 25),
      seg('V12-5', 'Let it settle. This is the picture the whole practice points toward.', 5),
    ],
  },
};

// ----- building a session from a script -----

// Resolves a segment's clip URL. Return null when the clip is not available; the
// segment then runs as its own text for its spoken length, so a session never
// breaks on a missing file.
export type NarrationResolver = (segmentId: string) => string | null;

// A guided exercise with a script and a host resolver plays its narration: each
// clip as a media phase with the engine-timed quiet after it, wrapped in the
// paced pre-roll and quiet post-roll the fluidity spec asks of every
// event-locked session. Anything else (no script, no resolver, or a resolver
// that has none of the clips) runs the exercise's own program unchanged.
export function programFor(exercise: PracticeExercise, resolve: NarrationResolver | undefined): PacerProgram {
  const script = exercise.kind === 'guided' ? NARRATION[exercise.id] : undefined;
  if (!script || !resolve) return exercise.program;
  if (!script.segments.some((s) => resolve(s.id))) return exercise.program;
  return withBookends(guidedProgram(script, resolve));
}

// The voice the person heard, for the session record; null when no clip played.
export function narratorIdFor(exercise: PracticeExercise, resolve: NarrationResolver | undefined): string | null {
  const script = exercise.kind === 'guided' ? NARRATION[exercise.id] : undefined;
  if (!script || !resolve) return null;
  if (!script.segments.some((s) => resolve(s.id))) return null;
  return NARRATOR_VOICES[script.narrator].voiceId;
}

// Roughly how long a segment takes to say, for the text-only fallback.
export function spokenSec(text: string): number {
  const words = text.trim().split(/\s+/).length;
  return Math.max(6, Math.round((words / 140) * 60));
}

// Turns a script into the phases of a guided session: each clip as a media phase
// (or a timed text phase when the clip is missing), the pause after it as quiet.
// Wrap the result in withBookends() for the pre-roll and post-roll.
export function guidedProgram(script: NarrationScript, resolve: NarrationResolver): PacerProgram {
  const phases: PacerPhase[] = [];
  script.segments.forEach((s, i) => {
    const src = resolve(s.id);
    if (src) {
      phases.push({ mode: 'media', asset: { kind: 'audio', src, title: s.id }, label: `Part ${i + 1}`, instruction: s.text });
    } else {
      phases.push({ mode: 'freeform', label: `Part ${i + 1}`, instruction: s.text, durationSec: spokenSec(s.text) });
    }
    if (s.pauseAfterSec > 0) {
      phases.push({ mode: 'freeform', label: 'Quiet', instruction: ' ', durationSec: s.pauseAfterSec });
    }
  });
  return { phases };
}

// Every clip the host needs to generate and store, with the text to send to the
// narrator. One entry per segment across all scripts.
export function narrationManifest(): { id: string; exerciseId: string; narrator: NarratorRole; voiceId: string; text: string }[] {
  return Object.values(NARRATION).flatMap((s) =>
    s.segments.map((g) => ({ id: g.id, exerciseId: s.exerciseId, narrator: s.narrator, voiceId: NARRATOR_VOICES[s.narrator].voiceId, text: g.text })),
  );
}
