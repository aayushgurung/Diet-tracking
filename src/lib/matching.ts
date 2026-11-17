import type { TriggerFood } from "./types";

/**
 * Names and explicitly entered food components are normalized independently.
 * Punctuation separates words; no fuzzy, substring, or inferred ingredient match.
 */
export function normalizeFoodName(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Call with only the authenticated user's watchlist. Never share a global cache. */
export function findTriggerMatches(
  names: string[],
  triggers: TriggerFood[],
): TriggerFood[] {
  const candidates = new Set(names.map(normalizeFoodName).filter(Boolean));
  if (!candidates.size) return [];

  return triggers.filter((trigger) => {
    if (!trigger.is_active) return false;
    // Derive from the human-readable source so older normalization versions
    // cannot accidentally suppress a warning after an upgrade.
    const linkedNames = [
      trigger.display_name,
      ...trigger.aliases.map((alias) => alias.alias_name),
    ];
    return linkedNames.some((name) => candidates.has(normalizeFoodName(name)));
  });
}
