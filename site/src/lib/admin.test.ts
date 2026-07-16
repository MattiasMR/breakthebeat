import { describe, expect, it } from "vitest";
import { calculateStats, filterParticipants, operationalCsv, type AdminParticipant } from "./admin";

const row = (overrides: Partial<AdminParticipant> = {}): AdminParticipant => ({
  id: "p1",
  registrationId: "r1",
  registrationCode: "BTB26-AAAA",
  participantCode: "BTB26-AAAA-A",
  role: "captain",
  displayName: "Bboy Test",
  email: "test@example.com",
  phone: "+593991234567",
  socialUrl: "https://instagram.com/test",
  shirtSize: "M",
  age: 22,
  country: "Ecuador",
  city: "Guayaquil",
  categories: ["1v1", "2v2"],
  status: "confirmed",
  emailStatus: "sent",
  createdAt: "2026-07-15T12:00:00Z",
  checkedInAt: null,
  hasMedicalAlert: false,
  ...overrides
});

describe("admin helpers", () => {
  it("cuenta personas, inscripciones y duplas sin inflar el total", () => {
    const stats = calculateStats([
      row(),
      row({ id: "p2", role: "partner", participantCode: "BTB26-AAAA-B", email: "partner@example.com", categories: ["2v2"] }),
      row({ id: "p3", registrationId: "r2", registrationCode: "BTB26-BBBB", participantCode: "BTB26-BBBB-A", categories: ["bgirls"], shirtSize: "S" })
    ]);
    expect(stats.participants).toBe(3);
    expect(stats.registrations).toBe(2);
    expect(stats.duos).toBe(1);
    expect(stats.categories["2v2"]).toBe(2);
    expect(stats.sizes.M).toBe(2);
  });

  it("combina búsqueda y filtros", () => {
    const rows = [row(), row({ id: "p2", displayName: "Bgirl Luna", city: "Quito", categories: ["bgirls"], shirtSize: "S" })];
    expect(filterParticipants(rows, { query: "luna", category: "bgirls", shirtSize: "S", status: "all", checkIn: "all" })).toHaveLength(1);
    expect(filterParticipants(rows, { query: "luna", category: "1v1", shirtSize: "all", status: "all", checkIn: "all" })).toHaveLength(0);
  });

  it("neutraliza fórmulas al exportar CSV", () => {
    expect(operationalCsv([row({ displayName: "=HYPERLINK(\"bad\")" })])).toContain("'=HYPERLINK");
  });
});

