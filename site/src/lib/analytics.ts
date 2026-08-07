export type RegistrationType = "individual" | "duo";

type AnalyticsParameter = string | number | boolean;
type AnalyticsParameters = Record<string, AnalyticsParameter>;

declare global {
  interface Window {
    btbAnalytics?: {
      consentGranted: () => boolean;
      openPreferences: () => void;
      track: (eventName: string, parameters?: AnalyticsParameters) => void;
    };
  }
}

const knownRegistrationErrors = new Set([
  "CLIENT_VALIDATION",
  "DUPLICATE_PARTICIPANT_CATEGORY",
  "DUPLICATE_PARTICIPANT",
  "CATEGORY_FULL",
  "REGISTRATION_CLOSED",
  "LEGAL_DOCUMENTS_NOT_READY",
  "TURNSTILE_FAILED",
  "INVALID_REGISTRATION",
  "INTERNAL_ERROR",
  "REGISTRATION_FAILED",
  "NETWORK_ERROR"
]);

export const normalizeRegistrationErrorCode = (code: string) =>
  knownRegistrationErrors.has(code) ? code.toLowerCase() : "registration_failed";

const track = (eventName: string, parameters: AnalyticsParameters) => {
  if (typeof window === "undefined") return;
  window.btbAnalytics?.track(eventName, { event_edition: "2026", ...parameters });
};

export const trackRegistrationStart = (registrationType: RegistrationType) =>
  track("registration_start", { registration_type: registrationType });

export const trackRegistrationComplete = (registrationType: RegistrationType) =>
  track("registration_complete", { registration_type: registrationType });

export const trackRegistrationError = (code: string) =>
  track("registration_error", { error_code: normalizeRegistrationErrorCode(code) });
