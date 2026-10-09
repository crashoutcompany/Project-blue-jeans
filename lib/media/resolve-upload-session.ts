import "server-only";

import { resolveUploadThingToken } from "@/lib/credentials/resolve";
import { ensurePlatformUploadThingConnection } from "@/lib/media/platform-connection";

export type ResolvedUploadSession =
  | {
      ok: true;
      token: string;
      connectionId: string | null;
    }
  | { ok: false; message: string };

export async function resolveUploadSession(
  userId: string,
): Promise<ResolvedUploadSession> {
  const resolved = await resolveUploadThingToken(userId);
  if (!resolved.ok) return resolved;

  const connectionId =
    resolved.connectionId ??
    (resolved.source === "platform_env"
      ? await ensurePlatformUploadThingConnection({
          userId,
          token: resolved.token,
        })
      : null);

  return {
    ok: true,
    token: resolved.token,
    connectionId,
  };
}
