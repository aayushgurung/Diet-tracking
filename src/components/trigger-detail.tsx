"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArrowLeft, Flag, Plus, RotateCcw, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FoodCard } from "@/components/food-card";
import { PageHeading } from "@/components/page-heading";
import { saveTrigger, setTriggerActive } from "@/lib/server/actions";
import { triggerInputSchema } from "@/lib/schemas";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";
import { formatDate } from "@/lib/time";
import type { FoodEntry, TriggerFood } from "@/lib/types";

export function TriggerDetail({ trigger, entries, timezone }: {trigger:TriggerFood;entries:FoodEntry[];timezone:string}) {
  const router = useRouter();
  const [name,setName] = useState(trigger.display_name);
  const [notes,setNotes] = useState(trigger.notes ?? "");
  const [aliases,setAliases] = useState(trigger.aliases.map(a => a.alias_name));
  const [alias,setAlias] = useState("");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [success,setSuccess] = useState(false);
  const [dirty,setDirty] = useState(false);
  const lock = useRef(false);
  useUnsavedChanges(dirty);
  const related = entries.filter(e => e.trigger_food_id === trigger.id).sort((a,b) => b.eaten_at.localeCompare(a.eaten_at));
  async function submit(event:React.FormEvent) {
    event.preventDefault(); if (lock.current) return; setError(""); setSuccess(false);
    const parsed = triggerInputSchema.safeParse({ id:trigger.id,display_name:name,notes,aliases:alias.trim() ? [...aliases,alias.trim()] : aliases });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    lock.current=true; setBusy(true);
    try { const result = await saveTrigger(parsed.data); if (!result.success) throw new Error(result.error); setAliases(parsed.data.aliases); setAlias(""); setDirty(false); setSuccess(true); router.refresh(); }
    catch(cause) { setError(cause instanceof Error ? cause.message : "Couldn't update this watchlist item. Try again."); }
    finally { setBusy(false); lock.current=false; }
  }
  return <><Link href="/triggers" className="back-link"><ArrowLeft size={16} /> Trigger foods</Link><PageHeading eyebrow="YOUR PERSONAL OBSERVATIONS" title={trigger.display_name} description={`First flagged ${formatDate(trigger.first_flagged_at,timezone)} · Last flagged ${formatDate(trigger.last_flagged_at,timezone)}`} action={<span className={`badge ${trigger.is_active ? "badge-trigger" : ""}`}><Flag size={14} />{trigger.is_active ? "Warning active" : "Warning archived"}</span>} /><div className="form-layout"><section><div className="section-heading"><h2>Food & reaction history <span className="count-bubble">{related.length}</span></h2></div>{related.length ? <div className="food-list">{related.map(entry => <div key={entry.id}><p className="entry-date-label">{formatDate(entry.eaten_at,timezone,"EEEE, d MMM yyyy")}</p><FoodCard entry={entry} timezone={timezone} />{entry.reaction && <div className="history-reaction"><span className="eyebrow">YOUR REACTION REPORT</span><p>{entry.reaction.symptoms.length ? entry.reaction.symptoms.join(", ") : "No symptoms specified"}{entry.reaction.severity && ` · Reported ${entry.reaction.severity}`}</p>{entry.reaction.reaction_at && <p className="field-help">Started {formatDate(entry.reaction.reaction_at,timezone,"d MMM yyyy, h:mm a")}</p>}{entry.reaction.onset_minutes !== null && <p className="field-help">{entry.reaction.onset_minutes} minutes after eating</p>}{entry.reaction.notes && <p className="preserve-whitespace">{entry.reaction.notes}</p>}</div>}</div>)}</div> : <div className="empty-state"><Flag size={28} /><h3>No linked entries remain</h3><p>The watchlist record is still here. Removing food entries doesn’t erase a warning.</p></div>}</section><aside className="stack"><form className="card form-section stack" onSubmit={submit} onChange={() => { setDirty(true); setSuccess(false); }}><h2>Watchlist details</h2><fieldset className="stack" disabled={busy}><div className="field"><label className="label" htmlFor="trigger-name">Food name</label><input className="input" id="trigger-name" maxLength={160} value={name} onChange={e => setName(e.target.value)} required /><p className="field-help">This name is checked for future warnings. Add the old name as an alias if you still want to match it.</p></div><div className="field"><label className="label" htmlFor="alias">Explicit aliases</label><p className="field-help">Only names you add here are matched. Related ingredients aren’t assumed.</p><div className="chip-list">{aliases.map((value,index) => <button key={`${value}-${index}`} type="button" className="chip" aria-label={`Remove alias ${value}`} onClick={() => { setAliases(old => old.filter((_,i) => i !== index)); setDirty(true); setSuccess(false); }}>{value}<X size={13} /></button>)}</div><div className="component-row"><input className="input" id="alias" value={alias} onChange={e => setAlias(e.target.value)} maxLength={160} placeholder="Another name for this food" /><Button type="button" variant="outline" size="icon" aria-label="Add alias" disabled={!alias.trim() || aliases.length >= 30} onClick={() => { setAliases(old => [...old,alias.trim()]); setAlias(""); setDirty(true); setSuccess(false); }}><Plus size={17} /></Button></div></div><div className="field"><label className="label" htmlFor="trigger-notes">Your notes</label><textarea className="input" id="trigger-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={4} maxLength={4000} /></div></fieldset>{error && <p className="alert-error" role="alert">{error}</p>}{success && <p className="success-note" role="status"><Check size={15} /> Watchlist updated.</p>}<Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save watchlist details"}</Button></form><section className="card form-section"><h2>{trigger.is_active ? "Take a break from this warning" : "Bring back this warning"}</h2><p className="muted">{trigger.is_active ? "Archive the warning whenever you choose. Your food entries and reaction reports will stay in your journal." : "Reactivate this food to see a reminder the next time you log its name or an alias."}</p><ConfirmDialog title={trigger.is_active ? "Archive this warning?" : "Reactivate this warning?"} description={trigger.is_active ? "You won’t see warnings for this food while it’s archived. Your historical entries and reactions will be preserved." : "Warnings will appear before saving this food again. You can always continue logging."} confirmLabel={trigger.is_active ? "Archive warning" : "Reactivate warning"} destructive={false} trigger={<Button variant="outline">{trigger.is_active ? <Archive size={16} /> : <RotateCcw size={16} />}{trigger.is_active ? "Archive warning" : "Reactivate warning"}</Button>} onConfirm={async () => { const result = await setTriggerActive(trigger.id,!trigger.is_active); if (!result.success) throw new Error(result.error); router.refresh(); }} /></section></aside></div></>;
}
