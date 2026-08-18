# Encrypt provider credentials with a versioned environment key

Wearer-funded Google and UploadThing credentials persist encrypted in Neon using authenticated encryption, while versioned master keys remain outside that database in the deployment environment. This gives v1 a small operational surface and protects database-only disclosures without introducing KMS; it also means deleted ciphertext can remain decryptable in bounded database backups until the disclosed backup-retention window expires.

## Consequences

- Credential records identify the master-key version used so keys can rotate without a flag day
- No master key is stored in Neon, source control, logs, analytics, or client code
- Master-key versions have no independent backup; losing one makes its credentials unrecoverable and forces affected Wearers to reconnect
- Production alone receives Wearer credential master keys; development and preview deployments use isolated databases and synthetic or dedicated test credentials
- A copied production ciphertext row in a Neon preview branch remains unusable because previews do not receive production decryption keys
- Production may start when a referenced master-key version is missing, but every affected Wearer-funded connection fails closed as unavailable and never falls back to platform credentials
- Suspected disclosure of ciphertext plus a master key disables affected connections and requires both master-key rotation and provider-side credential revocation/reconnection
- Immediate cryptographic erasure is not a v1 guarantee; deletion follows the documented backup-retention window
