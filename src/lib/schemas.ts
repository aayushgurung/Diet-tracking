import { z } from "zod";
import { normalizeFoodName } from "./matching";

const uuid = z.string().uuid("Please use a valid record ID.");
const name = z
  .string()
  .trim()
  .min(1, "Enter a food name.")
  .max(160, "Keep names under 160 characters.")
  .refine((value) => normalizeFoodName(value).length > 0, "Enter a food name using letters or numbers.");
const notes = z.string().trim().max(4000, "Keep notes under 4,000 characters.");
const timestamp = z.string().datetime({ offset: true, message: "Choose a valid date and time." });

export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export const foodInputSchema = z.object({
  id: uuid.optional(),
  food_name: name,
  eaten_at: timestamp,
  notes,
  meal_category: z.enum(["breakfast", "lunch", "dinner", "snack"]).nullable(),
  // Ownership is additionally validated against the authenticated user on server.
  photo_path: z.string().max(260).regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(?:jpe?g|png|webp)$/i, "Choose a valid journal photo.").nullable(),
  components: z.array(z.object({
    name,
    kind: z.enum(["food", "ingredient"]),
  })).max(40, "Add up to 40 individual foods or ingredients."),
});

export const reactionInputSchema = z.object({
  food_entry_id: uuid,
  symptoms: z.array(z.string().trim().min(1).max(100)).max(20)
    .transform((values) => [...new Set(values)]),
  severity: z.enum(["mild", "moderate", "severe"]).nullable(),
  reaction_at: timestamp.nullable(),
  onset_minutes: z.number().int().min(0).max(525600).nullable(),
  notes,
});

export const triggerInputSchema = z.object({
  id: uuid,
  display_name: name,
  aliases: z.array(name).max(30, "Use up to 30 explicit aliases."),
  notes,
}).superRefine((value, context) => {
  const normalized = value.aliases.map(normalizeFoodName);
  if (new Set(normalized).size !== normalized.length) {
    context.addIssue({ code: "custom", path: ["aliases"], message: "Each alias should be different." });
  }
  if (normalized.includes(normalizeFoodName(value.display_name))) {
    context.addIssue({ code: "custom", path: ["aliases"], message: "The food name is already matched; choose a different alias." });
  }
});

export const profileInputSchema = z.object({
  display_name: z.string().trim().max(80, "Keep your name under 80 characters."),
  timezone: z.string().min(1).max(100).refine(isValidTimeZone, "Choose a valid timezone."),
  warnings_enabled: z.boolean(),
  avatar_enabled: z.boolean(),
});

export const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(254),
  password: z.string().min(1, "Enter your password.").max(128),
});

export const signUpSchema = signInSchema.extend({
  password: z.string().min(8, "Use at least 8 characters.").max(128),
  display_name: z.string().trim().max(80),
  timezone: z.string().max(100).refine(isValidTimeZone, "Choose a valid timezone."),
});
