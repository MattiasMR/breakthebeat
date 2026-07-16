import QRCode from "qrcode";
import { categoryLabels, CONFIRMATION_STORAGE_KEY, type RegistrationConfirmation } from "../lib/registration";

const shell = document.querySelector<HTMLElement>("[data-confirmation-shell]");
const empty = document.querySelector<HTMLElement>("[data-confirmation-empty]");
const grid = document.querySelector<HTMLElement>("[data-qr-grid]");
const registrationCode = document.querySelector<HTMLElement>("[data-registration-code]");
const emailStatus = document.querySelector<HTMLElement>("[data-email-status]");

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
  }));
}
