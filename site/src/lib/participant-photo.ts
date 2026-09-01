import type { ParticipantPhoto } from "./registration";

export const PARTICIPANT_PHOTO_MAX_BYTES = 1_500_000;
const PARTICIPANT_PHOTO_MAX_DIMENSION = 1600;

const canvasBlob = (canvas: HTMLCanvasElement, quality: number) => new Promise<Blob>((resolve, reject) => {
  canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("No se pudo procesar la fotografía.")), "image/jpeg", quality);
});

const blobBase64 = async (blob: Blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
};

export const prepareParticipantPhoto = async (file: File): Promise<ParticipantPhoto> => {
  if (!file.type.startsWith("image/")) throw new Error("Selecciona un archivo de imagen válido.");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, PARTICIPANT_PHOTO_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Tu navegador no pudo procesar la fotografía.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    let output: Blob | undefined;
    for (const quality of [0.84, 0.72, 0.6, 0.5]) {
      output = await canvasBlob(canvas, quality);
      if (output.size <= PARTICIPANT_PHOTO_MAX_BYTES) break;
    }
    if (!output || output.size > PARTICIPANT_PHOTO_MAX_BYTES) {
      throw new Error("La fotografía sigue siendo demasiado pesada. Elige otra imagen.");
    }
    return { mimeType: "image/jpeg", base64: await blobBase64(output) };
  } finally {
    bitmap.close();
  }
};
