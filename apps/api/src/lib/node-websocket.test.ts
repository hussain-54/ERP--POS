import { describe, expect, it } from "vitest";
import {
  ensureNodeWebSocket,
  nodeWebSocketTransport,
  supabaseRealtimeOptions,
} from "./node-websocket.js";

describe("node websocket transport", () => {
  it("supplies a WebSocket constructor when native WebSocket is missing", () => {
    const original = globalThis.WebSocket;
    const hadNative = typeof original === "function";
    try {
      if (hadNative) {
        Object.defineProperty(globalThis, "WebSocket", {
          value: undefined,
          configurable: true,
          writable: true,
        });
      }
      ensureNodeWebSocket();
      const transport = nodeWebSocketTransport();
      expect(typeof transport).toBe("function");
      expect(typeof supabaseRealtimeOptions().realtime.transport).toBe("function");
    } finally {
      Object.defineProperty(globalThis, "WebSocket", {
        value: original,
        configurable: true,
        writable: true,
      });
    }
  });
});
