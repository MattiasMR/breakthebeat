import { z } from "zod";

export const guestTypes = ["Influencer", "Bailarín", "Sponsor", "Invitado"] as const;

export const guestAttendanceSchema = z.object({
  firstName: z.string().trim().min(2, "Ingresa tu nombre").max(80, "El nombre es demasiado largo"),
  lastName: z.string().trim().min(2, "Ingresa tu apellido").max(80, "El apellido es demasiado largo"),
  organization: z.enum(guestTypes, { error: "Selecciona tu tipo de invitado" })
});

export type GuestAttendance = {
  id: string;
  firstName: string;
  lastName: string;
  organization: string | null;
  confirmedAt: string;
  createdAt: string;
};

const searchValue = (value: string | null) => (value ?? "")
  .normalize("NFD")
  .replace(/\p{Diacritic}/gu, "")
  .toLocaleLowerCase("es");

export const filterGuestAttendances = (rows: GuestAttendance[], query: string) => {
  const terms = searchValue(query).trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return rows;
  return rows.filter((row) => {
    const searchable = searchValue(`${row.firstName} ${row.lastName} ${row.organization ?? ""}`);
    return terms.every((term) => searchable.includes(term));
  });
};

const csvCell = (value: unknown) => {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};

export const guestAttendanceCsv = (rows: GuestAttendance[]) => {
  const header = ["Nombre", "Apellido", "Tipo de invitado", "Confirmó asistencia"];
  const data = rows.map((row) => [row.firstName, row.lastName, row.organization ?? "", row.confirmedAt]);
  return [header, ...data].map((line) => line.map(csvCell).join(",")).join("\r\n");
};
