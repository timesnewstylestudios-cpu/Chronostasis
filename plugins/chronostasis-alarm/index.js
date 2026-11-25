import { registerPlugin } from '@capacitor/core';

const ChronostasisAlarm = registerPlugin('ChronostasisAlarm', {
  web: () => import('./web.js').then((m) => new m.ChronostasisAlarmWeb()),
});

export { ChronostasisAlarm };
