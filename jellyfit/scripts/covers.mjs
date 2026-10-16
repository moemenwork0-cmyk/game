/**
 * CrazyGames cover images from the game's own art (assets/icon.png) and logo style:
 * 1920×1080 (16:9), 800×1200 (2:3), 800×800 (1:1). Only the title as text, no borders.
 *   node scripts/covers.mjs  →  covers/
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { COVERS, renderCover } from './cover-lib.mjs';

mkdirSync('covers', { recursive: true });
const browser = await chromium.launch();
for (const c of COVERS) {
  await renderCover(browser, c, `covers/${c.name}`);
  console.log('covers/' + c.name);
}
await browser.close();
