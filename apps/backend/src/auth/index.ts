import type { IncomingMessage } from "node:http";
import type { RequestHandler, Router } from "express";
import express from "express";
import type { BackendEnv } from "@netdash/shared";
import { OidcClient } from "./oidc";
import { authorize, parseGroupList, type AuthorizedUser, type RbacConfig } from "./rbac";
import {
  LOGIN_STATE_COOKIE,
  SESSION_COOKIE,
  decodeSession,
  encodeSession,
  type SessionUser,
} from "./session";

export interface AuthContext {
  enabled: boolean;
  /** Express routes for login/callback/logout/me. */
  router: Router;
  /** Rejects a request that has no authorised session. */
  guard: RequestHandler;
  /** Same check, for the WebSocket upgrade. */
  authorizeRequest(req: IncomingMessage): AuthorizedUser | null;
}

/** Minimal cookie parsing - avoids a dependency for one header. */
export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) {
    return out;
  }
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) {
      continue;
    }
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) {
      out[key] = decodeURIComponent(value);
    }
  }
  return out;
}

function audit(event: string, fields: Record<string, unknown>): void {
  // Structured so Loki can filter on it. Auth decisions are exactly the kind of
  // thing you want a record of when something goes wrong.
  console.log(JSON.stringify({ level: "info", event, ...fields, ts: new Date().toISOString() }));
}

/**
 * When authentication is disabled (the default for a fresh checkout and for
 * local development) every request is treated as an anonymous admin. That is
 * only ever appropriate on a laptop - the deployment sets NETDASH_AUTH=oidc.
 */
function createDisabledAuth(): AuthContext {
  const anonymous: AuthorizedUser = {
    sub: "anonymous",
    username: "anonymous",
    name: "Anonymous",
    groups: [],
    exp: Number.MAX_SAFE_INTEGER,
    role: "admin",
  };

  const router = express.Router();
  router.get("/api/me", (_req, res) => {
    res.json({ authenticated: false, authEnabled: false, user: anonymous });
  });

  return {
    enabled: false,
    router,
    guard: (_req, _res, next) => next(),
    authorizeRequest: () => anonymous,
  };
}

