import { z } from "npm:zod@4";
import { optionsResponse, isAllowedOrigin } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/http.ts";
import { uploadParticipantPhoto } from "../_shared/participant-photo.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { verifyTurnstile } from "../_shared/turnstile.ts";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const participantCodePattern = /^BTB26-[A-F0-9]{8}-[AB]$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

const requestSchema = z.object({
  eventSlug: z.literal("break-the-beat-2026"),
  identifier: z.string().trim().min(5).max(254),
  photo: z.object({
    mimeType: z.literal("image/jpeg"),
    base64: z.string().min(100).max(2_000_000)
  }),
  turnstileToken: z.string().min(1).max(2048)
});

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

const enforceRateLimit = async (request: Request, identifier: string) => {
  const client = createAdminClient();
  const keys = await Promise.all([
    hashKey(`participant-photo-address:${requestAddress(request)}`),
    hashKey(`participant-photo-identifier:${identifier}`)
  ]);
  const windowStart = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const cleanupBefore = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { error: cleanupError } = await client
    .from("participant_photo_attempts")
    .delete()
    .lt("created_at", cleanupBefore);
  if (cleanupError) throw cleanupError;

  const counts = await Promise.all(keys.map((key) => client
    .from("participant_photo_attempts")
    .select("id", { count: "exact", head: true })
    .eq("key_hash", key)
    .gte("created_at", windowStart)));
  if (counts.some(({ error }) => error)) throw new Error("Could not check participant photo rate limit");
  if (counts.some(({ count }) => (count ?? 0) >= 5)) return false;

  const { error: insertError } = await client
    .from("participant_photo_attempts")
    .insert(keys.map((key_hash) => ({ key_hash })));
  if (insertError) throw insertError;
  return true;
};

type ParticipantRow = {
  id: string;
  registration_id: string;
  email_normalized: string;
  photo_path: string | null;
};

const activeParticipants = async (client: ReturnType<typeof createAdminClient>, rows: ParticipantRow[]) => {
  if (!rows.length) return [];
  const registrationIds = [...new Set(rows.map((row) => row.registration_id))];
  const { data, error } = await client
    .from("registrations")
    .select("id")
    .in("id", registrationIds)
    .eq("status", "confirmed");
  if (error) throw error;
  const activeIds = new Set((data ?? []).map((registration) => registration.id));
  return rows.filter((row) => activeIds.has(row.registration_id));
};

const handleRequest = async (request: Request) => {
  if (request.method === "OPTIONS") return optionsResponse(request);
  if (request.method !== "POST") return errorResponse(request, "METHOD_NOT_ALLOWED", 405);
  if (!isAllowedOrigin(request)) return errorResponse(request, "ORIGIN_NOT_ALLOWED", 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(request, "INVALID_PHOTO_REQUEST");
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return errorResponse(request, "INVALID_PHOTO_REQUEST");
  if (!(await verifyTurnstile(request, parsed.data.turnstileToken, "participant_photo"))) {
    return errorResponse(request, "TURNSTILE_FAILED", 403);
  }

  const identifier = parsed.data.identifier.trim();
  const normalizedIdentifier = identifier.toLowerCase();
  if (!(await enforceRateLimit(request, normalizedIdentifier))) {
    return errorResponse(request, "TOO_MANY_REQUESTS", 429);
  }

  const client = createAdminClient();
  const { data: event, error: eventError } = await client
    .from("events")
    .select("id")
    .eq("slug", parsed.data.eventSlug)
    .maybeSingle();
  if (eventError) throw eventError;
  if (!event) return errorResponse(request, "PARTICIPANT_NOT_FOUND", 404);

  let lookup = client
    .from("participants")
    .select("id, registration_id, email_normalized, photo_path")
    .eq("event_id", event.id);
  let lookupByQr = false;
  if (normalizedIdentifier.startsWith("btb26:")) {
    const qrToken = normalizedIdentifier.slice("btb26:".length);
    if (!uuidPattern.test(qrToken)) return errorResponse(request, "INVALID_IDENTIFIER");
    lookup = lookup.eq("qr_token", qrToken);
    lookupByQr = true;
  } else if (participantCodePattern.test(identifier)) {
    lookup = lookup.eq("participant_code", identifier.toUpperCase());
    lookupByQr = true;
  } else if (emailPattern.test(normalizedIdentifier)) {
    lookup = lookup.eq("email_normalized", normalizedIdentifier);
  } else {
    return errorResponse(request, "INVALID_IDENTIFIER");
  }

  const { data: matches, error: lookupError } = await lookup;
  if (lookupError) throw lookupError;
  const initialActive = await activeParticipants(client, (matches ?? []) as ParticipantRow[]);
  if (!initialActive.length) return errorResponse(request, "PARTICIPANT_NOT_FOUND", 404);

  const email = initialActive[0].email_normalized;
  const { data: sameEmailRows, error: sameEmailError } = await client
    .from("participants")
    .select("id, registration_id, email_normalized, photo_path")
    .eq("event_id", event.id)
    .eq("email_normalized", email);
  if (sameEmailError) throw sameEmailError;
  const targets = await activeParticipants(client, (sameEmailRows ?? []) as ParticipantRow[]);
  if (!targets.length) return errorResponse(request, "PARTICIPANT_NOT_FOUND", 404);
  if (!lookupByQr && targets.some((participant) => participant.photo_path)) {
    return errorResponse(request, "PHOTO_ALREADY_EXISTS_USE_QR", 409);
  }

  const pathHash = await hashKey(`participant-photo-path:${event.id}:${email}`);
  const path = `${event.id}/${pathHash.slice(0, 40)}.jpg`;
  await uploadParticipantPhoto(client, path, parsed.data.photo);
  const { error: updateError } = await client
    .from("participants")
    .update({ photo_path: path, photo_uploaded_at: new Date().toISOString() })
    .in("id", targets.map((participant) => participant.id));
  if (updateError) throw updateError;

  const response = jsonResponse(request, { updated: true, participantCount: targets.length });
  response.headers.set("Cache-Control", "no-store");
  return response;
};

Deno.serve(async (request) => {
  try {
    return await handleRequest(request);
  } catch (error) {
    console.error("Unhandled update-participant-photo error", error);
    return errorResponse(request, error instanceof Error && error.message === "INVALID_PHOTO" ? "INVALID_PHOTO" : "INTERNAL_ERROR", 500);
  }
});
