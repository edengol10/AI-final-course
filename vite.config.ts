import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "/",
  plugins: [react()],
  build: {
    sourcemap: false,
    target: "es2022"
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    // A local Git worktree may contain a second checkout with its own tests.
    // It is not source code for this dashboard and must not be discovered by
    // the root test command.
    exclude: ["**/node_modules/**", "**/.worktrees/**"],
    css: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"]
    }
  }
});
