import { NETDASH_PROTOCOL_VERSION, frontendEnvSchema, wsMessageSchema } from "@netdash/shared";

interface WsClientOptions {
  onMessage: (message: ReturnType<typeof wsMessageSchema.parse>) => void;
  onError?: (error: string) => void;
  onStatusChange?: (status: "connected" | "reconnecting" | "disconnected") => void;
}

const frontEnv = frontendEnvSchema.parse(import.meta.env);

/**
 * Same-origin by default: in production the backend serves the SPA and the
 * WebSocket on one port/host; in dev the Vite proxy forwards `/ws` to the
 * backend. An explicit `VITE_NETDASH_WS_URL` always wins.
 */
function resolveWsUrl(): string {
  if (frontEnv.VITE_NETDASH_WS_URL) {
    return frontEnv.VITE_NETDASH_WS_URL;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${frontEnv.VITE_NETDASH_WS_PATH}`;
}

export function createWsClient({ onMessage, onError, onStatusChange }: WsClientOptions) {
  let socket: WebSocket | undefined;
  let reconnectAttempts = 0;
  let closedByUser = false;
  let reconnectTimer: number | undefined;

  const connect = () => {
    socket = new WebSocket(resolveWsUrl());

    socket.onopen = () => {
      if (closedByUser) {
        return;
      }
      reconnectAttempts = 0;
      onStatusChange?.("connected");
    };

    socket.onmessage = (event) => {
      if (closedByUser) {
        return;
      }

      try {
        const parsed = wsMessageSchema.parse(JSON.parse(event.data));
        if (parsed.protocolVersion !== NETDASH_PROTOCOL_VERSION) {
          onError?.(
            `Protocol mismatch: expected ${NETDASH_PROTOCOL_VERSION}, received ${parsed.protocolVersion}`,
          );
          return;
        }

        onMessage(parsed);
      } catch (error) {
        onError?.(`Invalid WS payload: ${String(error)}`);
      }
    };

    // Once the consumer has closed this client, its late events must not leak:
    // React StrictMode mounts effects twice, so a torn-down client would
    // otherwise overwrite the status of the live one with "disconnected".
    socket.onclose = () => {
      if (closedByUser) {
        return;
      }

      onStatusChange?.("reconnecting");
      reconnectAttempts += 1;
      const jitter = Math.floor(Math.random() * 150);
      const delay = Math.min(5000, 250 * 2 ** reconnectAttempts) + jitter;
      reconnectTimer = window.setTimeout(connect, delay);
    };

    socket.onerror = () => {
      if (closedByUser) {
        return;
      }
      onError?.("WebSocket connection error");
    };
  };

  connect();

  return {
    close: () => {
      closedByUser = true;
      if (reconnectTimer !== undefined) {
        window.clearTimeout(reconnectTimer);
      }
      socket?.close();
      onStatusChange?.("disconnected");
    },
  };
}
