import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    exclude: [...configDefaults.exclude, "e2e/**"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      // src/ui/kit is vendored shadcn output; src/test holds test doubles.
      exclude: ["src/ui/kit/**", "src/test/**", "**/*.test.{ts,tsx}", "**/*.d.ts"],
      reporter: ["text", "html", "lcov"],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: [
            "src/domain/**/*.test.ts",
            "src/lib/**/*.test.ts",
            "src/adapters/**/*.test.ts",
            "src/app/**/*.test.ts",
            "src/test/**/*.test.ts",
            "src/*.test.ts",
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["src/ui/**/*.test.{ts,tsx}"],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
    ],
  },
});
