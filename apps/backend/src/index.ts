import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import type { WebSocketServer } from "ws";
import { backendEnvSchema, parseAllowedOrigins } from "@netdash/shared";
import { createAuth } from "./auth";
import { createProvider } from "./providers";
import { attachWebSocketServer } from "./websocket/server";

const env = backendEnvSchema.parse(process.env);
const isProduction = process.env.NODE_ENV === "production";
const provider = createProvider(env);
const auth = createAuth(env);

const buildInfo = {
  version: env.NETDASH_VERSION,
  commit: env.NETDASH_COMMIT,
  buildTime: env.NETDASH_BUILD_TIME,
};

const allowedOrigins = parseAllowedOrigins(env.NETDASH_ALLOWED_ORIGIN);

const app = express();
app.disable("x-powered-by");
// Behind Traefik, so the client protocol/host come from the proxy headers.
app.set("trust proxy", true);
app.use(
  cors({
    origin: allowedOrigins === "*" ? "*" : allowedOrigins,
    credentials: true,
  }),
);

// Health must stay unauthenticated: kubelet probes carry no session.
app.get(["/health", "/healthz", "/readyz"], (_req, res) => {
  res.json({
    status: "ok",
    service: "netdash-backend",
    ...buildInfo,
    source: provider.name,
    auth: auth.enabled ? "oidc" : "disabled",
    httpPort: env.NETDASH_HTTP_PORT,
    wsPath: env.NETDASH_WS_PATH,
    wsStandalonePort: env.NETDASH_WS_PORT || null,
    uptimeSec: Math.round(process.uptime()),
    ts: Date.now(),
  });
});

// Login/callback/logout must be reachable without a session, so the auth routes
// are mounted before the guard.
app.use(auth.router);
app.use(auth.guard);

// In production the same process serves the built frontend, so the whole app is
// a single origin behind a single Ingress host - which is also what the
// same-origin WebSocket path below depends on.
if (isProduction) {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const frontendDist = path.resolve(currentDir, "../../frontend/dist");
  const indexHtml = path.join(frontendDist, "index.html");

  app.use(express.static(frontendDist));
  app.get("*", (req, res, next) => {
    if (req.path === env.NETDASH_WS_PATH || req.path.startsWith("/api/")) {
      next();
      return;
    }
    res.sendFile(indexHtml);
  });
}

const httpServer = http.createServer(app);

const wss = attachWebSocketServer({
  server: httpServer,
  path: env.NETDASH_WS_PATH,
  allowedOrigin: env.NETDASH_ALLOWED_ORIGIN,
  provider,
  refreshIntervalMs: env.NETDASH_REFRESH_INTERVAL_MS,
  authorizeRequest: auth.authorizeRequest,
});

let standaloneWss: WebSocketServer | undefined;
if (env.NETDASH_WS_PORT > 0) {
  standaloneWss = attachWebSocketServer({
    port: env.NETDASH_WS_PORT,
    allowedOrigin: env.NETDASH_ALLOWED_ORIGIN,
    provider,
    refreshIntervalMs: env.NETDASH_REFRESH_INTERVAL_MS,
    authorizeRequest: auth.authorizeRequest,
  });
  console.log(`NetDash standalone WebSocket listening on ws://localhost:${env.NETDASH_WS_PORT}`);
}

httpServer.listen(env.NETDASH_HTTP_PORT, () => {
  console.log(
    `NetDash backend ${buildInfo.version} (${buildInfo.commit}) listening on ` +
      `http://localhost:${env.NETDASH_HTTP_PORT} (ws: ${env.NETDASH_WS_PATH}, ` +
      `source: ${provider.name}, auth: ${auth.enabled ? "oidc" : "disabled"})`,
  );
  if (!auth.enabled) {
    console.warn(
      "WARNING: NETDASH_AUTH=disabled - every caller is treated as an admin. Do not expose this.",
    );
  }
});

// Graceful shutdown
function shutdown() {
  console.log("Shutting down...");
  wss.close();
  standaloneWss?.close();
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
