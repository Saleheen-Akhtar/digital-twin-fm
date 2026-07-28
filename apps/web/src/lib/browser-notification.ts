/**
 * Request permission and show a Chrome / system notification.
 * Silently returns false if permission is denied or unavailable.
 *
 * When the user clicks the notification, it focuses the app tab and
 * navigates to `onClickUrl` (defaults to /dashboard/alerts).
 */
interface NotifyOptions {
  body?: string;
  icon?: string;
  tag?: string;
  /** URL to navigate to when the notification is clicked (default: /dashboard/alerts) */
  onClickUrl?: string;
}

export function notifyBrowser(
  title: string,
  options?: NotifyOptions,
): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;

  const url = options?.onClickUrl ?? '/dashboard/alerts';
  const notifOptions: NotificationOptions = {
    body: options?.body,
    icon: options?.icon,
    tag: options?.tag,
    // Keep the notification visible until the user interacts with it
    requireInteraction: true,
  };

  function show() {
    const notification = new Notification(title, notifOptions);

    notification.onclick = (event: Event) => {
      event.preventDefault();
      // Focus the app tab and navigate to the alerts page
      window.focus();
      window.location.href = url;
      // Close the notification
      notification.close();
    };
  }

  if (Notification.permission === 'granted') {
    show();
    return true;
  }

  if (Notification.permission === 'default') {
    Notification.requestPermission().then((perm) => {
      if (perm === 'granted') {
        show();
      }
    });
    return false;
  }

  // 'denied' — can't show
  return false;
}
