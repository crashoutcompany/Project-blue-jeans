# Wearer media is private

Garment photos, Wearer photos, and generated Fit / Outfit heroes are private to one Wearer account, so Blue Jeans stores them as private UploadThing objects and authorizes reads with short-lived access rather than persisting public CDN URLs. Unguessable public URLs would conflict with the product’s per-Wearer privacy boundary and would expose especially sensitive body and try-on imagery to anyone who obtained a URL.

## Consequences

- Database records keep provider ownership and file identity, not durable public access URLs
- Client mutations reference a server-issued upload intent or media ID, never an arbitrary URL / file-key pair
- Every browser media read is authorized for the owning Wearer before Blue Jeans issues an UploadThing signed URL valid for at most 15 minutes for direct delivery
- Signed URLs are not persisted, logged, analyzed, or passed through a publicly cacheable image-optimization route
- AI image inputs are resolved from an owned media record and fetched server-side through that record’s authorized storage connection; server code never fetches a user-supplied media URL
- Media rendering does not depend on a hardcoded UploadThing app hostname
- Existing owner UploadThing files with known keys are made private in place; database data-URL heroes are uploaded, and any image that cannot be migrated is reported for an explicit repair or removal decision
