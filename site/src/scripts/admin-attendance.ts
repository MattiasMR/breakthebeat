import QRCode from "qrcode";
import { filterGuestAttendances, type GuestAttendance } from "../lib/guest-attendance";
import { EVENT_SLUG } from "../lib/registration";
import { getSupabase, isBackendConfigured, withClientBase } from "../lib/supabase";

const dashboard = document.querySelector<HTMLElement>("[data-guest-dashboard]");
const accessMessage = document.querySelector<HTMLElement>("[data-guest-access-message]");
const notice = document.querySelector<HTMLElement>("[data-guest-notice]");
const rowsContainer = document.querySelector<HTMLTableSectionElement>("[data-guest-rows]");

if (!dashboard || !accessMessage || !notice || !rowsContainer) throw new Error("Guest admin markup is incomplete");

let eventId = "";
let guests: GuestAttendance[] = [];
let filtered: GuestAttendance[] = [];

const attendanceUrl = new URL(withClientBase("/asistencia/"), window.location.origin).toString();

const setNotice = (message: string, tone: "info" | "success" | "error" = "info") => {
  notice.textContent = message;
  notice.className = `admin-notice is-${tone}`;
};

const renderRows = () => {
  const query = document.querySelector<HTMLInputElement>("[data-guest-filter]")?.value ?? "";
  const organization = document.querySelector<HTMLSelectElement>("[data-guest-organization-filter]")?.value ?? "all";
  filtered = filterGuestAttendances(guests, query).filter((guest) => organization === "all" || guest.organization === organization);
  const count = document.querySelector<HTMLElement>("[data-guest-filtered-count]");
  const stat = document.querySelector<HTMLElement>("[data-guest-stat]");
  const empty = document.querySelector<HTMLElement>("[data-guest-empty]");
  if (count) count.textContent = String(filtered.length);
  if (stat) stat.textContent = String(guests.length);
  if (empty) empty.hidden = filtered.length > 0;

  rowsContainer.replaceChildren(...filtered.map((guest) => {
    const row = document.createElement("tr");
    const values = [guest.firstName, guest.lastName, guest.organization ?? "—", new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Guayaquil" }).format(new Date(guest.confirmedAt))];
    values.forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    });
    const actions = document.createElement("td");
    actions.className = "row-actions";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "deactivate-action-button";
    remove.textContent = "Quitar invitado";
    remove.dataset.removeGuest = guest.id;
    remove.setAttribute("aria-label", `Quitar a ${guest.firstName} ${guest.lastName}`);
    actions.append(remove);
    row.append(actions);
    return row;
  }));
};

const loadGuests = async () => {
  setNotice("Actualizando lista de invitados…");
  const client = getSupabase();
  const { data: event, error: eventError } = await client.from("events").select("id").eq("slug", EVENT_SLUG).maybeSingle();
  if (eventError || !event) return setNotice("No pudimos identificar el evento actual.", "error");
  eventId = event.id;
  const { data, error } = await client
    .from("guest_attendances")
    .select("id, first_name, last_name, organization, confirmed_at, created_at")
    .eq("event_id", eventId)
    .order("confirmed_at", { ascending: false });
  if (error) return setNotice("No se pudo cargar la lista de invitados.", "error");
  guests = (data ?? []).map((guest) => ({
    id: guest.id,
    firstName: guest.first_name,
    lastName: guest.last_name,
    organization: guest.organization,
    confirmedAt: guest.confirmed_at,
    createdAt: guest.created_at
  }));
  renderRows();
  setNotice("Lista de invitados actualizada.", "success");
};

const verifyAdmin = async () => {
  if (!isBackendConfigured()) {
    accessMessage.querySelector("h1")!.textContent = "Supabase no está configurado.";
    return;
  }
  const client = getSupabase();
  const { data: sessionData } = await client.auth.getSession();
  if (!sessionData.session) return window.location.replace(withClientBase("/admin/"));
  const { data: admin, error } = await client.from("admin_users").select("username").eq("auth_user_id", sessionData.session.user.id).eq("active", true).maybeSingle();
  if (error || !admin) {
    await client.auth.signOut();
    return window.location.replace(withClientBase("/admin/"));
  }
  accessMessage.hidden = true;
  dashboard.hidden = false;
  document.querySelector<HTMLElement>("[data-guest-attendance-url]")!.textContent = attendanceUrl;
  await loadGuests();
};

document.querySelector("[data-guest-filter]")?.addEventListener("input", renderRows);
document.querySelector("[data-guest-organization-filter]")?.addEventListener("change", renderRows);
rowsContainer.addEventListener("click", async (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-remove-guest]");
  const guest = guests.find((item) => item.id === button?.dataset.removeGuest);
  if (!button || button.disabled || !guest || !eventId) return;
  if (!window.confirm(`¿Quitar a ${guest.firstName} ${guest.lastName} de la lista de invitados? Se eliminará su confirmación de asistencia. Esta acción no se puede deshacer.`)) return;
  button.disabled = true;
  button.textContent = "Quitando…";
  try {
    const { error } = await getSupabase().rpc("remove_guest_attendance", { p_event_id: eventId, p_guest_id: guest.id });
    if (error) throw error;
    guests = guests.filter((item) => item.id !== guest.id);
    renderRows();
    setNotice(`${guest.firstName} ${guest.lastName} fue quitado de la lista.`, "success");
  } catch {
    setNotice("No pudimos quitar al invitado. Actualiza la lista antes de volver a intentarlo.", "error");
  } finally {
    button.disabled = false;
    button.textContent = "Quitar invitado";
  }
});

document.querySelector<HTMLButtonElement>("[data-export-guests]")?.addEventListener("click", async (event) => {
  const button = event.currentTarget as HTMLButtonElement;
  button.disabled = true;
  const rows = [...filtered];
  try {
    const { downloadGuestWorkbook } = await import("../lib/admin-workbook");
    await downloadGuestWorkbook(`break-the-beat-invitados-${new Date().toISOString().slice(0, 10)}.xlsx`, rows);
    setNotice("Excel de invitados descargado.", "success");
    if (eventId) {
      const { error } = await getSupabase().rpc("log_admin_action", { p_action: "export_guest_attendance_xlsx", p_target_type: "event", p_target_id: eventId, p_metadata: { rows: rows.length } });
      if (error) setNotice("Excel descargado, pero no se pudo registrar la exportación en la auditoría.", "error");
    }
  } catch {
    setNotice("No pudimos completar la exportación de invitados.", "error");
  } finally {
    button.disabled = false;
  }
});
document.querySelector("[data-copy-guest-url]")?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(attendanceUrl);
    setNotice("Enlace de asistencia copiado.", "success");
  } catch {
    setNotice("No pudimos copiar el enlace. Puedes seleccionarlo y copiarlo manualmente.", "error");
  }
});
document.querySelector("[data-download-guest-qr]")?.addEventListener("click", async () => {
  try {
    const dataUrl = await QRCode.toDataURL(attendanceUrl, { width: 900, margin: 2, errorCorrectionLevel: "M" });
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = "QR-asistencia-break-the-beat-2026.png";
    link.click();
    setNotice("QR general descargado.", "success");
  } catch {
    setNotice("No pudimos generar el QR general.", "error");
  }
});

void verifyAdmin();
