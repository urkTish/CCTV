import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Relative base so the built bundle can be opened behind any path (or from a
  // USB stick) in a client meeting without configuring a web root.
  base: './',
  build: { outDir: 'dist', sourcemap: true },
  test: {
    // Domain and engine tests are pure and run in node; the UI smoke test needs a
    // DOM, so it opts in with `// @vitest-environment jsdom`.
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
