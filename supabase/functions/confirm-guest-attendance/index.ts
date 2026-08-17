import { z } from "npm:zod@4";
import { optionsResponse, isAllowedOrigin } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/http.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { verifyTurnstile } from "../_shared/turnstile.ts";

const eventSlug = "break-the-beat-2026";
const textField = (min: number, max: number) => z.string().trim().min(min).max(max)
  .transform((value) => value.replace(/\s+/g, " "));

const requestSchema = z.object({
  eventSlug: z.literal(eventSlug),
  firstName: textField(2, 80),
  lastName: textField(2, 80),
  organization: z.string().trim().max(120).transform((value) => value.replace(/\s+/g, " ")),
  turnstileToken: z.string().min(1).max(2048)
}).strict();

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
  if (!(await verifyTurnstile(request, parsed.data.turnstileToken, "guest_attendance"))) {
    return errorResponse(request, "TURNSTILE_FAILED", 403);
  }

  const client = createAdminClient();
  const { data: event, error: eventError } = await client
    .from("events")
    .select("id")
    .eq("slug", parsed.data.eventSlug)
    .maybeSingle();
  if (eventError || !event) return errorResponse(request, "EVENT_NOT_FOUND", 404);

  const { data: attendance, error: insertError } = await client
    .from("guest_attendances")
    .insert({
      event_id: event.id,
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      organization: parsed.data.organization || null
    })
    .select("confirmed_at")
    .single();
  if (insertError || !attendance) return errorResponse(request, "ATTENDANCE_CONFIRMATION_FAILED", 500);

  return jsonResponse(request, { confirmedAt: attendance.confirmed_at });
});
