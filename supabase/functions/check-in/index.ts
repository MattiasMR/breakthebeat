import { z } from "npm:zod@4";
import { optionsResponse, isAllowedOrigin } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/http.ts";
import { createAdminClient, requireAdmin } from "../_shared/supabase.ts";

const requestSchema = z.object({ tokenOrCode: z.string().trim().min(6).max(100) });
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const qrPayloadPattern = /^BTB26:([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return optionsResponse(request);
  if (request.method !== "POST") return errorResponse(request, "METHOD_NOT_ALLOWED", 405);
  if (!isAllowedOrigin(request)) return errorResponse(request, "ORIGIN_NOT_ALLOWED", 403);

  let parsed;
  try {
    parsed = requestSchema.safeParse(await request.json());
  } catch {
    return errorResponse(request, "INVALID_REQUEST");
  }
  if (!parsed.success) return errorResponse(request, "INVALID_REQUEST");

  const raw = parsed.data.tokenOrCode.trim();
  const qrMatch = raw.match(qrPayloadPattern);
  const admin = qrMatch ? null : await requireAdmin(request);
  if (!qrMatch && !admin) return errorResponse(request, "QR_REQUIRED", 403);

  const client = admin?.client ?? createAdminClient();
  const lookupValue = qrMatch?.[1] ?? raw.toUpperCase();
  let query = client
    .from("participants")
    .select("id, display_name, participant_code, registration_id, registrations!inner(public_code, status)");
  query = uuidPattern.test(lookupValue) ? query.eq("qr_token", lookupValue) : query.eq("participant_code", lookupValue);
  const { data: participant, error } = await query.maybeSingle();

  if (error || !participant) return errorResponse(request, "PARTICIPANT_NOT_FOUND", 404);
  const registration = Array.isArray(participant.registrations) ? participant.registrations[0] : participant.registrations;
  if (registration?.status === "cancelled") return errorResponse(request, "PARTICIPANT_CANCELLED", 409);

  const [{ data: categories }, { data: existing }] = await Promise.all([
    client.from("participant_categories").select("category").eq("participant_id", participant.id),
    client.from("check_ins").select("checked_in_at, checked_in_by, source").eq("participant_id", participant.id).maybeSingle()
  ]);

  let wasAlreadyCheckedIn = Boolean(existing);
  if (!wasAlreadyCheckedIn) {
    const { error: insertError } = await client.from("check_ins").insert({
      participant_id: participant.id,
      checked_in_by: admin?.user.id ?? null,
      source: admin ? "admin" : "qr"
    });
    if (insertError?.code === "23505") wasAlreadyCheckedIn = true;
    if (insertError && insertError.code !== "23505") return errorResponse(request, "CHECK_IN_FAILED", 500);
  }

  const { data: finalCheckIn } = await client
    .from("check_ins")
    .select("checked_in_at, checked_in_by, source")
    .eq("participant_id", participant.id)
    .single();

  const { data: checkInAdmin } = admin && finalCheckIn?.checked_in_by
    ? await client.from("admin_users").select("username").eq("auth_user_id", finalCheckIn.checked_in_by).maybeSingle()
    : { data: null };

  await client.from("admin_audit_log").insert({
    auth_user_id: admin?.user.id ?? null,
    action: wasAlreadyCheckedIn
      ? (admin ? "repeat_manual_check_in" : "repeat_qr_check_in")
      : (admin ? "manual_check_in" : "qr_check_in"),
    target_type: "participant",
    target_id: participant.id,
    metadata: { participant_code: participant.participant_code, source: admin ? "admin" : "qr" }
  });

  return jsonResponse(request, {
    participantId: participant.id,
    displayName: participant.display_name,
    participantCode: participant.participant_code,
    registrationCode: registration?.public_code,
    categories: (categories ?? []).map((item) => item.category),
    checkedInAt: finalCheckIn?.checked_in_at,
    checkedInBy: checkInAdmin?.username ?? "punto de check-in",
    alreadyCheckedIn: wasAlreadyCheckedIn
  });
});
