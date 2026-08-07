import { describe, expect, it } from "vitest";
import { buildParticipantQrPayload, createParticipantQrDataUrl, participantQrFilename } from "./participant-qr";

describe("participant QR helpers", () => {
  it("construye el mismo payload privado que acepta el check-in", () => {
    const token = "123e4567-e89b-42d3-a456-426614174000";
    expect(buildParticipantQrPayload(token)).toBe(`BTB26:${token}`);
  });

  it("usa el código individual en el nombre de la descarga", () => {
    expect(participantQrFilename("BTB26-54A79D88-A")).toBe("QR-BTB26-54A79D88-A.png");
  });

  it("genera una imagen PNG descargable", async () => {
    const payload = buildParticipantQrPayload("123e4567-e89b-42d3-a456-426614174000");
    await expect(createParticipantQrDataUrl(payload)).resolves.toMatch(/^data:image\/png;base64,/);
  });
});
