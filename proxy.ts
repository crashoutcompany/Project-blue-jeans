import { auth } from "@/lib/auth";
import { AUTH_SIGN_IN_PATH } from "@/lib/auth/config";
import { createAuthProxy } from "@/lib/auth/proxy";

const authProxy = createAuthProxy({
  auth,
  publicPaths: [
    "/",
    AUTH_SIGN_IN_PATH,
    "/auth/sign-in",
    "/auth/sign-out",
    "/auth/not-admitted",
    "/auth/not-admin",
    "/auth/accept-invite",
    "/privacy",
    "/terms",
    "/invite/*",
  ],
  rules: [{ path: "*", access: "session" }],
  signInPath: AUTH_SIGN_IN_PATH,
});

export default authProxy;
export { authProxy as proxy };

export const config = {
  matcher: [
    "/((?!api(?:/|$)|_next(?:/|$)|favicon\\.ico$|.*\\.(?:avif|gif|ico|jpe?g|png|svg|webp)$).*)",
  ],
};
