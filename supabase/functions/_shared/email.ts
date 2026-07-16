import QRCode from "npm:qrcode@1.5.4";
import type { SupabaseClient } from "npm:@supabase/supabase-js@^2";

export type EmailParticipant = {
  id: string;
  displayName: string;
  email: string;
  participantCode: string;
  qrToken: string;
  categories: string[];
};

export type EmailRegistration = {
  registrationId: string;
  registrationCode: string;
  participants: EmailParticipant[];
};

const escapeHtml = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const qrBase64 = async (payload: string) => {
  const dataUrl = await QRCode.toDataURL(payload, { width: 520, margin: 2, errorCorrectionLevel: "M" });
  return dataUrl.replace(/^data:image\/png;base64,/, "");
};

const categoryLabels: Record<string, string> = {
  "1v1": "1 vs 1",
  "2v2": "2 vs 2",
  bgirls: "BGirls"
};

const emailHtml = (registrationCode: string, participant: EmailParticipant) => `
<!doctype html>
<html lang="es">
  <body style="margin:0;background:#050505;color:#fff8ea;font-family:Arial,sans-serif;padding:32px">
    <div style="max-width:620px;margin:auto;border:1px solid #383838;border-radius:18px;overflow:hidden">
      <div style="padding:28px;background:#f32383;color:#050505">
        <p style="margin:0 0 8px;font-weight:800;text-transform:uppercase">Break The Beat 2026</p>
        <h1 style="margin:0;font-size:30px">¡Tu inscripción está lista!</h1>
      </div>
      <div style="padding:28px">
        <p>Hola <strong>${escapeHtml(participant.displayName)}</strong>,</p>
        <p>Tu registro para Break The Beat quedó confirmado. Presenta el QR adjunto o este código al ingresar.</p>
        <div style="margin:24px 0;padding:18px;background:#fff8ea;color:#050505;border-radius:12px">
          <p style="margin:0 0 8px"><strong>Código personal:</strong> ${escapeHtml(participant.participantCode)}</p>
          <p style="margin:0 0 8px"><strong>Inscripción:</strong> ${escapeHtml(registrationCode)}</p>
          <p style="margin:0"><strong>Categorías:</strong> ${participant.categories.map((category) => escapeHtml(categoryLabels[category] ?? category)).join(", ")}</p>
        </div>
        <p>El QR no contiene tu información médica ni tus datos de contacto.</p>
      </div>
    </div>
  </body>
</html>`;

export const sendRegistrationEmails = async (
  registration: EmailRegistration,
  idempotencyPrefix: string
) => {
  const apiKey = Deno.env.get("RESEND_API_KEY")?.trim();
  const from = Deno.env.get("RESEND_FROM")?.trim();
  const replyTo = Deno.env.get("RESEND_REPLY_TO")?.trim();
  if (!apiKey || !from) return { status: "failed" as const, error: "EMAIL_NOT_CONFIGURED" };

  const results = await Promise.all(registration.participants.map(async (participant) => {
    try {
      const qrPayload = `BTB26:${participant.qrToken}`;
      const attachment = await qrBase64(qrPayload);
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `${idempotencyPrefix}-${participant.id}`.slice(0, 256)
        },
        body: JSON.stringify({
          from,
          to: [participant.email],
          reply_to: replyTo || undefined,
          subject: `Tu inscripción a Break The Beat · ${participant.participantCode}`,
          html: emailHtml(registration.registrationCode, participant),
          attachments: [{
            filename: `QR-${participant.participantCode}.png`,
            content: attachment
          }],
          tags: [
            { name: "event", value: "break_the_beat_2026" },
            { name: "registration", value: registration.registrationCode.replaceAll("-", "_") }
          ]
        }),
        signal: AbortSignal.timeout(12000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }));

  const sent = results.filter(Boolean).length;
  if (sent === results.length) return { status: "sent" as const, error: null };
  if (sent > 0) return { status: "partial" as const, error: "PARTIAL_EMAIL_DELIVERY" };
  return { status: "failed" as const, error: "EMAIL_DELIVERY_FAILED" };
};

export const updateEmailStatus = async (
  client: SupabaseClient,
  registrationId: string,
  result: { status: "sent" | "partial" | "failed"; error: string | null }
) => {
  await client
    .from("registrations")
    .update({ email_status: result.status, email_error: result.error })
    .eq("id", registrationId);
};
