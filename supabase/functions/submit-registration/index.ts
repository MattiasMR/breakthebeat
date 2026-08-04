import { optionsResponse, isAllowedOrigin } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/http.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { verifyTurnstile } from "../_shared/turnstile.ts";
import { registrationPayloadSchema } from "../_shared/registration-schema.ts";

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
      "CATEGORY_FULL",
      "INVALID_DUO",
      "CAPTAIN_AUTHORITY_REQUIRED"
    ].find((code) => message.includes(code));
    const status = known === "DUPLICATE_PARTICIPANT" || known === "CATEGORY_FULL" ? 409 : 400;
    return errorResponse(request, known ?? "REGISTRATION_FAILED", status);
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

  return jsonResponse(request, {
    registrationCode: registration.registrationCode,
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
