import { describe, expect, it } from "vitest";
import { filterGuestAttendances, guestAttendanceCsv, type GuestAttendance } from "./guest-attendance";

const row = (overrides: Partial<GuestAttendance> = {}): GuestAttendance => ({
  id: "guest-1",
  firstName: "María",
  lastName: "Pérez",
  organization: "Sponsor Beat",
  confirmedAt: "2026-08-17T12:00:00Z",
  createdAt: "2026-08-17T12:00:00Z",
  ...overrides
});

describe("guest attendance helpers", () => {
  it("busca por nombre, apellido y empresa ignorando acentos", () => {
    expect(filterGuestAttendances([row()], "maria perez")).toHaveLength(1);
    expect(filterGuestAttendances([row()], "sponsor")).toHaveLength(1);
    expect(filterGuestAttendances([row()], "otro")).toHaveLength(0);
  });

  it("neutraliza fórmulas al exportar CSV", () => {
    expect(guestAttendanceCsv([row({ organization: "=malicious" })])).toContain("'=malicious");
  });
});
