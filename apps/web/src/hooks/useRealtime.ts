/**
 * Digital Twin FM — useRealtime hook
 *
 * Connects to the api-gateway's Socket.IO WebSocket gateway at `/realtime`,
 * authenticates with the JWT from the httpOnly cookie, and updates the
 * viewer store with live asset status changes and alerts.
 *
 * Usage:
 *   const { connected } = useRealtime();
 *
 * The hook manages its own connection lifecycle — it connects when the
 * component mounts and disconnects on unmount.
 */
"use client";

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { useViewerStore } from "@/features/digital-twin/viewer-store";
import type { AssetStatus } from "@/features/digital-twin/viewer-data";

/** URL of the api-gateway. In dev this is localhost:4000. */
const WS_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/** Socket.IO namespace (matches the @WebSocketGateway decorator). */
const WS_NAMESPACE = "/realtime";

/** Token fetch endpoint (Next.js Route Handler). */
const TOKEN_ENDPOINT = "/api/auth/ws-token";

export interface UseRealtimeResult {
  connected: boolean;
}

export function useRealtime(): UseRealtimeResult {
  const socketRef = useRef<Socket | null>(null);
  const connected = useViewerStore((s) => s.wsConnected);
  const setWsConnected = useViewerStore((s) => s.setWsConnected);
  const setAssetStatus = useViewerStore((s) => s.setAssetStatus);

  useEffect(() => {
    let cancelled = false;
    let socket: Socket | null = null;

    async function connect() {
      try {
        // 1. Fetch the JWT from the server-side cookie reader
        const res = await fetch(TOKEN_ENDPOINT);
        if (!res.ok) {
          console.warn("[useRealtime] No valid session — skipping WS connect");
          return;
        }
        const { token } = await res.json();
        if (!token || cancelled) return;

        // 2. Connect to the WebSocket gateway with the JWT
        socket = io(`${WS_URL}${WS_NAMESPACE}`, {
          auth: { token },
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 2000,
          reconnectionDelayMax: 15000,
        });

        socket.on("connect", () => {
          if (!cancelled) setWsConnected(true);
          console.log("[useRealtime] Connected", socket?.id);
        });

        socket.on("disconnect", (reason) => {
          if (!cancelled) setWsConnected(false);
          console.log("[useRealtime] Disconnected:", reason);
        });

        socket.on("connect_error", (err) => {
          console.warn("[useRealtime] Connection error:", err.message);
        });

        // 3. Handle asset status updates from the ingestion pipeline
        socket.on(
          "asset:updated",
          (payload: { assetId: string; status?: AssetStatus; type?: string }) => {
            if (payload.status && !cancelled) {
              setAssetStatus(payload.assetId, payload.status);
            }
          },
        );

        // 4. Handle new alerts (for future alert overlays)
        socket.on("alert:created", (alert: { assetId?: string; severity?: string; message?: string }) => {
          console.log("[useRealtime] Alert:", alert.severity, alert.message);
          // Future: add to alert overlay store
        });

        socketRef.current = socket;
      } catch (err) {
        console.warn("[useRealtime] Failed to connect:", err);
      }
    }

    connect();

    return () => {
      cancelled = true;
      if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
        socketRef.current = null;
      }
      setWsConnected(false);
    };
  }, [setWsConnected, setAssetStatus]);

  return { connected };
}
