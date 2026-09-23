import type { AdminParticipant } from "./admin";
import { categoryLabels, type Category } from "./registration";

export type CategoryChange = { id: string; categories: Category[] };
export const categorySnapshot = (rows: AdminParticipant[]): CategoryChange[] =>
  rows.map((row) => ({ id: row.id, categories: [...row.categories].sort() }));

export const duoPartner = (row: AdminParticipant, rows: AdminParticipant[]) =>
  row.categories.includes("2v2")
    ? rows.find((other) => other.id !== row.id && other.registrationId === row.registrationId && other.categories.includes("2v2"))
    : undefined;

export const categoryText = (categories: readonly string[]) =>
  categories.map((category) => categoryLabels[category as Category] ?? category).join(" · ") || "Sin categorías";

export const validateCategoryChanges = (rows: AdminParticipant[], changes: CategoryChange[]) => {
  if (changes.length !== rows.length || new Set(changes.map((item) => item.id)).size !== rows.length ||
      changes.some((item) => !rows.some((row) => row.id === item.id))) return "La inscripción cambió. Cierra y vuelve a abrir el editor.";
  if (changes.some((item) => !item.categories.length)) return "Selecciona al menos una categoría para cada persona.";
  const duos = changes.filter((item) => item.categories.includes("2v2")).length;
  if (duos && (rows.length !== 2 || duos !== 2)) return "2 vs 2 requiere a los dos integrantes de la inscripción.";
  if (["1v1", "bgirls"].some((category) => changes.filter((item) => item.categories.includes(category as Category)).length > 1))
    return "Los dos integrantes no pueden ocupar la misma categoría individual en una sola inscripción. Necesitan inscripciones separadas.";
  if (changes.every((item) => [...item.categories].sort().join() === [...rows.find((row) => row.id === item.id)!.categories].sort().join()))
    return "No hay cambios de categorías para guardar.";
  return "";
};

export type ActivityEntry = {
  id: string; action: string; target_type: string; target_id: string | null;
  created_at: string; username: string; metadata: Record<string, any>;
};
const actionLabels: Record<string, string> = {
  update_participant_categories: "Cambió categorías", update_registration: "Actualizó una inscripción",
  deactivate_registration: "Desactivó una inscripción", reactivate_registration: "Reactivó una inscripción",
  delete_registration: "Eliminó una inscripción", manual_check_in: "Registró un check-in manual",
  qr_check_in: "Registró un ingreso por QR", repeat_manual_check_in: "Consultó un check-in ya realizado",
  repeat_qr_check_in: "Se volvió a escanear un QR", open_registration: "Abrió las inscripciones",
  close_registration: "Cerró las inscripciones", export_operational_xlsx: "Descargó el Excel operativo",
  export_emergency_xlsx: "Descargó el Excel de emergencia", export_guest_attendance_xlsx: "Descargó el Excel de invitados",
  remove_guest_attendance: "Quitó un invitado", view_emergency_contact: "Consultó un contacto de emergencia",
  view_participant_photo: "Abrió una foto", generate_participant_qr: "Generó un QR",
  export_active_participant_photos: "Descargó las fotos activas", export_all_participant_photos: "Descargó todas las fotos",
  admin_login: "Inició sesión"
};
export const activityText = (entry: ActivityEntry, rows: AdminParticipant[]) => {
  const metadata = entry.metadata ?? {};
  const row = rows.find((item) => entry.target_type === "participant" ? item.id === entry.target_id : item.registrationId === entry.target_id);
  const target = metadata.public_code ?? metadata.participant_code ?? (entry.target_type === "participant" ? row?.displayName : row?.registrationCode);
  let text = `${actionLabels[entry.action] ?? entry.action}${target ? ` · ${target}` : ""}`;
  if (entry.action === "update_registration" && metadata.next_status) text += ` · ${metadata.next_status === "confirmed" ? "Confirmada" : "Desactivada"}`;
  if (typeof metadata.rows === "number") text += ` · ${metadata.rows} registros`;
  if (entry.action === "update_participant_categories" && Array.isArray(metadata.after)) {
    for (const after of metadata.after) {
      const before = Array.isArray(metadata.before) ? metadata.before.find((item: CategoryChange) => item.id === after.id) : undefined;
      if (!Array.isArray(after.categories) || !Array.isArray(before?.categories)) continue;
      if ([...before.categories].sort().join() === [...after.categories].sort().join()) continue;
      text += `\n${metadata.participants?.[after.id]?.name ?? "Participante"}: ${categoryText(before.categories)} → ${categoryText(after.categories)}`;
    }
  }
  return text;
};
