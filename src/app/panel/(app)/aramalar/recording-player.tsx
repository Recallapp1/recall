"use client";

import { LoaderCircle, Play } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { getRecordingUrl } from "./actions";

/** Loads the recording on demand so each playback is audited. */
export function RecordingPlayer({ callId }: { callId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (url) {
    return (
      // Speech recordings have no captions; the transcript is shown alongside.
      <audio controls autoPlay src={url} className="w-full">
        Tarayıcınız ses oynatmayı desteklemiyor.
      </audio>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        className="w-fit"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await getRecordingUrl(callId);
            if (result.ok) setUrl(result.url);
            else setError(result.message);
          })
        }
      >
        {pending ? <LoaderCircle className="animate-spin" /> : <Play />}
        Kaydı dinle
      </Button>
      {error && <p className="text-sm text-danger">{error}</p>}
      <p className="text-xs text-body">Kayıt dinlemeleri denetim kaydına yazılır.</p>
    </div>
  );
}
