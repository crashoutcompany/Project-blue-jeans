# BYOK foundation

This slice adds admission-aware provider settings and switches Gemini and
UploadThing call sites onto per-Wearer credential resolution with media
provenance.

## Database

The BYOK tables (`wearer_memberships`, `wearer_invitations`,
`provider_connections`, `provider_credentials`, `media_assets`,
`upload_intents`) are part of `db/schema.sql`.
Re-running `db/schema.sql` adds `provider_validation_attempts`, the per-Wearer
limit on key validations. Disconnecting a provider now deletes the ciphertext
row, so on an existing database run this once to purge rows disconnected
earlier:

```sql
DELETE FROM provider_credentials WHERE revoked_at IS NOT NULL;
```

Provider keys are write-only. After a save, no part of a key (not even a
last-4 hint) is returned to the browser, logged, or stored outside the
ciphertext; Settings shows only "Connected" with Replace and Disconnect, and
"connected" means an `active` connection with a live `provider_credentials`
row. Earlier builds stored a hint in `provider_credentials.secret_hint`.
Re-running `db/schema.sql` NULLs it; run it again (or the `UPDATE` below)
after the write-only build is live, so a save served by the previous build
during the rollout is scrubbed too:

```sql
UPDATE provider_credentials SET secret_hint = NULL WHERE secret_hint IS NOT NULL;
```

The column stays for now because the previous deployment still reads and
writes it, and instant rollback or skew protection can keep serving that build.
Once no deployment older than the write-only build can run, drop it in a
follow-up, together with the column line in `db/schema.sql`:

```sql
ALTER TABLE provider_credentials DROP COLUMN IF EXISTS secret_hint;
```

Seed the sole platform-funded owner with the stable Better Auth user id:

```sql
INSERT INTO wearer_memberships (
  user_id,
  access_role,
  credential_source,
  status
)
VALUES (
  '<better-auth-user-id>',
  'owner',
  'platform_env',
  'active'
)
ON CONFLICT (user_id) DO NOTHING;
```

Admitted non-owner accounts are inserted as `wearer` / `user_byok` when they
accept an owner invite from Settings.

## Configure production

Set these Vercel environment variables only in production:

- `APP_OWNER_USER_ID`: the same stable Better Auth id as the owner membership.
  Production owner bootstrap uses this exact id only. Auth provider identity
  does not grant product admission. The Playwright
  test-login route may create an admitted Wearer only outside production.
  It is required in production: without it, no account (not even an `owner`
  membership row) may spend the platform keys.
- `PROVIDER_CREDENTIAL_KEY_VERSION=1`
- `PROVIDER_CREDENTIAL_KEY_V1`: a base64-encoded 32-byte key generated with
  `openssl rand -base64 32`

Keep older `PROVIDER_CREDENTIAL_KEY_V<n>` values during key rotation until all
rows have been re-encrypted with the current version. Reads lazily rewrap
ciphertext to `PROVIDER_CREDENTIAL_KEY_VERSION` after a successful decrypt.
Losing a key makes rows encrypted by that version unrecoverable.

`saveByokCredential` binds the account and writes the ciphertext in one
statement, and will not replace a bound `external_account_id` with a different
provider app, even under concurrent saves. Disconnecting deletes the
ciphertext row rather than flagging it.

Credential resolution always reads the membership from the database
(`getMembershipPolicy`, which also covers the `APP_OWNER_USER_ID` bootstrap).
Resolver functions take only a user id, so no caller can hand in an owner
policy.

Saving a key counts against a per-Wearer, per-provider limit of 10 validation
attempts an hour (`provider_validation_attempts`); the API answers 429 past it.

The existing `GOOGLE_GENERATIVE_AI_API_KEY` and `UPLOADTHING_TOKEN` remain the
owner's platform-funded credentials. The resolver never falls back to either
value for a `user_byok` membership.

## Current boundary

Admitted Wearers save Google AI Studio and UploadThing credentials in Settings.
Each API validates the secret, then encrypts it. The owner account keeps using
platform env vars and cannot paste BYOK secrets.

Gemini call sites resolve through `resolveGeminiApiKey`. UploadThing uploads,
deletes, and browser reads resolve through `resolveUploadThingToken`.

Closet and wearer photos are stored as `media_assets` rows bound to the
UploadThing connection that uploaded them. The database stores `/api/media/{id}`
display paths. Browser reads still require an admitted session and redirect to
the public UploadThing CDN URL (`https://{appId}.ufs.sh/f/{key}`). Anyone who
has that CDN URL can fetch the bytes; in-app listing stays gated. AI image
inputs resolve from owned media records server-side.

Existing files without a `media_asset_id` are bound in place on the next
settings or upload request: keys bind to `media_assets`, and display paths
switch to `/api/media/{id}`. Files that no longer exist in the owning app are
left unreachable rather than grandfathered.

Settings is gated by admitted membership. The owner invites Wearers from
Settings (copy a one-time `/invite/{token}` link). Invited Wearers must sign in
with that email, then open the link. The `/api/settings/providers` routes
enforce membership and never fall back to platform keys for `user_byok`.

## UploadThing app requirements

Each BYOK Wearer needs their own UploadThing app for the routes Blue Jeans
uses (`closetImage`, `wearerPhoto`). Files are uploaded with public-read ACL so
a free UploadThing plan works. The validator stores the app id
(`external_account_id`) so the same UploadThing app cannot be linked to two
Wearers. Reconnecting must use a token from that same app; a different app is
rejected so existing photos stay readable.

The `appId` inside a token is plain base64 and not trusted on its own. The
validator uploads a tiny `blue-jeans-token-check.txt` probe, confirms the
returned `ufsUrl` names that app, then deletes the probe. Ingest verifies the
upload signature against the app named in it, so this proves the API key
belongs to the claimed app.
