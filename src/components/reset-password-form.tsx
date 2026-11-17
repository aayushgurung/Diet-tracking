"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
export function ResetPasswordForm() {
  const router=useRouter(); const [password,setPassword]=useState("");const [confirmation,setConfirmation]=useState("");const [error,setError]=useState("");const [busy,setBusy]=useState(false);const lock=useRef(false);
  return <form className="stack" onSubmit={async e=>{e.preventDefault();if(lock.current)return;setError("");if(password.length<8 || password!==confirmation){setError("Use at least 8 characters and make sure both passwords match.");return;}lock.current=true;setBusy(true);try{const {error}=await createClient().auth.updateUser({password});if(error)throw error;router.replace("/");router.refresh();}catch(cause){setError(cause instanceof Error?cause.message:"Couldn't update your password. Try requesting a new reset link.");}finally{lock.current=false;setBusy(false);}}}><div className="field"><label className="label" htmlFor="new-password">New password</label><input className="input" id="new-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} required /></div><div className="field"><label className="label" htmlFor="confirm-password">Confirm password</label><input className="input" id="confirm-password" type="password" autoComplete="new-password" value={confirmation} onChange={e=>setConfirmation(e.target.value)} required /></div>{error&&<p className="alert-error" role="alert">{error}</p>}<Button disabled={busy} type="submit">{busy?"Saving…":"Save new password"}</Button></form>;
}
