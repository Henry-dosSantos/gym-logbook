import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const outDir = new URL('../public/icons/', import.meta.url);
mkdirSync(outDir, { recursive: true });

const targets = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['icon-maskable-512.png', 512],
  ['apple-touch-icon.png', 180],
];

const browser = await chromium.launch();
for (const [name, size] of targets) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  const barW = Math.round(size * 0.07);
  const barH = Math.round(size * 0.44);
  await page.setContent(
    `<style>html,body{margin:0;background:#000000}div{position:absolute;background:#F2F2F2;width:${barW}px;height:${barH}px;left:${Math.round((size - barW) / 2)}px;top:${Math.round((size - barH) / 2)}px}</style><div></div>`,
  );
  writeFileSync(new URL(name, outDir), await page.screenshot({ type: 'png' }));
  await page.close();
}
await browser.close();
