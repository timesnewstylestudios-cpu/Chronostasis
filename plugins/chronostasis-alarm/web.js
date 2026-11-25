import { WebPlugin } from '@capacitor/core';

export class ChronostasisAlarmWeb extends WebPlugin {
  async schedule() {
    return { supported: false, scheduled: 0, needsExact: false };
  }

  async cancelAll() {
    return { supported: false };
  }

  async canExact() {
    return { supported: false, granted: false };
  }

  async openExactAlarmSettings() {
    return { supported: false };
  }

  async openFullScreenSettings() {
    return { supported: false };
  }

  async openBatterySettings() {
    return { supported: false };
  }
}
