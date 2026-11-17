"use client";
import { useEffect } from "react";

export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const navigate = (event: MouseEvent) => {
      const anchor = (event.target as Element)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || anchor.hasAttribute("download") || anchor.target === "_blank" || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || anchor.origin !== location.origin || anchor.href === location.href) return;
      if (!window.confirm("Leave without saving your changes?")) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", navigate, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", navigate, true); };
  }, [dirty]);
}
