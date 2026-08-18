# Revoking admission deletes the Wearer account

The owner’s invitation authority includes the authority to revoke an admitted Wearer. Revocation immediately starts the same deletion used for a Wearer-requested account deletion—attempt private UploadThing cleanup, then erase credentials and product data even if remote cleanup fails—with no restoration grace period; this deliberately favors immediate removal from the private invite-only product over recoverability after an accidental or disputed revocation.
