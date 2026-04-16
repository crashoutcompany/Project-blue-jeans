import fs from "node:fs";
import path from "node:path";

const AUTH_DIR = path.join(process.cwd(), "tests/e2e/.auth");

function writeStorageState(
  filename: string,
  role: "admin" | "non-admin",
) {
  const state = {
    cookies: [
      {
        name: "e2e-role",
        value: role === "admin" ? "admin" : "non-admin",
        domain: "127.0.0.1",
        path: "/",
        expires: -1 as const,
        httpOnly: false,
        secure: false,
        sameSite: "Lax" as const,
      },
    ],
    origins: [] as { origin: string; localStorage: { name: string; value: string }[] }[],
  };
  fs.writeFileSync(path.join(AUTH_DIR, filename), JSON.stringify(state, null, 2));
}

export default async function globalSetup() {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  writeStorageState("admin.json", "admin");
  writeStorageState("non-admin.json", "non-admin");
}
