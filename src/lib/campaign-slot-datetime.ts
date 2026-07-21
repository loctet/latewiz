import { fromZonedTime, toZonedTime } from "@/lib/timezones";

/** Split ISO scheduled_at into date/time inputs (local browser timezone). */
export function isoToLocalDateInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isoToLocalTimeInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "09:00";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Combine local date + time into ISO string for Zernio scheduling. */
export function localDateTimeToIso(
  date: string,
  time: string,
  timezone?: string
): string {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  if (timezone) {
    return fromZonedTime(
      `${date}T${String(h).padStart(2, "0")}:${String(min ?? 0).padStart(2, "0")}:00`,
      timezone
    ).toISOString();
  }
  return new Date(y, m - 1, d, h, min ?? 0, 0, 0).toISOString();
}

export function isoToDateInputInTimezone(iso: string, timezone: string): string {
  try {
    const zoned = toZonedTime(new Date(iso), timezone);
    const y = zoned.getFullYear();
    const m = String(zoned.getMonth() + 1).padStart(2, "0");
    const day = String(zoned.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch {
    return isoToLocalDateInput(iso);
  }
}

export function isoToTimeInputInTimezone(iso: string, timezone: string): string {
  try {
    const zoned = toZonedTime(new Date(iso), timezone);
    return `${String(zoned.getHours()).padStart(2, "0")}:${String(
      zoned.getMinutes()
    ).padStart(2, "0")}`;
  } catch {
    return isoToLocalTimeInput(iso);
  }
}
