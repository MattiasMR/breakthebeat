import {
  CONFIRMATION_STORAGE_KEY,
  DRAFT_STORAGE_KEY,
  EVENT_SLUG,
  categoryLabels,
  participantSchema,
  registrationPayloadSchema,
  type Category,
  type ParticipantInput,
  type RegistrationConfirmation,
  type RegistrationPayload
} from "../lib/registration";
import { backendConfiguration, getSupabase, isBackendConfigured, withClientBase } from "../lib/supabase";

declare global {
  interface Window {
    turnstile?: { reset: () => void };
  }
}

const form = document.querySelector<HTMLFormElement>("#registration-form");
const formFields = document.querySelector<HTMLFieldSetElement>("#registration-fields");
const systemBanner = document.querySelector<HTMLElement>("[data-registration-status]");

if (!form || !formFields || !systemBanner) throw new Error("Registration form markup is incomplete");

const steps = Array.from(form.querySelectorAll<HTMLElement>("[data-form-step]"));
const progressItems = Array.from(document.querySelectorAll<HTMLElement>("[data-progress-step]"));
const submitAlert = form.querySelector<HTMLElement>("[data-submit-alert]");
const medicalAlert = form.querySelector<HTMLElement>("[data-medical-alert]");
const review = form.querySelector<HTMLElement>("[data-review]");
const legalDocuments = form.querySelector<HTMLElement>("[data-legal-documents]");
const categoryError = form.querySelector<HTMLElement>("[data-category-error]");
let currentStepName = "categories";
let registrationEnabled = false;

const isDuo = () => Boolean(form.querySelector<HTMLInputElement>('input[name="captain.categories"][value="2v2"]')?.checked);

const activeStepNames = () => isDuo()
  ? ["categories", "captain", "partner", "health", "emergency", "review", "consents"]
  : ["categories", "captain", "health", "emergency", "review", "consents"];

const setBanner = (message: string, state: "loading" | "ready" | "closed" | "error") => {
  systemBanner.textContent = message;
  systemBanner.className = `system-banner is-${state}`;
};

const setSubmitAlert = (message = "") => {
  if (!submitAlert) return;
  submitAlert.textContent = message;
  submitAlert.hidden = !message;
};

const setMedicalAlert = (message = "") => {
  if (!medicalAlert) return;
  medicalAlert.textContent = message;
  medicalAlert.hidden = !message;
};

const updateProgress = (name = currentStepName) => {
  const activeNames = activeStepNames();
  const activeIndex = activeNames.indexOf(name);

  progressItems.forEach((item) => {
    const stepName = item.dataset.progressStep ?? "";
    const index = activeNames.indexOf(stepName);
    item.hidden = index === -1;
    item.classList.toggle("is-active", index === activeIndex);
    item.classList.toggle("is-complete", index !== -1 && index < activeIndex);
    const number = item.querySelector<HTMLElement>(":scope > span");
    if (number && index !== -1) number.textContent = String(index + 1);
  });

  steps.forEach((step) => {
    const index = activeNames.indexOf(step.dataset.formStep ?? "");
    const kicker = step.querySelector<HTMLElement>("[data-step-kicker]");
    if (kicker && index !== -1) kicker.textContent = `Paso ${index + 1} de ${activeNames.length}`;
  });
};

const showStep = (name: string) => {
  currentStepName = name;

  steps.forEach((step) => {
    const stepName = step.dataset.formStep ?? "";
    const active = stepName === name;
    step.hidden = !active;
    step.classList.toggle("is-active", active);
  });
  updateProgress(name);

  const heading = steps.find((step) => step.dataset.formStep === name)?.querySelector<HTMLElement>("h2");
  if (heading) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
  const dialogScroller = form.closest<HTMLDialogElement>("dialog")?.querySelector<HTMLElement>(".home-registration-dialog-scroll");
  if (dialogScroller) {
    dialogScroller.scrollTo({ top: 0, behavior: "smooth" });
  } else {
    window.scrollTo({ top: Math.max(0, form.getBoundingClientRect().top + window.scrollY - 120), behavior: "smooth" });
  }
};

const setPartnerEnabled = (enabled: boolean) => {
  form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[name^="partner."]').forEach((control) => {
    if (control.matches('input[type="checkbox"][data-forced-category]')) {
      control.disabled = true;
      return;
    }
    control.disabled = !enabled;
  });
  form.querySelectorAll<HTMLElement>("[data-partner-medical]").forEach((partnerMedical) => {
    partnerMedical.hidden = !enabled;
  });
  const authority = form.querySelector<HTMLElement>("[data-captain-authority]");
  if (authority) authority.hidden = !enabled;
  const authorityInput = authority?.querySelector<HTMLInputElement>("input");
  if (authorityInput) {
    authorityInput.disabled = !enabled;
    authorityInput.required = enabled;
    if (!enabled) authorityInput.checked = false;
  }
};

