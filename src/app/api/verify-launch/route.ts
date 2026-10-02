// ===== VERIFY LAUNCH =====
// POST { token } -> 200 with the token's claims, or 401 { error: 'invalid_token' }.
// The secret stays on the server; the page only ever sees the verdict.

import { NextResponse } from 'next/server';

import { verifyLaunchToken } from '@/lib/launch-token';

export async function POST(request: Request) {
  let token: unknown;
  try {
    ({ token } = await request.json());
  } catch {
    // Unreadable body is the same as no token.
  }

  const claims = typeof token === 'string' && token ? await verifyLaunchToken(token) : null;
  if (!claims) return NextResponse.json({ error: 'invalid_token' }, { status: 401 });

  return NextResponse.json(claims);
}
