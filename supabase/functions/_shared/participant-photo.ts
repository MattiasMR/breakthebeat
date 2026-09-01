import type { SupabaseClient } from "npm:@supabase/supabase-js@^2";

export const PARTICIPANT_PHOTO_BUCKET = "participant-photos";
export const PARTICIPANT_PHOTO_MAX_BYTES = 1_500_000;

export type ParticipantPhotoPayload = {
  mimeType: "image/jpeg";
  base64: string;
};

export const decodeParticipantPhoto = (photo: ParticipantPhotoPayload) => {
  let binary: string;
  try {
    binary = atob(photo.base64);
  } catch {
    throw new Error("INVALID_PHOTO");
  }
  if (binary.length < 4 || binary.length > PARTICIPANT_PHOTO_MAX_BYTES) {
    throw new Error("INVALID_PHOTO");
  }
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    throw new Error("INVALID_PHOTO");
  }
  return bytes;
};

export const uploadParticipantPhoto = async (
  client: SupabaseClient,
  path: string,
  photo: ParticipantPhotoPayload
) => {
  const bytes = decodeParticipantPhoto(photo);
  const { error } = await client.storage
    .from(PARTICIPANT_PHOTO_BUCKET)
    .upload(path, bytes, {
      contentType: photo.mimeType,
      cacheControl: "3600",
      upsert: true
    });
  if (error) throw error;
};
