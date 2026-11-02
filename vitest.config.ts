import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/__tests__/**/*.test.ts', 'tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/simulation/**/*.ts', 'src/lib/**/*.ts'],
      exclude: ['src/simulation/**/__tests__/**', 'src/simulation/simulation.worker.ts'],
      reporter: ['text-summary', 'lcov'],
    },
  },
});
