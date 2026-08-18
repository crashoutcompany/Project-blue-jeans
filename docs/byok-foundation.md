# BYOK foundation

This slice adds admission-aware Google AI Studio settings and switches
Gemini call sites onto `resolveGeminiApiKey`. UploadThing is still
platform-env only.

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
rows have been re-encrypted with the current version. Reads lazily rewrap
ciphertext to `PROVIDER_CREDENTIAL_KEY_VERSION` after a successful decrypt.
Losing a key makes rows encrypted by that version unrecoverable.

`saveByokCredential` writes the connection row and ciphertext together, and
will not replace a bound `external_account_id` with a different provider app.

The existing `GOOGLE_GENERATIVE_AI_API_KEY` and `UPLOADTHING_TOKEN` remain the
owner's platform-funded credentials. The resolver never falls back to either
value for a `user_byok` membership.

## Current boundary

Admitted Wearers save a Google AI Studio key in Settings. The API validates
the key against Google, then encrypts it. The owner account keeps using
`GOOGLE_GENERATIVE_AI_API_KEY` and cannot paste a BYOK key.

Lookbook generation, closet describe/regenerate, and Plan my week resolve
Gemini through `resolveGeminiApiKey`. UploadThing still uses
`UPLOADTHING_TOKEN` until media provenance and per-Wearer routing exist.

Settings currently sits behind the admin shell, so the Wearer save form is
reachable from the UI only after admission opens. The
`/api/settings/providers` routes already enforce membership.
