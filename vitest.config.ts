import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [react()],
  test: {
    globals: true,
    exclude: [
      "**/node_modules/**",
      "**/.next/**",
      "**/tests/e2e/**",
      "**/playwright-report/**",
      "**/test-results/**",
    ],
    projects: [
      {
        resolve: {
          tsconfigPaths: true,
        },
        plugins: [react()],
        test: {
          name: "node",
          environment: "node",
          setupFiles: ["./vitest.setup.node.ts"],
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        resolve: {
          tsconfigPaths: true,
        },
        plugins: [react()],
        test: {
          name: "components",
          environment: "jsdom",
          setupFiles: ["./vitest.setup.dom.ts"],
          include: ["components/**/*.test.tsx"],
        },
      },
    ],
  },
});
