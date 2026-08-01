import {
  CONFIRMATION_STORAGE_KEY,
  DRAFT_STORAGE_KEY,
  emailSchema,
  EVENT_SLUG,
  participantSchema,
  phoneSchema,
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
const progressItems = Array.from(document.querySelectorAll<HTMLElement>("[data-progress-phase]"));
const progressCopy = document.querySelector<HTMLElement>("[data-progress-copy]");
const submitAlert = form.querySelector<HTMLElement>("[data-submit-alert]");
const medicalAlert = form.querySelector<HTMLElement>("[data-medical-alert]");
const legalDocuments = form.querySelector<HTMLElement>("[data-legal-documents]");
const legalAcceptance = form.querySelector<HTMLElement>("[data-legal-acceptance]");
const categoryError = form.querySelector<HTMLElement>("[data-category-error]");
let currentStepName = "categories";
let registrationEnabled = false;

const isDuo = () => Boolean(form.querySelector<HTMLInputElement>('input[name="captain.categories"][value="2v2"]')?.checked);

const activeStepNames = () => isDuo()
  ? ["categories", "partner", "emergency", "consents"]
  : ["categories", "emergency", "consents"];

const visualPhaseByStep: Record<string, number> = {
  categories: 1,
  partner: 1,
  emergency: 2,
  consents: 3
};

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

const instantSchemaFor = (input: HTMLInputElement) => {
  if (input.name.endsWith(".email")) return emailSchema;
  if (input.name.endsWith(".phone") || input.name.endsWith(".emergencyPhone")) return phoneSchema;
  return null;
};

const clearInstantValidation = (input: HTMLInputElement) => {
  input.setCustomValidity("");
  input.classList.remove("is-invalid");
  input.removeAttribute("aria-invalid");
  const error = input.closest(".field")?.querySelector<HTMLElement>("[data-field-validation-error]");
  if (error) error.hidden = true;
};

const validateInstantField = (input: HTMLInputElement, showError: boolean) => {
  const schema = instantSchemaFor(input);
  if (!schema || input.disabled) return true;

  input.setCustomValidity("");
  const result = schema.safeParse(input.value);
  const message = result.success ? "" : (result.error.issues[0]?.message ?? "Revisa este dato.");
  input.setCustomValidity(message);

  const visible = Boolean(message) && showError;
  input.classList.toggle("is-invalid", visible);
  if (visible) input.setAttribute("aria-invalid", "true");
  else input.removeAttribute("aria-invalid");

  const error = input.closest(".field")?.querySelector<HTMLElement>("[data-field-validation-error]");
  if (error) {
    error.textContent = message;
    error.hidden = !visible;
  }
  return !message;
};

const updateProgress = (name = currentStepName) => {
  const activeNames = activeStepNames();
  const activePhase = visualPhaseByStep[name] ?? 1;

  progressItems.forEach((item) => {
    const phase = Number(item.dataset.progressPhase);
    item.classList.toggle("is-active", phase === activePhase);
    item.classList.toggle("is-complete", phase < activePhase);
  });
  if (progressCopy) progressCopy.textContent = `Paso ${activePhase} de 3`;

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
    if (control.matches("[data-forced-category]")) {
      control.disabled = !enabled;
      return;
    }
    control.disabled = !enabled;
    if (!enabled && control instanceof HTMLInputElement) clearInstantValidation(control);
  });
  form.querySelectorAll<HTMLElement>("[data-partner-medical]").forEach((partnerMedical) => {
    partnerMedical.hidden = !enabled;
  });
};

const syncDuo = () => {
  setPartnerEnabled(isDuo());
  if (!isDuo() && currentStepName === "partner") {
    showStep("categories");
    return;
  }
  updateProgress();
};

const getString = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const collectParticipant = (prefix: "captain" | "partner", data: FormData): ParticipantInput => {
  const legalName = getString(data, `${prefix}.legalName`);
  const artisticName = getString(data, `${prefix}.artisticName`);
  return {
    role: prefix,
    displayName: `${legalName} · ${artisticName}`,
    socialUrl: "",
    age: Number(getString(data, `${prefix}.age`)),
    country: "",
    city: "",
    phone: getString(data, `${prefix}.phone`),
    email: getString(data, `${prefix}.email`).toLowerCase(),
    categories: data.getAll(`${prefix}.categories`).map(String) as Category[],
    medical: {
      hasCondition: false,
      conditionDetail: "",
      hasAllergies: false,
      medicationAllergyDetail: "",
      foodAllergyDetail: "",
      takesMedication: false,
      medicationDetail: "",
      emergencyRelationship: getString(data, `${prefix}.medical.emergencyRelationship`),
      emergencyName: getString(data, `${prefix}.medical.emergencyName`),
      emergencyPhone: getString(data, `${prefix}.medical.emergencyPhone`)
    }
  };
};

