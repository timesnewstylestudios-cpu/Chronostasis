import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { ChronostasisAlarm } from 'chronostasis-alarm';

const CHANNEL = 'chronostasis-nag';
let channelReady = false;
let permitted = false;

export function platform() {
  return Capacitor.getPlatform();
}

export function isNative() {
  const name = Capacitor.getPlatform();
  return name === 'android' || name === 'ios';
}

export async function ensureNotificationPermission() {
  const name = Capacitor.getPlatform();
  try {
    if (name === 'android' || name === 'ios') {
      const status = await LocalNotifications.requestPermissions();
      permitted = status.display === 'granted';
      if (name === 'android' && permitted && !channelReady) {
        await LocalNotifications.createChannel({
          id: CHANNEL,
          name: 'Erinnerungen',
          description: 'Eskalierende Erinnerungen, bis du am Ziel bist',
          importance: 5,
          visibility: 1,
          vibration: true,
        });
        channelReady = true;
      }
      return permitted;
    }
  } catch {
    permitted = false;
    return false;
  }
  if (!('Notification' in globalThis)) return false;
  const result = await Notification.requestPermission();
  permitted = result === 'granted';
  return permitted;
}

export async function exactAlarmState() {
  if (Capacitor.getPlatform() !== 'android') return { supported: false, granted: false };
  try {
    const local = await LocalNotifications.checkExactNotificationSetting();
    const custom = await ChronostasisAlarm.canExact();
    const granted = local.exact_alarm === 'granted' || custom.granted === true;
    return { supported: true, granted };
  } catch {
    return { supported: true, granted: false };
  }
}

export async function openExactSettings() {
  if (Capacitor.getPlatform() !== 'android') return false;
  try {
    await LocalNotifications.changeExactNotificationSetting();
    return true;
  } catch {
    try {
      await ChronostasisAlarm.openExactAlarmSettings();
      return true;
    } catch {
      return false;
    }
  }
}

export async function openFullScreenSettings() {
  if (Capacitor.getPlatform() !== 'android') return false;
  try {
    const result = await ChronostasisAlarm.openFullScreenSettings();
    return result.supported !== false;
  } catch {
    return false;
  }
}

export async function openBatterySettings() {
  if (Capacitor.getPlatform() !== 'android') return false;
  try {
    const result = await ChronostasisAlarm.openBatterySettings();
    return result.supported !== false;
  } catch {
    return false;
  }
}

async function cancelLocal() {
  const pending = await LocalNotifications.getPending();
  const notifications = pending.notifications || [];
  if (!notifications.length) return;
  await LocalNotifications.cancel({ notifications: notifications.map((item) => ({ id: item.id })) });
}

export async function syncAlarms(items) {
  const name = Capacitor.getPlatform();
  if (name !== 'android' && name !== 'ios') return { native: false, needsExact: false };
  let needsExact = false;
  let rest = items;
  if (name === 'android') {
    const wake = items[0] ? [items[0]] : [];
    try {
      const result = await ChronostasisAlarm.schedule({
        alarms: wake.map((item) => ({
          id: item.id,
          at: item.at,
          title: item.title,
          body: item.body,
        })),
      });
      needsExact = Boolean(result.needsExact);
      rest = result.supported && !result.needsExact ? items.slice(1) : items;
      if (!items.length) await ChronostasisAlarm.cancelAll();
    } catch {
      rest = items;
    }
  }
  try {
    await cancelLocal();
    if (rest.length && permitted) {
      await LocalNotifications.schedule({
        notifications: rest.map((item) => ({
          id: item.id,
          title: item.title,
          body: item.body,
          channelId: CHANNEL,
          schedule: { at: new Date(item.at), allowWhileIdle: true },
          extra: { app: 'chronostasis' },
          ongoing: item.intensity >= 3,
          autoCancel: false,
        })),
      });
    }
  } catch {
    /* The in-app tone still runs while the page is open. */
  }
  return { native: true, needsExact };
}

export async function pingWeb(title, body) {
  if (!permitted) return;
  try {
    const registration = navigator.serviceWorker ? await navigator.serviceWorker.getRegistration() : null;
    if (registration) {
      await registration.showNotification(title, { body, tag: 'chronostasis', renotify: true, lang: 'de' });
      return;
    }
  } catch {
    /* fall through to the page Notification constructor */
  }
  try {
    if ('Notification' in globalThis && Notification.permission === 'granted') {
      new Notification(title, { body, tag: 'chronostasis', lang: 'de' });
    }
  } catch {
    /* ignore */
  }
}

export function notificationPermissionGranted() {
  return permitted;
}
