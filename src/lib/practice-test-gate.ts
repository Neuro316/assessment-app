// ===== /practice TEST PAGE GATE =====
// /practice is a manual test harness with stub data and no access control of its
// own. It exists only where it is switched on:
//   - PRACTICE_TEST_PAGE=1 turns it on anywhere, production included;
//   - `next dev` (NODE_ENV=development) has it on, so local testing needs no setup;
//   - anywhere else, including a production build with the flag unset, it is off and
//     the route answers 404.
// The flag is read at request time (the page is dynamic), so changing it in the
// deployment's environment needs no rebuild.
//
// Pure, so the tests can load it directly.

export function isPracticeTestPageEnabled(env: { PRACTICE_TEST_PAGE?: string; NODE_ENV?: string }): boolean {
  return env.PRACTICE_TEST_PAGE === '1' || env.NODE_ENV === 'development';
}
