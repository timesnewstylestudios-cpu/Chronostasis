let context;

function tone(ctx, frequency, type, start, duration, volume) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

/** Short deterministic beeps. Intensity 1, 2, 3 maps to one, three, or five tones. */
export function playAlarm(intensity) {
  const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Ctx) return;
  if (!context) context = new Ctx();
  if (context.state === 'suspended') context.resume();
  const bursts = intensity >= 3 ? 5 : intensity === 2 ? 3 : 1;
  const type = intensity >= 3 ? 'square' : 'sine';
  const volume = intensity >= 3 ? 0.28 : 0.16;
  for (let i = 0; i < bursts; i += 1) {
    tone(context, 480 + intensity * 140, type, context.currentTime + i * 0.26, 0.18, volume);
  }
  if (navigator.vibrate) {
    const pattern = intensity >= 3 ? [180, 70, 180, 70, 320] : intensity === 2 ? [100, 50, 100] : [70];
    navigator.vibrate(pattern);
  }
}
