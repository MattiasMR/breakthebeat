import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { calculateStats, filterParticipants, operationalCsv, type AdminParticipant } from "./admin";
import { buildOperationalWorkbook } from "./admin-workbook";

const row = (overrides: Partial<AdminParticipant> = {}): AdminParticipant => ({
  id: "p1",
  registrationId: "r1",
  registrationCode: "BTB26-AAAA",
  participantCode: "BTB26-AAAA-A",
  qrToken: "123e4567-e89b-42d3-a456-426614174000",
  role: "captain",
  displayName: "Bboy Test",
  email: "test@example.com",
  phone: "+593991234567",
  socialUrl: "https://instagram.com/test",
  age: 22,
  categories: ["1v1", "2v2"],
  status: "confirmed",
  createdAt: "2026-07-15T12:00:00Z",
  checkedInAt: null,
  ...overrides
});

describe("admin helpers", () => {
  it("cuenta personas, inscripciones y duplas sin inflar el total", () => {
    const stats = calculateStats([
      row(),
      row({ id: "p2", role: "partner", participantCode: "BTB26-AAAA-B", email: "partner@example.com", categories: ["2v2"] }),
      row({ id: "p3", registrationId: "r2", registrationCode: "BTB26-BBBB", participantCode: "BTB26-BBBB-A", categories: ["bgirls"] })
    ]);
    expect(stats.participants).toBe(3);
    expect(stats.registrations).toBe(2);
    expect(stats.duos).toBe(1);
    expect(stats.categories["2v2"]).toBe(2);
  });

  it("combina búsqueda y filtros", () => {
    const rows = [row(), row({ id: "p2", displayName: "Bgirl Luna", categories: ["bgirls"] })];
    expect(filterParticipants(rows, { query: "luna", category: "bgirls", status: "all", checkIn: "all" })).toHaveLength(1);
    expect(filterParticipants(rows, { query: "luna", category: "1v1", status: "all", checkIn: "all" })).toHaveLength(0);
  });

  it("neutraliza fórmulas al exportar CSV", () => {
    expect(operationalCsv([row({ displayName: "=HYPERLINK(\"bad\")" })])).toContain("'=HYPERLINK");
  });

  it("crea un Excel operativo con resumen y filtros compatibles", async () => {
    const workbook = buildOperationalWorkbook([row({ checkedInAt: "2026-08-31T12:00:00Z" })], new Date("2026-08-31T13:00:00Z"));
    const summary = workbook.getWorksheet("Resumen");
    const participants = workbook.getWorksheet("Participantes");
    expect(summary?.getCell("A1").value).toContain("Break The Beat 2026");
    expect(summary?.getCell("B7").value).toEqual({ formula: "COUNTIF('Participantes'!$J$2:$J$2,\"Confirmado\")" });
    expect(participants?.getCell("A1").value).toBe("Código");
    expect(participants?.getCell("C2").value).toBe("Bboy Test");

    const reopened = new ExcelJS.Workbook();
    await reopened.xlsx.load(await workbook.xlsx.writeBuffer());
    expect(reopened.getWorksheet("Participantes")?.getTables()).toHaveLength(0);
  });

  it("mantiene un Excel válido aunque el filtro no tenga resultados", async () => {
    const workbook = buildOperationalWorkbook([], new Date("2026-08-31T13:00:00Z"));
    const reopened = new ExcelJS.Workbook();
    await reopened.xlsx.load(await workbook.xlsx.writeBuffer());
    expect(reopened.getWorksheet("Participantes")?.getCell("A1").value).toBe("Código");
    expect(reopened.getWorksheet("Resumen")?.getCell("B7").value).toEqual({ formula: "COUNTIF('Participantes'!$J$2:$J$2,\"Confirmado\")" });
  });
});
