import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { categoryLabels, type Category } from "../lib/registration";
import { getSupabase, isBackendConfigured } from "../lib/supabase";

const video = document.querySelector<HTMLVideoElement>("[data-scanner-video]");
const startButton = document.querySelector<HTMLButtonElement>("[data-start-scanner]");
const stopButton = document.querySelector<HTMLButtonElement>("[data-stop-scanner]");
const status = document.querySelector<HTMLElement>("[data-scanner-status]");
const placeholder = document.querySelector<HTMLElement>("[data-scanner-placeholder]");
const resultPanel = document.querySelector<HTMLElement>("[data-checkin-result]");

if (!video || !startButton || !stopButton || !status || !resultPanel) throw new Error("Check-in markup is incomplete");

const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 250 });
const qrPayloadPattern = /^BTB26:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let controls: IScannerControls | undefined;
let processing = false;

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

const ensureBackend = () => {
  if (!isBackendConfigured()) {
    setStatus("Supabase no está configurado.", true);
    return false;
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
  if (processing || !ensureBackend()) return;
  const qrPayload = tokenOrCode.trim();
  if (!qrPayloadPattern.test(qrPayload)) {
    setStatus("Este código no es un QR válido de Break The Beat.", true);
    return;
  }
  processing = true;
  stopScanner();
  setStatus("Validando participante…");
  const { data, error } = await getSupabase().functions.invoke("check-in", { body: { tokenOrCode: qrPayload } });
  processing = false;
  if (error || !data) {
    const code = await errorCode(error);
    const messages: Record<string, string> = {
      PARTICIPANT_NOT_FOUND: "No encontramos un participante con ese QR o código.",
      PARTICIPANT_CANCELLED: "La inscripción de este participante está cancelada.",
      QR_REQUIRED: "Esta pantalla solo acepta el QR personal de Break The Beat."
    };
    setStatus(messages[code] ?? "No se pudo completar el check-in.", true);
    return;
  }
  setStatus(data.alreadyCheckedIn ? "QR válido, pero ya estaba registrado." : "Check-in guardado.");
  showResult(data);
};

const startScanner = async () => {
  if (!ensureBackend()) return;
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
    setStatus("No pudimos abrir la cámara. Revisa el permiso e inténtalo de nuevo.", true);
  }
};

startButton.addEventListener("click", () => void startScanner());
stopButton.addEventListener("click", stopScanner);
document.querySelector("[data-scan-next]")?.addEventListener("click", () => void startScanner());
window.addEventListener("pagehide", stopScanner);

ensureBackend();
