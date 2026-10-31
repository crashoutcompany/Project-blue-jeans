import { requireSql } from "@/lib/db";
import { logServerError } from "@/lib/server/safe-client-error";

/** Longer than any run can take, so a crashed run cannot block the week for long. */
const WEEK_CLAIM_LEASE_SECONDS = 10 * 60;

export const WEEK_ALREADY_PLANNING_PUBLIC =
  "Your week is already being planned. Give it a minute, then refresh.";

/**
 * Lease (user_id, week_start) so concurrent "Plan my week" / "Regenerate this
 * day" calls (double click, two tabs) cannot both pay for Gemini only for the
 * second to clobber the first. Returns the claim token, or null when another
 * run holds an unexpired lease.
 */
async function claimWeek(
  userId: string,
  weekStart: string,
): Promise<string | null> {
  const sql = requireSql();
  const rows = (await sql`
    INSERT INTO weekly_plan_claims (user_id, week_start, token, expires_at)
    VALUES (
      ${userId},
      ${weekStart}::date,
      gen_random_uuid(),
      now() + make_interval(secs => ${WEEK_CLAIM_LEASE_SECONDS}::double precision)
    )
    ON CONFLICT (user_id, week_start) DO UPDATE SET
      token = EXCLUDED.token,
      expires_at = EXCLUDED.expires_at
    WHERE weekly_plan_claims.expires_at <= now()
    RETURNING token::text AS token
  `) as Array<{ token: string }>;
  return rows[0]?.token ?? null;
}

/** Release only our own claim; an expired lease may already belong to a newer run. */
async function releaseWeek(
  userId: string,
  weekStart: string,
  token: string,
): Promise<void> {
  const sql = requireSql();
  await sql`
    DELETE FROM weekly_plan_claims
    WHERE user_id = ${userId}
      AND week_start = ${weekStart}::date
      AND token = ${token}::uuid
  `;
}

/**
 * Run `fn` while holding the week's lease. Returns `busy` without calling
 * `fn` when another run holds it.
 */
export async function withWeekClaim<T>(
  userId: string,
  weekStart: string,
  label: string,
  fn: () => Promise<T>,
): Promise<{ busy: true } | { busy: false; value: T }> {
  const token = await claimWeek(userId, weekStart);
  if (!token) return { busy: true };

  try {
    return { busy: false, value: await fn() };
  } finally {
    await releaseWeek(userId, weekStart, token).catch((e) => {
      logServerError(`${label} release`, e);
    });
  }
}
