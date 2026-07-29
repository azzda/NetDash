import { describe, expect, it } from "vitest";
import { backendEnvSchema, frontendEnvSchema, parseAllowedOrigins } from "./env";

describe("backendEnvSchema", () => {
  it("defaults to a single-origin server with the standalone WS listener disabled", () => {
    const env = backendEnvSchema.parse({});

    expect(env.NETDASH_HTTP_PORT).toBe(4000);
    expect(env.NETDASH_WS_PATH).toBe("/ws");
    expect(env.NETDASH_WS_PORT).toBe(0);
  });

  it("coerces ports and keeps build metadata", () => {
    const env = backendEnvSchema.parse({
      NETDASH_HTTP_PORT: "8080",
      NETDASH_WS_PORT: "4001",
      NETDASH_VERSION: "sha-abc1234",
      NETDASH_COMMIT: "abc1234",
    });

    expect(env.NETDASH_HTTP_PORT).toBe(8080);
    expect(env.NETDASH_WS_PORT).toBe(4001);
    expect(env.NETDASH_VERSION).toBe("sha-abc1234");
    expect(env.NETDASH_COMMIT).toBe("abc1234");
  });

  it("rejects a WebSocket path that is not rooted", () => {
    expect(() => backendEnvSchema.parse({ NETDASH_WS_PATH: "ws" })).toThrow();
  });
});

describe("frontendEnvSchema", () => {
  it("leaves the WS URL unset so the client derives a same-origin URL", () => {
    const env = frontendEnvSchema.parse({});

    expect(env.VITE_NETDASH_WS_URL).toBeUndefined();
    expect(env.VITE_NETDASH_WS_PATH).toBe("/ws");
  });

  it("accepts an absolute override", () => {
    const env = frontendEnvSchema.parse({ VITE_NETDASH_WS_URL: "ws://10.0.30.200:4000/ws" });

    expect(env.VITE_NETDASH_WS_URL).toBe("ws://10.0.30.200:4000/ws");
  });
});

describe("parseAllowedOrigins", () => {
  it("treats '*' and empty as wildcard", () => {
    expect(parseAllowedOrigins("*")).toBe("*");
    expect(parseAllowedOrigins("   ")).toBe("*");
  });

  it("splits and trims a comma-separated allowlist", () => {
    expect(parseAllowedOrigins("https://a.example, https://b.example")).toEqual([
      "https://a.example",
      "https://b.example",
    ]);
  });
});
