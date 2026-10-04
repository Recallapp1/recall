import "server-only";

import { after } from "next/server";

import { env } from "@/lib/env";

import { db } from "../../../db";
import type { RetellHandlerDeps } from "./handlers";

type Handler = (request: Request, deps: RetellHandlerDeps) => Promise<Response>;

/**
 * Wires a Retell handler for a route. Without an API key nothing can be
 * verified, so the endpoint answers 503 instead of failing with a 500.
 */
export function withRetell(handler: Handler) {
  return async (request: Request) => {
    const apiKey = env().RETELL_API_KEY;
    if (!apiKey) {
      console.error(JSON.stringify({ msg: "retell.not_configured" }));
      return Response.json(
        { error: { code: "VOICE_NOT_CONFIGURED", message: "RETELL_API_KEY is not set" } },
        { status: 503 },
      );
    }
    return handler(request, {
      db: db(),
      apiKey,
      now: () => new Date(),
      defer: (task) => after(task),
    });
  };
}