const syncDuo = () => {
  setPartnerEnabled(isDuo());
  if (!isDuo() && currentStepName === "partner") {
    showStep("health");
    return;
  }
  updateProgress();
};

const syncConditionalFields = () => {
  const groups = new Set(Array.from(form.querySelectorAll<HTMLInputElement>("[data-detail-toggle]")).map((input) => input.dataset.detailToggle));
  groups.forEach((group) => {
    if (!group) return;
    const checked = form.querySelector<HTMLInputElement>(`[data-detail-toggle="${group}"]:checked`);
    const visible = checked?.value === "true";
    const container = form.querySelector<HTMLElement>(`[data-detail="${group}"]`);
    if (!container) return;
    container.hidden = !visible;
    const fields = Array.from(container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select"));
    fields.forEach((field) => {
      field.disabled = !visible || (field.name.startsWith("partner.") && !isDuo());
      if (!visible) field.setCustomValidity("");
    });

    const condition = fields.find((field) => field.name.endsWith("conditionDetail"));
    const medication = fields.find((field) => field.name.endsWith("medicationDetail") && !field.name.endsWith("AllergyDetail"));
    if (condition) condition.required = visible;
    if (medication) medication.required = visible;

    if (group.endsWith("-allergy") && visible) {
      const medicationAllergy = fields.find((field) => field.name.endsWith("medicationAllergyDetail"));
      const foodAllergy = fields.find((field) => field.name.endsWith("foodAllergyDetail"));
      if (medicationAllergy && foodAllergy) {
        medicationAllergy.required = !medicationAllergy.value.trim() && !foodAllergy.value.trim();
      }
    }
  });
};

const getString = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const getBoolean = (data: FormData, key: string) => getString(data, key) === "true";

const collectParticipant = (prefix: "captain" | "partner", data: FormData): ParticipantInput => ({
  role: prefix,
  displayName: getString(data, `${prefix}.displayName`),
  socialUrl: getString(data, `${prefix}.socialUrl`),
  shirtSize: getString(data, `${prefix}.shirtSize`) as "S" | "M" | "L",
  age: Number(getString(data, `${prefix}.age`)),
  country: getString(data, `${prefix}.country`),
  city: getString(data, `${prefix}.city`),
  phone: getString(data, `${prefix}.phone`),
  email: getString(data, `${prefix}.email`).toLowerCase(),
  categories: data.getAll(`${prefix}.categories`).map(String) as Category[],
  medical: {
    hasCondition: getBoolean(data, `${prefix}.medical.hasCondition`),
    conditionDetail: getString(data, `${prefix}.medical.conditionDetail`),
    hasAllergies: getBoolean(data, `${prefix}.medical.hasAllergies`),
    medicationAllergyDetail: getString(data, `${prefix}.medical.medicationAllergyDetail`),
    foodAllergyDetail: getString(data, `${prefix}.medical.foodAllergyDetail`),
    takesMedication: getBoolean(data, `${prefix}.medical.takesMedication`),
    medicationDetail: getString(data, `${prefix}.medical.medicationDetail`),
    emergencyRelationship: getString(data, `${prefix}.medical.emergencyRelationship`),
    emergencyName: getString(data, `${prefix}.medical.emergencyName`),
    emergencyPhone: getString(data, `${prefix}.medical.emergencyPhone`)
  }
});

const collectPayload = (turnstileToken: string): RegistrationPayload => {
  const data = new FormData(form);
  const participants = [collectParticipant("captain", data)];
  if (isDuo()) participants.push(collectParticipant("partner", data));
  return {
    eventSlug: EVENT_SLUG,
    participants,
    consents: {
      terms: data.has("consent.terms") as true,
      privacy: data.has("consent.privacy") as true,
      health: data.has("consent.health") as true,
      image: data.has("consent.image") as true,
      captainAuthority: data.has("consent.captainAuthority")
    },
    turnstileToken
  };
};

const validateVisibleControls = (step: HTMLElement) => {
  syncConditionalFields();
  const invalid = Array.from(step.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea"))
    .find((control) => !control.disabled && !control.checkValidity());
  if (invalid) {
    invalid.reportValidity();
    invalid.focus();
    return false;
  }
  return true;
};

const validateCurrentStep = () => {
  const step = steps.find((item) => item.dataset.formStep === currentStepName);
  if (!step) return false;
  if (currentStepName === "categories") {
    const selected = form.querySelectorAll('input[name="captain.categories"]:checked').length > 0;
    if (categoryError) categoryError.hidden = selected;
    if (!selected) return false;
  }
  if (!validateVisibleControls(step)) return false;

  if (currentStepName === "emergency") {
    const data = new FormData(form);
    const participants = [collectParticipant("captain", data)];
    if (isDuo()) participants.push(collectParticipant("partner", data));
    const invalidResult = participants
      .map((participant) => participantSchema.safeParse(participant))
      .find((result) => !result.success);
    if (invalidResult && !invalidResult.success) {
      setMedicalAlert(invalidResult.error.issues[0]?.message ?? "Revisa los datos obligatorios.");
      return false;
    }
  }
  setMedicalAlert();
  setSubmitAlert();
  return true;
};

const renderReview = () => {
  if (!review) return;
  const data = new FormData(form);
  const participants = [collectParticipant("captain", data)];
  if (isDuo()) participants.push(collectParticipant("partner", data));
  review.replaceChildren(...participants.map((participant) => {
    const card = document.createElement("article");
    card.className = "review-card";
    const alert = participant.medical.hasCondition || participant.medical.hasAllergies || participant.medical.takesMedication;
    const title = document.createElement("h3");
    title.textContent = participant.displayName;
    const role = document.createElement("span");
    role.className = "review-role";
    role.textContent = participant.role === "captain" ? "Participante principal" : "Compañero";
    const list = document.createElement("dl");
    const items: Array<[string, string]> = [
      ["Categorías", participant.categories.map((category) => categoryLabels[category]).join(", ")],
      ["Contacto", `${participant.email} · ${participant.phone}`],
      ["Origen", `${participant.city}, ${participant.country}`],
      ["Talla", participant.shirtSize],
      ["Emergencia", `${participant.medical.emergencyName} · ${participant.medical.emergencyPhone}`],
      ["Alerta médica", alert ? "Sí · revisar en panel privado" : "No declarada"]
    ];
    items.forEach(([term, value]) => {
      const dt = document.createElement("dt");
      dt.textContent = term;
      const dd = document.createElement("dd");
      dd.textContent = value;
      list.append(dt, dd);
    });
    card.append(role, title, list);
    return card;
  }));
};

const saveDraft = () => {
  if (!registrationEnabled) return;
  const entries: Array<[string, string]> = [];
  form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("[name]").forEach((control) => {
    if (control.name === "cf-turnstile-response" || control.name.startsWith("consent.")) return;
    if ((control instanceof HTMLInputElement) && (control.type === "checkbox" || control.type === "radio")) {
      if (control.checked) entries.push([control.name, control.value]);
    } else if (control.value) {
      entries.push([control.name, control.value]);
    }
  });
  sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(entries));
};

const restoreDraft = () => {
  const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
  if (!raw) return;
  try {
    const entries = JSON.parse(raw) as Array<[string, string]>;
    const grouped = new Map<string, string[]>();
    entries.forEach(([name, value]) => grouped.set(name, [...(grouped.get(name) ?? []), value]));
    form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("[name]").forEach((control) => {
      const values = grouped.get(control.name) ?? [];
      if (control instanceof HTMLInputElement && (control.type === "checkbox" || control.type === "radio")) {
        if (!control.dataset.forcedCategory) control.checked = values.includes(control.value);
      } else if (values.length) {
        control.value = values.at(-1) ?? "";
      }
    });
  } catch {
    sessionStorage.removeItem(DRAFT_STORAGE_KEY);
  }
};

const renderLegalDocuments = (documents: Array<{ kind: string; title: string; version: string; public_url: string | null }>) => {
  if (!legalDocuments) return;
  legalDocuments.replaceChildren(...documents.map((document) => {
    const item = document.public_url ? window.document.createElement("a") : window.document.createElement("div");
    item.className = "legal-document";
    if (item instanceof HTMLAnchorElement && document.public_url) {
      item.href = document.public_url;
      item.target = "_blank";
      item.rel = "noreferrer";
    }
    const copy = window.document.createElement("span");
    const title = window.document.createElement("strong");
    title.textContent = document.title;
    const version = window.document.createElement("small");
    version.textContent = `Versión ${document.version}`;
    copy.append(title, version);
    item.append(copy);
    return item;
  }));
};

const loadRegistrationState = async () => {
  if (!isBackendConfigured()) {
    setBanner("Configuración pendiente: falta conectar el proyecto de Supabase.", "error");
    return;
  }
  if (!backendConfiguration.turnstileSiteKey && !backendConfiguration.testMode) {
    setBanner("Configuración pendiente: falta activar Cloudflare Turnstile.", "error");
    return;
  }

  try {
    const client = getSupabase();
    const [{ data: event, error }, { data: documents }] = await Promise.all([
      client.from("events").select("registration_open").eq("slug", EVENT_SLUG).maybeSingle(),
      client.from("legal_documents").select("kind, title, version, public_url").order("kind")
    ]);
    if (error || !event) {
      setBanner("No pudimos comprobar el estado de las inscripciones. Intenta más tarde.", "error");
      return;
    }
    if (!event.registration_open) {
      setBanner("Las inscripciones están cerradas en este momento.", "closed");
      return;
    }

    renderLegalDocuments(documents ?? []);
    registrationEnabled = true;
    formFields.disabled = false;
    restoreDraft();
    syncDuo();
    syncConditionalFields();
    setBanner("Inscripciones abiertas · Domingo 27 Sept, 2026 · 10 AM", "ready");
  } catch {
    setBanner("No pudimos conectar con el sistema de inscripciones.", "error");
  }
};

form.addEventListener("change", (event) => {
  const target = event.target as HTMLInputElement;
  if (target.name === "captain.categories") syncDuo();
  syncConditionalFields();
  setMedicalAlert();
  saveDraft();
});
form.addEventListener("input", () => {
  syncConditionalFields();
  setMedicalAlert();
  saveDraft();
});

form.querySelectorAll<HTMLButtonElement>("[data-next]").forEach((button) => button.addEventListener("click", () => {
  if (!validateCurrentStep()) return;
  if (currentStepName === "emergency") renderReview();
  const names = activeStepNames();
  const next = names[names.indexOf(currentStepName) + 1];
  if (next) showStep(next);
}));

form.querySelectorAll<HTMLButtonElement>("[data-back]").forEach((button) => button.addEventListener("click", () => {
  const names = activeStepNames();
  const previous = names[names.indexOf(currentStepName) - 1];
  if (previous) showStep(previous);
}));

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!registrationEnabled || !validateCurrentStep()) return;
  const submitButton = form.querySelector<HTMLButtonElement>("[data-submit]");
  const token = getString(new FormData(form), "cf-turnstile-response") || (backendConfiguration.testMode ? "test-ok" : "");
  const parsed = registrationPayloadSchema.safeParse(collectPayload(token));
  if (!parsed.success) {
    setSubmitAlert(parsed.error.issues[0]?.message ?? "Revisa los campos obligatorios.");
    return;
  }

  submitButton?.setAttribute("disabled", "true");
  if (submitButton) submitButton.textContent = "Guardando inscripción…";
  setSubmitAlert();

  try {
    const client = getSupabase();
    const { data, error } = await client.functions.invoke<RegistrationConfirmation>("submit-registration", { body: parsed.data });
    if (error || !data) {
      let code = "REGISTRATION_FAILED";
      const context = (error as { context?: Response } | null)?.context;
      if (context) {
        try { code = ((await context.clone().json()) as { error?: string }).error ?? code; } catch { /* response without JSON */ }
      }
      const messages: Record<string, string> = {
        DUPLICATE_PARTICIPANT: "Uno de los correos ya está inscrito. Contacta al equipo para corregir o unir el registro.",
        REGISTRATION_CLOSED: "Las inscripciones se cerraron antes de completar el envío.",
        LEGAL_DOCUMENTS_NOT_READY: "Los documentos legales aún no están listos para recibir inscripciones.",
        TURNSTILE_FAILED: "La verificación humana expiró. Inténtalo nuevamente.",
        INVALID_REGISTRATION: "Hay un dato con formato inválido. Vuelve a la revisión y comprueba tus perfiles.",
        INTERNAL_ERROR: "El servidor no pudo completar la inscripción. Tus datos siguen en el formulario; inténtalo nuevamente."
      };
      throw new Error(messages[code] ?? "No pudimos guardar la inscripción. Revisa tu conexión e intenta nuevamente.");
    }

    sessionStorage.setItem(CONFIRMATION_STORAGE_KEY, JSON.stringify(data));
    sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    window.location.assign(withClientBase("/confirmacion/"));
  } catch (error) {
    setSubmitAlert(error instanceof Error ? error.message : "No pudimos guardar la inscripción.");
    window.turnstile?.reset();
  } finally {
    submitButton?.removeAttribute("disabled");
    if (submitButton) submitButton.textContent = "Confirmar inscripción";
  }
});

void loadRegistrationState();
