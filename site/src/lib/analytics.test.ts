import { afterEach, describe, expect, it, vi } from "vitest";
import {
  normalizeRegistrationErrorCode,
  trackRegistrationComplete,
  trackRegistrationError,
  trackRegistrationStart
} from "./analytics";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("normalizeRegistrationErrorCode", () => {
  it("normalizes known backend codes for GA4", () => {
    expect(normalizeRegistrationErrorCode("CATEGORY_FULL")).toBe("category_full");
    expect(normalizeRegistrationErrorCode("DUPLICATE_PARTICIPANT_CATEGORY")).toBe("duplicate_participant_category");
  });

  it("does not forward arbitrary error text or personal data", () => {
    expect(normalizeRegistrationErrorCode("correo persona@example.com")).toBe("registration_failed");
    expect(normalizeRegistrationErrorCode("unexpected response body")).toBe("registration_failed");
  });

  it("emits only the thesis funnel parameters", () => {
    const track = vi.fn();
    vi.stubGlobal("window", { btbAnalytics: { track } });

    trackRegistrationStart("duo");
    trackRegistrationComplete("individual");
    trackRegistrationError("CATEGORY_FULL");

    expect(track.mock.calls).toEqual([
      ["registration_start", { event_edition: "2026", registration_type: "duo" }],
      ["registration_complete", { event_edition: "2026", registration_type: "individual" }],
      ["registration_error", { event_edition: "2026", error_code: "category_full" }]
    ]);
  });
});
