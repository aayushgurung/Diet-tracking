"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, Plus, X, Check, Leaf, LockKeyhole, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/avatar";
import { TriggerWarning } from "@/components/trigger-warning";
import { findTriggerMatches } from "@/lib/matching";
import { foodInputSchema } from "@/lib/schemas";
import { toDateTimeLocal, fromDateTimeLocal } from "@/lib/time";
import { compressImage } from "@/lib/images";
import { saveFood } from "@/lib/server/actions";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";
import type { FoodComponent, FoodEntry, JournalData, MealCategory } from "@/lib/types";

export function FoodForm({ data, entry }: { data: JournalData; entry?: FoodEntry }) {
  const router = useRouter();
  const [name, setName] = useState(entry?.food_name ?? "");
  const [eatenAt, setEatenAt] = useState(() => toDateTimeLocal(entry?.eaten_at ?? new Date().toISOString(), data.profile.timezone));
  const [notes, setNotes] = useState(entry?.notes ?? "");
  const [category, setCategory] = useState<MealCategory | "">(entry?.meal_category ?? "");
  const [components, setComponents] = useState<FoodComponent[]>(entry?.components ?? []);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState(entry?.photo_url ?? "");
  const [removePhoto, setRemovePhoto] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string,string>>({});
  const [dirty, setDirty] = useState(false);
  const submitting = useRef(false);
  const photoRequest = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  useUnsavedChanges(dirty);
  const matches = findTriggerMatches([name, ...components.map(c => c.name)], data.triggers);

  async function selectPhoto(file?: File) {
    if (!file) return;
    const request = ++photoRequest.current;
    setPreparing(true); setError("");
    try {
      const compressed = await compressImage(file);
      const url = await new Promise<string>((resolve,reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Couldn't preview this photo. Try again.")); reader.readAsDataURL(compressed);
      });
      if (request !== photoRequest.current) return;
      setPhoto(compressed); setPreview(url); setRemovePhoto(false); setDirty(true);
    } catch (cause) { if (request === photoRequest.current) setError(cause instanceof Error ? cause.message : "Couldn't prepare this photo. Try another image."); }
    finally { if (request === photoRequest.current) setPreparing(false); }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || preparing) return;
    setError(""); setFieldErrors({});
    let eaten_at: string;
    try { eaten_at = fromDateTimeLocal(eatenAt, data.profile.timezone); }
    catch (cause) { setFieldErrors({ eaten_at: cause instanceof Error ? cause.message : "Choose a valid date and time." }); return; }
    const parsed = foodInputSchema.safeParse({ id: entry?.id, food_name: name, eaten_at, notes, meal_category: category || null, photo_path: removePhoto ? null : entry?.photo_path ?? null, components: components.filter(c => c.name.trim()) });
    if (!parsed.success) {
      const errors: Record<string,string> = {};
      parsed.error.issues.forEach(issue => { errors[String(issue.path[0])] = issue.message; }); setFieldErrors(errors); return;
    }
    submitting.current = true; setBusy("Saving your food…");
    let newPhoto: string | null = null;
    try {
      if (photo) {
        setBusy("Uploading your photo…");
        const body = new FormData(); body.set("file", photo);
        const response = await fetch("/api/photos", { method: "POST", body });
        const result = await response.json();
        if (!response.ok || !result.path) throw new Error(result.error ?? "Couldn't upload your photo. Please try again.");
        newPhoto = result.path;
      }
      setBusy("Saving your food…");
      const result = await saveFood({ ...parsed.data, photo_path: newPhoto ?? parsed.data.photo_path });
      if (!result.success) throw new Error(result.error);
      setDirty(false);
      router.push(entry ? `/entry/${result.data.id}` : "/?saved=1"); router.refresh();
    } catch (cause) {
      if (newPhoto) await fetch("/api/photos", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: newPhoto }) }).catch(() => undefined);
      setError(cause instanceof Error ? cause.message : "Couldn't save your food. Your changes are still here. Please try again.");
      submitting.current = false; setBusy("");
    }
  }

  return <form className="food-entry-form" onSubmit={submit} onChange={() => setDirty(true)} noValidate aria-busy={!!busy}>
    <div className="form-layout"><div className="form-main stack">
      <section className="card form-section"><div className="form-section-title"><span className="step-dot">1</span><h2>The little essentials</h2></div><div className="field"><label className="label" htmlFor="food-name">What did you eat? <span aria-hidden="true">*</span></label><input autoFocus className="input food-name-input" id="food-name" name="food_name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Avocado toast" maxLength={160} required aria-invalid={!!fieldErrors.food_name} aria-describedby={fieldErrors.food_name ? "food-name-error" : undefined} disabled={!!busy} />{fieldErrors.food_name && <p className="form-error" id="food-name-error">{fieldErrors.food_name}</p>}</div>
      {data.profile.warnings_enabled && <TriggerWarning key={matches.map(m => m.id).join("|")} matches={matches} entries={data.entries} showAvatar={data.profile.avatar_enabled} />}
      {name.trim() && !matches.length && data.profile.warnings_enabled && <p className="field-help no-warning"><Leaf size={14} /> No previous warnings for this food.</p>}
      <div className="form-grid"><div className="field"><label className="label" htmlFor="eaten-at">When did you eat it? <span aria-hidden="true">*</span></label><input className="input" type="datetime-local" id="eaten-at" value={eatenAt} onChange={e => setEatenAt(e.target.value)} required disabled={!!busy} aria-invalid={!!fieldErrors.eaten_at} aria-describedby="eaten-at-help" /><p id="eaten-at-help" className="field-help">{fieldErrors.eaten_at ?? `Your timezone: ${data.profile.timezone}. Recording time is saved separately.`}</p></div><div className="field"><label className="label" htmlFor="meal-category">Meal <span className="optional">optional</span></label><select className="input" id="meal-category" value={category} onChange={e => setCategory(e.target.value as MealCategory | "")} disabled={!!busy}><option value="">No category</option><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option><option value="snack">Snack</option></select></div></div></section>
      <section className="card form-section"><div className="form-section-title"><span className="step-dot">2</span><h2>A little more detail <span className="optional">optional</span></h2></div><div className="field"><label className="label" htmlFor="food-notes">Anything to remember?</label><textarea className="input" id="food-notes" rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Where you ate, how it was prepared, or just a little note…" maxLength={4000} disabled={!!busy} />{fieldErrors.notes && <p className="form-error">{fieldErrors.notes}</p>}</div><div className="field"><p className="label">Individual foods & ingredients</p><p className="field-help">List items separately to check their exact names against your watchlist. We won’t guess ingredients.</p>{components.map((component,index) => <div key={index} className="component-row"><select className="input" aria-label={`Item ${index+1} type`} value={component.kind} disabled={!!busy} onChange={e => setComponents(old => old.map((c,i) => i === index ? { ...c,kind: e.target.value as FoodComponent["kind"] } : c))}><option value="ingredient">Ingredient</option><option value="food">Food</option></select><input className="input" aria-label={`Item ${index+1} name`} value={component.name} onChange={e => setComponents(old => old.map((c,i) => i === index ? {...c,name:e.target.value} : c))} placeholder="e.g. Milk" maxLength={160} disabled={!!busy} /><button type="button" className="icon-button" aria-label={`Remove item ${index+1}`} onClick={() => { setComponents(old => old.filter((_,i) => i !== index)); setDirty(true); }} disabled={!!busy}><X size={17} /></button></div>)}{components.length < 40 && <Button type="button" variant="ghost" size="sm" disabled={!!busy} onClick={() => { setComponents(old => [...old,{name:"",kind:"ingredient"}]); setDirty(true); }}><Plus size={16} /> Add a food or ingredient</Button>}{fieldErrors.components && <p className="form-error">{fieldErrors.components}</p>}</div></section>
      {error && <p className="alert-error" role="alert">{error}</p>}
      <div className="form-actions"><p className="field-help"><LockKeyhole size={14} /> A memory, just for you.</p><div><Button variant="ghost" asChild><Link href={entry ? `/entry/${entry.id}` : "/"}>Cancel</Link></Button><Button type="submit" disabled={!!busy || preparing}>{busy ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}{busy || (entry ? "Save changes" : "Save to journal")}</Button></div></div>
    </div><aside className="form-aside stack"><section className="card form-section"><h2>Add a photo <span className="optional">optional</span></h2><p className="field-help">A picture can bring the memory back.</p>{preview ? <div className="photo-preview"><img src={preview} alt="Food photo preview" /><Button type="button" variant="secondary" size="sm" disabled={!!busy || preparing} onClick={() => { photoRequest.current++; setPhoto(null); setPreview(""); setRemovePhoto(true); setDirty(true); }}><X size={15} /> Remove photo</Button></div> : <button type="button" className="photo-picker" onClick={() => fileInput.current?.click()} disabled={!!busy || preparing}><ImagePlus size={29} strokeWidth={1.4} /><strong>{preparing ? "Preparing your photo…" : "Choose a photo"}</strong><span>JPEG, PNG or WebP · up to 10 MB</span></button>}<input ref={fileInput} disabled={!!busy || preparing} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose food photograph" onChange={e => { void selectPhoto(e.target.files?.[0]); e.target.value = ""; }} /><input ref={cameraInput} disabled={!!busy || preparing} className="sr-only" type="file" accept="image/*" capture="environment" aria-label="Take food photograph" onChange={e => { void selectPhoto(e.target.files?.[0]); e.target.value = ""; }} /><div className="photo-picker-actions"><Button type="button" size="sm" variant="outline" disabled={!!busy || preparing} onClick={() => cameraInput.current?.click()}><Camera size={15} /> Camera</Button>{preview && <Button type="button" size="sm" variant="ghost" disabled={!!busy || preparing} onClick={() => fileInput.current?.click()}>Replace</Button>}</div>{preparing && <p role="status" className="field-help">Preparing photo…</p>}<p className="field-help"><LockKeyhole size={12} /> Photos stay in your private journal.</p></section><div className="gentle-note"><Leaf size={23} /><h3>Keep it simple.</h3><p>A food name and a time are all you need. You can always come back to add details.</p>{data.profile.avatar_enabled && <Avatar state="neutral" size="sm" message="Every little note counts." />}</div></aside></div>
  </form>;
}
