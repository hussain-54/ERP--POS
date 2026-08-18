import { WebSocket } from "ws";

type WebSocketLikeConstructor = {
  new (address: string | URL, subprotocols?: string | string[]): unknown;
};

ensureNodeWebSocket();

/**
 * @supabase/realtime-js requires a WebSocket constructor.
 * Node 20 (Vercel/Docker `engines.node: 20.x`) has none; Node 22+ does.
 */
export function nodeWebSocketTransport(): WebSocketLikeConstructor {
  if (typeof globalThis.WebSocket === "function") {
    return globalThis.WebSocket as unknown as WebSocketLikeConstructor;
  }
  return WebSocket as unknown as WebSocketLikeConstructor;
}

export function ensureNodeWebSocket(): void {
  if (typeof globalThis.WebSocket === "function") return;
  Object.defineProperty(globalThis, "WebSocket", {
    value: WebSocket,
    configurable: true,
    writable: true,
  });
}

export function supabaseRealtimeOptions(): { realtime: { transport: never } } {
  ensureNodeWebSocket();
  return { realtime: { transport: nodeWebSocketTransport() as never } };
}
