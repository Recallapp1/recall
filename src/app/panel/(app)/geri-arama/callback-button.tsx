"use client";

import { Check, LoaderCircle, RotateCcw } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { updateCallback } from "./actions";

export function CallbackButton({ callbackId, done }: { callbackId: string; done: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant={done ? "outline" : "default"}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await updateCallback({ callbackId, status: done ? "open" : "done" });
          if (result.ok) toast.success(result.message);
          else toast.error(result.message);
        })
      }
    >
      {pending ? <LoaderCircle className="animate-spin" /> : done ? <RotateCcw /> : <Check />}
      {done ? "Yeniden aç" : "Arandı"}
    </Button>
  );
}
