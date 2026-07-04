/**
 * Digital Twin FM — useBrowserNotifications hook
 *
 * Wraps the Browser Notification API to show system-level notifications
 * when new alerts fire. Handles permission request, availability check,
 * and deduplication of repeated notifications.
 *
 * On first mount, requests permission silently. Notifications auto-hide
 * after 6 seconds and navigate to the alerts page when clicked.
 *
 * Usage:
 *   const { notify, permission } = useBrowserNotifications();
 *   notify({
 *     title: "Energy spike detected",
 *     body: "Chiller C-102 is consuming 45% above threshold",
 *     assetId: "...",
 *   });
 */
"use client";

import { useCallback, useRef } from "react";

export type NotificationPermission = "granted" | "denied" | "default" | "unsupported";

export interface BrowserNotificationPayload {
  title: string;
  body: string;
  /** Optional — opens /dashboard/alerts when notification is clicked */
  assetId?: string;
  severity?: "info" | "warning" | "critical";
}

export interface UseBrowserNotificationsResult {
  /** Show a system notification. Returns false if unsupported or denied. */
  notify: (payload: BrowserNotificationPayload) => boolean;
  /** Current permission state */
  permission: NotificationPermission;
  /** Request permission explicitly (called automatically on first `notify`) */
  requestPermission: () => Promise<NotificationPermission>;
}

export function useBrowserNotifications(): UseBrowserNotificationsResult {
  const lastNotifRef = useRef<{ key: string; time: number } | null>(null);

  const getPermission = useCallback((): NotificationPermission => {
    if (typeof Notification === "undefined") return "unsupported";
    return Notification.permission;
  }, []);

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (typeof Notification === "undefined") return "unsupported";
    const perm = await Notification.requestPermission();
    return perm;
  }, []);

  const notify = useCallback(
    (payload: BrowserNotificationPayload): boolean => {
      const perm = getPermission();
      if (perm !== "granted") {
        // Try requesting permission once
        if (perm === "default") {
          requestPermission().then((p) => {
            if (p === "granted") {
              // Retry this notification
              showNotification(payload);
            }
          });
        }
        return false;
      }

      return showNotification(payload);
    },
    [getPermission, requestPermission],
  );

  return { notify, permission: getPermission(), requestPermission };
}

// ── Internal helper ──────────────────────────────────────────────

/**
 * Deduplication: if the same asset fires the same alert body within 15
 * seconds, suppress the duplicate. This prevents notification spam when
 * the ingestion pipeline emits rapid sensor:reading events for the same
 * threshold breach.
 */
const DEDUP_WINDOW_MS = 15_000;
const lastNotificationRef: { key: string; time: number } | null =
  typeof window !== "undefined"
    ? (window as any).__dtfm_last_notification ?? null
    : null;
if (typeof window !== "undefined") {
  (window as any).__dtfm_last_notification = lastNotificationRef;
}

function showNotification(payload: BrowserNotificationPayload): boolean {
  const key = `${payload.assetId ?? ""}:${payload.body}`;
  const now = Date.now();

  if (lastNotificationRef && lastNotificationRef.key === key && now - lastNotificationRef.time < DEDUP_WINDOW_MS) {
    return false; // duplicate suppressed
  }

  // Update sentinel
  const sentinel = { key, time: now };
  if (typeof window !== "undefined") {
    (window as any).__dtfm_last_notification = sentinel;
  }

  try {
    const notif = new Notification(payload.title, {
      body: payload.body,
      icon: "/favicon.ico",
      tag: key, // browser-level dedup
      silent: payload.severity === "info",
    } as NotificationOptions);

    // Auto-close after 6 seconds
    setTimeout(() => notif.close(), 6000);

    // Navigate to alerts when clicked
    if (payload.assetId) {
      notif.onclick = () => {
        window.focus();
        window.open(`/dashboard/alerts?assetId=${payload.assetId}`, "_self");
      };
    } else {
      notif.onclick = () => {
        window.focus();
        window.open("/dashboard/alerts", "_self");
      };
    }

    return true;
  } catch {
    return false;
  }
}
