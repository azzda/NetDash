import cors from "cors";
import express from "express";
import { backendEnvSchema } from "@netdash/shared";
import { attachWebSocketServer } from "./websocket/server";

const env = backendEnvSchema.parse(process.env);

const app = express();
app.use(cors({ origin: env.NETDASH_ALLOWED_ORIGIN }));

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "netdash-backend",
    httpPort: env.NETDASH_HTTP_PORT,
    wsPort: env.NETDASH_WS_PORT,
    ts: Date.now(),
  });
});

app.listen(env.NETDASH_HTTP_PORT, () => {
  console.log(`NetDash backend listening on http://localhost:${env.NETDASH_HTTP_PORT}`);
});

attachWebSocketServer(env.NETDASH_WS_PORT);
console.log(`NetDash WebSocket listening on ws://localhost:${env.NETDASH_WS_PORT}`);
