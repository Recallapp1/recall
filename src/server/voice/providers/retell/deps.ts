import "server-only";

import { after } from "next/server";

import { env } from "@/lib/env";

import { safeError } from "@/lib/safe-error";

import { db } from "../../../db";
import { alertUnbackedClaim } from "../../../domain/claim-alerts";
import { dispatchClinicNotifications } from "../../../domain/notifications";
import { sendEmail } from "../../../notifications/email";
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
      sharedNumberCheck: env().VOICE_SHARED_NUMBER_CHECK === true,
      verifyHint: env().VOICE_VERIFY_HINT === true,
      toolErrorHint: env().VOICE_TOOL_ERROR_HINT === true,
      verifiedService: env().VOICE_VERIFIED_SERVICE === true,
      toolIdempotency: env().VOICE_TOOL_IDEMPOTENCY === true,
      toolFailsafe: env().VOICE_TOOL_FAILSAFE === true,
      storeLatency: env().CALL_LATENCY_STORE === true,
      alertUnbackedClaim:
        env().UNBACKED_CLAIM_EMAIL === true
          ? async (clinicId, callId) => {
              const config = env();
              await alertUnbackedClaim(db(), {
                clinicId,
                callId,
                origin: new URL(config.BETTER_AUTH_URL ?? config.APP_URL).origin,
                send: sendEmail,
              });
            }
          : undefined,
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
