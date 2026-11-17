import { describe, expect, it } from "vitest";
import { currentDateKey, formatTime, fromDateTimeLocal, localDateKey, toDateTimeLocal } from "./time";

describe("journal time handling", () => {
  it("groups by the user's local calendar date, including UTC day boundaries", () => {
    expect(localDateKey("2026-11-16T13:30:00Z", "Australia/Sydney")).toBe("2026-11-17");
    expect(localDateKey("2026-11-17T01:30:00Z", "America/Los_Angeles")).toBe("2026-11-16");
  });

  it("keeps eaten time distinct from a later recorded timestamp", () => {
    const entry = {
      eaten_at: "2026-11-16T12:30:00Z",
      created_at: "2026-11-16T13:15:00Z",
    };
    expect(localDateKey(entry.eaten_at, "Australia/Sydney")).toBe("2026-11-16");
    expect(localDateKey(entry.created_at, "Australia/Sydney")).toBe("2026-11-17");
    expect(formatTime(entry.eaten_at, "Australia/Sydney")).toBe("11:30 PM");
    expect(formatTime(entry.created_at, "Australia/Sydney")).toBe("12:15 AM");
  });

  it("defaults current date in the selected timezone", () => {
    expect(currentDateKey("Australia/Sydney", new Date("2026-11-16T14:00:00Z"))).toBe("2026-11-17");
  });

  it("round-trips a wall time to an unambiguous UTC timestamp", () => {
    const iso = fromDateTimeLocal("2026-11-17T12:30", "Australia/Sydney");
    expect(iso).toBe("2026-11-17T01:30:00.000Z");
    expect(toDateTimeLocal(iso, "Australia/Sydney")).toBe("2026-11-17T12:30");
  });

  it("respects daylight saving instead of assuming a fixed offset", () => {
    expect(fromDateTimeLocal("2026-06-01T12:30", "Australia/Sydney")).toBe("2026-06-01T02:30:00.000Z");
    expect(fromDateTimeLocal("2026-12-01T12:30", "Australia/Sydney")).toBe("2026-12-01T01:30:00.000Z");
  });

  it("rejects a nonexistent spring-forward local time", () => {
    expect(() => fromDateTimeLocal("2026-10-04T02:30", "Australia/Sydney")).toThrow("does not exist");
  });

  it("chooses the earlier occurrence of an autumn repeated time", () => {
    expect(fromDateTimeLocal("2026-04-05T02:30", "Australia/Sydney")).toBe("2026-04-04T15:30:00.000Z");
  });

  it("handles a half-hour daylight saving transition", () => {
    expect(fromDateTimeLocal("2026-04-05T01:45", "Australia/Lord_Howe")).toBe("2026-04-04T14:45:00.000Z");
    expect(() => fromDateTimeLocal("2026-10-04T02:15", "Australia/Lord_Howe")).toThrow();
  });

  it("rejects invalid calendar dates, malformed input and invalid zones", () => {
    expect(() => fromDateTimeLocal("2026-02-30T12:00", "UTC")).toThrow();
    expect(() => fromDateTimeLocal("not a date", "UTC")).toThrow();
    expect(() => fromDateTimeLocal("2026-11-17T12:30", "Unknown/Zone")).toThrow();
  });
});
