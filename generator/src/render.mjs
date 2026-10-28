import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';

// Opens each page in one shared Chromium. The library path for Chromium comes from the environment.
export async function openRenderer() {
  const browser = await chromium.launch();
  return {
    // Renders the #page element of an HTML file to a PNG buffer.
    // `layer` is passed to the page as ?layer=... so a page can hide parts of itself.
    async render(htmlPath, { layer = 'all', transparent = false } = {}) {
      const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
      try {
        const url = `${pathToFileURL(htmlPath).href}?layer=${layer}`;
        await page.goto(url);
        await page.waitForSelector('body[data-ready]', { timeout: 30000 });
        const box = await page.locator('#page').boundingBox();
        await page.setViewportSize({ width: 1600, height: Math.ceil(box.height) });
        return await page.screenshot({
          clip: { x: 0, y: 0, width: 1600, height: Math.ceil(box.height) },
          omitBackground: transparent,
          animations: 'disabled',
        });
      } finally {
        await page.close();
      }
    },
    close: () => browser.close(),
  };
}
