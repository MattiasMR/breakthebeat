import {
  calculateStats,
  downloadCsv,
  filterParticipants,
  operationalCsv,
  type AdminFilters,
  type AdminParticipant
} from "../lib/admin";
import {
  buildLabeledParticipantQr,
  buildParticipantQrPayload,
  createParticipantQrDataUrl,
  participantQrFilename
} from "../lib/participant-qr";
import { categoryLabels, EVENT_SLUG } from "../lib/registration";
import { backendConfiguration, getSupabase, isBackendConfigured } from "../lib/supabase";

declare global {
  interface Window {
    turnstile?: { reset: () => void };
  }
}

const loginShell = document.querySelector<HTMLElement>("[data-login-shell]");
const loginForm = document.querySelector<HTMLFormElement>("[data-login-form]");
const loginAlert = document.querySelector<HTMLElement>("[data-login-alert]");
const dashboard = document.querySelector<HTMLElement>("[data-dashboard]");
const rowsContainer = document.querySelector<HTMLTableSectionElement>("[data-participant-rows]");
const dialog = document.querySelector<HTMLDialogElement>("[data-participant-dialog]");
const detail = document.querySelector<HTMLElement>("[data-participant-detail]");

if (!loginShell || !loginForm || !dashboard || !rowsContainer) throw new Error("Admin markup is incomplete");

let participants: AdminParticipant[] = [];
let filtered: AdminParticipant[] = [];
let selected = new Set<string>();
let eventState: { id: string; registration_open: boolean; legal_ready: boolean } | null = null;
let inactivityTimer: number | undefined;

const filters: AdminFilters = {
  query: "",
  category: "all",
  status: "all",
  checkIn: "all"
};

const relationOne = <T>(value: T | T[] | null | undefined): T | null => Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

const setLoginAlert = (message = "") => {
  if (!loginAlert) return;
  loginAlert.textContent = message;
  loginAlert.hidden = !message;
};

const setNotice = (message: string, tone: "info" | "success" | "error" = "info") => {
  const notice = document.querySelector<HTMLElement>("[data-admin-notice]");
  if (!notice) return;
  notice.textContent = message;
  notice.className = `admin-notice is-${tone}`;
};

const sessionLogout = async (message?: string) => {
  if (isBackendConfigured()) await getSupabase().auth.signOut();
  window.clearTimeout(inactivityTimer);
  dashboard.hidden = true;
  loginShell.hidden = false;
  if (message) setLoginAlert(message);
};

const resetInactivity = () => {
  if (dashboard.hidden) return;
  window.clearTimeout(inactivityTimer);
  inactivityTimer = window.setTimeout(() => void sessionLogout("La sesión se cerró por inactividad."), 30 * 60 * 1000);
};

const normalizeRows = (data: any[]): AdminParticipant[] => data.map((item) => {
  const registration = relationOne<any>(item.registrations);
  const checkIn = relationOne<any>(item.check_ins);
  return {
    id: item.id,
    registrationId: item.registration_id,
    registrationCode: registration?.public_code ?? "",
    participantCode: item.participant_code,
    qrToken: item.qr_token,
    role: item.role,
    displayName: item.display_name,
    email: item.email,
    phone: item.phone,
    socialUrl: item.social_url,
    age: item.age,
    categories: (item.participant_categories ?? []).map((entry: any) => entry.category),
    status: registration?.status ?? "confirmed",
    createdAt: registration?.created_at ?? item.created_at,
    checkedInAt: checkIn?.checked_in_at ?? null
  };
});

const renderDistribution = (containerSelector: string, entries: Array<[string, number]>) => {
  const container = document.querySelector<HTMLElement>(containerSelector);
  if (!container) return;
  container.replaceChildren(...entries.map(([label, value]) => {
    const row = document.createElement("div");
    const name = document.createElement("span");
    name.textContent = label;
    const count = document.createElement("strong");
    count.textContent = String(value);
    row.append(name, count);
    return row;
  }));
};

const renderStats = () => {
  const stats = calculateStats(participants);
  Object.entries(stats).forEach(([key, value]) => {
    if (typeof value !== "number") return;
    const node = document.querySelector<HTMLElement>(`[data-stat="${key}"]`);
    if (node) node.textContent = String(value);
  });
  renderDistribution("[data-category-stats]", [
    ["1 vs 1", stats.categories["1v1"]],
    ["2 vs 2", stats.categories["2v2"]],
    ["BGirls", stats.categories.bgirls]
  ]);
};

