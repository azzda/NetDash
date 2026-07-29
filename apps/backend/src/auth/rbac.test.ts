import { describe, expect, it } from "vitest";
import { authorize, normaliseGroups, parseGroupList, resolveRole, type RbacConfig } from "./rbac";
import type { SessionUser } from "./session";

const config: RbacConfig = {
  adminGroups: ["homelab-admins"],
  allowedGroups: ["app-netdash"],
};

function user(groups: string[]): SessionUser {
  return {
    sub: "s",
    username: "someone",
    groups,
    exp: Math.floor(Date.now() / 1000) + 60,
  };
}

describe("resolveRole", () => {
  it("denies by default", () => {
    expect(resolveRole([], config)).toBeNull();
    expect(resolveRole(["app-cloud", "app-git"], config)).toBeNull();
  });

  it("grants viewer via the access group", () => {
    expect(resolveRole(["app-netdash"], config)).toBe("viewer");
  });

  it("grants admin via the admin group", () => {
    expect(resolveRole(["homelab-admins"], config)).toBe("admin");
  });

  it("prefers admin when a user holds both", () => {
    expect(resolveRole(["app-netdash", "homelab-admins"], config)).toBe("admin");
  });
});

describe("authorize", () => {
  it("returns null for an unauthorised user, so the caller cannot forget to check", () => {
    expect(authorize(user(["app-photos"]), config)).toBeNull();
  });

  it("attaches the role to an authorised user", () => {
    expect(authorize(user(["app-netdash"]), config)?.role).toBe("viewer");
  });
});

describe("normaliseGroups", () => {
  it("strips the leading slash Keycloak emits on group paths", () => {
    expect(normaliseGroups(["/app-netdash", "/homelab-admins"])).toEqual([
      "app-netdash",
      "homelab-admins",
    ]);
  });

  it("tolerates a missing or malformed claim", () => {
    expect(normaliseGroups(undefined)).toEqual([]);
    expect(normaliseGroups("app-netdash")).toEqual([]);
    expect(normaliseGroups([1, null, "app-netdash"])).toEqual(["app-netdash"]);
  });
});

describe("parseGroupList", () => {
  it("falls back when unset or blank", () => {
    expect(parseGroupList(undefined, ["app-netdash"])).toEqual(["app-netdash"]);
    expect(parseGroupList("   ", ["app-netdash"])).toEqual(["app-netdash"]);
  });

  it("splits and trims", () => {
    expect(parseGroupList("a, b ,c", [])).toEqual(["a", "b", "c"]);
  });
});
