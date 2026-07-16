import { z } from "npm:zod@4";
import { optionsResponse, isAllowedOrigin } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/http.ts";
import { requireAdmin } from "../_shared/supabase.ts";
import { sendRegistrationEmails, updateEmailStatus, type EmailRegistration } from "../_shared/email.ts";

const requestSchema = z.object({ registrationId: z.string().uuid() });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return optionsResponse(request);
  if (request.method !== "POST") return errorResponse(request, "METHOD_NOT_ALLOWED", 405);
  if (!isAllowedOrigin(request)) return errorResponse(request, "ORIGIN_NOT_ALLOWED", 403);

  const admin = await requireAdmin(request);
  if (!admin) return errorResponse(request, "NOT_AUTHORIZED", 401);

  let parsed;
  try {
    parsed = requestSchema.safeParse(await request.json());
  } catch {
    return errorResponse(request, "INVALID_REQUEST");
  }
  if (!parsed.success) return errorResponse(request, "INVALID_REQUEST");

  const { data: registration, error } = await admin.client
    .from("registrations")
    .select(`
      id,
      public_code,
      participants (
        id,
        display_name,
        email,
        participant_code,
        qr_token,
        participant_categories ( category )
      )
    `)
    .eq("id", parsed.data.registrationId)
    .maybeSingle();

  if (error || !registration) return errorResponse(request, "REGISTRATION_NOT_FOUND", 404);

  const emailRegistration: EmailRegistration = {
    registrationId: registration.id,
    registrationCode: registration.public_code,
    participants: registration.participants.map((participant: any) => ({
      id: participant.id,
      displayName: participant.display_name,
      email: participant.email,
      participantCode: participant.participant_code,
      qrToken: participant.qr_token,
      categories: participant.participant_categories.map((item: any) => item.category)
    }))
  };

  let result: { status: "sent" | "partial" | "failed"; error: string | null };
  try {
    result = await sendRegistrationEmails(emailRegistration, `resend-${crypto.randomUUID()}`);
  } catch {
    result = { status: "failed", error: "EMAIL_DELIVERY_FAILED" };
  }
  await updateEmailStatus(admin.client, registration.id, result);
  await admin.client.from("admin_audit_log").insert({
    auth_user_id: admin.user.id,
    action: "resend_confirmation",
    target_type: "registration",
    target_id: registration.id,
    metadata: { status: result.status }
  });

  return jsonResponse(request, { emailStatus: result.status });
});

