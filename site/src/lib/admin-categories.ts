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
