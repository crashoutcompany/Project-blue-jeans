import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Playwright-only auth stub when `E2E_PLAYWRIGHT=1`.
 * Session is driven by the `e2e-role` cookie: `anon` | `non-admin` | `admin`.
 */
export function createE2ePlaywrightAuth() {
  return {
    getSession: async () => {
      if (process.env.E2E_PLAYWRIGHT !== "1") {
        return { data: null };
      }
      const cookieStore = await cookies();
      const role = cookieStore.get("e2e-role")?.value ?? "anon";

      if (role === "anon") {
        return { data: null };
      }

      if (role === "non-admin") {
        return {
          data: {
            user: {
              id: "e2e-non-admin",
              email: "nonadmin@example.com",
              role: "user",
              name: "Non Admin",
            },
          },
        };
      }

      if (role === "admin") {
        return {
          data: {
            user: {
              id: "e2e-admin",
              email:
                process.env.E2E_ADMIN_EMAIL?.trim() || "e2e-admin@example.com",
              role: "admin",
              name: "E2E Admin",
            },
          },
        };
      }

      return { data: null };
    },

    middleware: (opts: { loginUrl: string }) => {
      void opts;
      return async (req: NextRequest) => {
        void req;
        return NextResponse.next();
      };
    },

    handler: () => ({
      GET: async () => new Response("Not found", { status: 404 }),
      POST: async () => new Response("Not found", { status: 404 }),
    }),
  };
}
