# BYOK foundation

This first implementation slice adds admission and provider-funding policy,
encrypted credential storage, and strict credential resolution. It does not yet
switch Gemini or UploadThing production call sites to BYOK.

## Apply the database migration

Run `db/migrate-byok-foundation.sql` once in the Neon SQL editor.

Seed the sole platform-funded owner with the stable Neon Auth user id:

```sql
INSERT INTO wearer_memberships (
  user_id,
  access_role,
  credential_source,
  status
)
VALUES (
  '<neon-auth-user-id>',
  'owner',
  'platform_env',
  'active'
)
ON CONFLICT (user_id) DO NOTHING;
```

Admitted non-owner accounts must be inserted as `wearer` / `user_byok`. The
invitation flow will own that write in a later slice.

## Configure production

Set these Vercel environment variables only in production:

- `APP_OWNER_USER_ID`: the same stable Neon Auth id as the owner membership
- `PROVIDER_CREDENTIAL_KEY_VERSION=1`
- `PROVIDER_CREDENTIAL_KEY_V1`: a base64-encoded 32-byte key generated with
  `openssl rand -base64 32`

Keep older `PROVIDER_CREDENTIAL_KEY_V<n>` values during key rotation until all
rows have been re-encrypted with the current version. Losing a key makes rows
encrypted by that version unrecoverable.

The existing `GOOGLE_GENERATIVE_AI_API_KEY` and `UPLOADTHING_TOKEN` remain the
owner's platform-funded credentials. The resolver never falls back to either
value for a `user_byok` membership.

## Current boundary

`lib/credentials/resolve.ts` is the only policy-aware credential entry point for
new provider integrations. The settings APIs must validate a provider secret
before calling `saveByokCredential`; the vault's `tested_at` timestamp is an
assertion that validation already succeeded.

The next slice should add the authenticated settings API/UI, provider-specific
validation, and then migrate Gemini call sites. UploadThing requires media
provenance and dynamic routing before its call sites can safely switch.
