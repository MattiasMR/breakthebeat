import ExcelJS from "exceljs";
import type { AdminParticipant } from "./admin";

const excelSafeText = (value: unknown) => {
  const text = value == null ? "" : String(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
};

const localizedStatus = (status: AdminParticipant["status"]) => status === "cancelled" ? "Desactivado" : "Confirmado";

const localizedRole = (role: AdminParticipant["role"]) => role === "captain" ? "Principal" : "Compañero";

const checkInValue = (checkedInAt: string | null) => checkedInAt ? new Date(checkedInAt) : "Pendiente";

export const buildOperationalWorkbook = (rows: AdminParticipant[], generatedAt = new Date()) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Break The Beat";
  workbook.created = generatedAt;
  workbook.modified = generatedAt;

  const summary = workbook.addWorksheet("Resumen", { views: [{ showGridLines: false }] });
  const participantsSheet = workbook.addWorksheet("Participantes", { views: [{ state: "frozen", ySplit: 1 }] });
  const headers = ["Código", "Inscripción", "Nombre", "Rol", "Email", "Teléfono", "Red social", "Edad", "Categorías", "Estado", "Check-in", "Foto"];
  const tableRows = rows.map((row) => [
    excelSafeText(row.participantCode), excelSafeText(row.registrationCode), excelSafeText(row.displayName), localizedRole(row.role),
    excelSafeText(row.email), excelSafeText(row.phone), excelSafeText(row.socialUrl), row.age, row.categories.join(" | "),
    localizedStatus(row.status), checkInValue(row.checkedInAt), row.photoPath ? "Cargada" : "Pendiente"
  ]);

  participantsSheet.addRow(headers);
  participantsSheet.addRows(tableRows);
  participantsSheet.columns = [
    { width: 20 }, { width: 19 }, { width: 32 }, { width: 13 }, { width: 31 }, { width: 18 },
    { width: 30 }, { width: 9 }, { width: 18 }, { width: 14 }, { width: 22 }, { width: 14 }
  ];
  participantsSheet.getRow(1).height = 22;
  participantsSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  participantsSheet.getRow(1).alignment = { vertical: "middle" };
  participantsSheet.getRow(1).eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
    cell.border = { bottom: { style: "thin", color: { argb: "FF1D4ED8" } } };
  });
  for (let rowNumber = 2; rowNumber <= rows.length + 1; rowNumber += 1) {
    if (rowNumber % 2 === 0) {
      participantsSheet.getRow(rowNumber).eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF6FF" } };
      });
    }
  }
  participantsSheet.getColumn("K").numFmt = "yyyy-mm-dd hh:mm";
  participantsSheet.autoFilter = { from: "A1", to: `L${Math.max(rows.length + 1, 1)}` };

  const dataLastRow = Math.max(rows.length + 1, 2);

  summary.mergeCells("A1:D1");
  summary.getCell("A1").value = "Break The Beat 2026 — Exportación de participantes";
  summary.getCell("A1").font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  summary.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF111827" } };
  summary.getCell("A1").alignment = { vertical: "middle" };
  summary.getRow(1).height = 28;
  summary.getCell("A3").value = "Generado";
  summary.getCell("B3").value = generatedAt;
  summary.getCell("B3").numFmt = "yyyy-mm-dd hh:mm";
  summary.getCell("A5").value = "Indicador";
  summary.getCell("B5").value = "Total";
  summary.getRow(5).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ["A5", "B5"].forEach((cell) => summary.getCell(cell).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } });
  const indicators = [
    ["Participantes exportados", rows.length], ["Confirmados", { formula: `COUNTIF('Participantes'!$J$2:$J$${dataLastRow},"Confirmado")` }],
    ["Desactivados", { formula: `COUNTIF('Participantes'!$J$2:$J$${dataLastRow},"Desactivado")` }], ["Con check-in", { formula: `COUNT('Participantes'!$K$2:$K$${dataLastRow})` }],
    ["1 vs 1", { formula: `COUNTIF('Participantes'!$I$2:$I$${dataLastRow},"*1v1*")` }], ["2 vs 2", { formula: `COUNTIF('Participantes'!$I$2:$I$${dataLastRow},"*2v2*")` }],
    ["BGirls", { formula: `COUNTIF('Participantes'!$I$2:$I$${dataLastRow},"*bgirls*")` }],
    ["Fotos pendientes", { formula: `COUNTIFS('Participantes'!$J$2:$J$${dataLastRow},"Confirmado",'Participantes'!$L$2:$L$${dataLastRow},"Pendiente")` }]
  ];
  indicators.forEach(([label, value], index) => {
    const row = index + 6;
    summary.getCell(`A${row}`).value = label;
    summary.getCell(`B${row}`).value = value;
    if (row % 2 === 0) ["A", "B"].forEach((column) => summary.getCell(`${column}${row}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF6FF" } });
  });
  summary.getCell("A14").value = "Uso";
  summary.getCell("B14").value = "Usa los filtros de la hoja “Participantes” para ordenar, buscar o filtrar los registros exportados.";
  summary.getCell("B14").alignment = { wrapText: true, vertical: "top" };
  summary.getColumn("A").width = 28;
  summary.getColumn("B").width = 72;
  summary.eachRow((row) => row.eachCell((cell) => cell.border = { bottom: { style: "hair", color: { argb: "FFD1D5DB" } } }));

  return workbook;
};

export const downloadOperationalWorkbook = async (filename: string, rows: AdminParticipant[]) => {
  const workbook = buildOperationalWorkbook(rows);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};
