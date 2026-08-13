import { z } from "npm:zod@4";
import { optionsResponse, isAllowedOrigin } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/http.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { verifyTurnstile } from "../_shared/turnstile.ts";

const recoverySchema = z.object({
  eventSlug: z.literal("break-the-beat-2026"),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  turnstileToken: z.string().min(1).max(2048)
});

const recoveryResponse = (request: Request, body: unknown) => {
  const response = jsonResponse(request, body);
  response.headers.set("Cache-Control", "no-store");
  return response;
};

const hashKey = async (value: string) => {
  const salt = Deno.env.get("LOGIN_RATE_LIMIT_SALT")?.trim();
  if (!salt) throw new Error("Missing LOGIN_RATE_LIMIT_SALT");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${value}`));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const requestAddress = (request: Request) => request.headers.get("cf-connecting-ip")?.trim()
  || request.headers.get("x-real-ip")?.trim()
  || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  || "unknown";

const enforceRateLimit = async (request: Request, email: string) => {
  const client = createAdminClient();
  const keys = await Promise.all([
    hashKey(`registration-recovery-address:${requestAddress(request)}`),
    hashKey(`registration-recovery-email:${email}`)
  ]);
  const windowStart = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const cleanupBefore = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { error: cleanupError } = await client
    .from("registration_recovery_attempts")
    .delete()
    .lt("created_at", cleanupBefore);
  if (cleanupError) throw cleanupError;

  const counts = await Promise.all(keys.map((key) => client
    .from("registration_recovery_attempts")
    .select("id", { count: "exact", head: true })
    .eq("key_hash", key)
    .gte("created_at", windowStart)));
  if (counts.some(({ error }) => error)) throw new Error("Could not check registration recovery rate limit");
  if (counts.some(({ count }) => (count ?? 0) >= 5)) return false;

  const { error: insertError } = await client
    .from("registration_recovery_attempts")
    .insert(keys.map((key_hash) => ({ key_hash })));
  if (insertError) throw insertError;
  return true;
};

const handleRequest = async (request: Request) => {
  if (request.method === "OPTIONS") return optionsResponse(request);
  if (request.method !== "POST") return errorResponse(request, "METHOD_NOT_ALLOWED", 405);
  if (!isAllowedOrigin(request)) return errorResponse(request, "ORIGIN_NOT_ALLOWED", 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(request, "INVALID_RECOVERY");
  }

  const parsed = recoverySchema.safeParse(body);
  if (!parsed.success) return errorResponse(request, "INVALID_RECOVERY");
  if (!(await verifyTurnstile(request, parsed.data.turnstileToken, "registration_recovery"))) {
    return errorResponse(request, "TURNSTILE_FAILED", 403);
  }
  if (!(await enforceRateLimit(request, parsed.data.email))) {
    return errorResponse(request, "TOO_MANY_REQUESTS", 429);
  }

  const client = createAdminClient();
  const { data: event, error: eventError } = await client
    .from("events")
    .select("id")
    .eq("slug", parsed.data.eventSlug)
    .maybeSingle();
  if (eventError) throw eventError;
  if (!event) return recoveryResponse(request, { participants: [] });

  const { data: participants, error: participantError } = await client
    .from("participants")
    .select("id, registration_id, display_name, participant_code, qr_token, created_at")
    .eq("event_id", event.id)
    .eq("email_normalized", parsed.data.email)
    .order("created_at", { ascending: true });
  if (participantError) throw participantError;
  if (!participants?.length) return recoveryResponse(request, { participants: [] });

  const registrationIds = [...new Set(participants.map((participant) => participant.registration_id))];
  const participantIds = participants.map((participant) => participant.id);
  const [{ data: registrations, error: registrationError }, { data: categories, error: categoryError }] = await Promise.all([
    client.from("registrations").select("id, public_code").in("id", registrationIds).eq("status", "confirmed"),
    client.from("participant_categories").select("participant_id, category").in("participant_id", participantIds).order("category")
  ]);
  if (registrationError) throw registrationError;
  if (categoryError) throw categoryError;

  const registrationCodes = new Map((registrations ?? []).map((registration) => [registration.id, registration.public_code]));
  const categoriesByParticipant = new Map<string, string[]>();
  (categories ?? []).forEach((item) => {
    categoriesByParticipant.set(item.participant_id, [
      ...(categoriesByParticipant.get(item.participant_id) ?? []),
      item.category
    ]);
  });

  return recoveryResponse(request, {
    participants: participants.flatMap((participant) => {
      const registrationCode = registrationCodes.get(participant.registration_id);
      if (!registrationCode) return [];
      return [{
        registrationCode,
        displayName: participant.display_name,
        participantCode: participant.participant_code,
        qrPayload: `BTB26:${participant.qr_token}`,
        categories: categoriesByParticipant.get(participant.id) ?? []
      }];
    })
  });
};

Deno.serve(async (request) => {
  try {
    return await handleRequest(request);
  } catch (error) {
    console.error("Unhandled recover-registration error", error);
    return errorResponse(request, "INTERNAL_ERROR", 500);
  }
});
