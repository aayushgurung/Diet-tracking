"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Flag, Plus, X, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SYMPTOM_SUGGESTIONS } from "@/lib/config";
import { reactionInputSchema } from "@/lib/schemas";
import { fromDateTimeLocal, toDateTimeLocal } from "@/lib/time";
import { saveReaction } from "@/lib/server/actions";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";
import type { FoodEntry, Severity } from "@/lib/types";

export function ReactionEditor({ entry, timezone }: { entry: FoodEntry; timezone: string }) {
  const [open,setOpen] = useState(false);
  const [dirty,setDirty] = useState(false);
  const busyRef = useRef(false);
  const dirtyRef = useRef(false);
  useUnsavedChanges(open && dirty);
  function changeOpen(next: boolean) {
    if (!next && busyRef.current) return;
    if (!next && dirtyRef.current && !window.confirm("Discard your unsaved reaction notes?")) return;
    if (!next) { dirtyRef.current = false; setDirty(false); }
    setOpen(next);
  }
  return <Dialog open={open} onOpenChange={changeOpen}><DialogTrigger asChild><Button variant={entry.is_flagged ? "outline" : "destructive"}><Flag size={16} />{entry.is_flagged ? "Edit reaction" : "Mark as trigger"}</Button></DialogTrigger><DialogContent onEscapeKeyDown={event => { if (busyRef.current) event.preventDefault(); }} onInteractOutside={event => { if (busyRef.current) event.preventDefault(); }}><DialogHeader><DialogTitle>{entry.is_flagged ? "Your reaction notes" : "Flag this food for review"}</DialogTitle><DialogDescription>{entry.food_name} · A personal observation, not a diagnosis. All reaction details are optional.</DialogDescription></DialogHeader><ReactionForm key={String(open)} entry={entry} timezone={timezone} onPending={pending => { busyRef.current = pending; }} onDirty={() => { dirtyRef.current = true; setDirty(true); }} onCancel={() => changeOpen(false)} onSaved={() => { dirtyRef.current = false; setDirty(false); setOpen(false); }} /></DialogContent></Dialog>;
}

function ReactionForm({ entry,timezone,onSaved,onCancel,onDirty,onPending }: { entry: FoodEntry; timezone: string; onSaved: () => void; onCancel: () => void; onDirty: () => void; onPending: (pending: boolean) => void }) {
  const router = useRouter();
  const [symptoms,setSymptoms] = useState(entry.reaction?.symptoms ?? []);
  const [custom,setCustom] = useState("");
  const [severity,setSeverity] = useState<Severity | "">(entry.reaction?.severity ?? "");
  const [reactionAt,setReactionAt] = useState(entry.reaction?.reaction_at ? toDateTimeLocal(entry.reaction.reaction_at,timezone) : "");
  const [onset,setOnset] = useState(entry.reaction?.onset_minutes?.toString() ?? "");
  const [notes,setNotes] = useState(entry.reaction?.notes ?? "");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const lock = useRef(false);
  const toggle = (value:string) => { onDirty(); setSymptoms(old => old.includes(value) ? old.filter(s => s !== value) : old.length < 20 ? [...old,value] : old); };
  async function submit(event:React.FormEvent) {
    event.preventDefault(); if (lock.current) return; setError("");
    let reaction_at: string | null = null;
    try { if (reactionAt) reaction_at = fromDateTimeLocal(reactionAt,timezone); }
    catch(cause) { setError(cause instanceof Error ? cause.message : "Choose a valid reaction time."); return; }
    const finalSymptoms = custom.trim() ? [...new Set([...symptoms,custom.trim()])] : symptoms;
    const parsed = reactionInputSchema.safeParse({ food_entry_id:entry.id,symptoms:finalSymptoms,severity:severity || null,reaction_at,onset_minutes:onset === "" ? null : Number(onset),notes });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    lock.current = true; setBusy(true); onPending(true);
    try { const result = await saveReaction(parsed.data); if (!result.success) throw new Error(result.error); router.refresh(); onSaved(); }
    catch(cause) { setError(cause instanceof Error ? cause.message : "Couldn't save your reaction. Please try again."); }
    finally { lock.current = false; setBusy(false); onPending(false); }
  }
  return <form className="stack reaction-form" onSubmit={submit} onChange={onDirty} noValidate aria-busy={busy}><fieldset disabled={busy} className="stack" aria-label="Optional reaction details"><fieldset className="field"><legend className="label">What did you notice?</legend><div className="chip-list">{SYMPTOM_SUGGESTIONS.map(symptom => <button key={symptom} type="button" className={`chip ${symptoms.includes(symptom) ? "chip-selected" : ""}`} aria-pressed={symptoms.includes(symptom)} disabled={!symptoms.includes(symptom) && symptoms.length >= 20} onClick={() => toggle(symptom)}>{symptom}</button>)}</div>{symptoms.filter(s => !(SYMPTOM_SUGGESTIONS as readonly string[]).includes(s)).map(s => <button type="button" className="chip chip-selected" key={s} onClick={() => toggle(s)} aria-label={`Remove symptom ${s}`}>{s}<X size={13} /></button>)}<label className="label" htmlFor="custom-symptom">Other symptom</label><div className="component-row"><input className="input" id="custom-symptom" value={custom} maxLength={100} placeholder="Describe a symptom" onChange={e => setCustom(e.target.value)} /><Button type="button" variant="outline" size="icon" aria-label="Add symptom" disabled={!custom.trim() || symptoms.length >= 20} onClick={() => { if (custom.trim() && !symptoms.includes(custom.trim())) toggle(custom.trim()); setCustom(""); }}><Plus size={17} /></Button></div></fieldset><div className="field"><label className="label" htmlFor="severity">How did it feel?</label><select className="input" id="severity" value={severity} onChange={e => setSeverity(e.target.value as Severity | "")}><option value="">Not specified</option><option value="mild">Mild</option><option value="moderate">Moderate</option><option value="severe">Severe</option></select><p className="field-help">Your own description, not an assessment of medical risk.</p></div><div className="form-grid"><div className="field"><label className="label" htmlFor="reaction-at">Symptoms started</label><input className="input" type="datetime-local" id="reaction-at" value={reactionAt} onChange={e => setReactionAt(e.target.value)} /><p className="field-help">Approximate, in {timezone}.</p></div><div className="field"><label className="label" htmlFor="onset">Or minutes after eating</label><input className="input" type="number" id="onset" min={0} max={525600} value={onset} onChange={e => setOnset(e.target.value)} placeholder="e.g. 30" /></div></div><div className="field"><label className="label" htmlFor="reaction-notes">Reaction notes</label><textarea className="input" id="reaction-notes" rows={3} maxLength={4000} value={notes} onChange={e => setNotes(e.target.value)} placeholder="What would you like to remember?" /></div></fieldset>{error && <p className="alert-error" role="alert">{error}</p>}<div className="dialog-actions"><Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? <LoaderCircle size={16} className="spin" /> : <Flag size={16} />}{busy ? "Saving…" : entry.is_flagged ? "Save reaction" : "Flag food & save"}</Button></div><p className="field-help">{entry.is_flagged ? "Editing this report preserves your watchlist preferences." : "This food will be added to your active warning watchlist. You can archive its warning separately."}</p></form>;
}
