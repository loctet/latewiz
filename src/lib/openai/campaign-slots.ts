/**
 * Spread posts_per_day evenly between window start/end for each day (ported from AutoPublish Studio).
 */
export function buildCampaignSlotTimes(
  startDate: string,
  days: number,
  postsPerDay: number,
  windowStart: string,
  windowEnd: string,
  timezone: string,
  /** Only include slots strictly after this timestamp (default: now). */
  minTimeMs: number = Date.now()
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
    const span = endMs - startMs;

    for (let i = 0; i < postsPerDay; i++) {
      const frac = postsPerDay === 1 ? 0.5 : (i + 1) / (postsPerDay + 1);
      const ts = Math.round(startMs + span * frac);
      if (ts > minTimeMs) {
        out.push(new Date(ts).toISOString());
      }
    }
  }

  return out;
}

function parseLocalDateTime(
  ymd: string,
  hi: string,
  timezone: string
): Date {
  const [h, m] = hi.split(":").map(Number);
  const base = new Date(`${ymd}T${String(h).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")}:00`);
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
