import "server-only";

import type { ProviderKind } from "@/lib/credentials/types";
import { requireSql } from "@/lib/db";

/** Saving a key is rare; this only stops Settings being used as a key oracle. */
export const VALIDATION_ATTEMPTS_PER_WINDOW = 10;
const WINDOW_SECONDS = 60 * 60;

export const VALIDATION_RATE_LIMITED_MESSAGE =
  "Too many attempts. Try again in an hour.";

/**
 * Count one provider validation attempt for this Wearer and report whether it
 * is within the fixed window. Stored in Postgres because serverless instances
 * do not share memory. A store failure throws so the save fails closed.
 */
export async function consumeValidationAttempt(
  userId: string,
  provider: ProviderKind,
): Promise<boolean> {
  const sql = requireSql();
  const rows = (await sql`
    INSERT INTO provider_validation_attempts AS attempt (
      user_id,
      provider,
      window_start,
      attempts
    )
    VALUES (${userId}, ${provider}::provider_kind, now(), 1)
    ON CONFLICT (user_id, provider) DO UPDATE SET
      window_start = CASE
        WHEN attempt.window_start
          < now() - make_interval(secs => ${WINDOW_SECONDS}::double precision)
        THEN now()
        ELSE attempt.window_start
      END,
      attempts = CASE
        WHEN attempt.window_start
          < now() - make_interval(secs => ${WINDOW_SECONDS}::double precision)
        THEN 1
        ELSE attempt.attempts + 1
      END
    RETURNING attempts
  `) as Array<{ attempts: number }>;

  const attempts = Number(rows[0]?.attempts ?? Number.POSITIVE_INFINITY);
  return attempts <= VALIDATION_ATTEMPTS_PER_WINDOW;
}
