import { describe, expect, it } from "vitest";
import { activityText, categorySnapshot, duoPartner, validateCategoryChanges } from "./admin-categories";
import type { AdminParticipant } from "./admin";

const person = (id: string, categories: AdminParticipant["categories"], registrationId = "r1") =>
  ({ id, categories, registrationId, displayName: `Persona ${id}` }) as AdminParticipant;

describe("edición administrativa de categorías", () => {
  it("encuentra el compañero en ambos sentidos, incluso fuera del resultado filtrado", () => {
    const a = person("a", ["2v2"]), b = person("b", ["2v2"]), c = person("c", ["2v2"], "r2");
    expect(duoPartner(a, [a, b, c])).toBe(b);
    expect(duoPartner(b, [a, b, c])).toBe(a);
    expect(duoPartner(person("a", ["1v1"]), [b])).toBeUndefined();
    expect(duoPartner(a, [a, c])).toBeUndefined();
  });
  it("rechaza categorías vacías, duplas incompletas y cambios sin efecto", () => {
    const rows = [person("a", ["1v1"])];
    expect(validateCategoryChanges(rows, [{ id: "a", categories: [] }])).toContain("al menos una");
    expect(validateCategoryChanges(rows, [{ id: "a", categories: ["2v2"] }])).toContain("dos integrantes");
    expect(validateCategoryChanges(rows, categorySnapshot(rows))).toContain("No hay cambios");
    expect(validateCategoryChanges(rows, [{ id: "b", categories: ["bgirls"] }])).toContain("inscripción cambió");
  });
  it("permite retirar el dúo si ambos conservan categorías individuales distintas", () => {
    const rows = [person("a", ["2v2"]), person("b", ["2v2"])];
    expect(validateCategoryChanges(rows, [{ id: "a", categories: ["1v1"] }, { id: "b", categories: ["bgirls"] }])).toBe("");
    expect(validateCategoryChanges(rows, [{ id: "a", categories: ["1v1"] }, { id: "b", categories: ["1v1"] }])).toContain("inscripciones separadas");
    expect(validateCategoryChanges(rows, [{ id: "a", categories: ["1v1"] }, { id: "b", categories: ["2v2"] }])).toContain("dos integrantes");
  });
  it("conserva el antes y después por nombre aunque la persona ya no esté en la lista", () => {
    const text = activityText({ id: "log", action: "update_participant_categories", target_type: "registration", target_id: "r1", created_at: "2026-09-23", username: "admin", metadata: {
      public_code: "BTB26-TEST", participants: { a: { name: "Ana" } },
      before: [{ id: "a", categories: ["1v1"] }], after: [{ id: "a", categories: ["bgirls"] }]
    } }, []);
    expect(text).toContain("Ana: 1 vs 1 → BGirls");
    expect(text).toContain("BTB26-TEST");
  });
});
