import { requestWithNeonDevCookies } from "@/lib/auth/neon-dev-request-cookies";
import { auth } from "@/lib/auth/server";

/** Neon quick start / server reference: https://neon.com/docs/auth/quick-start/nextjs-api-only */
const { GET: authGET, POST: authPOST } = auth.handler();

type AuthRouteCtx = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, ctx: AuthRouteCtx) {
  return authGET(requestWithNeonDevCookies(request), ctx);
}

export async function POST(request: Request, ctx: AuthRouteCtx) {
  return authPOST(requestWithNeonDevCookies(request), ctx);
}
