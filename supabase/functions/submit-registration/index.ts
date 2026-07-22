import { optionsResponse, isAllowedOrigin } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/http.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { verifyTurnstile } from "../_shared/turnstile.ts";
import { registrationPayloadSchema } from "../_shared/registration-schema.ts";
import { sendRegistrationEmails, updateEmailStatus, type EmailRegistration } from "../_shared/email.ts";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

const handleRequest = async (request: Request) => {
  if (request.method === "OPTIONS") return optionsResponse(request);
  if (request.method !== "POST") return errorResponse(request, "METHOD_NOT_ALLOWED", 405);
  if (!isAllowedOrigin(request)) return errorResponse(request, "ORIGIN_NOT_ALLOWED", 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(request, "INVALID_JSON");
  }

  const parsed = registrationPayloadSchema.safeParse(body);
  if (!parsed.success) return errorResponse(request, "INVALID_REGISTRATION");

  const human = await verifyTurnstile(request, parsed.data.turnstileToken, "registration");
  if (!human) return errorResponse(request, "TURNSTILE_FAILED", 403);

  const client = createAdminClient();
  const { data, error } = await client.rpc("create_registration", { p_payload: parsed.data });
  if (error || !data) {
    const message = error?.message ?? "REGISTRATION_FAILED";
    const known = [
      "REGISTRATION_CLOSED",
      "LEGAL_DOCUMENTS_NOT_READY",
      "DUPLICATE_PARTICIPANT",
      "INVALID_DUO",
      "CAPTAIN_AUTHORITY_REQUIRED"
    ].find((code) => message.includes(code));
    return errorResponse(request, known ?? "REGISTRATION_FAILED", known === "DUPLICATE_PARTICIPANT" ? 409 : 400);
  }

  const registration = data as {
    registrationId: string;
    registrationCode: string;
    participants: Array<{
      id: string;
      displayName: string;
      email: string;
      participantCode: string;
      qrToken: string;
      categories: string[];
    }>;
  };

  const emailRegistration: EmailRegistration = registration;
  const deliveryTask = (async () => {
    let emailResult: { status: "sent" | "partial" | "failed"; error: string | null };
    try {
      emailResult = await sendRegistrationEmails(emailRegistration, `initial-${registration.registrationId}`);
    } catch {
      emailResult = { status: "failed", error: "EMAIL_DELIVERY_FAILED" };
    }

    try {
      await updateEmailStatus(client, registration.registrationId, emailResult);
    } catch (error) {
      console.error("Unable to update registration email status", error);
    }
  })();

  if (typeof EdgeRuntime !== "undefined") {
    EdgeRuntime.waitUntil(deliveryTask);
  } else {
    void deliveryTask;
  }

  return jsonResponse(request, {
    registrationCode: registration.registrationCode,
    emailStatus: "pending",
    participants: registration.participants.map((participant) => ({
      displayName: participant.displayName,
      participantCode: participant.participantCode,
      qrPayload: `BTB26:${participant.qrToken}`,
      categories: participant.categories
    }))
  }, 201);
};

Deno.serve(async (request) => {
  try {
    return await handleRequest(request);
  } catch (error) {
    console.error("Unhandled submit-registration error", error);
    return errorResponse(request, "INTERNAL_ERROR", 500);
  }
});
