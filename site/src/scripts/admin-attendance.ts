import QRCode from "qrcode";
import { filterGuestAttendances, guestAttendanceCsv, type GuestAttendance } from "../lib/guest-attendance";
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

const downloadCsv = (filename: string, content: string) => {
  const blob = new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
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
    return row;
  }));
};

const renderOrganizationFilter = () => {
  const select = document.querySelector<HTMLSelectElement>("[data-guest-organization-filter]");
  if (!select) return;
  const selected = select.value;
  const organizations = [...new Set(guests.map((guest) => guest.organization).filter((value): value is string => Boolean(value)))].sort((left, right) => left.localeCompare(right, "es"));
  select.replaceChildren();
  const all = document.createElement("option");
  all.value = "all";
  all.textContent = "Todas";
  select.append(all);
  organizations.forEach((organization) => {
    const option = document.createElement("option");
    option.value = organization;
    option.textContent = organization;
    select.append(option);
  });
  select.value = organizations.includes(selected) ? selected : "all";
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
  renderOrganizationFilter();
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
document.querySelector("[data-export-guests]")?.addEventListener("click", async () => {
  downloadCsv(`break-the-beat-invitados-${new Date().toISOString().slice(0, 10)}.csv`, guestAttendanceCsv(filtered));
  if (eventId) await getSupabase().rpc("log_admin_action", { p_action: "export_guest_attendance_csv", p_target_type: "event", p_target_id: eventId, p_metadata: { rows: filtered.length } });
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
