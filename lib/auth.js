// lib/auth.js — minimal, self-contained session auth.
// - Passwords hashed with bcrypt (never stored in plain text)
// - Sessions are signed JWTs (jose, HS256) in an httpOnly cookie, so the
//   client JS can never read or forge them; the API derives the user from
//   the cookie and NEVER trusts a client-supplied userId.
// Swap-friendly: replace with Auth.js or Supabase later without touching
// the rest of the API surface.

import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';

export const SESSION_COOKIE = 'tc_session';

export const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 24 * 30, // 30 days
};

function secretKey() {
  const s = process.env.AUTH_SECRET;
  if (!s && process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET must be set in production');
  }
  return new TextEncoder().encode(s || 'dev-only-secret-change-me');
}

export const hashPassword = (pw) => bcrypt.hash(pw, 10);
export const verifyPassword = (pw, hash) => bcrypt.compare(pw, hash);

export async function signSession(user) {
  return await new SignJWT({ email: user.email, name: user.name || null })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secretKey());
}

/** Read + verify the session cookie from a Next.js Request. Returns
 *  { id, email, name } or null. */
export async function getSessionUser(request) {
  const token = request.cookies?.get?.(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return { id: payload.sub, email: payload.email, name: payload.name || null };
  } catch {
    return null;
  }
}
