import { describe, expect, it } from "vitest";
import { EVENT_SLUG, registrationPayloadSchema, type ParticipantInput } from "./registration";

const participant = (overrides: Partial<ParticipantInput> = {}): ParticipantInput => ({
  role: "captain",
  displayName: "Bboy Test",
  socialUrl: "https://instagram.com/bboytest",
  age: 22,
  country: "Ecuador",
  city: "Guayaquil",
  phone: "+593 99 123 4567",
  email: "test@example.com",
  categories: ["1v1"],
  medical: {
    hasCondition: false,
    conditionDetail: "",
    hasAllergies: false,
    medicationAllergyDetail: "",
    foodAllergyDetail: "",
    takesMedication: false,
    medicationDetail: "",
    emergencyRelationship: "Pareja",
    emergencyName: "Persona Emergencia",
    emergencyPhone: "+593 99 765 4321"
  },
  ...overrides
});

const payload = (participants: ParticipantInput[]) => ({
  eventSlug: EVENT_SLUG,
  participants,
  consents: { terms: true, privacy: true, health: true, image: true, captainAuthority: false },
  turnstileToken: "test-ok"
});

describe("registrationPayloadSchema", () => {
  it("acepta una inscripción individual válida", () => {
    expect(registrationPayloadSchema.safeParse(payload([participant()])).success).toBe(true);
  });

  it("rechaza participantes menores de edad", () => {
    expect(registrationPayloadSchema.safeParse(payload([participant({ age: 17 })])).success).toBe(false);
  });

  it("exige teléfono internacional y acepta cualquier texto como usuario social", () => {
    expect(registrationPayloadSchema.safeParse(payload([participant({ phone: "0991234567" })])).success).toBe(false);
    expect(registrationPayloadSchema.safeParse(payload([participant({ socialUrl: "@bboy.test" })])).success).toBe(true);
    expect(registrationPayloadSchema.safeParse(payload([participant({ socialUrl: "bboy test sin arroba" })])).success).toBe(true);
    expect(registrationPayloadSchema.safeParse(payload([participant({ socialUrl: "mi perfil está en TikTok" })])).success).toBe(true);
  });

  it("acepta selección múltiple sin duplicar al participante", () => {
    expect(registrationPayloadSchema.safeParse(payload([participant({ categories: ["1v1", "bgirls"] })])).success).toBe(true);
  });

  it("exige perfil y autorización para 2 vs 2", () => {
    expect(registrationPayloadSchema.safeParse(payload([participant({ categories: ["2v2"] })])).success).toBe(false);

    const duo = payload([
      participant({ categories: ["1v1", "2v2"] }),
      participant({ role: "partner", displayName: "Bgirl Partner", email: "partner@example.com", categories: ["2v2", "bgirls"] })
    ]);
    duo.consents.captainAuthority = true;
    expect(registrationPayloadSchema.safeParse(duo).success).toBe(true);
  });

  it("rechaza el mismo correo dentro de una dupla", () => {
    const duo = payload([
      participant({ categories: ["2v2"] }),
      participant({ role: "partner", categories: ["2v2"] })
    ]);
    duo.consents.captainAuthority = true;
    expect(registrationPayloadSchema.safeParse(duo).success).toBe(false);
  });

  it("exige detalles cuando se declara una alerta médica", () => {
    const medical = participant().medical;
    expect(registrationPayloadSchema.safeParse(payload([participant({ medical: { ...medical, hasCondition: true } })])).success).toBe(false);
    expect(registrationPayloadSchema.safeParse(payload([participant({ medical: { ...medical, hasCondition: true, conditionDetail: "Asma" } })])).success).toBe(true);
  });

  it("exige al menos un detalle cuando se declaran alergias", () => {
    const medical = participant().medical;
    expect(registrationPayloadSchema.safeParse(payload([participant({ medical: { ...medical, hasAllergies: true } })])).success).toBe(false);
    expect(registrationPayloadSchema.safeParse(payload([participant({ medical: { ...medical, hasAllergies: true, foodAllergyDetail: "Maní" } })])).success).toBe(true);
  });
});
