import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { categoryLabels, type Category } from "../lib/registration";
import { getSupabase, isBackendConfigured, withClientBase } from "../lib/supabase";

const video = document.querySelector<HTMLVideoElement>("[data-scanner-video]");
const startButton = document.querySelector<HTMLButtonElement>("[data-start-scanner]");
const stopButton = document.querySelector<HTMLButtonElement>("[data-stop-scanner]");
const status = document.querySelector<HTMLElement>("[data-scanner-status]");
const placeholder = document.querySelector<HTMLElement>("[data-scanner-placeholder]");
const manualForm = document.querySelector<HTMLFormElement>("[data-manual-checkin]");
const resultPanel = document.querySelector<HTMLElement>("[data-checkin-result]");

if (!video || !startButton || !stopButton || !status || !manualForm || !resultPanel) throw new Error("Check-in markup is incomplete");

const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 250 });
let controls: IScannerControls | undefined;
let processing = false;
let inactivityTimer: number | undefined;
let adminVerified = false;

const resetInactivity = () => {
  window.clearTimeout(inactivityTimer);
  inactivityTimer = window.setTimeout(async () => {
    stopScanner();
    if (isBackendConfigured()) await getSupabase().auth.signOut();
    window.location.replace(withClientBase("/admin/"));
  }, 30 * 60 * 1000);
};

const setStatus = (message: string, error = false) => {
  status.textContent = message;
  status.classList.toggle("is-error", error);
};

const stopScanner = () => {
  controls?.stop();
  controls = undefined;
  video.srcObject = null;
  startButton.disabled = false;
  stopButton.disabled = true;
  if (placeholder) placeholder.hidden = false;
};

const ensureSession = async () => {
  if (!isBackendConfigured()) {
    setStatus("Supabase no está configurado.", true);
    return false;
  }
  const client = getSupabase();
  const { data } = await client.auth.getSession();
  if (!data.session) {
    window.location.replace(withClientBase("/admin/"));
    return false;
  }
  if (!adminVerified) {
    const { data: admin } = await client.from("admin_users").select("auth_user_id").eq("auth_user_id", data.session.user.id).eq("active", true).maybeSingle();
    if (!admin) {
      await client.auth.signOut();
      window.location.replace(withClientBase("/admin/"));
      return false;
    }
    adminVerified = true;
  }
  return true;
};

const showResult = (data: any) => {
  resultPanel.hidden = false;
  const label = resultPanel.querySelector<HTMLElement>("[data-result-label]");
  const name = resultPanel.querySelector<HTMLElement>("[data-result-name]");
  const code = resultPanel.querySelector<HTMLElement>("[data-result-code]");
  const categories = resultPanel.querySelector<HTMLElement>("[data-result-categories]");
  const time = resultPanel.querySelector<HTMLElement>("[data-result-time]");
  if (label) label.textContent = data.alreadyCheckedIn ? "Este QR ya había sido registrado" : "Ingreso confirmado";
  if (name) name.textContent = data.displayName;
  if (code) code.textContent = data.participantCode;
  if (categories) categories.textContent = (data.categories as Category[]).map((category) => categoryLabels[category]).join(" · ");
  if (time) {
    const formatted = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "medium", timeZone: "America/Guayaquil" }).format(new Date(data.checkedInAt));
    time.textContent = `${formatted} · registrado por ${data.checkedInBy}`;
  }
  resultPanel.classList.toggle("is-repeat", data.alreadyCheckedIn);
};

const errorCode = async (error: unknown) => {
  const context = (error as { context?: Response } | null)?.context;
  if (!context) return "UNKNOWN";
  try { return ((await context.clone().json()) as { error?: string }).error ?? "UNKNOWN"; } catch { return "UNKNOWN"; }
};

const checkIn = async (tokenOrCode: string) => {
  if (processing || !(await ensureSession())) return;
  resetInactivity();
  processing = true;
  setStatus("Validando participante…");
  const { data, error } = await getSupabase().functions.invoke("check-in", { body: { tokenOrCode } });
  processing = false;
  if (error || !data) {
    const code = await errorCode(error);
    const messages: Record<string, string> = {
      PARTICIPANT_NOT_FOUND: "No encontramos un participante con ese QR o código.",
      PARTICIPANT_CANCELLED: "La inscripción de este participante está cancelada.",
      NOT_AUTHORIZED: "La sesión expiró. Vuelve a iniciar sesión."
    };
    setStatus(messages[code] ?? "No se pudo completar el check-in.", true);
    if (code === "NOT_AUTHORIZED") window.location.replace(withClientBase("/admin/"));
    return;
  }
  stopScanner();
  setStatus(data.alreadyCheckedIn ? "QR válido, pero ya estaba registrado." : "Check-in guardado.");
  showResult(data);
};

const startScanner = async () => {
  if (!(await ensureSession())) return;
  resultPanel.hidden = true;
  setStatus("Solicitando acceso a la cámara…");
  startButton.disabled = true;
  try {
    controls = await reader.decodeFromConstraints(
      { audio: false, video: { facingMode: { ideal: "environment" } } },
      video,
      (scanResult) => {
        if (scanResult && !processing) void checkIn(scanResult.getText());
      }
    );
    stopButton.disabled = false;
    if (placeholder) placeholder.hidden = true;
    setStatus("Cámara activa. Centra el QR dentro del marco.");
  } catch {
    startButton.disabled = false;
    setStatus("No pudimos abrir la cámara. Revisa el permiso o usa el código manual.", true);
  }
};

startButton.addEventListener("click", () => void startScanner());
stopButton.addEventListener("click", stopScanner);
['pointerdown', 'keydown', 'touchstart'].forEach((name) => window.addEventListener(name, resetInactivity, { passive: true }));
document.querySelector("[data-scan-next]")?.addEventListener("click", () => void startScanner());
manualForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const code = String(new FormData(manualForm).get("code") ?? "").trim();
  if (code) void checkIn(code);
});
window.addEventListener("pagehide", () => {
  window.clearTimeout(inactivityTimer);
  stopScanner();
});

resetInactivity();
void ensureSession();
