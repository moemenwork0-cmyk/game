import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import { readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** Lists the optional audio files in public/audio so the game never requests missing ones. */
function audioManifest(): Plugin {
  const id = 'virtual:audio-manifest';
  return {
    name: 'audio-manifest',
    resolveId: (source) => (source === id ? '\0' + id : null),
    load(source) {
      if (source !== '\0' + id) return null;
      const dir = resolve(__dirname, 'public/audio');
      const files = existsSync(dir) ? readdirSync(dir).filter((f) => /\.(ogg|mp3|m4a|wav)$/i.test(f)) : [];
      return `export default ${JSON.stringify(files)};`;
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [audioManifest()],
  build: {
    target: 'es2019',
    sourcemap: false,
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
