import { defineConfig } from 'vitest/config'
export default defineConfig({
  cacheDir: '/tmp/vcm-vite-cache',
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
})
