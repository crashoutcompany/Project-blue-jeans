import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const resolve = {
  alias: {
    "@": path.resolve(import.meta.dirname, "."),
  },
};

export default defineConfig({
  plugins: [react()],
  resolve,
  test: {
    globals: true,
    env: {
      BETTER_AUTH_SECRET:
        process.env.BETTER_AUTH_SECRET ??
        "test-better-auth-secret-at-least-32-characters",
    },
    exclude: [
      "**/node_modules/**",
      "**/.next/**",
      "**/tests/e2e/**",
      "**/playwright-report/**",
      "**/test-results/**",
    ],
    projects: [
      {
        resolve,
        test: {
          name: "node",
          environment: "node",
          setupFiles: ["./vitest.setup.node.ts"],
          include: ["tests/unit/**/*.test.ts", "lib/**/*.test.ts"],
        },
      },
      {
        plugins: [react()],
        resolve,
        test: {
          name: "components",
          environment: "jsdom",
          setupFiles: ["./vitest.setup.dom.ts"],
          include: ["components/**/*.test.tsx", "app/**/*.test.tsx"],
        },
      },
    ],
  },
});
