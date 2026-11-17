import type { FoodEntry, Profile, ReactionReport, TriggerFood } from "../src/lib/types";

export const TEST_USER_ID = "11111111-1111-4111-8111-111111111111";
export const TEST_ENTRY_ID = "22222222-2222-4222-8222-222222222222";
export const TEST_TRIGGER_ID = "33333333-3333-4333-8333-333333333333";

export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return { id: TEST_USER_ID, display_name: "Alex", timezone: "Australia/Sydney", warnings_enabled: true, avatar_enabled: true, ...overrides };
}

export function makeTrigger(overrides: Partial<TriggerFood> = {}): TriggerFood {
  return {
    id: TEST_TRIGGER_ID, user_id: TEST_USER_ID, display_name: "Milk", normalised_name: "milk",
    is_active: true, notes: null, first_flagged_at: "2026-11-01T01:00:00Z",
    last_flagged_at: "2026-11-01T01:00:00Z", updated_at: "2026-11-01T01:00:00Z",
    aliases: [{ alias_name: "Whole milk" }], ...overrides,
  };
}

export function makeReaction(overrides: Partial<ReactionReport> = {}): ReactionReport {
  return {
    id: "44444444-4444-4444-8444-444444444444", user_id: TEST_USER_ID,
    food_entry_id: TEST_ENTRY_ID, symptoms: ["Stomach discomfort"], severity: "mild",
    reaction_at: "2026-11-01T02:00:00Z", onset_minutes: 60, notes: null,
    created_at: "2026-11-01T02:00:00Z", updated_at: "2026-11-01T02:00:00Z", ...overrides,
  };
}

export function makeEntry(overrides: Partial<FoodEntry> = {}): FoodEntry {
  return {
    id: TEST_ENTRY_ID, user_id: TEST_USER_ID, food_name: "Milk", normalised_food_name: "milk",
    eaten_at: "2026-11-01T01:00:00Z", created_at: "2026-11-01T01:15:00Z",
    updated_at: "2026-11-01T02:00:00Z", notes: null, meal_category: null,
    photo_path: null, is_flagged: true, trigger_food_id: TEST_TRIGGER_ID,
    components: [], reaction: makeReaction(), ...overrides,
  };
}