const chip = (text: string, className = "") => {
  const element = document.createElement("span");
  element.className = `data-chip ${className}`.trim();
  element.textContent = text;
  return element;
};

const renderRows = () => {
  filtered = filterParticipants(participants, filters).sort((left, right) => {
    const byDate = new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    if (left.registrationId !== right.registrationId) return byDate;
    return left.role === right.role ? 0 : left.role === "captain" ? -1 : 1;
  });
  const count = document.querySelector<HTMLElement>("[data-filtered-count]");
  if (count) count.textContent = String(filtered.length);
  const empty = document.querySelector<HTMLElement>("[data-table-empty]");
  if (empty) empty.hidden = filtered.length > 0;

  rowsContainer.replaceChildren(...filtered.map((row, index) => {
    const tr = document.createElement("tr");
    if (row.status === "cancelled") tr.classList.add("is-cancelled");
    if (row.categories.includes("2v2")) {
      tr.classList.add("is-duo-row");
      if (filtered[index - 1]?.registrationId !== row.registrationId) tr.classList.add("is-duo-start");
      if (filtered[index + 1]?.registrationId !== row.registrationId) tr.classList.add("is-duo-end");
    }

    const selectCell = document.createElement("td");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.ariaLabel = `Seleccionar ${row.displayName}`;
    checkbox.checked = selected.has(row.id);
    checkbox.dataset.selectParticipant = row.id;
    selectCell.append(checkbox);

    const personCell = document.createElement("td");
    const name = document.createElement("strong");
    name.textContent = row.displayName;
    const code = document.createElement("small");
    code.textContent = `Inscripción: ${row.registrationCode} · ${row.role === "captain" ? "Principal" : "Compañero"}`;
    const email = document.createElement("small");
    email.textContent = `Participante: ${row.participantCode} · ${row.email}`;
    personCell.append(name, code, email);

    const categoryCell = document.createElement("td");
    row.categories.forEach((category) => categoryCell.append(chip(categoryLabels[category])));

    const statusCell = document.createElement("td");
    statusCell.append(chip(row.status === "cancelled" ? "Cancelado" : "Confirmado", row.status));
    statusCell.append(chip(row.checkedInAt ? "Ingresó" : "Sin check-in", row.checkedInAt ? "checked" : ""));

    const actionCell = document.createElement("td");
    actionCell.className = "row-actions";
    const detailsButton = document.createElement("button");
    detailsButton.type = "button";
    detailsButton.textContent = "Ver";
    detailsButton.dataset.viewParticipant = row.id;
    const checkInButton = document.createElement("button");
    checkInButton.type = "button";
    checkInButton.textContent = "Check-in";
    checkInButton.dataset.manualCheckin = row.participantCode;
    checkInButton.dataset.participantName = row.displayName;
    checkInButton.disabled = Boolean(row.checkedInAt) || row.status === "cancelled";
    if (row.checkedInAt) checkInButton.title = "Este participante ya hizo check-in";
    if (row.status === "cancelled") checkInButton.title = "La inscripción está cancelada";
    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.textContent = row.status === "cancelled" ? "Reactivar" : "Cancelar";
    cancelButton.dataset.toggleRegistration = row.registrationId;
    cancelButton.dataset.nextStatus = row.status === "cancelled" ? "confirmed" : "cancelled";
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "Eliminar";
    deleteButton.dataset.deleteRegistration = row.registrationId;
    deleteButton.dataset.registrationCode = row.registrationCode;
    const qrButton = document.createElement("button");
    qrButton.type = "button";
    qrButton.textContent = "Generar QR";
    qrButton.dataset.generateQr = row.id;
    qrButton.className = "qr-action-button";
    actionCell.append(detailsButton, checkInButton, cancelButton, deleteButton, qrButton);

    tr.append(selectCell, personCell, categoryCell, statusCell, actionCell);
    return tr;
  }));

  const deleteButton = document.querySelector<HTMLButtonElement>("[data-delete-selected]");
  if (deleteButton) deleteButton.disabled = selected.size === 0;
};

const applyFilters = () => {
  document.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-filter]").forEach((control) => {
    const key = control.dataset.filter as keyof AdminFilters;
    (filters as Record<string, string>)[key] = control.value;
  });
  renderRows();
};

