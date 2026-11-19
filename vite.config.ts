import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: {
    host: 'localhost',
    port: 5173,
  },
  build: {
    target: 'es2022',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: false,
  },
});
