// ===== WAKE LOCK =====
// Keeps the screen on for the duration of a practice session, so a 5-11
// minute paced-breathing exercise doesn't get cut off by the device locking.
//
// RECONSTRUCTION NOTICE: this is new code, not recovered from the lost
// session — nothing about the original wake lock implementation survived
// except that one existed. This is a standard, defensive implementation of
// the Screen Wake Lock API, not a restoration of specific prior behavior.

import { useEffect, useRef } from 'react';

// Not every browser exposes this (iOS Safari added it late; some browsers
// never will), so every call site must tolerate `navigator.wakeLock` being
// absent — this hook degrades to a no-op rather than throwing.
type WakeLockSentinelLike = { release: () => Promise<void> };

export function useWakeLock(active: boolean): void {
  const lockRef = useRef<WakeLockSentinelLike | null>(null);

  useEffect(() => {
    if (!active) return;
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;

    let cancelled = false;

    const acquire = async () => {
      try {
        const lock = await (navigator as unknown as {
          wakeLock: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
        }).wakeLock.request('screen');
        if (cancelled) {
          // The effect was cleaned up while the request was in flight.
          void lock.release();
          return;
        }
        lockRef.current = lock;
      } catch {
        // Request can be refused (e.g. battery saver, backgrounded tab at
        // request time) — the session still runs, it just might dim.
      }
    };

    void acquire();

    // The lock is released automatically whenever the tab is backgrounded,
    // and NOT re-acquired automatically when it comes back — re-request on
    // visibility return so a session survives a brief app-switch.
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && active && lockRef.current === null) {
        void acquire();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      if (lockRef.current) {
        void lockRef.current.release();
        lockRef.current = null;
      }
    };
  }, [active]);
}
