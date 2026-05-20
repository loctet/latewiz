/** True if ISO datetime is strictly after now. */
export function isScheduleInFuture(iso: string, now = Date.now()): boolean {
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && t > now;
}

/** Minimum date input value (YYYY-MM-DD) for scheduling — today in local TZ. */
export function minScheduleDateInput(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Minimum time input when date is today; otherwise no minimum. */
export function minScheduleTimeInput(
  dateYmd: string,
  now = new Date()
): string | undefined {
  const today = minScheduleDateInput(now);
  if (dateYmd !== today) return undefined;
  const h = now.getHours();
  const m = now.getMinutes();
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function filterFutureSlotTimes(
  times: string[],
  now = Date.now()
): string[] {
  return times.filter((t) => isScheduleInFuture(t, now));
}

export function countPastSlotTimes(
  times: string[],
  now = Date.now()
): number {
  return times.filter((t) => !isScheduleInFuture(t, now)).length;
}
