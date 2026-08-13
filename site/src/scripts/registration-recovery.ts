import { emailSchema, CONFIRMATION_STORAGE_KEY, EVENT_SLUG } from "../lib/registration";
import { registrationRecoveryResponseSchema, toRecoveryConfirmation } from "../lib/registration-recovery";
import { backendConfiguration, getSupabase, isBackendConfigured, withClientBase } from "../lib/supabase";

declare global {
  interface Window {
    turnstile?: { reset: () => void };
  }
}

type RecoveryTurnstileApi = {
  render: (selector: string, options: { sitekey: string; theme: "light" | "dark"; action: string }) => string;
  getResponse: (widgetId: string) => string;
  reset: (widgetId: string) => void;
};

const dialog = document.querySelector<HTMLDialogElement>("[data-recovery-dialog]");
const form = document.querySelector<HTMLFormElement>("[data-recovery-form]");
const alert = document.querySelector<HTMLElement>("[data-recovery-alert]");
const submit = document.querySelector<HTMLButtonElement>("[data-recovery-submit]");
const emailInput = form?.querySelector<HTMLInputElement>('input[name="email"]');
const turnstileContainer = document.querySelector<HTMLElement>("[data-recovery-turnstile]");
let recoveryWidgetId: string | undefined;
let turnstileRenderTimer: number | undefined;
const getRecoveryTurnstile = () => window.turnstile as unknown as RecoveryTurnstileApi | undefined;

const setAlert = (message = "") => {
  if (!alert) return;
  alert.textContent = message;
  alert.hidden = !message;
};

const renderRecoveryTurnstile = () => {
  const sitekey = turnstileContainer?.dataset.sitekey;
  const turnstile = getRecoveryTurnstile();
  if (recoveryWidgetId || !sitekey || !turnstile) return Boolean(recoveryWidgetId);
  recoveryWidgetId = turnstile.render("#registration-recovery-turnstile", {
    sitekey,
    theme: "light",
    action: "registration_recovery"
  });
  return true;
};

const ensureRecoveryTurnstile = () => {
  if (renderRecoveryTurnstile() || turnstileRenderTimer) return;
  let attempts = 0;
  turnstileRenderTimer = window.setInterval(() => {
    attempts += 1;
    if (renderRecoveryTurnstile() || attempts >= 20) {
      window.clearInterval(turnstileRenderTimer);
      turnstileRenderTimer = undefined;
    }
  }, 250);
};

const resetRecoveryTurnstile = () => {
  if (recoveryWidgetId) getRecoveryTurnstile()?.reset(recoveryWidgetId);
};

const openDialog = () => {
  if (!dialog) return;
  dialog.showModal();
  document.body.classList.add("has-registration-recovery-dialog");
  ensureRecoveryTurnstile();
  window.setTimeout(() => emailInput?.focus(), 0);
};

const closeDialog = () => {
  dialog?.close();
  document.body.classList.remove("has-registration-recovery-dialog");
};

document.querySelectorAll<HTMLButtonElement>("[data-recovery-open]").forEach((button) => {
  button.addEventListener("click", openDialog);
});
document.querySelectorAll<HTMLButtonElement>("[data-recovery-close]").forEach((button) => {
  button.addEventListener("click", closeDialog);
});
dialog?.addEventListener("close", () => document.body.classList.remove("has-registration-recovery-dialog"));
dialog?.addEventListener("click", (event) => {
  if (event.target === dialog) closeDialog();
});

emailInput?.addEventListener("input", () => {
  emailInput.setCustomValidity("");
  setAlert();
});
emailInput?.addEventListener("focusout", () => {
  emailInput.value = emailInput.value.trim().toLowerCase();
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!emailInput || !submit) return;

  const parsedEmail = emailSchema.safeParse(emailInput.value);
  if (!parsedEmail.success) {
    const message = parsedEmail.error.issues[0]?.message ?? "Ingresa un correo válido.";
    emailInput.setCustomValidity(message);
    emailInput.reportValidity();
    return;
  }
  if (!isBackendConfigured()) {
    setAlert("La recuperación todavía no está conectada al sistema de inscripciones.");
    return;
  }
  if (!backendConfiguration.turnstileSiteKey && !backendConfiguration.testMode) {
    setAlert("La verificación humana todavía no está disponible.");
    return;
  }

  const turnstileToken = recoveryWidgetId
    ? (getRecoveryTurnstile()?.getResponse(recoveryWidgetId) ?? "")
    : (backendConfiguration.testMode ? "test-ok" : "");
  if (!turnstileToken) {
    setAlert("Completa la verificación humana antes de continuar.");
    return;
  }

  submit.disabled = true;
  submit.textContent = "Buscando…";
  setAlert();
  try {
    const client = getSupabase();
    const { data: response, error } = await client.functions.invoke("recover-registration", {
      body: { eventSlug: EVENT_SLUG, email: parsedEmail.data, turnstileToken }
    });
    if (error || !response) {
      let code = "RECOVERY_FAILED";
      const context = (error as { context?: Response } | null)?.context;
      if (context) {
        try {
          const body = (await context.clone().json()) as { error?: string };
          code = body.error ?? code;
        } catch { /* response without JSON */ }
      }
      const messages: Record<string, string> = {
        TURNSTILE_FAILED: "La verificación humana expiró. Complétala nuevamente.",
        TOO_MANY_REQUESTS: "Se hicieron demasiados intentos. Espera 15 minutos antes de volver a probar.",
        INVALID_RECOVERY: "Revisa el correo ingresado e inténtalo nuevamente.",
        INTERNAL_ERROR: "No pudimos consultar las inscripciones en este momento. Inténtalo más tarde."
      };
      throw new Error(messages[code] ?? "No pudimos recuperar la inscripción. Revisa tu conexión e inténtalo nuevamente.");
    }

    const parsedResponse = registrationRecoveryResponseSchema.safeParse(response);
    if (!parsedResponse.success) throw new Error("El sistema devolvió una respuesta inválida. Inténtalo más tarde.");
    if (!parsedResponse.data.participants.length) {
      setAlert("No encontramos una inscripción activa con ese correo. Verifica que sea exactamente el que usaste al registrarte.");
      resetRecoveryTurnstile();
      return;
    }

    sessionStorage.setItem(CONFIRMATION_STORAGE_KEY, JSON.stringify(toRecoveryConfirmation(parsedResponse.data)));
    window.location.assign(withClientBase("/confirmacion/"));
  } catch (error) {
    setAlert(error instanceof Error ? error.message : "No pudimos recuperar la inscripción.");
    resetRecoveryTurnstile();
  } finally {
    submit.disabled = false;
    submit.textContent = "Buscar mi inscripción";
  }
});

if (window.location.hash === "#recuperar-qr") openDialog();
