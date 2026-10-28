import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';

// Opens each page in one shared Chromium. The library path for Chromium comes from the environment.
export async function openRenderer() {
  const browser = await chromium.launch();
  return {
    // Renders the #page element of an HTML file to a PNG buffer.
    // `layer` is passed to the page as ?layer=... so a page can hide parts of itself.
    // `data`, if given, is available to the page as window.PAGE_DATA before its scripts run.
    async render(htmlPath, { layer = 'all', transparent = false, width = 1600, data } = {}) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: 1 });
      try {
        if (data !== undefined) await page.addInitScript((d) => { window.PAGE_DATA = d; }, data);
        const url = `${pathToFileURL(htmlPath).href}?layer=${layer}`;
        await page.goto(url);
        await page.waitForSelector('body[data-ready]', { timeout: 30000 });
        const box = await page.locator('#page').boundingBox();
        await page.setViewportSize({ width, height: Math.ceil(box.height) });
        return await page.screenshot({
          clip: { x: 0, y: 0, width, height: Math.ceil(box.height) },
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
