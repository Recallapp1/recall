import "server-only";

import { after } from "next/server";

import { env } from "@/lib/env";

import { safeError } from "@/lib/safe-error";

import { db } from "../../../db";
import { dispatchClinicNotifications } from "../../../domain/notifications";
import { smsProvider } from "../../../notifications/sms";
import { deleteProviderCall } from "./recordings";
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
      smsDelivers: smsProvider().delivers,
      postCallFlags: env().POST_CALL_FLAGS === true,
      dispatchClinic: async (clinicId) => {
        const config = env();
        try {
          await dispatchClinicNotifications(db(), clinicId, {
            now: new Date(),
            sendingEnabled: config.SMS_SENDING_ENABLED,
            provider: smsProvider(),
            providerName: config.SMS_SENDING_ENABLED ? config.SMS_PROVIDER : "console",
          });
        } catch (error) {
          // The daily job sends anything left pending.
          console.error(
            JSON.stringify({
              msg: "notifications.dispatch_failed",
              clinicId,
              error: safeError(error),
            }),
          );
        }
      },
      deleteProviderCall,
    });
  };
}
