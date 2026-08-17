import { guestAttendanceSchema } from "../lib/guest-attendance";
import { EVENT_SLUG } from "../lib/registration";
import { backendConfiguration, getSupabase, isBackendConfigured } from "../lib/supabase";

declare global {
  interface Window { turnstile?: { reset: () => void } }
}

const form = document.querySelector<HTMLFormElement>("[data-attendance-form]");
const alert = document.querySelector<HTMLElement>("[data-attendance-alert]");
const submit = document.querySelector<HTMLButtonElement>("[data-attendance-submit]");
const success = document.querySelector<HTMLElement>("[data-attendance-success]");

if (!form || !alert || !submit || !success) throw new Error("Attendance markup is incomplete");

const setAlert = (message = "") => {
  alert.textContent = message;
  alert.hidden = !message;
};

const errorCode = async (error: unknown) => {
  const context = (error as { context?: Response } | null)?.context;
  if (!context) return "UNKNOWN";
  try { return ((await context.clone().json()) as { error?: string }).error ?? "UNKNOWN"; } catch { return "UNKNOWN"; }
};

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const raw = Object.fromEntries(new FormData(form).entries());
  const parsed = guestAttendanceSchema.safeParse(raw);
  if (!parsed.success) {
    setAlert(parsed.error.issues[0]?.message ?? "Revisa tus datos antes de continuar.");
    return;
  }
  if (!isBackendConfigured()) return setAlert("La confirmación todavía no está conectada. Inténtalo nuevamente más tarde.");
  if (!backendConfiguration.turnstileSiteKey && !backendConfiguration.testMode) {
    return setAlert("La verificación humana todavía no está disponible.");
  }

  const turnstileToken = String(raw["cf-turnstile-response"] ?? "") || (backendConfiguration.testMode ? "test-ok" : "");
  if (!turnstileToken) return setAlert("Completa la verificación humana antes de confirmar.");

  submit.disabled = true;
  submit.textContent = "Confirmando…";
  setAlert();
  try {
    const { data, error } = await getSupabase().functions.invoke("confirm-guest-attendance", {
      body: { eventSlug: EVENT_SLUG, ...parsed.data, turnstileToken }
    });
    if (error || !data) {
      const code = await errorCode(error);
      const messages: Record<string, string> = {
        TURNSTILE_FAILED: "La verificación humana expiró. Complétala nuevamente.",
        EVENT_NOT_FOUND: "No encontramos el evento. Inténtalo nuevamente más tarde."
      };
      throw new Error(messages[code] ?? "No pudimos confirmar tu asistencia. Inténtalo nuevamente.");
    }
    const successCopy = success.querySelector<HTMLElement>("[data-attendance-success-copy]");
    if (successCopy) successCopy.textContent = `Gracias, ${parsed.data.firstName}. Te esperamos en la pista.`;
    form.hidden = true;
    success.hidden = false;
  } catch (error) {
    setAlert(error instanceof Error ? error.message : "No pudimos confirmar tu asistencia.");
    window.turnstile?.reset();
  } finally {
    submit.disabled = false;
    submit.textContent = "Confirmar asistencia";
  }
});
