import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Enables the automatic JSX runtime and React Fast Refresh in dev.
// Without this Vite falls back to esbuild's classic transform, which emits
// `React.createElement(...)` calls and requires `import React` in every file.
// `base` controls the path assets are referenced from:
//   - default '/'           → iOS custom-scheme bundle + Windows local server
//   - VITE_BASE=/repo/      → GitHub Pages project site (set in the CI workflow)
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
});
