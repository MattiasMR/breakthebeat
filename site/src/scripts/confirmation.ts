import { categoryLabels, CONFIRMATION_STORAGE_KEY, type RegistrationConfirmation } from "../lib/registration";
import { buildLabeledParticipantQr, createParticipantQrDataUrl, participantQrFilename } from "../lib/participant-qr";

const shell = document.querySelector<HTMLElement>("[data-confirmation-shell]");
const empty = document.querySelector<HTMLElement>("[data-confirmation-empty]");
const grid = document.querySelector<HTMLElement>("[data-qr-grid]");
const registrationCode = document.querySelector<HTMLElement>("[data-registration-code]");
const downloadWarning = document.querySelector<HTMLElement>("[data-download-warning]");
const downloadAll = document.querySelector<HTMLButtonElement>("[data-download-all]");
const confirmationCopy = document.querySelector<HTMLElement>("[data-confirmation-copy]");

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
      context.font = "700 38px Poppins, sans-serif";
      context.fillText(card.querySelector("h2")?.textContent?.trim() ?? "Participante", center, 48);
      context.font = "24px Poppins, sans-serif";
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
  const isSingleParticipant = confirmation.participants.length === 1;
  if (registrationCode) registrationCode.textContent = confirmation.registrationCode;
  if (confirmationCopy) {
    confirmationCopy.textContent = isSingleParticipant
      ? "Descarga el código y preséntalo en el ingreso el día del evento. Este QR es personal."
      : "Descarga los códigos y preséntalos en el ingreso el día del evento. Cada participante tiene su propio QR.";
  }
  if (downloadWarning) {
    downloadWarning.textContent = isSingleParticipant
      ? "Importante: descarga y guarda tu QR ahora. No se enviará por correo y lo necesitarás para ingresar al evento. No lo pierdas."
      : "Importante: descarga y guarda tus QR ahora. No se enviarán por correo y los necesitarás para ingresar al evento. No los pierdas.";
  }
  if (downloadAll) downloadAll.textContent = isSingleParticipant ? "Descargar QR" : "Descargar QRS";

  void Promise.all(confirmation.participants.map(async (participant) => {
    const card = document.createElement("article");
    card.className = "qr-card";
    card.dataset.participantCode = participant.participantCode;
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
    image.src = await createParticipantQrDataUrl(participant.qrPayload);
    const code = document.createElement("strong");
    code.className = "qr-human-code";
    code.textContent = participant.participantCode;
    const download = document.createElement("a");
    download.className = "button button-primary";
    download.href = await buildLabeledParticipantQr(image.src, participant.displayName, categories.textContent ?? "", participant.participantCode);
    download.download = participantQrFilename(participant.participantCode);
    download.textContent = "Guardar QR";
    card.append(role, name, categories, image, code, download);
    return card;
  })).then((cards) => {
    grid.replaceChildren(...cards);
    if (downloadAll) downloadAll.disabled = false;
  });
}
