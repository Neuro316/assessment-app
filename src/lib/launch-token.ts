// ===== LAUNCH TOKEN =====
// Verifies the signed token the University will put on a launch link. SERVER ONLY:
// it reads LAUNCH_TOKEN_SECRET, which must never be exposed to the browser (no
// NEXT_PUBLIC_ prefix). Called from /api/verify-launch, never from a component.
//
// Every failure — no secret, bad signature, expired, missing or malformed claims —
// comes back as null, so the caller only ever has to ask "valid or not".

import { jwtVerify } from 'jose';

export type LaunchMode = 'assessment' | 'practice' | 'bundle';

export interface LaunchClaims {
  personId: string;
  mode: LaunchMode;
  exp: number;
}

const MODES: LaunchMode[] = ['assessment', 'practice', 'bundle'];

export async function verifyLaunchToken(token: string): Promise<LaunchClaims | null> {
  const secret = process.env.LAUNCH_TOKEN_SECRET;
  if (!secret) {
    console.error('[launch-token] LAUNCH_TOKEN_SECRET is not set; every launch token will be rejected');
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ['HS256'],
      // jwtVerify only checks exp when it is present; a token without one must not
      // be treated as valid forever.
      requiredClaims: ['sub', 'exp'],
    });

    const { sub, mode, exp } = payload;
    if (typeof sub !== 'string' || !sub) return null;
    if (typeof mode !== 'string' || !MODES.includes(mode as LaunchMode)) return null;
    if (typeof exp !== 'number') return null;

    return { personId: sub, mode: mode as LaunchMode, exp };
  } catch {
    return null;
  }
}
