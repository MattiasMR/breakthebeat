import { describe, expect, it } from "vitest";
import { registrationRecoveryResponseSchema, toRecoveryConfirmation } from "./registration-recovery";

const participant = (registrationCode: string, participantCode: string) => ({
  registrationCode,
  displayName: "Bailarín de prueba",
  participantCode,
  qrPayload: "BTB26:123e4567-e89b-42d3-a456-426614174000",
  categories: ["1v1" as const]
});

describe("registration recovery", () => {
  it("prepara una inscripción recuperada para la pantalla de confirmación", () => {
    const response = registrationRecoveryResponseSchema.parse({
      participants: [participant("BTB26-AAAABBBB", "BTB26-AAAABBBB-A")]
    });

    expect(toRecoveryConfirmation(response)).toMatchObject({
      source: "recovery",
      registrationCount: 1,
      registrationCode: "BTB26-AAAABBBB"
    });
  });

  it("agrupa varios QR del mismo correo sin duplicar el conteo de inscripciones", () => {
    const response = registrationRecoveryResponseSchema.parse({
      participants: [
        participant("BTB26-AAAABBBB", "BTB26-AAAABBBB-A"),
        participant("BTB26-CCCCDDDD", "BTB26-CCCCDDDD-A"),
        participant("BTB26-CCCCDDDD", "BTB26-CCCCDDDD-B")
      ]
    });

    const confirmation = toRecoveryConfirmation(response);
    expect(confirmation.registrationCount).toBe(2);
    expect(confirmation.registrationCode).toBe("2 inscripciones");
    expect(confirmation.participants).toHaveLength(3);
  });

  it("rechaza categorías o payloads que no pertenecen al contrato público", () => {
    expect(registrationRecoveryResponseSchema.safeParse({
      participants: [{ ...participant("BTB26-AAAABBBB", "BTB26-AAAABBBB-A"), qrPayload: "otro-token" }]
    }).success).toBe(false);
  });
});
