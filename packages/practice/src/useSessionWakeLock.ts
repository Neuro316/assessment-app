// ===== useSessionWakeLock =====
// Keeps the screen awake for as long as `active` is true — a practice session is
// running — whether or not a strap is connected. Released when the session ends,
// is cancelled, or the component unmounts.
//
// The browser drops a wake lock whenever the page is hidden (tab switch, screen
// off), so it is re-requested each time the page becomes visible again while the
// session is still running.
//
// This covers the idle timeout only. A hardware power button, or the OS locking a
// phone in a pocket, is outside what a web page can prevent.

import { useEffect } from 'react';

export function useSessionWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let stopped = false;

    const acquire = async () => {
      if (stopped || sentinel || document.visibilityState !== 'visible') return;
      try {
        const lock = await navigator.wakeLock.request('screen');
        // The session may have ended while the request was in flight.
        if (stopped) {
          lock.release().catch(() => {});
          return;
        }
        sentinel = lock;
        lock.addEventListener('release', () => {
          if (sentinel === lock) sentinel = null;
        });
      } catch {
        // Refused (no permission, hidden page, or a frame without screen-wake-lock).
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', onVisibility);
      if (sentinel) {
        const lock = sentinel;
        sentinel = null;
        lock.release().catch(() => {});
      }
    };
  }, [active]);
}
