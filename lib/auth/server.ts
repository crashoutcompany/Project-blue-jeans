import { headers } from "next/headers";

import { auth as betterAuth } from "@/lib/auth";

export const auth = {
  async getSession(requestHeaders?: Headers) {
    const data = await betterAuth.api.getSession({
      headers: requestHeaders ?? (await headers()),
    });
    return { data };
  },
};
