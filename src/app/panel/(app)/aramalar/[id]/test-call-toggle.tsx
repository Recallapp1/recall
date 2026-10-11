"use client";

import { LoaderCircle } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { markTestCall } from "../actions";

/** "Test araması" marking (TEST_CALL_FLAG, R2 5e). */
export function TestCallToggle({ callId, isTest }: { callId: string; isTest: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="w-fit"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await markTestCall({ callId, test: !isTest });
          if (result.ok) toast.success(result.message);
          else toast.error(result.message);
        })
      }
    >
      {pending && <LoaderCircle className="animate-spin" />}
      {isTest ? "Test işaretini kaldır" : "Test araması olarak işaretle"}
    </Button>
  );
}
