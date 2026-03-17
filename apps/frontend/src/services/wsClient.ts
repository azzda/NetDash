import {
  NETDASH_PROTOCOL_VERSION,
  frontendEnvSchema,
  wsMessageSchema,
} from "@netdash/shared";

interface WsClientOptions {
  onMessage: (message: ReturnType<typeof wsMessageSchema.parse>) => void;
  onError?: (error: string) => void;
  onStatusChange?: (status: "connected" | "reconnecting" | "disconnected") => void;
}

const frontEnv = frontendEnvSchema.parse(import.meta.env);

export function createWsClient({ onMessage, onError, onStatusChange }: WsClientOptions) {
  let socket: WebSocket | undefined;
  let reconnectAttempts = 0;
  let closedByUser = false;

  const connect = () => {
    socket = new WebSocket(frontEnv.VITE_NETDASH_WS_URL);

    socket.onopen = () => {
      reconnectAttempts = 0;
      onStatusChange?.("connected");
    };

    socket.onmessage = (event) => {
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

    socket.onclose = () => {
      if (closedByUser) {
        onStatusChange?.("disconnected");
        return;
      }

      onStatusChange?.("reconnecting");
      reconnectAttempts += 1;
      const jitter = Math.floor(Math.random() * 150);
      const delay = Math.min(5000, 250 * 2 ** reconnectAttempts) + jitter;
      window.setTimeout(connect, delay);
    };

    socket.onerror = () => {
      onError?.("WebSocket connection error");
    };
  };

  connect();

  return {
    close: () => {
      closedByUser = true;
      socket?.close();
    },
  };
}
