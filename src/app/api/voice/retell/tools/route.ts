import { withRetell } from "@/server/voice/providers/retell/deps";
import { handleFunctionCall } from "@/server/voice/providers/retell/handlers";

export const POST = withRetell(handleFunctionCall);
