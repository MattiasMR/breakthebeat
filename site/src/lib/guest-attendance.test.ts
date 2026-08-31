import { describe, expect, it } from "vitest";
import { filterGuestAttendances, guestAttendanceCsv, guestAttendanceSchema, guestTypes, type GuestAttendance } from "./guest-attendance";

const row = (overrides: Partial<GuestAttendance> = {}): GuestAttendance => ({
  id: "guest-1",
  firstName: "María",
  lastName: "Pérez",
  organization: "Sponsor",
  confirmedAt: "2026-08-17T12:00:00Z",
  createdAt: "2026-08-17T12:00:00Z",
  ...overrides
});

describe("guest attendance helpers", () => {
  it("acepta solamente los cuatro tipos de invitado", () => {
    guestTypes.forEach((organization) => {
      expect(guestAttendanceSchema.safeParse({ firstName: "María", lastName: "Pérez", organization }).success).toBe(true);
    });
    expect(guestAttendanceSchema.safeParse({ firstName: "María", lastName: "Pérez", organization: "" }).success).toBe(false);
    expect(guestAttendanceSchema.safeParse({ firstName: "María", lastName: "Pérez", organization: "Otro" }).success).toBe(false);
  });

  it("busca por nombre, apellido y tipo de invitado ignorando acentos", () => {
    expect(filterGuestAttendances([row()], "maria perez")).toHaveLength(1);
    expect(filterGuestAttendances([row()], "sponsor")).toHaveLength(1);
    expect(filterGuestAttendances([row()], "otro")).toHaveLength(0);
  });

  it("neutraliza fórmulas al exportar CSV", () => {
    expect(guestAttendanceCsv([row({ organization: "=malicious" })])).toContain("'=malicious");
  });
});
