import { categoryLabels, EVENT_SLUG, type Category } from "../lib/registration";
import { getSupabase } from "../lib/supabase";

type Capacity = { category: Category; total: number; occupied: number; remaining: number };
const list = document.querySelector<HTMLElement>("[data-capacity-list]")!;
const status = document.querySelector<HTMLElement>("[data-capacity-status]")!;
const refresh = document.querySelector<HTMLButtonElement>("[data-refresh-capacity]")!;
let version = 0;
let loading = false;
let saving = false;

export const clearCapacity = () => { version++; list.replaceChildren(); };

export const loadCapacity = async () => {
  if (loading || saving) return;
  const current = ++version;
  loading = true;
  refresh.disabled = true;
  list.querySelectorAll<HTMLFieldSetElement>("fieldset").forEach((field) => { field.disabled = true; });
  status.textContent = "Actualizando cupos…";
  try {
    const { data, error } = await getSupabase().rpc("admin_get_category_limits", { p_event_slug: EVENT_SLUG });
    if (current !== version) return;
    if (error || !data || data.length !== 3) throw error ?? new Error("CAPACITY_UNAVAILABLE");
    list.replaceChildren(...(data as Capacity[]).map((row) => {
      const form = document.createElement("form");
      form.dataset.capacityCategory = row.category;
      const fieldset = document.createElement("fieldset");
      fieldset.className = "capacity-row";
      const legend = document.createElement("legend");
      legend.textContent = categoryLabels[row.category];
      const controls = document.createElement("div");
      controls.className = "capacity-controls";
      const label = document.createElement("label");
      label.textContent = "Cupos totales";
      const input = document.createElement("input");
      input.type = "number";
      input.name = "total";
      input.required = true;
      input.min = String(row.occupied);
      input.max = "2147483647";
      input.step = "1";
      input.value = String(row.total);
      input.ariaLabel = `Cupos totales de ${categoryLabels[row.category]}`;
      label.append(input);
      const save = document.createElement("button");
      save.type = "submit";
      save.className = "button button-secondary dark";
      save.textContent = "Guardar";
      save.disabled = true;
      const counts = document.createElement("p");
      counts.textContent = `${row.occupied} ocupados · ${row.remaining} disponibles${row.category === "2v2" ? " · cupos por dupla" : ""}`;
      const message = document.createElement("p");
      message.role = "status";
      input.addEventListener("input", () => {
        save.disabled = !input.validity.valid || input.valueAsNumber === row.total;
        message.textContent = input.validity.valid ? "" : `Ingresa un entero entre ${row.occupied} y 2147483647. El total no puede ser menor que los cupos ocupados.`;
      });
      controls.append(label, save);
      fieldset.append(legend, controls, counts, message);
      form.append(fieldset);
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (saving || !form.reportValidity() || input.valueAsNumber === row.total) return;
        const total = input.valueAsNumber;
        if (!window.confirm(`¿Cambiar los cupos totales de ${categoryLabels[row.category]} de ${row.total} a ${total}?\nOcupados: ${row.occupied}. Quedarán ${total - row.occupied} disponibles${row.category === "2v2" ? " para duplas" : ""}.`)) return;
        saving = true;
        refresh.disabled = true;
        list.querySelectorAll<HTMLFieldSetElement>("fieldset").forEach((field) => { field.disabled = true; });
        message.textContent = "Guardando…";
        let saved = false;
        let stale = false;
        try {
          const { error } = await getSupabase().rpc("admin_update_category_limit", {
            p_event_slug: EVENT_SLUG, p_category: row.category, p_total: total, p_expected_total: row.total
          });
          if (error) throw error;
          saved = true;
        } catch (error) {
          const code = (error as { message?: string })?.message ?? "";
          stale = code.includes("STALE_CAPACITY") || code.includes("CAPACITY_BELOW_OCCUPIED");
          message.textContent = stale
            ? "Los cupos cambiaron mientras editabas. Pulsa Actualizar y revisa los datos antes de guardar."
            : "No se pudo confirmar el cambio. Pulsa Actualizar para comprobar el total antes de reintentar.";
        } finally {
          saving = false;
          if (current === version) {
            refresh.disabled = false;
            if (saved) {
              await loadCapacity();
              if (status.textContent?.startsWith("Actualizados")) status.textContent = `Cupos de ${categoryLabels[row.category]} guardados.`;
            }
            // On failure keep edits disabled until a fresh read resolves an uncertain response.
          }
        }
      });
      return form;
    }));
    status.textContent = "Actualizados. El total incluye los cupos ocupados y los disponibles.";
  } catch {
    if (current === version) status.textContent = "No se pudieron cargar los cupos. Pulsa Actualizar para reintentar.";
  } finally {
    loading = false;
    if (current === version) refresh.disabled = false;
  }
};
refresh.addEventListener("click", () => void loadCapacity());
