import { after } from "next/server";

import { env } from "@/lib/env";
import { db } from "@/server/db";
import { handleVapiRequest } from "@/server/voice/providers/vapi/handler";

export async function POST(request: Request) {
  const config = env();
  return handleVapiRequest(request, {
    db: db(),
    secret: config.VAPI_WEBHOOK_SECRET,
    serverUrl: new URL("/api/voice/vapi", config.APP_URL).toString(),
    pipeline: {
      llmModel: config.VOICE_LLM_MODEL,
      transcriberProvider: config.VOICE_TRANSCRIBER_PROVIDER,
      transcriberModel: config.VOICE_TRANSCRIBER_MODEL,
      ttsProvider: config.VOICE_TTS_PROVIDER,
      ttsVoiceId: config.VOICE_TTS_VOICE_ID,
    },
    now: () => new Date(),
    defer: (task) => after(task),
  });
}
