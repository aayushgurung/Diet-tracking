"use client";
import { useState } from "react";
import { ImageOff } from "lucide-react";

/** Remount with key={src} when renewing a signed URL. */
export function PrivatePhoto({ src, alt, loading }: { src:string; alt:string; loading?:"lazy"|"eager" }) {
  const [unavailable,setUnavailable] = useState(false);
  return unavailable ? <span className="photo-unavailable" role="img" aria-label={`${alt} photo unavailable. Refresh the page to renew private photo access.`}><ImageOff size={25} strokeWidth={1.5} aria-hidden="true" /></span> : <img src={src} alt={alt} loading={loading} onError={() => setUnavailable(true)} />;
}
