import type { Category } from "./registration";

export type AdminParticipant = {
  id: string;
  registrationId: string;
  registrationCode: string;
  participantCode: string;
  role: "captain" | "partner";
  displayName: string;
  email: string;
  phone: string;
  socialUrl: string;
  age: number;
  categories: Category[];
  status: "confirmed" | "cancelled";
  createdAt: string;
  checkedInAt: string | null;
  hasMedicalAlert: boolean;
};

export type AdminFilters = {
  query: string;
  category: "all" | Category;
  status: "all" | "confirmed" | "cancelled";
  checkIn: "all" | "yes" | "no";
};

export const filterParticipants = (rows: AdminParticipant[], filters: AdminFilters) => {
  const query = filters.query.trim().toLocaleLowerCase("es");
  return rows.filter((row) => {
    const matchesQuery = !query || [row.displayName, row.email, row.phone, row.participantCode, row.registrationCode]
      .some((value) => value.toLocaleLowerCase("es").includes(query));
    const matchesCategory = filters.category === "all" || row.categories.includes(filters.category);
    const matchesStatus = filters.status === "all" || row.status === filters.status;
    const matchesCheckIn = filters.checkIn === "all" || (filters.checkIn === "yes" ? Boolean(row.checkedInAt) : !row.checkedInAt);
    return matchesQuery && matchesCategory && matchesStatus && matchesCheckIn;
  });
};

export const calculateStats = (rows: AdminParticipant[]) => {
  const active = rows.filter((row) => row.status !== "cancelled");
  const registrations = new Set(active.map((row) => row.registrationId));
  const duos = new Set(active.filter((row) => row.categories.includes("2v2")).map((row) => row.registrationId));
  return {
    participants: active.length,
    registrations: registrations.size,
    duos: duos.size,
    checkedIn: active.filter((row) => row.checkedInAt).length,
    medicalAlerts: active.filter((row) => row.hasMedicalAlert).length,
    categories: {
      "1v1": active.filter((row) => row.categories.includes("1v1")).length,
      "2v2": active.filter((row) => row.categories.includes("2v2")).length,
      bgirls: active.filter((row) => row.categories.includes("bgirls")).length
    }
  };
};

const csvCell = (value: unknown) => {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};

export const operationalCsv = (rows: AdminParticipant[]) => {
  const header = ["Código", "Inscripción", "Nombre", "Rol", "Email", "Teléfono", "Red social", "Edad", "Categorías", "Estado", "Check-in"];
  const data = rows.map((row) => [
    row.participantCode,
    row.registrationCode,
    row.displayName,
    row.role,
    row.email,
    row.phone,
    row.socialUrl,
    row.age,
    row.categories.join(" | "),
    row.status,
    row.checkedInAt ?? ""
  ]);
  return [header, ...data].map((line) => line.map(csvCell).join(",")).join("\r\n");
};

export const downloadCsv = (filename: string, content: string) => {
  const blob = new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};
