# BYOK foundation

This slice adds admission-aware provider settings and switches Gemini and
UploadThing call sites onto per-Wearer credential resolution with media
provenance.

## Apply the database migrations

Run these once in the Neon SQL editor, in order:

1. `db/migrate-byok-foundation.sql`
2. `db/migrate-byok-uploadthing.sql`
3. `db/migrate-admission-invites.sql`

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

Admitted non-owner accounts are inserted as `wearer` / `user_byok` when they
accept an owner invite from Settings.

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

Admitted Wearers save Google AI Studio and UploadThing credentials in Settings.
Each API validates the secret, then encrypts it. The owner account keeps using
platform env vars and cannot paste BYOK secrets.

Gemini call sites resolve through `resolveGeminiApiKey`. UploadThing uploads,
deletes, and browser reads resolve through `resolveUploadThingToken`.

Closet and wearer photos are stored as `media_assets` rows bound to the
UploadThing connection that uploaded them. The database stores `/api/media/{id}`
display paths — not durable public CDN URLs. Browser reads redirect to
UploadThing signed URLs (≤ 15 minutes). AI image inputs resolve from owned
media records server-side.

Existing public UploadThing files are sealed in place on the next settings or
upload request: ACL moves to private where possible, keys bind to
`media_assets`, and display paths switch to `/api/media/{id}`. Files that no
longer exist in the owning app are left unreachable rather than grandfathered.

Settings is gated by admitted membership. The owner invites Wearers from
Settings (copy a one-time `/invite/{token}` link). Invited Wearers must sign in
with that email, then open the link. The `/api/settings/providers` routes
enforce membership and never fall back to platform keys for `user_byok`.

## UploadThing app requirements

Each BYOK Wearer needs their own UploadThing app with **private ACL** enabled
for the routes Blue Jeans uses (`closetImage`, `wearerPhoto`). The validator
stores the app id (`external_account_id`) so the same UploadThing app cannot be
linked to two Wearers. Reconnecting must use a token from that same app; a
different app is rejected so existing private photos stay readable.
