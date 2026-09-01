import { optionsResponse, isAllowedOrigin } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/http.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { verifyTurnstile } from "../_shared/turnstile.ts";
import { registrationPayloadSchema } from "../_shared/registration-schema.ts";
import { PARTICIPANT_PHOTO_BUCKET, uploadParticipantPhoto } from "../_shared/participant-photo.ts";

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
  const databasePayload = {
    ...parsed.data,
    participants: parsed.data.participants.map(({ photo: _photo, ...participant }) => participant)
  };
  const { data, error } = await client.rpc("create_registration", { p_payload: databasePayload });
  if (error || !data) {
    const message = error?.message ?? "REGISTRATION_FAILED";
    const duplicateCategory = message.match(/DUPLICATE_PARTICIPANT_CATEGORY:(1v1|2v2|bgirls)/)?.[1];
    const known = [
      "REGISTRATION_CLOSED",
      "LEGAL_DOCUMENTS_NOT_READY",
      "DUPLICATE_PARTICIPANT_CATEGORY",
      "DUPLICATE_PARTICIPANT",
      "CATEGORY_FULL",
      "INVALID_DUO",
      "CAPTAIN_AUTHORITY_REQUIRED"
    ].find((code) => message.includes(code));
    const status = ["DUPLICATE_PARTICIPANT_CATEGORY", "DUPLICATE_PARTICIPANT", "CATEGORY_FULL"].includes(known ?? "")
      ? 409
      : 400;
    if (known === "DUPLICATE_PARTICIPANT_CATEGORY" && duplicateCategory) {
      return jsonResponse(request, { error: known, category: duplicateCategory }, status);
    }
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

  const uploadedPaths: string[] = [];
  try {
    for (const participant of registration.participants) {
      const input = parsed.data.participants.find((item) => item.email === participant.email.toLowerCase());
      if (!input) throw new Error("INVALID_PHOTO");
      const path = `${parsed.data.eventSlug}/${participant.id}.jpg`;
      await uploadParticipantPhoto(client, path, input.photo);
      uploadedPaths.push(path);
      const { error: updateError } = await client
        .from("participants")
        .update({ photo_path: path, photo_uploaded_at: new Date().toISOString() })
        .eq("id", participant.id);
      if (updateError) throw updateError;
    }
  } catch (photoError) {
    if (uploadedPaths.length) await client.storage.from(PARTICIPANT_PHOTO_BUCKET).remove(uploadedPaths);
    const { error: rollbackError } = await client.from("registrations").delete().eq("id", registration.registrationId);
    if (rollbackError) console.error("Could not roll back registration after photo failure", rollbackError);
    console.error("Participant photo upload failed", photoError);
    return errorResponse(request, "PHOTO_UPLOAD_FAILED", 500);
  }

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
