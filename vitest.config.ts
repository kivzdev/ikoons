import { defineConfig } from 'vitest/config'

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    include: ['packages/*/test/**/*.test.{ts,tsx}', 'scripts/test/**/*.test.ts'],
    environment: 'jsdom',
    setupFiles: ['packages/icons/test/setup.ts'],
  },
})
