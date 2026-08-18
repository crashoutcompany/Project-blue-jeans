# Separate provider funding from authorization

The sole owner always uses deployment environment credentials, while every other admitted Wearer stores encrypted Google AI Studio and UploadThing credentials in Neon. Admission, administrative authority, and provider funding are independent policies: non-owner failures never fall back to platform credentials, and application code resolves one explicit credential source from the authenticated membership rather than inferring funding from administrator status.

Each UploadThing connection represents one dedicated Blue Jeans app, and every media record identifies the connection that owns its file. Browser uploads use server-issued upload intents; authenticated presign requests and signature-verified callbacks construct UploadThing handlers with that connection’s token. Same-app token rotation is allowed only after pending uploads settle, while switching or forgetting an app is blocked as long as it owns active media.

## Consequences

- The owner’s environment-backed UploadThing app has a logical database connection record without storing its token in Neon
- Provider clients are request/step scoped and are never mutable cross-Wearer singletons
- Deletion resolves the token from media provenance rather than from the current default connection
- UploadThing callback metadata selects an upload intent / connection, but no callback side effect runs until the provider signature and stored ownership are verified
