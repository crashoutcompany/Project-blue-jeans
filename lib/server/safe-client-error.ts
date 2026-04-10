/**
 * Log full error details on the server; avoid returning raw `Error.message` to browsers
 * or public APIs (GCP, DB drivers, and stacks often leak internals).
 */

export function logServerError(context: string, error: unknown): void {
  const label = `[server] ${context}`;
  if (error instanceof Error) {
    console.error(label, error.message);
    if (error.stack) console.error(error.stack);
  } else {
    console.error(label, error);
  }
}

/** Log `error`, then return `clientMessage` for JSON / Server Action responses. */
export function safeClientMessage(
  context: string,
  error: unknown,
  clientMessage: string,
): string {
  logServerError(context, error);
  return clientMessage;
}
