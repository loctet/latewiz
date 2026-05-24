/** Random in [0, 1) — injectable for tests */
export type Rng = () => number;

const MIN_GAP_BETWEEN_POSTS_MS = 45 * 60 * 1000;
const DAY_WINDOW_JITTER_MS = 22 * 60 * 1000;

/**
 * Spread posts_per_day across each day's window with varied, human-like times.
 * Avoids posting at the exact same clock time every day (looks automated).
 */
export function buildCampaignSlotTimes(
  startDate: string,
  days: number,
  postsPerDay: number,
  windowStart: string,
  windowEnd: string,
  timezone: string,
  /** Only include slots strictly after this timestamp (default: now). */
  minTimeMs: number = Date.now(),
  rng: Rng = Math.random
): string[] {
  const out: string[] = [];
  const start = new Date(`${startDate}T12:00:00`);

  for (let d = 0; d < days; d++) {
    const day = new Date(start);
    day.setDate(day.getDate() + d);
    const ymd = day.toISOString().slice(0, 10);

    const tStart = parseLocalDateTime(ymd, windowStart, timezone);
    const tEnd = parseLocalDateTime(ymd, windowEnd, timezone);
    let startMs = tStart.getTime();
    let endMs = tEnd.getTime();
    if (endMs <= startMs) {
      endMs = startMs + 9 * 60 * 60 * 1000;
    }

    const dayTimes = pickVariedDaySlotTimes(startMs, endMs, postsPerDay, rng);
    for (const ts of dayTimes) {
      if (ts > minTimeMs) {
        out.push(new Date(ts).toISOString());
      }
    }
  }

  return out;
}

/** Pick posting times for one day inside [startMs, endMs], sorted ascending. */
function pickVariedDaySlotTimes(
  startMs: number,
  endMs: number,
  count: number,
  rng: Rng
): number[] {
  if (count <= 0) return [];
  const span = endMs - startMs;
  if (span <= 0) return [];

  const dayShift =
    Math.floor((rng() - 0.5) * 2 * DAY_WINDOW_JITTER_MS);
  const dayEndShift = Math.floor((rng() - 0.5) * DAY_WINDOW_JITTER_MS);
  let windowStart = startMs + dayShift;
  let windowEnd = endMs + dayEndShift;
  windowStart = Math.max(startMs, windowStart);
  windowEnd = Math.min(endMs, windowEnd);
  if (windowEnd - windowStart < 30 * 60 * 1000) {
    windowStart = startMs;
    windowEnd = endMs;
  }

  const minGap = Math.min(
    MIN_GAP_BETWEEN_POSTS_MS,
    Math.max(20 * 60 * 1000, Math.floor(span / Math.max(count + 1, 2)))
  );
  const edgePad = Math.min(8 * 60 * 1000, Math.floor(minGap / 3));
  const usableStart = windowStart + edgePad;
  const usableEnd = windowEnd - edgePad;

  if (usableEnd <= usableStart) {
    return [humanizeClockTime(Math.round((startMs + endMs) / 2), rng)];
  }

  const times: number[] = [];
  const maxAttempts = count * 50;

  for (let attempt = 0; attempt < maxAttempts && times.length < count; attempt++) {
    let candidate =
      usableStart + Math.floor(rng() * (usableEnd - usableStart));
    candidate = humanizeClockTime(candidate, rng);
    candidate = Math.max(usableStart, Math.min(usableEnd, candidate));

    if (!times.some((t) => Math.abs(t - candidate) < minGap)) {
      times.push(candidate);
    }
  }

  while (times.length < count) {
    const i = times.length;
    const frac = count === 1 ? 0.5 : (i + 0.5) / count;
    const jitterMs = Math.floor((rng() - 0.5) * 2 * 28 * 60 * 1000);
    let ts = Math.round(
      usableStart + (usableEnd - usableStart) * frac + jitterMs
    );
    ts = humanizeClockTime(ts, rng);
    ts = Math.max(usableStart, Math.min(usableEnd, ts));
    if (!times.some((t) => Math.abs(t - ts) < minGap)) {
      times.push(ts);
    } else {
      const bumped = Math.min(usableEnd, ts + minGap);
      times.push(humanizeClockTime(bumped, rng));
    }
  }

  times.sort((a, b) => a - b);
  return times;
}

/**
 * Nudge timestamps off rigid patterns (:00 every day, identical spacing).
 * Mix quarter-hours, slightly-off-hour, and organic minute values.
 */
function humanizeClockTime(ms: number, rng: Rng): number {
  const d = new Date(ms);
  const roll = rng();
  let minute: number;

  if (roll < 0.28) {
    const quarter = Math.round(d.getMinutes() / 15) * 15;
    minute = quarter + Math.floor(rng() * 13) - 6;
  } else if (roll < 0.52) {
    minute =
      rng() < 0.5
        ? 2 + Math.floor(rng() * 13)
        : 47 + Math.floor(rng() * 12);
  } else if (roll < 0.78) {
    do {
      minute = Math.floor(rng() * 60);
    } while (minute % 15 === 0 && rng() < 0.55);
  } else {
    minute = 4 + Math.floor(rng() * 19);
  }

  minute = Math.max(0, Math.min(59, minute));
  d.setMinutes(minute, 0, 0);
  return d.getTime();
}

function parseLocalDateTime(
  ymd: string,
  hi: string,
  timezone: string
): Date {
  const [h, m] = hi.split(":").map(Number);
  const base = new Date(
    `${ymd}T${String(h).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")}:00`
  );
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    void formatter;
  } catch {
    /* use local parse fallback */
  }
  return base;
}
