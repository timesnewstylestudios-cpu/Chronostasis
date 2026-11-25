let sentinel = null;
let desired = null;

async function screenLock(on) {
  if (!navigator.wakeLock) return;
  if (!on) {
    try {
      await sentinel?.release();
    } catch {
      /* already released */
    }
    sentinel = null;
    return;
  }
  try {
    sentinel = await navigator.wakeLock.request('screen');
  } catch {
    sentinel = null;
  }
}

export async function holdAwake(on) {
  if (desired === on) return;
  desired = on;
  try {
    const { KeepAwake } = await import('@capacitor-community/keep-awake');
    if (on) {
      const supported = await KeepAwake.isSupported();
      const ok = supported === true || supported?.isSupported === true;
      if (!ok) {
        await screenLock(true);
        return;
      }
      await KeepAwake.keepAwake();
      return;
    }
    await KeepAwake.allowSleep();
  } catch {
    await screenLock(on);
  }
}