const collectPayload = (turnstileToken: string): RegistrationPayload => {
  const data = new FormData(form);
  const accepted = data.has("consent.responsibility");
  const participants = [collectParticipant("captain", data)];
  if (isDuo()) participants.push(collectParticipant("partner", data));
  return {
    eventSlug: EVENT_SLUG,
    participants,
    consents: {
      terms: accepted as true,
      privacy: accepted as true,
      health: accepted as true,
      image: accepted as true,
      captainAuthority: isDuo() && accepted
    },
    turnstileToken
  };
};

const validateVisibleControls = (step: HTMLElement) => {
  const controls = Array.from(step.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea"));
  controls.forEach((control) => {
    if (control instanceof HTMLInputElement) validateInstantField(control, true);
  });
  const invalid = controls
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
  const visibleDocuments = documents.filter((document) => document.kind !== "health");
  legalDocuments.replaceChildren(...visibleDocuments.map((document) => {
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
    copy.append(title);
    item.append(copy);
    return item;
  }));

  if (!legalAcceptance) return;
  legalAcceptance.replaceChildren(window.document.createTextNode("Al dar en Finalizar inscripción aceptas "));
  const references = [
    { kind: "terms", prefix: "los ", fallback: "Términos y reglas del evento" },
    { kind: "privacy", prefix: "el ", fallback: "Aviso de privacidad" },
    { kind: "captain_authority", prefix: "la ", fallback: "Declaración de autorización del compañero" },
    { kind: "image", prefix: "la ", fallback: "Autorización de imagen y voz" }
  ];
  references.forEach((reference, index) => {
    const document = visibleDocuments.find((item) => item.kind === reference.kind);
    legalAcceptance.append(window.document.createTextNode(reference.prefix));
    const label = document?.title ?? reference.fallback;
    if (document?.public_url) {
      const link = window.document.createElement("a");
      link.href = document.public_url;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = label;
      legalAcceptance.append(link);
    } else {
      legalAcceptance.append(window.document.createTextNode(label));
    }
    legalAcceptance.append(window.document.createTextNode(index === references.length - 1 ? "." : index === references.length - 2 ? " y " : ", "));
  });
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
    setBanner("Inscripciones abiertas · Domingo 27 Sept, 2026 · 10 AM", "ready");
  } catch {
    setBanner("No pudimos conectar con el sistema de inscripciones.", "error");
  }
};

form.addEventListener("change", (event) => {
  const target = event.target as HTMLInputElement;
  if (target.name === "captain.categories") syncDuo();
  setMedicalAlert();
  saveDraft();
});
form.addEventListener("input", (event) => {
  const target = event.target;
  if (target instanceof HTMLInputElement && instantSchemaFor(target)) {
    validateInstantField(target, Boolean(target.value.trim()) || target.dataset.validationTouched === "true");
  }
  setMedicalAlert();
  saveDraft();
});

form.addEventListener("focusout", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || !instantSchemaFor(target)) return;
  target.value = target.value.trim();
  if (target.name.endsWith(".email")) target.value = target.value.toLowerCase();
  target.dataset.validationTouched = "true";
  validateInstantField(target, true);
});

form.querySelectorAll<HTMLButtonElement>("[data-next]").forEach((button) => button.addEventListener("click", () => {
  if (!validateCurrentStep()) return;
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
        DUPLICATE_PARTICIPANT: "El correo ingresado ya se encuentra registrado.",
        REGISTRATION_CLOSED: "Las inscripciones se cerraron antes de completar el envío.",
        LEGAL_DOCUMENTS_NOT_READY: "Los documentos legales aún no están listos para recibir inscripciones.",
        TURNSTILE_FAILED: "La verificación humana expiró. Inténtalo nuevamente.",
        INVALID_REGISTRATION: "Hay un dato con formato inválido. Vuelve y comprueba los datos ingresados.",
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
    if (submitButton) submitButton.textContent = "Finalizar inscripción";
  }
});

void loadRegistrationState();
