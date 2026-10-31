export type OutfitPlanErrorReason = "no-object" | "invalid-ids";

const PUBLIC_MESSAGES: Record<OutfitPlanErrorReason, string> = {
  "no-object":
    "The stylist couldn't put an outfit together this time. Try again in a moment.",
  "invalid-ids":
    "The model returned garment ids that do not match your closet. Try again or improve descriptions.",
};

/**
 * Step-1 planning failed in a way the user can act on (usually by retrying).
 * `message` holds the internal detail for logs; `publicMessage` is safe to show.
 */
export class OutfitPlanError extends Error {
  readonly reason: OutfitPlanErrorReason;
  readonly publicMessage: string;

  constructor(
    reason: OutfitPlanErrorReason,
    detail: string,
    options?: { cause?: unknown },
  ) {
    super(detail, options);
    this.name = "OutfitPlanError";
    this.reason = reason;
    this.publicMessage = PUBLIC_MESSAGES[reason];
  }
}

export function isOutfitPlanError(error: unknown): error is OutfitPlanError {
  return error instanceof OutfitPlanError;
}
