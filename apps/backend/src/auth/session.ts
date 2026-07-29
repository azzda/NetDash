import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Stateless, signed session cookies.
 *
 * No server-side store on purpose: NetDash runs multiple replicas in prod, and
 * a shared store would be another thing to run and back up. The cookie carries
 * the identity, an HMAC proves we issued it, and `exp` bounds its life.
 *
 * The cookie is NOT encrypted - it is signed. Only put in it what the user is
 * already allowed to know about themselves.
 */

export interface SessionUser {
  /** OIDC subject - the stable identifier. */
  sub: string;
  username: string;
  name?: string;
  email?: string;
  groups: string[];
  /** Seconds since epoch. */
  exp: number;
}

const ENCODING = "base64url";

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest(ENCODING);
}

export function encodeSession(user: SessionUser, secret: string): string {
  const payload = Buffer.from(JSON.stringify(user), "utf8").toString(ENCODING);
  return `${payload}.${sign(payload, secret)}`;
}

/**
 * Returns the session, or null for anything untrustworthy: a bad shape, a
 * forged or truncated signature, or an expired session.
 */
export function decodeSession(
  value: string | undefined,
  secret: string,
  now = Date.now(),
): SessionUser | null {
  if (!value) {
    return null;
  }

  const separator = value.lastIndexOf(".");
  if (separator <= 0) {
    return null;
  }

  const payload = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  const expected = sign(payload, secret);

  // Constant-time compare, and only when the lengths already match -
  // timingSafeEqual throws on a length mismatch.
  const provided = Buffer.from(signature);
  const computed = Buffer.from(expected);
  if (provided.length !== computed.length || !timingSafeEqual(provided, computed)) {
    return null;
  }

  let parsed: SessionUser;
  try {
    parsed = JSON.parse(Buffer.from(payload, ENCODING).toString("utf8")) as SessionUser;
  } catch {
    return null;
  }

  if (!parsed || typeof parsed.sub !== "string" || typeof parsed.exp !== "number") {
    return null;
  }
  if (!Array.isArray(parsed.groups)) {
    return null;
  }
  if (parsed.exp * 1000 <= now) {
    return null;
  }

  return parsed;
}

export function generateSessionSecret(): string {
  return randomBytes(32).toString("hex");
}

export const SESSION_COOKIE = "netdash_session";
/** Short-lived cookie holding the PKCE verifier and state between the two legs of a login. */
export const LOGIN_STATE_COOKIE = "netdash_login";
