import { configDefaults, defineConfig } from "vitest/config";

// Node unit tests only; the React Router plugin in vite.config.ts is for the app itself.
// The scripts glob covers the build tooling's own tests (write-headers.test.mjs).
export default defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.mjs"],
    exclude: [...configDefaults.exclude, "src/**/*.browser.test.tsx"],
  },
});
