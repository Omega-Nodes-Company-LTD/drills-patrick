import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // The unit tests exercise pure helpers; no real credentials are needed.
    env: { SKIP_ENV_VALIDATION: '1' },
  },
})
