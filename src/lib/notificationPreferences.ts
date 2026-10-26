import type { AppNotification, NotificationPreferences } from '../types';

// Existing accounts keep seeing all in-app categories until they opt out.
export const DEFAULT_NOTIFICATION_PREFERENCES: Readonly<NotificationPreferences> = Object.freeze({
  payment: true,
  task: true,
  client: true,
  document: true,
  system: true,
});

export function getNotificationPreferences(preferences?: Partial<NotificationPreferences> | null): NotificationPreferences {
  return {
    payment: typeof preferences?.payment === 'boolean' ? preferences.payment : true,
    task: typeof preferences?.task === 'boolean' ? preferences.task : true,
    client: typeof preferences?.client === 'boolean' ? preferences.client : true,
    document: typeof preferences?.document === 'boolean' ? preferences.document : true,
    system: typeof preferences?.system === 'boolean' ? preferences.system : true,
  };
}

export function getVisibleNotifications(notifications: readonly AppNotification[], preferences?: Partial<NotificationPreferences> | null): AppNotification[] {
  const enabled = getNotificationPreferences(preferences);
  return notifications.filter(notification => enabled[notification.type]);
}
