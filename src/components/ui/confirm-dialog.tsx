"use client";

import { useState, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface ConfirmDialogProps {
  title: string;
  description: string;
  trigger: ReactNode;
  onConfirm: () => Promise<void> | void;
  confirmLabel?: string;
  destructive?: boolean;
}

export function ConfirmDialog({ title, description, trigger, onConfirm, confirmLabel = "Confirm", destructive = true }: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That didn’t work. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!pending) { setError(null); setOpen(next); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent onEscapeKeyDown={(event) => { if (pending) event.preventDefault(); }} onInteractOutside={(event) => { if (pending) event.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {error && <p className="alert-error" role="alert">{error}</p>}
        <DialogFooter>
          <DialogClose asChild><Button variant="outline" disabled={pending}>Cancel</Button></DialogClose>
          <Button variant={destructive ? "destructive" : "default"} onClick={confirm} disabled={pending}>
            {pending && <LoaderCircle className="spin" size={17} aria-hidden="true" />}
            {pending ? "Please wait…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
