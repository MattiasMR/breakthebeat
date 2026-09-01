import { z } from "zod";

export const EVENT_SLUG = "break-the-beat-2026";
export const DRAFT_STORAGE_KEY = "btb-registration-draft-v2";
export const CONFIRMATION_STORAGE_KEY = "btb-registration-confirmation-v1";

export const categorySchema = z.enum(["1v1", "2v2", "bgirls"]);
export type Category = z.infer<typeof categorySchema>;

export const categoryLabels: Record<Category, string> = {
  "1v1": "1 vs 1",
  "2v2": "2 vs 2",
  bgirls: "BGirls"
};

export const phoneSchema = z
  .string()
  .trim()
  .min(8, "Ingresa un teléfono válido")
  .max(24, "Ingresa un teléfono válido")
  .regex(/^[+0-9][0-9 ()-]{7,22}$/, "Ingresa un teléfono válido");

export const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email("Ingresa un correo válido"));

const socialUrlSchema = z
  .string()
  .trim()
  .max(200, "El usuario es demasiado largo");

export const participantPhotoSchema = z.object({
  mimeType: z.literal("image/jpeg"),
  base64: z.string().min(100, "Selecciona una fotografía válida").max(2_000_000, "La fotografía es demasiado pesada")
});

export const medicalSchema = z
  .object({
    hasCondition: z.boolean(),
    conditionDetail: z.string().trim().max(1000),
    hasAllergies: z.boolean(),
    medicationAllergyDetail: z.string().trim().max(1000),
    foodAllergyDetail: z.string().trim().max(1000),
    takesMedication: z.boolean(),
    medicationDetail: z.string().trim().max(1000),
    emergencyRelationship: z.string().trim().min(2, "Selecciona la relación del contacto"),
    emergencyName: z.string().trim().min(2, "Ingresa el nombre del contacto").max(120),
    emergencyPhone: phoneSchema
  })
  .superRefine((value, context) => {
    if (value.hasCondition && !value.conditionDetail) {
      context.addIssue({ code: "custom", path: ["conditionDetail"], message: "Describe la condición médica" });
    }
    if (value.hasAllergies && !value.medicationAllergyDetail && !value.foodAllergyDetail) {
      context.addIssue({ code: "custom", path: ["medicationAllergyDetail"], message: "Indica al menos una alergia" });
    }
    if (value.takesMedication && !value.medicationDetail) {
      context.addIssue({ code: "custom", path: ["medicationDetail"], message: "Indica la medicación permanente" });
    }
  });

export const participantSchema = z.object({
  role: z.enum(["captain", "partner"]),
  displayName: z.string().trim().min(2, "Ingresa el nombre completo o artístico").max(120),
  socialUrl: socialUrlSchema,
  age: z.number().int().min(18, "Solo pueden inscribirse mayores de edad").max(100, "Revisa la edad"),
  country: z.string().trim().max(80),
  city: z.string().trim().max(100),
  phone: phoneSchema,
  email: emailSchema,
  photo: participantPhotoSchema,
  categories: z.array(categorySchema)
    .min(1, "Selecciona al menos una categoría")
    .max(3, "Puedes seleccionar hasta tres categorías")
    .refine((categories) => new Set(categories).size === categories.length, "No repitas categorías"),
  medical: medicalSchema
});

export const registrationPayloadSchema = z
  .object({
    eventSlug: z.literal(EVENT_SLUG),
    participants: z.array(participantSchema).min(1).max(2),
    consents: z.object({
      terms: z.literal(true, { error: "Debes aceptar los términos" }),
      privacy: z.literal(true, { error: "Debes aceptar el aviso de privacidad" }),
      health: z.literal(true, { error: "Debes autorizar el tratamiento de datos de salud" }),
      image: z.literal(true, { error: "Debes aceptar el permiso de imagen y voz" }),
      captainAuthority: z.boolean()
    }),
    turnstileToken: z.string().min(1, "Completa la verificación humana")
  })
  .superRefine((value, context) => {
    const captain = value.participants.find((participant) => participant.role === "captain");
    const partners = value.participants.filter((participant) => participant.role === "partner");
    const isDuo = captain?.categories.includes("2v2") ?? false;

    if (!captain) {
      context.addIssue({ code: "custom", path: ["participants"], message: "Falta el participante principal" });
      return;
    }

    if (isDuo && (partners.length !== 1 || !partners[0].categories.includes("2v2"))) {
      context.addIssue({ code: "custom", path: ["participants"], message: "Una inscripción 2 vs 2 requiere dos perfiles completos" });
    }

    if (!isDuo && partners.length > 0) {
      context.addIssue({ code: "custom", path: ["participants"], message: "El compañero solo corresponde a la categoría 2 vs 2" });
    }

    if (isDuo && !value.consents.captainAuthority) {
      context.addIssue({ code: "custom", path: ["consents", "captainAuthority"], message: "Debes declarar que tienes autorización de tu compañero" });
    }

    const emails = value.participants.map((participant) => participant.email.toLowerCase());
    if (new Set(emails).size !== emails.length) {
      context.addIssue({ code: "custom", path: ["participants"], message: "Cada participante debe usar un correo diferente" });
    }
  });

export type ParticipantInput = z.infer<typeof participantSchema>;
export type ParticipantPhoto = z.infer<typeof participantPhotoSchema>;
export type RegistrationPayload = z.infer<typeof registrationPayloadSchema>;

export type RegistrationConfirmation = {
  source?: "registration" | "recovery";
  registrationCount?: number;
  registrationCode: string;
  participants: Array<{
    registrationCode?: string;
    displayName: string;
    participantCode: string;
    qrPayload: string;
    categories: Category[];
  }>;
};

export const emptyMedical = () => ({
  hasCondition: false,
  conditionDetail: "",
  hasAllergies: false,
  medicationAllergyDetail: "",
  foodAllergyDetail: "",
  takesMedication: false,
  medicationDetail: "",
  emergencyRelationship: "",
  emergencyName: "",
  emergencyPhone: ""
});
