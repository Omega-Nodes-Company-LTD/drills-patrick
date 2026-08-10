import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      // `server-only` exists to break a *client* build, and does it by
      // throwing on import. Under vitest there is no client build to break,
      // and without this stub every server module — where most of the logic
      // worth testing lives — would be unimportable.
      'server-only': resolve(__dirname, './tests/stubs/server-only.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // The unit tests exercise pure helpers; no real credentials are needed.
    env: { SKIP_ENV_VALIDATION: '1' },
  },
})
