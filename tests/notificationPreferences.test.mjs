import test from 'node:test';
import assert from 'node:assert/strict';
import { getNotificationPreferences, getVisibleNotifications } from '../src/lib/notificationPreferences.ts';

test('existing accounts retain every notification category by default', () => {
  assert.deepEqual(getNotificationPreferences(), { payment: true, task: true, client: true, document: true, system: true });
  assert.equal(getNotificationPreferences({ task: false }).task, false);
  assert.equal(getNotificationPreferences({ task: false }).payment, true);
});

test('disabled categories leave the visible inbox and its unread count without deleting history', () => {
  const notices = [
    { id: 'p', type: 'payment', read: false },
    { id: 't', type: 'task', read: false },
    { id: 's', type: 'system', read: true },
  ];
  const visible = getVisibleNotifications(notices, { task: false });
  assert.deepEqual(visible.map(n => n.id), ['p', 's']);
  assert.equal(visible.filter(n => !n.read).length, 1);
  assert.equal(notices.length, 3);
  assert.deepEqual(getVisibleNotifications(notices, { task: true }).map(n => n.id), ['p', 't', 's']);
});
