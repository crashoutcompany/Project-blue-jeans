import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
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
        plugins: [tsconfigPaths(), react()],
        test: {
          name: "node",
          environment: "node",
          setupFiles: ["./vitest.setup.node.ts"],
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        plugins: [tsconfigPaths(), react()],
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
