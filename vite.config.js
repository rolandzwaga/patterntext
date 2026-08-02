import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages serves this repo from /patterntext/, so asset URLs have to be
  // relative rather than rooted at /.
  base: './',
  build: {
    // Pages publishes either the repo root or /docs on the default branch.
    outDir: 'docs',
  },
});
