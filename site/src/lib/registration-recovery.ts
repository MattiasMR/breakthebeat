import { z } from "zod";
import { categorySchema, type RegistrationConfirmation } from "./registration";

export const registrationRecoveryResponseSchema = z.object({
  participants: z.array(z.object({
    registrationCode: z.string().min(1).max(40),
    displayName: z.string().min(2).max(120),
    participantCode: z.string().min(1).max(48),
    qrPayload: z.string().startsWith("BTB26:").max(64),
    categories: z.array(categorySchema).min(1).max(3)
  })).max(3)
});

export type RegistrationRecoveryResponse = z.infer<typeof registrationRecoveryResponseSchema>;

export const toRecoveryConfirmation = (recovery: RegistrationRecoveryResponse): RegistrationConfirmation => {
  const registrationCodes = [...new Set(recovery.participants.map((participant) => participant.registrationCode))];
  return {
    source: "recovery",
    registrationCount: registrationCodes.length,
    registrationCode: registrationCodes.length === 1
      ? registrationCodes[0]
      : `${registrationCodes.length} inscripciones`,
    participants: recovery.participants
  };
};
