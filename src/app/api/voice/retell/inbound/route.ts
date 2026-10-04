import { withRetell } from "@/server/voice/providers/retell/deps";
import { handleInbound } from "@/server/voice/providers/retell/handlers";

export const POST = withRetell(handleInbound);
