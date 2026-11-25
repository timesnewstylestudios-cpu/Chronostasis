import { Capacitor, registerPlugin } from '@capacitor/core';

const BackgroundGeolocation = registerPlugin('BackgroundGeolocation');
let watcherId = null;
let watcherStarting = false;
let foregroundStop = null;

export function watchForeground(onPoint) {
  if (!navigator.geolocation) {
    onPoint(null, 'unavailable');
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    (pos) => onPoint({
      lat: pos.coords.latitude,
      lon: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      at: pos.timestamp,
    }, null),
    (error) => onPoint(null, error.code === 1 ? 'denied' : 'unavailable'),
    { enableHighAccuracy: true, maximumAge: 4000, timeout: 20000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

export function startForeground(onPoint) {
  if (foregroundStop) return;
  foregroundStop = watchForeground(onPoint);
}

/**
 * Background fixes exist only in the Android shell. The community plugin keeps a
 * foreground-service notification, which is what Android requires for a long-running fix.
 * The web app uses watchPosition and stops when the page sleeps.
 */
export async function syncBackground(active, onPoint) {
  if (Capacitor.getPlatform() !== 'android' || !active) {
    if (watcherId) {
      try {
        await BackgroundGeolocation.removeWatcher({ id: watcherId });
      } catch {
        /* already gone */
      }
      watcherId = null;
    }
    return;
  }
  if (watcherId || watcherStarting) return;
  watcherStarting = true;
  try {
    watcherId = await BackgroundGeolocation.addWatcher({
      backgroundMessage: 'Chronostasis prüft, ob du unterwegs bist.',
      backgroundTitle: 'Chronostasis',
      requestPermissions: true,
      stale: false,
      distanceFilter: 20,
    }, (location, error) => {
      if (error) {
        onPoint(null, error.code === 'NOT_AUTHORIZED' ? 'denied' : 'unavailable');
        return;
      }
      if (!location) return;
      onPoint({
        lat: location.latitude,
        lon: location.longitude,
        accuracy: location.accuracy,
        at: location.time || Date.now(),
      }, null);
    });
  } catch {
    watcherId = null;
  } finally {
    watcherStarting = false;
  }
}

export async function openLocationSettings() {
  if (Capacitor.getPlatform() !== 'android') return false;
  try {
    await BackgroundGeolocation.openSettings();
    return true;
  } catch {
    return false;
  }
}