export function createAuth(env: BackendEnv): AuthContext {
  if (env.NETDASH_AUTH !== "oidc") {
    return createDisabledAuth();
  }

  const missing = (
    [
      "NETDASH_OIDC_ISSUER",
      "NETDASH_OIDC_CLIENT_ID",
      "NETDASH_OIDC_CLIENT_SECRET",
      "NETDASH_PUBLIC_URL",
      "NETDASH_SESSION_SECRET",
    ] as const
  ).filter((key) => !env[key]);
  if (missing.length) {
    throw new Error(`NETDASH_AUTH=oidc requires ${missing.join(", ")}`);
  }

  const sessionSecret = env.NETDASH_SESSION_SECRET as string;
  const rbac: RbacConfig = {
    adminGroups: parseGroupList(env.NETDASH_ADMIN_GROUPS, ["homelab-admins"]),
    allowedGroups: parseGroupList(env.NETDASH_ALLOWED_GROUPS, ["app-netdash"]),
  };

  const oidc = new OidcClient({
    issuer: env.NETDASH_OIDC_ISSUER as string,
    clientId: env.NETDASH_OIDC_CLIENT_ID as string,
    clientSecret: env.NETDASH_OIDC_CLIENT_SECRET as string,
    publicUrl: env.NETDASH_PUBLIC_URL as string,
    sessionTtlSeconds: env.NETDASH_SESSION_TTL_SECONDS,
  });

  const secureCookies = (env.NETDASH_PUBLIC_URL as string).startsWith("https://");
  // Keycloak (and any standard OIDC realm) serves a self-service Account Console
  // at `${issuer}/account`. NetDash does not manage profiles itself - it just
  // points users at the IdP's own console, which keeps working when the backing
  // user store changes (e.g. moving to a Samba AD DC behind Keycloak).
  const accountManageUrl = `${(env.NETDASH_OIDC_ISSUER as string).replace(/\/+$/, "")}/account`;
  const cookieBase = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: secureCookies,
    path: "/",
  };

  function sessionFrom(req: IncomingMessage): SessionUser | null {
    const cookies = parseCookies(req.headers.cookie);
    return decodeSession(cookies[SESSION_COOKIE], sessionSecret);
  }

  function authorizeRequest(req: IncomingMessage): AuthorizedUser | null {
    const session = sessionFrom(req);
    return session ? authorize(session, rbac) : null;
  }

  const router = express.Router();

  router.get("/auth/login", (req, res) => {
    void (async () => {
      try {
        const login = await oidc.createLoginRequest();
        // The verifier and state must survive the round trip to Keycloak but
        // must not be readable by scripts, hence an httpOnly cookie rather than
        // in-memory state (which would break across replicas anyway).
        res.cookie(
          LOGIN_STATE_COOKIE,
          encodeSession(
            {
              sub: "login",
              username: login.state,
              groups: [login.codeVerifier],
              exp: Math.floor(Date.now() / 1000) + 600,
            },
            sessionSecret,
          ),
          { ...cookieBase, maxAge: 600_000 },
        );
        res.redirect(login.authorizationUrl);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        audit("auth.login_failed", { reason: message });
        res.status(502).send("Identity provider unavailable");
      }
    })();
  });

  router.get("/auth/callback", (req, res) => {
    void (async () => {
      const pending = decodeSession(
        parseCookies(req.headers.cookie)[LOGIN_STATE_COOKIE],
        sessionSecret,
      );
      res.clearCookie(LOGIN_STATE_COOKIE, cookieBase);

      const code = typeof req.query.code === "string" ? req.query.code : undefined;
      const state = typeof req.query.state === "string" ? req.query.state : undefined;

      if (!pending || !code || !state || state !== pending.username) {
        // A mismatched state is the CSRF signal; treat it as hostile, not as a
        // glitch to retry.
        audit("auth.callback_rejected", { reason: "state mismatch or missing code" });
        res.status(400).send("Invalid login state. Please start again from /auth/login.");
        return;
      }

      try {
        const user = await oidc.exchangeCode(code, pending.groups[0]);
        const authorized = authorize(user, rbac);
        if (!authorized) {
          audit("auth.denied", { username: user.username, groups: user.groups });
          res
            .status(403)
            .send(
              "Your account is not authorised for NetDash. Ask an admin to add you to the app-netdash group.",
            );
          return;
        }

        res.cookie(SESSION_COOKIE, encodeSession(user, sessionSecret), {
          ...cookieBase,
          maxAge: Math.max(0, user.exp * 1000 - Date.now()),
        });
        audit("auth.login", { username: user.username, role: authorized.role });
        res.redirect("/");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        audit("auth.exchange_failed", { reason: message });
        res.status(502).send("Login failed. Please try again.");
      }
    })();
  });

  router.post("/auth/logout", (req, res) => {
    void (async () => {
      const user = sessionFrom(req);
      res.clearCookie(SESSION_COOKIE, cookieBase);
      audit("auth.logout", { username: user?.username });
      res.json({ ok: true, endSessionUrl: await oidc.endSessionUrl().catch(() => undefined) });
    })();
  });

  router.get("/api/me", (req, res) => {
    const user = authorizeRequest(req);
    if (!user) {
      res.status(401).json({ authenticated: false, authEnabled: true });
      return;
    }
    res.json({
      authenticated: true,
      authEnabled: true,
      account: { manageUrl: accountManageUrl },
      user: {
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        groups: user.groups,
      },
    });
  });

  const guard: RequestHandler = (req, res, next) => {
    if (authorizeRequest(req)) {
      next();
      return;
    }

    // An API caller gets a 401 to handle; a browser gets sent to the IdP.
    if (req.path.startsWith("/api/") || req.headers.accept?.includes("application/json")) {
      res.status(401).json({ error: "authentication required" });
      return;
    }
    res.redirect("/auth/login");
  };

  return { enabled: true, router, guard, authorizeRequest };
}
