import { EVENT_SLUG } from "../lib/registration";
import { prepareParticipantPhoto } from "../lib/participant-photo";
import { backendConfiguration, getSupabase, isBackendConfigured } from "../lib/supabase";

declare global {
  interface Window {
    turnstile?: { reset: () => void };
  }
}

type PhotoTurnstile = { getResponse: () => string; reset: () => void };
const getPhotoTurnstile = () => window.turnstile as unknown as PhotoTurnstile | undefined;

const form = document.querySelector<HTMLFormElement>("[data-photo-update-form]");
const alert = document.querySelector<HTMLElement>("[data-photo-update-alert]");
const submit = document.querySelector<HTMLButtonElement>("[data-photo-update-submit]");
const success = document.querySelector<HTMLElement>("[data-photo-update-success]");

const setAlert = (message = "") => {
  if (!alert) return;
  alert.textContent = message;
  alert.hidden = !message;
};

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!submit || !success || !form.reportValidity()) return;
  if (!isBackendConfigured()) return setAlert("La carga de fotografías todavía no está conectada.");
  if (!backendConfiguration.turnstileSiteKey && !backendConfiguration.testMode) {
    return setAlert("La verificación humana todavía no está disponible.");
  }

  const data = new FormData(form);
  const identifier = String(data.get("identifier") ?? "").trim();
  const photoFile = data.get("photo");
  const turnstileToken = getPhotoTurnstile()?.getResponse() || (backendConfiguration.testMode ? "test-ok" : "");
  if (!(photoFile instanceof File) || !photoFile.size) return setAlert("Selecciona una fotografía.");
  if (!turnstileToken) return setAlert("Completa la verificación humana antes de continuar.");

  submit.disabled = true;
  submit.textContent = "Procesando fotografía…";
  setAlert();
  try {
    const photo = await prepareParticipantPhoto(photoFile);
    submit.textContent = "Guardando fotografía…";
    const { data: response, error } = await getSupabase().functions.invoke("update-participant-photo", {
      body: { eventSlug: EVENT_SLUG, identifier, photo, turnstileToken }
    });
    if (error || !response) {
      let code = "PHOTO_UPDATE_FAILED";
      const context = (error as { context?: Response } | null)?.context;
      if (context) {
        try { code = ((await context.clone().json()) as { error?: string }).error ?? code; } catch { /* non-JSON error */ }
      }
      const messages: Record<string, string> = {
        INVALID_IDENTIFIER: "Ingresa el correo exacto, tu código de participante o el contenido de tu QR.",
        PARTICIPANT_NOT_FOUND: "No encontramos una inscripción activa con ese dato.",
        PHOTO_ALREADY_EXISTS_USE_QR: "Ya existe una fotografía para ese correo. Para reemplazarla, identifica tu registro con el QR o código de participante.",
        INVALID_PHOTO: "La fotografía no tiene un formato válido.",
        INVALID_PHOTO_REQUEST: "Revisa los datos y la fotografía seleccionada.",
        TURNSTILE_FAILED: "La verificación humana expiró. Complétala nuevamente.",
        TOO_MANY_REQUESTS: "Se hicieron demasiados intentos. Espera 15 minutos antes de volver a probar.",
        INTERNAL_ERROR: "No pudimos guardar la fotografía en este momento. Inténtalo más tarde."
      };
      throw new Error(messages[code] ?? "No pudimos guardar la fotografía. Revisa tu conexión e inténtalo nuevamente.");
    }
    form.hidden = true;
    success.hidden = false;
  } catch (error) {
    setAlert(error instanceof Error ? error.message : "No pudimos guardar la fotografía.");
    getPhotoTurnstile()?.reset();
  } finally {
    submit.disabled = false;
    submit.textContent = "Guardar fotografía";
  }
});