const loadRows = async () => {
  setNotice("Actualizando inscripciones…");
  const { data, error } = await getSupabase()
    .from("participants")
    .select(`
      id, registration_id, participant_code, qr_token, role, display_name, social_url,
      age, phone, email, created_at,
      registrations!inner(id, public_code, status, created_at),
      participant_categories(category),
      check_ins(checked_in_at)
    `)
    .order("created_at", { ascending: false });
  if (error) {
    setNotice("No se pudieron cargar las inscripciones.", "error");
    return;
  }
  participants = normalizeRows(data ?? []);
  selected.clear();
  renderStats();
  renderRows();
  const oldRecords = participants.filter((row) => Date.now() - new Date(row.createdAt).getTime() > 365 * 86400000).length;
  setNotice(oldRecords ? `${oldRecords} registros tienen más de un año. Revisa si todavía deben conservarse.` : "Datos actualizados.", oldRecords ? "info" : "success");
};

const renderEventState = () => {
  const label = document.querySelector<HTMLElement>("[data-event-state]");
  const button = document.querySelector<HTMLButtonElement>("[data-toggle-registration]");
  if (!label || !button || !eventState) return;
  label.textContent = eventState.registration_open ? "Inscripciones abiertas" : "Inscripciones cerradas";
  button.textContent = eventState.registration_open ? "Cerrar inscripciones" : "Abrir inscripciones";
  button.disabled = false;
};

const loadEventState = async () => {
  const { data } = await getSupabase().from("events").select("id, registration_open, legal_ready").eq("slug", EVENT_SLUG).maybeSingle();
  eventState = data;
  renderEventState();
};

const showDashboard = async (username: string) => {
  loginShell.hidden = true;
  dashboard.hidden = false;
  const usernameNode = document.querySelector<HTMLElement>("[data-admin-username]");
  if (usernameNode) usernameNode.textContent = username;
  resetInactivity();
  await Promise.all([loadRows(), loadEventState()]);
};

const restoreSession = async () => {
  if (!isBackendConfigured()) {
    setLoginAlert("Falta configurar Supabase en este despliegue.");
    return;
  }
  const client = getSupabase();
  const { data: sessionData } = await client.auth.getSession();
  if (!sessionData.session) return;
  const { data: admins, error } = await client.from("admin_users").select("username").eq("auth_user_id", sessionData.session.user.id).eq("active", true).maybeSingle();
  if (error || !admins) {
    await client.auth.signOut();
    return;
  }
  await showDashboard(admins.username);
};

const invokeErrorCode = async (error: unknown) => {
  const context = (error as { context?: Response } | null)?.context;
  if (!context) return "UNKNOWN";
  try { return ((await context.clone().json()) as { error?: string }).error ?? "UNKNOWN"; } catch { return "UNKNOWN"; }
};

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!isBackendConfigured()) return setLoginAlert("Falta configurar Supabase.");
  const data = new FormData(loginForm);
  const token = String(data.get("cf-turnstile-response") ?? "") || (backendConfiguration.testMode ? "test-ok" : "");
  const button = loginForm.querySelector<HTMLButtonElement>("[data-login-submit]");
  button?.setAttribute("disabled", "true");
  setLoginAlert();
  const { data: response, error } = await getSupabase().functions.invoke("admin-login", {
    body: { username: data.get("username"), password: data.get("password"), turnstileToken: token }
  });
  if (error || !response) {
    const code = await invokeErrorCode(error);
    setLoginAlert(code === "TURNSTILE_FAILED" ? "La verificación humana expiró." : "Usuario o contraseña incorrectos.");
    window.turnstile?.reset();
    button?.removeAttribute("disabled");
    return;
  }
  const { error: sessionError } = await getSupabase().auth.setSession({ access_token: response.accessToken, refresh_token: response.refreshToken });
  button?.removeAttribute("disabled");
  if (sessionError) return setLoginAlert("No se pudo iniciar la sesión.");
  loginForm.reset();
  await showDashboard(response.username);
});

document.querySelector("[data-logout]")?.addEventListener("click", () => void sessionLogout());
document.querySelector("[data-dialog-close]")?.addEventListener("click", () => dialog?.close());
["pointerdown", "keydown", "touchstart"].forEach((name) => window.addEventListener(name, resetInactivity, { passive: true }));
document.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-filter]").forEach((control) => control.addEventListener("input", applyFilters));

rowsContainer.addEventListener("change", (event) => {
  const checkbox = (event.target as HTMLElement).closest<HTMLInputElement>("[data-select-participant]");
  if (!checkbox) return;
  checkbox.checked ? selected.add(checkbox.dataset.selectParticipant ?? "") : selected.delete(checkbox.dataset.selectParticipant ?? "");
  renderRows();
});

