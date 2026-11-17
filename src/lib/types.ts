export type MealCategory = "breakfast" | "lunch" | "dinner" | "snack";
export type Severity = "mild" | "moderate" | "severe";

export interface Profile {
  id: string;
  display_name: string;
  timezone: string;
  warnings_enabled: boolean;
  avatar_enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface FoodComponent {
  id?: string;
  name: string;
  kind: "food" | "ingredient";
}

export interface ReactionReport {
  id: string;
  user_id: string;
  food_entry_id: string;
  symptoms: string[];
  severity: Severity | null;
  reaction_at: string | null;
  onset_minutes: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FoodEntry {
  id: string;
  user_id: string;
  food_name: string;
  normalised_food_name: string;
  eaten_at: string;
  created_at: string;
  updated_at: string;
  notes: string | null;
  meal_category: MealCategory | null;
  photo_path: string | null;
  is_flagged: boolean;
  trigger_food_id: string | null;
  components: FoodComponent[];
  reaction: ReactionReport | null;
  photo_url?: string | null;
}

export interface TriggerAlias {
  id?: string;
  alias_name: string;
  normalised_alias_name?: string;
}

export interface TriggerFood {
  id: string;
  user_id: string;
  display_name: string;
  normalised_name: string;
  is_active: boolean;
  notes: string | null;
  first_flagged_at: string;
  last_flagged_at: string;
  updated_at: string;
  aliases: TriggerAlias[];
}

export interface JournalData {
  profile: Profile;
  entries: FoodEntry[];
  triggers: TriggerFood[];
}

export interface FoodInput {
  id?: string;
  food_name: string;
  eaten_at: string;
  notes: string;
  meal_category: MealCategory | null;
  photo_path: string | null;
  components: FoodComponent[];
}

export interface ReactionInput {
  food_entry_id: string;
  symptoms: string[];
  severity: Severity | null;
  reaction_at: string | null;
  onset_minutes: number | null;
  notes: string;
}

export interface TriggerInput {
  id: string;
  display_name: string;
  aliases: string[];
  notes: string;
}

export interface ProfileInput {
  display_name: string;
  timezone: string;
  warnings_enabled: boolean;
  avatar_enabled: boolean;
}

export type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };
