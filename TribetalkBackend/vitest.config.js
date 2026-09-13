import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./test/setup.js"],
    exclude: ["e2e/**", "node_modules/**", "dist/**"],
  },
});
