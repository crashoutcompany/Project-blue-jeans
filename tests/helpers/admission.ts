import type { assertAdmittedForServerAction } from "@/lib/auth/admitted";

type ServerActionGate = Awaited<ReturnType<typeof assertAdmittedForServerAction>>;

/** An admitted Wearer as `assertAdmittedForServerAction` reports it. */
export function admitted(userId = "u1"): ServerActionGate {
  return {
    ok: true,
    userId,
    membership: {
      userId,
      accessRole: "wearer",
      credentialSource: "user_byok",
      status: "active",
      persisted: true,
    },
  };
}

export const NOT_ADMITTED_MESSAGE =
  "This account has not been admitted to Blue Jeans.";

export const notAdmitted: ServerActionGate = {
  ok: false,
  message: NOT_ADMITTED_MESSAGE,
};
