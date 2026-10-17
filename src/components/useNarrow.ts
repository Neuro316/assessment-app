'use client';

// Under 640px (Tailwind's sm): where the header pills go short and the armband
// sheet comes up from the bottom.

import { useEffect, useState } from 'react';

export function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return narrow;
}
