/**
 * Whether the committed day is currently nagging.
 * Geofence entry ends it. Verified motion toward the destination keeps a slow reminder.
 * Snooze silences the tone only until snoozedUntil; it does not move leave-by.
 */
export function nagDecision({
  nowMs,
  wakeMs,
  leaveByMs,
  paused = false,
  arrived = false,
  inside = false,
  onTheWay = false,
  snoozedUntil = null,
}) {
  if (paused) return { active: false, cause: 'pause', markArrived: false };
  if (arrived) return { active: false, cause: 'angekommen', markArrived: false };
  if (inside) return { active: false, cause: 'geofence', markArrived: true };
  if (wakeMs == null || leaveByMs == null) return { active: false, cause: 'kein_plan', markArrived: false };
  if (nowMs < wakeMs) return { active: false, cause: 'warten', markArrived: false };
  if (snoozedUntil != null && nowMs < snoozedUntil) {
    return { active: false, cause: 'schlummern', snoozing: true, markArrived: false };
  }
  if (onTheWay) {
    return {
      active: true,
      cause: 'unterwegs',
      intensityCap: 1,
      everyMin: 10,
      leaveByPassed: nowMs >= leaveByMs,
      markArrived: false,
    };
  }
  return {
    active: true,
    cause: 'nag',
    elapsedMin: (nowMs - wakeMs) / 60000,
    leaveByPassed: nowMs >= leaveByMs,
    markArrived: false,
  };
}

export function isCommitmentLocked(nowMs, plan, occ) {
  if (!plan?.wakeAt) return false;
  if (occ?.pausedReason || occ?.arrivedAt) return false;
  return nowMs >= plan.wakeAt.getTime();
}
