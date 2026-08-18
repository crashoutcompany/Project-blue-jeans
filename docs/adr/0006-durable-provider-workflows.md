# Run provider side effects as durable workflows

Image sanitization, AI generation, UploadThing persistence, security notification, migration, and account deletion cross Neon and external providers and cannot be made atomic inside one serverless request. Blue Jeans records operation state and idempotency in Neon and orchestrates retryable steps with Vercel Workflow so interruption or replay cannot silently lose work or multiply provider charges.

## Consequences

- Workflow inputs and persisted step results contain opaque account, connection, media, and operation IDs only—never decrypted credentials, prompts, provider responses, private image bytes, or signed URLs
- A Node.js step loads and decrypts a provider credential only immediately before use and never returns it from the step
- Every external side effect has a stable idempotency key and a recorded outcome; retries distinguish transient failures from invalid credentials or revoked consent
- Provider exceptions are caught inside steps and converted to sanitized retryable/fatal error codes so workflow history never persists response bodies, signed URLs, prompts, or credentials
- Membership, account-deletion state, provider health, and applicable consent are rechecked before each external call
