/**
 * Digital Twin FM — useSensorRealtime hook
 *
 * Connects to the api-gateway's Socket.IO WebSocket gateway and listens
 * for `sensor:reading` events pushed by the ingestion pipeline via Redis.
 *
 * Provides live sensor reading updates to the monitoring dashboard.
 * Falls back gracefully when the WS is not available (returns connected=false).
 *
 * Usage:
 *   const { readings, connected, error } = useSensorRealtime();
 *   // readings is a Map<string, SensorReading> keyed by sensorId
 */
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, type Socket } from "socket.io-client";

const WS_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const WS_NAMESPACE = "/realtime";
const TOKEN_ENDPOINT = "/api/auth/ws-token";

export interface SensorReading {
  sensorId: string;
  assetId: string;
  value: number;
  unit: string;
  timestamp: string;
}

export interface UseSensorRealtimeResult {
  /** Latest reading per sensor, keyed by sensorId */
  readings: Map<string, SensorReading>;
  /** Whether the WebSocket is currently connected */
  connected: boolean;
  /** Error message if connection failed */
  error: string | null;
}

export function useSensorRealtime(): UseSensorRealtimeResult {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const readingsRef = useRef<Map<string, SensorReading>>(new Map());
  const [, forceUpdate] = useState(0);

  const triggerUpdate = useCallback(() => {
    forceUpdate((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let socket: Socket | null = null;

    async function connect() {
      try {
        const res = await fetch(TOKEN_ENDPOINT);
        if (!res.ok) {
          if (!cancelled) setError("No valid session for realtime");
          return;
        }
        const { token } = await res.json();
        if (!token || cancelled) return;

        socket = io(`${WS_URL}${WS_NAMESPACE}`, {
          auth: { token },
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 2000,
          reconnectionDelayMax: 15000,
        });

        socket.on("connect", () => {
          if (!cancelled) {
            setConnected(true);
            setError(null);
          }
          console.log("[useSensorRealtime] Connected", socket?.id);
        });

        socket.on("disconnect", (reason) => {
          if (!cancelled) setConnected(false);
          console.log("[useSensorRealtime] Disconnected:", reason);
        });

        socket.on("connect_error", (err) => {
          if (!cancelled) setError(err.message);
          console.warn("[useSensorRealtime] Connection error:", err.message);
        });

        // Listen for live sensor readings from the ingestion pipeline
        socket.on("sensor:reading", (payload: SensorReading) => {
          if (cancelled) return;
          readingsRef.current.set(payload.sensorId, payload);
          triggerUpdate();
        });

        socketRef.current = socket;
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to connect");
        }
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
      setConnected(false);
    };
  }, [triggerUpdate]);

  return {
    readings: readingsRef.current,
    connected,
    error,
  };
}
