"use client";

import Link from "next/link";
import { useState } from "react";
import { Flag, X, ArrowUpRight } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import type { FoodEntry, TriggerFood } from "@/lib/types";

export function TriggerWarning({ matches, entries, showAvatar = true }: { matches: TriggerFood[]; entries: FoodEntry[]; showAvatar?: boolean }) {
  const [dismissed, setDismissed] = useState(false);
  if (!matches.length) return null;
  if (dismissed) return <p className="dismissed-warning" role="status">Previous warning dismissed. <button type="button" className="text-link" onClick={() => setDismissed(false)}>Show warning</button></p>;
  const matchingEntries = entries.filter(e => matches.some(t => e.trigger_food_id === t.id) && e.reaction).sort((a,b) => (b.reaction?.updated_at ?? b.created_at).localeCompare(a.reaction?.updated_at ?? a.created_at));
  const latest = matchingEntries[0]?.reaction;
  const strong = matchingEntries.some(e => e.reaction?.severity === "severe");
  return <aside className={`trigger-warning ${strong ? "trigger-warning-strong" : ""}`} role="status" aria-live="polite" aria-label="Previous food warning">
    <button type="button" className="warning-dismiss icon-button" aria-label="Dismiss warning temporarily" onClick={() => setDismissed(true)}><X size={17} /></button>
    {showAvatar && <Avatar state={strong ? "strong-warning" : "caution"} message="A little reminder from your journal." />}
    <div className="warning-copy"><span className="eyebrow"><Flag size={13} /> A NOTE FROM YOUR PAST SELF</span><h3>You flagged {matches.map(t => t.display_name).join(", ")} before.</h3>{latest?.symptoms.length ? <p>Last noted reaction: <strong>{latest.symptoms.join(", ")}</strong>.</p> : <p>You previously marked this food for review.</p>}{strong && <p>A previous report includes a severity you described as severe.</p>}<p className="warning-context">This is your personal observation. You can still add this food to your journal.</p><div className="warning-actions">{matches.map(t => <Link key={t.id} href={`/triggers/${t.id}`} className="text-link">Review {t.display_name} <ArrowUpRight size={14} /></Link>)}<Button type="button" variant="outline" size="sm" onClick={() => setDismissed(true)}>Continue logging</Button></div></div>
  </aside>;
}
