/**
 * Brand images from the game's own Jello drawing: assets/brand/jello.png (transparent, 1024²),
 * used by the Android splash (android_setup.py) and the loading screen (src/boot/loader.ts).
 *   node scripts/brand.mjs
 */
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const server = await createServer({ server: { port: 5181 }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:5181/scripts/brand/render.html');
await page.waitForFunction(() => typeof window.renderJello === 'function');
const url = await page.evaluate(() => window.renderJello(1024));
mkdirSync('assets/brand', { recursive: true });
writeFileSync('assets/brand/jello.png', Buffer.from(url.split(',')[1], 'base64'));
console.log('assets/brand/jello.png');
await browser.close();
await server.close();
