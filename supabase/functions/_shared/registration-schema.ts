import { z } from "npm:zod@4";

const category = z.enum(["1v1", "2v2", "bgirls"]);
const phone = z.string().trim().min(8).max(24).regex(/^\+[1-9][0-9 ()-]{7,22}$/);
const socialHandlePattern = /^@[A-Za-z0-9._]{1,30}$/;
const socialProfile = z.string().trim().min(2).max(200).refine((value) => {
  if (socialHandlePattern.test(value)) return true;
  try {
    const hostname = new URL(value).hostname.replace(/^www\./, "").toLowerCase();
    return hostname === "instagram.com" || hostname.endsWith(".instagram.com") || hostname === "tiktok.com" || hostname.endsWith(".tiktok.com");
  } catch {
    return false;
  }
});

const medical = z.object({
  hasCondition: z.boolean(),
  conditionDetail: z.string().trim().max(1000),
  hasAllergies: z.boolean(),
  medicationAllergyDetail: z.string().trim().max(1000),
  foodAllergyDetail: z.string().trim().max(1000),
  takesMedication: z.boolean(),
  medicationDetail: z.string().trim().max(1000),
  emergencyRelationship: z.string().trim().min(2).max(80),
  emergencyName: z.string().trim().min(2).max(120),
  emergencyPhone: phone
}).superRefine((value, context) => {
  if (value.hasCondition && !value.conditionDetail) context.addIssue({ code: "custom", path: ["conditionDetail"], message: "required" });
  if (value.hasAllergies && !value.medicationAllergyDetail && !value.foodAllergyDetail) {
    context.addIssue({ code: "custom", path: ["medicationAllergyDetail"], message: "required" });
  }
  if (value.takesMedication && !value.medicationDetail) context.addIssue({ code: "custom", path: ["medicationDetail"], message: "required" });
});

const participant = z.object({
  role: z.enum(["captain", "partner"]),
  displayName: z.string().trim().min(2).max(120),
  socialUrl: socialProfile,
  age: z.number().int().min(18).max(100),
  country: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(100),
  phone,
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  categories: z.array(category).min(1).max(3),
  medical
});

export const registrationPayloadSchema = z.object({
  eventSlug: z.literal("break-the-beat-2026"),
  participants: z.array(participant).min(1).max(2),
  consents: z.object({
    terms: z.literal(true),
    privacy: z.literal(true),
    health: z.literal(true),
    image: z.literal(true),
    captainAuthority: z.boolean()
  }),
  turnstileToken: z.string().min(1).max(2048)
}).superRefine((value, context) => {
  const captain = value.participants.find((item) => item.role === "captain");
  const partner = value.participants.find((item) => item.role === "partner");
  const duo = captain?.categories.includes("2v2") ?? false;
  if (!captain || (duo && (!partner || !partner.categories.includes("2v2"))) || (!duo && partner)) {
    context.addIssue({ code: "custom", path: ["participants"], message: "invalid duo" });
  }
  if (duo && !value.consents.captainAuthority) {
    context.addIssue({ code: "custom", path: ["consents", "captainAuthority"], message: "required" });
  }
  if (new Set(value.participants.map((item) => item.email.toLowerCase())).size !== value.participants.length) {
    context.addIssue({ code: "custom", path: ["participants"], message: "duplicate email" });
  }
});

export type RegistrationPayload = z.infer<typeof registrationPayloadSchema>;