rowsContainer.addEventListener("click", async (event) => {
  const target = event.target as HTMLElement;
  const view = target.closest<HTMLButtonElement>("[data-view-participant]");
  const manualCheckInButton = target.closest<HTMLButtonElement>("[data-manual-checkin]");
  const toggle = target.closest<HTMLButtonElement>("[data-toggle-registration]");
  const remove = target.closest<HTMLButtonElement>("[data-delete-registration]");
  const generateQrButton = target.closest<HTMLButtonElement>("[data-generate-qr]");
  if (view) await openParticipantDetail(view.dataset.viewParticipant ?? "");
  if (manualCheckInButton) {
    await manualCheckIn(
      manualCheckInButton.dataset.manualCheckin ?? "",
      manualCheckInButton.dataset.participantName ?? "este participante"
    );
  }
  if (toggle) await toggleRegistrationStatus(toggle.dataset.toggleRegistration ?? "", toggle.dataset.nextStatus as "confirmed" | "cancelled");
  if (remove) await deleteRegistrations([remove.dataset.deleteRegistration ?? ""], remove.dataset.registrationCode ?? "esta inscripción");
  if (generateQrButton) await generateParticipantQr(generateQrButton.dataset.generateQr ?? "", generateQrButton);
});

const openParticipantDetail = async (participantId: string) => {
  const row = participants.find((item) => item.id === participantId);
  if (!row || !dialog || !detail) return;
  detail.textContent = "Cargando información protegida…";
  dialog.showModal();
  const { data: emergency } = await getSupabase()
    .from("emergency_contacts")
    .select("relationship, full_name, phone")
    .eq("participant_id", participantId)
    .maybeSingle();
  await getSupabase().rpc("log_admin_action", { p_action: "view_emergency_contact", p_target_type: "participant", p_target_id: participantId, p_metadata: {} });

  detail.replaceChildren();
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = row.participantCode;
  const heading = document.createElement("h2");
  heading.textContent = row.displayName;
  const sensitive = document.createElement("div");
  sensitive.className = "sensitive-detail";
  const entries: Array<[string, string]> = [
    ["Contacto de emergencia", emergency ? `${emergency.full_name} (${emergency.relationship}) · ${emergency.phone}` : "Sin información"]
  ];
  const partner = row.role === "captain"
    ? participants.find((participant) => participant.registrationId === row.registrationId && participant.role === "partner")
    : null;
  if (partner) entries.push(["Compañero registrado", `${partner.displayName} · ${partner.participantCode}`]);
  entries.forEach(([label, value]) => {
    const item = document.createElement("div");
    const strong = document.createElement("strong");
    strong.textContent = label;
    const span = document.createElement("span");
    span.textContent = value;
    item.append(strong, span);
    sensitive.append(item);
  });
  detail.append(eyebrow, heading, sensitive);
};

const manualCheckIn = async (participantCode: string, displayName: string) => {
  if (!participantCode || !window.confirm(`¿Confirmar el check-in manual de ${displayName}?`)) return;
  setNotice(`Registrando check-in de ${displayName}…`);
  const { data, error } = await getSupabase().functions.invoke("check-in", { body: { tokenOrCode: participantCode } });
  if (error || !data) {
    const code = await invokeErrorCode(error);
    const message = code === "PARTICIPANT_CANCELLED"
      ? "La inscripción está cancelada. Reactívala antes del check-in."
      : code === "PARTICIPANT_NOT_FOUND"
        ? "No se encontró al participante."
        : "No se pudo completar el check-in manual.";
    return setNotice(message, "error");
  }
  setNotice(data.alreadyCheckedIn ? `${displayName} ya tenía check-in.` : `Check-in manual registrado para ${displayName}.`, "success");
  await loadRows();
};

const toggleRegistrationStatus = async (registrationId: string, status: "confirmed" | "cancelled") => {
  const { error } = await getSupabase().from("registrations").update({ status }).eq("id", registrationId);
  if (error) return setNotice("No se pudo cambiar el estado.", "error");
  await loadRows();
};

