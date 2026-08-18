# Enforce Wearer isolation in the app and database

Blue Jeans is invite-gated but multi-user, and its records include private wardrobe data, body imagery metadata, and encrypted provider credentials. Every request is authorized and scoped by Wearer in application code, while Postgres row-level security independently restricts the same records; relying on either scattered query predicates or database policy alone would make one mistake sufficient for a cross-Wearer disclosure.

## Consequences

- The production application connects with a role that neither owns protected tables nor has `BYPASSRLS`; migrations and maintenance use a separate privileged role
- Every user-scoped database operation establishes the Wearer identity transaction-locally before executing queries, including background work
- UploadThing callbacks and account-deletion work use narrowly scoped service paths after their own authenticity and ownership checks rather than globally bypassing row-level security
