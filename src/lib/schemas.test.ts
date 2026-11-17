import { describe, expect, it } from "vitest";
import { foodInputSchema, profileInputSchema, reactionInputSchema, triggerInputSchema } from "./schemas";

const id = "11111111-1111-4111-8111-111111111111";
const food = {
  food_name: "Milk", eaten_at: "2026-11-17T01:30:00.000Z", notes: "",
  meal_category: null, photo_path: null, components: [],
};

describe("trusted-boundary input validation", () => {
  it("accepts the minimal meal without symptoms, notes or a photo", () => {
    expect(foodInputSchema.safeParse(food).success).toBe(true);
  });

  it("does not allow the client to set creation time, flags or ownership", () => {
    const output = foodInputSchema.parse({ ...food, user_id: "other", created_at: "yesterday", is_flagged: true });
    expect(output).not.toHaveProperty("user_id");
    expect(output).not.toHaveProperty("created_at");
    expect(output).not.toHaveProperty("is_flagged");
  });

  it("rejects empty, punctuation-only and oversized names", () => {
    for (const food_name of ["   ", "!!!", "a".repeat(161)]) {
      expect(foodInputSchema.safeParse({ ...food, food_name }).success).toBe(false);
    }
  });

  it("requires a timestamp with UTC or an explicit offset", () => {
    expect(foodInputSchema.safeParse({ ...food, eaten_at: "2026-11-17T12:30" }).success).toBe(false);
  });

  it("supports explicit separate foods and ingredients", () => {
    expect(foodInputSchema.parse({ ...food, components: [{ name: "Milk", kind: "ingredient" }] }).components).toEqual([{ name: "Milk", kind: "ingredient" }]);
  });

  it("accepts an optional empty report when flagging a food", () => {
    expect(reactionInputSchema.safeParse({ food_entry_id: id, symptoms: [], severity: null, reaction_at: null, onset_minutes: null, notes: "" }).success).toBe(true);
  });

  it("supports editing multiple symptoms while validating severity and onset", () => {
    const input = { food_entry_id: id, symptoms: ["Bloating", "Headache", "Bloating"], severity: "moderate", reaction_at: null, onset_minutes: 90, notes: "Personal observation" };
    expect(reactionInputSchema.parse(input).symptoms).toEqual(["Bloating", "Headache"]);
    expect(reactionInputSchema.safeParse({ ...input, severity: "dangerous" }).success).toBe(false);
    expect(reactionInputSchema.safeParse({ ...input, onset_minutes: -1 }).success).toBe(false);
  });

  it("prevents duplicate normalized aliases and redundant display-name aliases", () => {
    expect(triggerInputSchema.safeParse({ id, display_name: "Milk", aliases: ["Whole milk", "WHOLE MILK!"], notes: "" }).success).toBe(false);
    expect(triggerInputSchema.safeParse({ id, display_name: "Milk", aliases: ["milk"], notes: "" }).success).toBe(false);
    expect(triggerInputSchema.safeParse({ id, display_name: "Milk", aliases: ["Whole milk"], notes: "" }).success).toBe(true);
  });

  it("requires a real timezone so date grouping cannot silently fall back", () => {
    const profile = { display_name: "Alex", timezone: "Australia/Sydney", warnings_enabled: true, avatar_enabled: true };
    expect(profileInputSchema.safeParse(profile).success).toBe(true);
    expect(profileInputSchema.safeParse({ ...profile, timezone: "Australia/Unknown" }).success).toBe(false);
  });

  it("restricts stored photo paths to user folders and supported images", () => {
    expect(foodInputSchema.safeParse({ ...food, photo_path: `${id}/${id}.jpg` }).success).toBe(true);
    expect(foodInputSchema.safeParse({ ...food, photo_path: "https://public.example/photo.jpg" }).success).toBe(false);
    expect(foodInputSchema.safeParse({ ...food, photo_path: `${id}/../secret.svg` }).success).toBe(false);
  });
});
