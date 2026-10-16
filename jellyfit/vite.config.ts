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

/** CrazyGames build only: their SDK v3 script, before the game bundle (spec 16.2). Never blocks. */
function crazyGamesSdk(): Plugin {
  return {
    name: 'crazygames-sdk',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) =>
        html.replace(
          '</title>',
          '</title>\n    <script src="https://sdk.crazygames.com/crazygames-sdk-v3.js" async onerror="window.__cgSdkFailed=true"></script>',
        ),
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [audioManifest(), ...(mode === 'crazygames' ? [crazyGamesSdk()] : [])],
  build: {
    target: 'es2019',
    sourcemap: false,
    outDir: mode === 'crazygames' ? 'dist-crazygames' : 'dist',
    assetsInlineLimit: 0,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
}));