const generateParticipantQr = async (participantId: string, button: HTMLButtonElement) => {
  const row = participants.find((participant) => participant.id === participantId);
  if (!row?.qrToken) return setNotice("No se encontró el token QR de este participante.", "error");

  button.disabled = true;
  setNotice(`Generando el QR de ${row.displayName}…`);
  try {
    const qrSource = await createParticipantQrDataUrl(buildParticipantQrPayload(row.qrToken));
    const categories = row.categories.map((category) => categoryLabels[category]).join(" · ");
    const href = await buildLabeledParticipantQr(qrSource, row.displayName, categories, row.participantCode);
    const download = document.createElement("a");
    download.href = href;
    download.download = participantQrFilename(row.participantCode);
    download.click();
    await getSupabase().rpc("log_admin_action", {
      p_action: "generate_participant_qr",
      p_target_type: "participant",
      p_target_id: row.id,
      p_metadata: { participant_code: row.participantCode }
    });
    setNotice(`QR de ${row.displayName} descargado.`, "success");
  } catch {
    setNotice("No se pudo generar el QR. Intenta nuevamente.", "error");
  } finally {
    button.disabled = false;
  }
};

document.querySelector("[data-toggle-registration]")?.addEventListener("click", async () => {
  if (!eventState) return;
  const next = !eventState.registration_open;
  const { error } = await getSupabase().from("events").update({ registration_open: next }).eq("id", eventState.id);
  if (error) return setNotice("No se pudo cambiar el estado del formulario.", "error");
  eventState.registration_open = next;
  await getSupabase().rpc("log_admin_action", {
    p_action: next ? "open_registration" : "close_registration",
    p_target_type: "event",
    p_target_id: eventState.id,
    p_metadata: {}
  });
  renderEventState();
  setNotice(next ? "Inscripciones abiertas." : "Inscripciones cerradas.", "success");
});

document.querySelector("[data-export]")?.addEventListener("click", async () => {
  downloadCsv(`break-the-beat-participantes-${new Date().toISOString().slice(0, 10)}.csv`, operationalCsv(filtered));
  await getSupabase().rpc("log_admin_action", { p_action: "export_operational_csv", p_target_type: "event", p_target_id: eventState?.id, p_metadata: { rows: filtered.length } });
});

const csvCell = (value: unknown) => {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};

document.querySelector("[data-export-emergency]")?.addEventListener("click", async () => {
  if (!window.confirm("Este archivo contiene información médica y de emergencia. ¿Confirmas que se usará únicamente para el evento?")) return;
  const ids = filtered.map((row) => row.id);
  if (!ids.length) return;
  const [{ data: medical }, { data: contacts }] = await Promise.all([
    getSupabase().from("medical_profiles").select("*").in("participant_id", ids),
    getSupabase().from("emergency_contacts").select("*").in("participant_id", ids)
  ]);
  const medicalMap = new Map((medical ?? []).map((item) => [item.participant_id, item]));
  const contactMap = new Map((contacts ?? []).map((item) => [item.participant_id, item]));
  const header = ["Código", "Nombre", "Teléfono", "Condición", "Alergia medicamento", "Alergia alimento", "Medicación permanente", "Contacto emergencia", "Relación", "Teléfono emergencia"];
  const lines = filtered.map((row) => {
    const health = medicalMap.get(row.id);
    const contact = contactMap.get(row.id);
    return [row.participantCode, row.displayName, row.phone, health?.condition_detail, health?.medication_allergy_detail, health?.food_allergy_detail, health?.medication_detail, contact?.full_name, contact?.relationship, contact?.phone];
  });
  downloadCsv(`break-the-beat-emergencia-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...lines].map((line) => line.map(csvCell).join(",")).join("\r\n"));
  await getSupabase().rpc("log_admin_action", { p_action: "export_emergency_csv", p_target_type: "event", p_target_id: eventState?.id, p_metadata: { rows: filtered.length } });
});

const deleteRegistrations = async (registrationIds: string[], description: string) => {
  const uniqueIds = [...new Set(registrationIds.filter(Boolean))];
  if (!uniqueIds.length) return;
  if (window.prompt(`Se eliminará permanentemente ${description} y todos sus datos. Escribe ELIMINAR para confirmar.`) !== "ELIMINAR") return;
  const { error } = await getSupabase().from("registrations").delete().in("id", uniqueIds);
  if (error) return setNotice("No se pudieron eliminar los registros.", "error");
  setNotice("Registros eliminados permanentemente.", "success");
  await loadRows();
};

document.querySelector("[data-delete-selected]")?.addEventListener("click", async () => {
  const registrationIds = [...new Set(participants.filter((row) => selected.has(row.id)).map((row) => row.registrationId))];
  await deleteRegistrations(registrationIds, `${registrationIds.length} inscripciones seleccionadas`);
});

void restoreSession();
