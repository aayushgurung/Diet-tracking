import Link from "next/link";
import { ArrowUpRight, Flag, Utensils } from "lucide-react";
import type { FoodEntry } from "@/lib/types";
import { formatTime } from "@/lib/time";
import { PrivatePhoto } from "@/components/private-photo";

export function FoodCard({ entry, timezone }: { entry: FoodEntry; timezone: string }) {
  return <Link href={`/entry/${entry.id}`} className={`food-card ${entry.is_flagged ? "food-card-flagged" : ""}`}>
    <div className="food-photo">{entry.photo_url ? <PrivatePhoto key={entry.photo_url} src={entry.photo_url} alt={entry.food_name} loading="lazy" /> : <Utensils aria-hidden="true" size={25} />}</div>
    <div className="food-card-content"><div className="food-card-top"><span className="food-time">{formatTime(entry.eaten_at, timezone)}{entry.meal_category && <span> · {entry.meal_category}</span>}</span>{entry.is_flagged && <span className="badge badge-trigger"><Flag size={12} aria-hidden="true" /> Flagged by you</span>}</div><h3>{entry.food_name}</h3>{entry.notes && <p className="food-notes">{entry.notes}</p>}{entry.reaction?.symptoms.length ? <p className="reaction-preview">{entry.reaction.symptoms.join(" · ")}</p> : null}</div>
    <ArrowUpRight className="food-card-arrow" size={19} aria-hidden="true" />
  </Link>;
}
