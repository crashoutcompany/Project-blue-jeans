import { getSql, requireSql } from "@/lib/db";
import { logServerError } from "@/lib/server/safe-client-error";

export type WearerPhoto = {
  imageUrl: string;
  uploadthingKey: string | null;
};

/** Current Wearer photo for an account, or null if unset / DB unavailable. */
export async function getWearerPhoto(
  userId: string,
): Promise<WearerPhoto | null> {
  const sql = getSql();
  if (!sql || !userId) return null;
  try {
    const rows = (await sql`
      SELECT image_url, uploadthing_key
      FROM wearer_profile
      WHERE user_id = ${userId}
      LIMIT 1
    `) as { image_url: string; uploadthing_key: string | null }[];
    const row = rows[0];
    if (!row?.image_url) return null;
    return {
      imageUrl: row.image_url,
      uploadthingKey: row.uploadthing_key,
    };
  } catch (e) {
    console.error("[wearer] getWearerPhoto failed", e);
    return null;
  }
}

export async function saveWearerPhoto(input: {
  userId: string;
  imageUrl: string;
  uploadthingKey?: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const url = input.imageUrl.trim();
  if (!url || url.length > 2048) {
    return { ok: false, message: "Invalid photo URL." };
  }
  if (!input.userId) {
    return { ok: false, message: "Missing user id." };
  }
  try {
    const sql = requireSql();
    const key = input.uploadthingKey?.trim() || null;
    await sql`
      INSERT INTO wearer_profile (user_id, image_url, uploadthing_key, updated_at)
      VALUES (${input.userId}, ${url}, ${key}, now())
      ON CONFLICT (user_id) DO UPDATE SET
        image_url = EXCLUDED.image_url,
        uploadthing_key = EXCLUDED.uploadthing_key,
        updated_at = now()
    `;
    return { ok: true };
  } catch (e) {
    logServerError("saveWearerPhoto", e);
    return { ok: false, message: "Could not save your photo. Try again." };
  }
}

export async function clearWearerPhoto(
  userId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!userId) {
    return { ok: false, message: "Missing user id." };
  }
  try {
    const sql = requireSql();
    await sql`DELETE FROM wearer_profile WHERE user_id = ${userId}`;
    return { ok: true };
  } catch (e) {
    logServerError("clearWearerPhoto", e);
    return { ok: false, message: "Could not remove your photo. Try again." };
  }
}
