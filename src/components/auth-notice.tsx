"use client";
import { useSearchParams } from "next/navigation";
export function AuthNotice() { const params=useSearchParams(); return params.has("error") ? <p className="alert-error" role="alert">This sign-in link couldn’t be verified. Please sign in again or request a new link.</p> : null; }
