import QRCode from "qrcode";
import { categoryLabels, CONFIRMATION_STORAGE_KEY, type RegistrationConfirmation } from "../lib/registration";

const shell = document.querySelector<HTMLElement>("[data-confirmation-shell]");
const empty = document.querySelector<HTMLElement>("[data-confirmation-empty]");
const grid = document.querySelector<HTMLElement>("[data-qr-grid]");
const registrationCode = document.querySelector<HTMLElement>("[data-registration-code]");
const emailStatus = document.querySelector<HTMLElement>("[data-email-status]");
const downloadAll = document.querySelector<HTMLButtonElement>("[data-download-all]");

downloadAll?.addEventListener("click", async () => {
  const cards = Array.from(document.querySelectorAll<HTMLElement>(".qr-card"));
  if (!cards.length) return;

  downloadAll.disabled = true;
  try {
    const images = cards.map((card) => card.querySelector<HTMLImageElement>("img")).filter((image): image is HTMLImageElement => Boolean(image));
    await Promise.all(images.map((image) => image.complete
      ? Promise.resolve()
      : new Promise<void>((resolve, reject) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => reject(new Error("No se pudo preparar uno de los QR.")), { once: true });
        })));

    const cardWidth = 780;
    const qrSize = 720;
    const headerHeight = 120;
    const footerHeight = 68;
    const gap = 24;
    const canvas = document.createElement("canvas");
    canvas.width = (cardWidth * cards.length) + (gap * Math.max(0, cards.length - 1));
    canvas.height = headerHeight + qrSize + footerHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("El navegador no pudo preparar la descarga.");

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.textAlign = "center";
    context.fillStyle = "#080808";

    cards.forEach((card, index) => {
      const left = index * (cardWidth + gap);
      const center = left + (cardWidth / 2);
      context.font = "700 38px Inter, sans-serif";
      context.fillText(card.querySelector("h2")?.textContent?.trim() ?? "Participante", center, 48);
      context.font = "24px Inter, sans-serif";
      context.fillText(card.querySelector("p")?.textContent?.trim() ?? "", center, 84);
      context.drawImage(images[index], left + 30, headerHeight, qrSize, qrSize);
      context.font = "22px ui-monospace, monospace";
      context.fillText(card.querySelector(".qr-human-code")?.textContent?.trim() ?? "", center, canvas.height - 24);
    });

    const download = document.createElement("a");
    download.href = canvas.toDataURL("image/png");
    download.download = `QR-${registrationCode?.textContent?.trim() || "Break-The-Beat"}.png`;
    download.click();
  } finally {
    downloadAll.disabled = false;
  }
});

const raw = sessionStorage.getItem(CONFIRMATION_STORAGE_KEY);
let confirmation: RegistrationConfirmation | null = null;
try {
  confirmation = raw ? JSON.parse(raw) as RegistrationConfirmation : null;
} catch {
  confirmation = null;
}

if (!confirmation || !shell || !grid) {
  if (empty) empty.hidden = false;
} else {
  shell.hidden = false;
  if (registrationCode) registrationCode.textContent = confirmation.registrationCode;
  if (emailStatus) {
    const messages = {
      pending: "La inscripción ya se guardó. El correo se procesará en segundo plano; guarda los QR que aparecen aquí.",
      sent: "Enviamos cada QR a su correo correspondiente.",
      partial: "La inscripción se guardó, pero uno de los correos no pudo entregarse. El equipo puede reenviarlo desde el panel.",
      failed: "La inscripción se guardó, pero el correo no pudo enviarse. Descarga los QR ahora o solicita un reenvío al equipo."
    };
    emailStatus.textContent = messages[confirmation.emailStatus];
    emailStatus.classList.add(`is-${confirmation.emailStatus}`);
  }

  void Promise.all(confirmation.participants.map(async (participant) => {
    const card = document.createElement("article");
    card.className = "qr-card";
    const role = document.createElement("span");
    role.className = "qr-card-label";
    role.textContent = "Acreditación individual";
    const name = document.createElement("h2");
    name.textContent = participant.displayName;
    const categories = document.createElement("p");
    categories.textContent = participant.categories.map((category) => categoryLabels[category]).join(" · ");
    const image = document.createElement("img");
    image.width = 360;
    image.height = 360;
    image.alt = `QR de ingreso de ${participant.displayName}`;
    image.src = await QRCode.toDataURL(participant.qrPayload, { width: 720, margin: 2, errorCorrectionLevel: "M" });
    const code = document.createElement("strong");
    code.className = "qr-human-code";
    code.textContent = participant.participantCode;
    const download = document.createElement("a");
    download.className = "button button-primary";
    download.href = image.src;
    download.download = `QR-${participant.participantCode}.png`;
    download.textContent = "Guardar QR";
    card.append(role, name, categories, image, code, download);
    grid.append(card);
  })).then(() => {
    if (downloadAll) downloadAll.disabled = false;
  });
}
