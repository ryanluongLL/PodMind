import os from "node:os"
import path from "node:path"
import { defineConfig } from "vitest/config"
import { TEST_DATABASE_URL } from "./src/integration/testDatabase.js"

/// Integration tests: real Express routes against a real test Postgres.
/// Files run one at a time because they share one database.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/integration/**/*.int.test.ts"],
    globalSetup: ["src/integration/globalSetup.ts"],
    setupFiles: ["src/integration/setup.ts"],
    fileParallelism: false,
    testTimeout: 15000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: TEST_DATABASE_URL,
      DEEPL_API_KEY: "test-key",
      OPENAI_API_KEY: "test-key",
      AUDIO_CACHE_DIR: path.join(os.tmpdir(), "podmind-audio-test"),
    },
  },
})