import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { buildGuestWorkbook } from "./admin-workbook";
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
    expect(guestTypes).toEqual(["Sponsor", "Bailarín", "Invitado", "Casa Grande"]);
    expect(guestAttendanceSchema.safeParse({ firstName: "María", lastName: "Pérez", organization: "Influencer" }).success).toBe(false);
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


describe("guest Excel export", () => {
  it("preserves columns, safe text, Ecuador dates and the shared workbook format", async () => {
    const workbook = buildGuestWorkbook([row({ firstName: "=unsafe", organization: null })]);
    const reopened = new ExcelJS.Workbook();
    await reopened.xlsx.load(await workbook.xlsx.writeBuffer());
    const sheet = reopened.getWorksheet("Invitados")!;
    expect(reopened.worksheets.map((item) => item.name)).toEqual(["Resumen", "Invitados"]);
    expect(sheet.getCell("A2").value).toBe("'=unsafe");
    expect(sheet.getCell("B2").value).toBe("Pérez");
    expect(sheet.getCell("C2").value ?? "").toBe("");
    expect(sheet.getCell("D2").value).toEqual(new Date("2026-08-17T07:00:00Z"));
    expect(sheet.getCell("D2").numFmt).toBe("yyyy-mm-dd hh:mm");
    expect(sheet.autoFilter).toBe("A1:D2");
    expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
    expect(sheet.getCell("A1").fill).toMatchObject({ fgColor: { argb: "FF2563EB" } });
    expect(sheet.getCell("A2").fill).toMatchObject({ fgColor: { argb: "FFEFF6FF" } });
    expect(sheet.getTables()).toHaveLength(0);
    expect(reopened.getWorksheet("Resumen")!.getCell("B6").value).toBe(1);
  });

  it("exports only the selected results and supports an empty list", async () => {
    for (const rows of [[], filterGuestAttendances([row(), row({ firstName: "Pedro" })], "pedro")]) {
      const reopened = new ExcelJS.Workbook();
      await reopened.xlsx.load(await buildGuestWorkbook(rows).xlsx.writeBuffer());
      const sheet = reopened.getWorksheet("Invitados")!;
      expect(sheet.rowCount).toBe(rows.length + 1);
      expect(sheet.columnCount).toBe(4);
      expect(sheet.autoFilter).toBe(`A1:D${rows.length + 1}`);
      expect(reopened.getWorksheet("Resumen")!.getCell("B6").value).toBe(rows.length);
    }
  });
});
