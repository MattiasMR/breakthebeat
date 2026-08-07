import QRCode from "qrcode";

const QR_SIZE = 720;

export const buildParticipantQrPayload = (qrToken: string) => `BTB26:${qrToken}`;

export const participantQrFilename = (participantCode: string) => `QR-${participantCode}.png`;

export const createParticipantQrDataUrl = (qrPayload: string) => QRCode.toDataURL(qrPayload, {
  width: QR_SIZE,
  margin: 2,
  errorCorrectionLevel: "M"
});

export const buildLabeledParticipantQr = async (
  qrSource: string,
  name: string,
  categories: string,
  participantCode: string
) => {
  await document.fonts.ready;
  const qrImage = new Image();
  qrImage.src = qrSource;
  await qrImage.decode();

  const canvas = document.createElement("canvas");
  canvas.width = 780;
  canvas.height = 940;
  const context = canvas.getContext("2d");
  if (!context) return qrSource;

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#080808";
  context.textAlign = "center";
  context.font = "700 38px Poppins, sans-serif";
  context.fillText(name, canvas.width / 2, 48);
  context.font = "24px Poppins, sans-serif";
  context.fillText(categories, canvas.width / 2, 84);
  context.drawImage(qrImage, 30, 120, QR_SIZE, QR_SIZE);
  context.font = "22px ui-monospace, monospace";
  context.fillText(participantCode, canvas.width / 2, 900);
  return canvas.toDataURL("image/png");
};
