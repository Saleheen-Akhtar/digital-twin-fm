/**
 * Request permission and show a Chrome / system notification.
 * Silently returns false if permission is denied or unavailable.
 */
export function notifyBrowser(
  title: string,
  options?: { body?: string; icon?: string; tag?: string },
): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;

  if (Notification.permission === 'granted') {
    new Notification(title, { ...options });
    return true;
  }

  if (Notification.permission === 'default') {
    // Request permission synchronously isn't possible, but we can
    // request asynchronously and show if granted.
    Notification.requestPermission().then((perm) => {
      if (perm === 'granted') {
        new Notification(title, { ...options });
      }
    });
    return false;
  }

  // 'denied' — can't show
  return false;
}
