import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/utils/**/*.ts", "src/discover/feedPreview.ts", "src/nlp/inflections.ts", "src/nlp/rankExamples.ts"],
      exclude: ["**/*.test.ts"],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
  },
})