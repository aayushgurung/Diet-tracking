import { describe, expect, it } from "vitest";
import { findTriggerMatches, normalizeFoodName } from "./matching";
import type { TriggerFood } from "./types";

function trigger(overrides: Partial<TriggerFood> = {}): TriggerFood {
  return {
    id: "milk", user_id: "person-a", display_name: "Milk", normalised_name: "milk",
    is_active: true, notes: null, first_flagged_at: "2026-01-01T00:00:00Z",
    last_flagged_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
    aliases: [{ alias_name: "Whole milk" }], ...overrides,
  };
}

describe("normalizeFoodName", () => {
  it.each([
    ["  MILK  ", "milk"],
    ["Chocolate   cake", "chocolate cake"],
    ["Cream-cheese!", "cream cheese"],
    ["Tomato / basil (soup)", "tomato basil soup"],
    ["Ｍｉｌｋ", "milk"],
    ["Cafe\u0301", "café"],
    ["\tRice\nnoodles", "rice noodles"],
    ["🥛", ""],
    ["", ""],
  ])("normalizes %j consistently", (input, expected) => {
    expect(normalizeFoodName(input)).toBe(expected);
    expect(normalizeFoodName(expected)).toBe(expected);
  });
});

describe("personal watchlist matching", () => {
  it("matches complete names case insensitively before an entry is saved", () => {
    expect(findTriggerMatches(["  MILK! "], [trigger()])).toHaveLength(1);
  });

  it("matches an explicitly configured alias", () => {
    expect(findTriggerMatches(["whole MILK"], [trigger()])).toHaveLength(1);
  });

  it("does not infer an ingredient from a substring or related food", () => {
    expect(findTriggerMatches(["Coconut milk", "Milkshake", "Cheese"], [trigger()])).toEqual([]);
  });

  it("checks explicitly listed ingredients and additional foods independently", () => {
    expect(findTriggerMatches(["Breakfast bowl", "Oats", "Milk"], [trigger()])).toHaveLength(1);
  });

  it("does not use an unreliable comma split for food components", () => {
    expect(findTriggerMatches(["Oats, Milk"], [trigger()])).toEqual([]);
  });

  it("archives and reactivates warnings without removing history", () => {
    const archived = trigger({ is_active: false });
    expect(findTriggerMatches(["Milk"], [archived])).toEqual([]);
    expect(archived.first_flagged_at).toBe("2026-01-01T00:00:00Z");
    expect(findTriggerMatches(["Milk"], [{ ...archived, is_active: true }])).toHaveLength(1);
  });

  it("returns each trigger only once even when several components match", () => {
    expect(findTriggerMatches(["milk", "MILK", "Whole milk"], [trigger()])).toHaveLength(1);
  });

  it("does not retain matches between different users' supplied watchlists", () => {
    expect(findTriggerMatches(["milk"], [trigger()])).toHaveLength(1);
    expect(findTriggerMatches(["milk"], [trigger({ user_id: "person-b", display_name: "Peanut", aliases: [] })])).toEqual([]);
    expect(findTriggerMatches(["milk"], [])).toEqual([]);
  });

  it("ignores empty normalized inputs", () => {
    expect(findTriggerMatches(["", "!!!"], [trigger()])).toEqual([]);
  });
});
