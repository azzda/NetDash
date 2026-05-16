import cors from "cors";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { backendEnvSchema } from "@netdash/shared";
import { attachWebSocketServer } from "./websocket/server";

const env = backendEnvSchema.parse(process.env);

const app = express();
app.use(cors({ origin: env.NETDASH_ALLOWED_ORIGIN }));

// In production, serve the frontend static build
if (process.env.NODE_ENV === "production") {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const frontendDist = path.resolve(__dirname, "../../frontend/dist");
  app.use(express.static(frontendDist));
}

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "netdash-backend",
    httpPort: env.NETDASH_HTTP_PORT,
    wsPort: env.NETDASH_WS_PORT,
    ts: Date.now(),
  });
});

const httpServer = app.listen(env.NETDASH_HTTP_PORT, () => {
  console.log(`NetDash backend listening on http://localhost:${env.NETDASH_HTTP_PORT}`);
});

const wss = attachWebSocketServer(env.NETDASH_WS_PORT);
console.log(`NetDash WebSocket listening on ws://localhost:${env.NETDASH_WS_PORT}`);

// Graceful shutdown
function shutdown() {
  console.log("Shutting down...");
  wss.close();
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
