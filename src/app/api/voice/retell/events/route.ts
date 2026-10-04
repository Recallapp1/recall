import { withRetell } from "@/server/voice/providers/retell/deps";
import { handleCallEvent } from "@/server/voice/providers/retell/handlers";

export const POST = withRetell(handleCallEvent);
