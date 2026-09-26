import { createYouTubePlayer, isYouTubeVideoId, parseYouTubeVideoId, youtubeWatchUrl } from "../lib/livestream";
import { EVENT_SLUG } from "../lib/registration";
import { getSupabase } from "../lib/supabase";

type Settings = { enabled: boolean; video_id: string | null; revision: number };
const form = document.querySelector<HTMLFormElement>("[data-live-form]")!;
const fields = document.querySelector<HTMLFieldSetElement>("[data-live-fields]")!;
const input = document.querySelector<HTMLInputElement>("[data-live-url]")!;
const toggle = document.querySelector<HTMLInputElement>("[data-live-toggle]")!;
const save = document.querySelector<HTMLButtonElement>("[data-live-save]")!;
const refresh = document.querySelector<HTMLButtonElement>("[data-live-refresh]")!;
const status = document.querySelector<HTMLElement>("[data-live-status]")!;
const preview = document.querySelector<HTMLElement>("[data-live-preview]")!;
const player = document.querySelector<HTMLElement>("[data-live-preview-player]")!;
let state: Settings | null = null;
let version = 0;
let busy = false;

const closePreview = () => { player.replaceChildren(); preview.hidden = true; };
const validState = (row: Settings | undefined): row is Settings => Boolean(row &&
  typeof row.enabled === "boolean" && Number.isSafeInteger(row.revision) && row.revision >= 0 &&
  (row.video_id === null || isYouTubeVideoId(row.video_id)) && (!row.enabled || row.video_id));
const editedId = () => input.value.trim() ? parseYouTubeVideoId(input.value) : null;
const updateControls = () => {
  const invalid = Boolean(input.value.trim()) && !editedId();
  const dirty = invalid || editedId() !== state?.video_id;
  input.setCustomValidity(invalid ? "Pega un enlace válido de un video o en vivo de YouTube." : "");
  toggle.disabled = busy || !state || dirty || (!state.video_id && !state.enabled);
  save.disabled = busy || !state || invalid || !dirty || (state.enabled && !editedId());
};
const render = (row: Settings) => {
  state = row;
  input.value = row.video_id ? youtubeWatchUrl(row.video_id) : "";
  toggle.checked = row.enabled;
  fields.disabled = false;
  updateControls();
};

export const clearLivestream = () => {
  version++;
  state = null;
  busy = false;
  form.reset();
  fields.disabled = true;
  closePreview();
};

export const loadLivestream = async () => {
  if (busy) return;
  const current = ++version;
  busy = true;
  fields.disabled = true;
  refresh.disabled = true;
  status.textContent = "Cargando configuración…";
  try {
    const { data, error } = await getSupabase().rpc("admin_get_livestream", { p_event_slug: EVENT_SLUG });
    if (current !== version) return;
    if (error || data?.length !== 1 || !validState(data[0])) throw error ?? new Error("INVALID_SETTINGS");
    render(data[0]);
    status.textContent = state?.enabled ? "Visible en la portada." : "Oculta en la portada. Puedes probar el video sin activarla.";
  } catch {
    if (current === version) {
      state = null;
      status.textContent = "No se pudo cargar la configuración. Pulsa Actualizar para reintentar.";
    }
  } finally {
    if (current === version) { busy = false; refresh.disabled = false; updateControls(); }
  }
};

const persist = async (enabled: boolean, videoId: string | null) => {
  if (busy || !state) return;
  const current = version;
  const previous = state;
  busy = true;
  fields.disabled = true;
  refresh.disabled = true;
  status.textContent = "Guardando…";
  try {
    const { data, error } = await getSupabase().rpc("admin_update_livestream", {
      p_event_slug: EVENT_SLUG, p_enabled: enabled, p_video_id: videoId, p_expected_revision: previous.revision
    });
    if (current !== version) return;
    if (error || data?.length !== 1 || !validState(data[0])) throw error ?? new Error("INVALID_SETTINGS");
    render(data[0]);
    status.textContent = enabled ? "Guardado. La transmisión está visible en la portada." : "Guardado. La transmisión está oculta en la portada.";
  } catch (error) {
    if (current !== version) return;
    toggle.checked = previous.enabled;
    state = null;
    status.textContent = (error as { message?: string })?.message?.includes("STALE_LIVESTREAM")
      ? "Otro administrador cambió la configuración. Pulsa Actualizar antes de volver a editar."
      : "No se pudo confirmar el guardado. Pulsa Actualizar para comprobar el estado antes de reintentar.";
  } finally {
    if (current === version) { busy = false; refresh.disabled = false; updateControls(); }
  }
};

input.addEventListener("input", () => {
  updateControls();
  status.textContent = input.validationMessage || "El enlace se aplicará al pulsar Guardar enlace. Puedes probarlo antes de guardar.";
  closePreview();
});
form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (save.disabled || !form.reportValidity() || !state) return;
  void persist(state.enabled, editedId());
});
toggle.addEventListener("change", () => { if (state) void persist(toggle.checked, state.video_id); });
refresh.addEventListener("click", () => void loadLivestream());
document.querySelector("[data-live-preview-button]")?.addEventListener("click", () => {
  const id = editedId();
  if (!id) { status.textContent = input.validationMessage || "Ingresa un enlace válido de YouTube para probar el video."; input.focus(); return; }
  player.replaceChildren(createYouTubePlayer(id, "Vista previa de la transmisión de Break The Beat"));
  preview.hidden = false;
});
document.querySelector("[data-live-close-preview]")?.addEventListener("click", closePreview);
