import type { SessionUser } from "./session";

/**
 * Group-to-role mapping.
 *
 * Default deny: a Keycloak account that is not in an allowed group has no role
 * here, even though it authenticated successfully. Keycloak is also configured
 * to refuse the login outright (the netdash-access-browser flow), so this is
 * the second of two independent gates - if the realm is ever mis-edited, the
 * app still refuses.
 */
export type NetDashRole = "admin" | "viewer";

export interface RbacConfig {
  /** Groups whose members administer NetDash. */
  adminGroups: string[];
  /** Groups whose members may use NetDash at all. */
  allowedGroups: string[];
}

export interface AuthorizedUser extends SessionUser {
  role: NetDashRole;
}

export function resolveRole(groups: string[], config: RbacConfig): NetDashRole | null {
  const held = new Set(groups);

  if (config.adminGroups.some((group) => held.has(group))) {
    return "admin";
  }
  if (config.allowedGroups.some((group) => held.has(group))) {
    return "viewer";
  }
  return null;
}

export function authorize(user: SessionUser, config: RbacConfig): AuthorizedUser | null {
  const role = resolveRole(user.groups, config);
  return role ? { ...user, role } : null;
}

/**
 * Keycloak emits group paths ("/app-netdash"); everything downstream is easier
 * if they are plain names.
 */
export function normaliseGroups(groups: unknown): string[] {
  if (!Array.isArray(groups)) {
    return [];
  }
  return groups
    .filter((group): group is string => typeof group === "string")
    .map((group) => (group.startsWith("/") ? group.slice(1) : group));
}

export function parseGroupList(value: string | undefined, fallback: string[]): string[] {
  if (!value?.trim()) {
    return fallback;
  }
  return value
    .split(",")
    .map((group) => group.trim())
    .filter(Boolean);
}
