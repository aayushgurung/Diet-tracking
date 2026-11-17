import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export function localDateKey(iso: string | Date, zone: string): string {
  return formatInTimeZone(iso, zone, "yyyy-MM-dd");
}

export function currentDateKey(zone: string, now: Date = new Date()): string {
  return localDateKey(now, zone);
}

export function toDateTimeLocal(iso: string | Date, zone: string): string {
  return formatInTimeZone(iso, zone, "yyyy-MM-dd'T'HH:mm");
}

/**
 * Convert a timezone's wall time to UTC. Nonexistent DST times are rejected.
 * During the repeated autumn hour, choose the earlier occurrence explicitly.
 * The selected timezone, never the executing machine's timezone, controls this.
 */
export function fromDateTimeLocal(value: string, zone: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    throw new Error("Choose a valid date and time.");
  }
  const parsed = fromZonedTime(value, zone);
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error("Choose a valid date, time and timezone.");
  }

  // Verify with the reverse conversion: a DST gap or invalid calendar day
  // cannot round-trip to the requested wall time.
  if (toDateTimeLocal(parsed, zone) !== value) {
    throw new Error("That local time does not exist in your timezone. Choose another time.");
  }

  // Most DST shifts are 60 minutes; Lord Howe uses 30 and some historic shifts
  // use two hours. Collect equivalent instants and select the earliest.
  let earliest = parsed;
  for (const minutes of [30, 60, 90, 120]) {
    const candidate = new Date(parsed.getTime() - minutes * 60_000);
    if (toDateTimeLocal(candidate, zone) === value) earliest = candidate;
  }
  return earliest.toISOString();
}

export function formatTime(iso: string | Date, zone: string): string {
  return formatInTimeZone(iso, zone, "h:mm a");
}

export function formatDate(iso: string | Date, zone: string, pattern = "d MMM yyyy"): string {
  return formatInTimeZone(iso, zone, pattern);
}

export function formatDateTime(iso: string | Date, zone: string): string {
  return formatInTimeZone(iso, zone, "d MMM yyyy, h:mm a");
}
