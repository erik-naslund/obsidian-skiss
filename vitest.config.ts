import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    // The `obsidian` package carries no module to load, only types. Node leaves
    // an unresolvable import alone until it is asked for, and every test file
    // mocks it before then; the jsdom environment one file runs in resolves it
    // like a browser would and fails on it, so it is pointed at a stand-in.
    alias: {
      obsidian: new URL('./tests/obsidian.ts', import.meta.url).pathname,
    },
  },
});
