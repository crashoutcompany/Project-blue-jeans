import { headers } from "next/headers";

import { auth as betterAuth } from "@/lib/auth";

type SessionQuery = {
  disableRefresh?: boolean;
  disableCookieCache?: boolean;
};

async function readSession(
  requestHeaders: Headers | undefined,
  query: SessionQuery,
) {
  const data = await betterAuth.api.getSession({
    headers: requestHeaders ?? (await headers()),
    query,
  });
  return { data };
}

export const auth = {
  /** RSC-safe session read — never refreshes cookies. */
  async getSession(requestHeaders?: Headers) {
    return readSession(requestHeaders, { disableRefresh: true });
  },
  /** Authoritative read for admission / mutations — bypasses cookie cache. */
  async getAuthoritativeSession(requestHeaders?: Headers) {
    return readSession(requestHeaders, {
      disableRefresh: true,
      disableCookieCache: true,
    });
  },
};
