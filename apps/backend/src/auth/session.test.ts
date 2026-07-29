import { describe, expect, it } from "vitest";
import { decodeSession, encodeSession, generateSessionSecret, type SessionUser } from "./session";

const SECRET = "a".repeat(64);
const OTHER_SECRET = "b".repeat(64);

function user(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    sub: "abc-123",
    username: "azzda",
    name: "azzda admin",
    email: "azzda@example.invalid",
    groups: ["homelab-admins", "app-netdash"],
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  };
}

describe("session cookies", () => {
  it("round-trips a session", () => {
    const original = user();
    const decoded = decodeSession(encodeSession(original, SECRET), SECRET);

    expect(decoded).toEqual(original);
  });

  it("rejects a session signed with a different secret", () => {
    const cookie = encodeSession(user(), OTHER_SECRET);

    expect(decodeSession(cookie, SECRET)).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const cookie = encodeSession(user({ groups: [] }), SECRET);
    const [, signature] = cookie.split(".");
    // Re-encode the payload with elevated groups, keeping the old signature.
    const forgedPayload = Buffer.from(
      JSON.stringify(user({ groups: ["homelab-admins"] })),
      "utf8",
    ).toString("base64url");

    expect(decodeSession(`${forgedPayload}.${signature}`, SECRET)).toBeNull();
  });

  it("rejects an expired session", () => {
    const cookie = encodeSession(user({ exp: Math.floor(Date.now() / 1000) - 1 }), SECRET);

    expect(decodeSession(cookie, SECRET)).toBeNull();
  });

  it("accepts a session right up to its expiry", () => {
    const exp = Math.floor(Date.now() / 1000) + 10;
    const cookie = encodeSession(user({ exp }), SECRET);

    expect(decodeSession(cookie, SECRET, exp * 1000 - 1)).not.toBeNull();
    expect(decodeSession(cookie, SECRET, exp * 1000)).toBeNull();
  });

  it("rejects malformed input rather than throwing", () => {
    for (const value of ["", "no-separator", ".", "abc.", "...", "not base64!.sig"]) {
      expect(decodeSession(value, SECRET)).toBeNull();
    }
    expect(decodeSession(undefined, SECRET)).toBeNull();
  });

  it("rejects a payload that is valid JSON but not a session", () => {
    const payload = Buffer.from(JSON.stringify({ hello: "world" }), "utf8").toString("base64url");
    const cookie = encodeSession(user(), SECRET);
    const signature = cookie.split(".")[1];

    expect(decodeSession(`${payload}.${signature}`, SECRET)).toBeNull();
  });

  it("generates secrets long enough to be worth signing with", () => {
    expect(generateSessionSecret()).toHaveLength(64);
    expect(generateSessionSecret()).not.toBe(generateSessionSecret());
  });
});
