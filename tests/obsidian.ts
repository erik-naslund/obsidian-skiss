/**
 * What `import … from 'obsidian'` resolves to in a test run. The npm package is
 * types only — its `main` is empty — so there is nothing to load, and a test
 * file supplies the values it needs with `vi.mock('obsidian', …)`. A file that
 * reaches the real module has forgotten to, and says so here rather than
 * failing later on an undefined import.
 */
throw new Error("the `obsidian` package is types only: mock it with vi.mock('obsidian', …)");
