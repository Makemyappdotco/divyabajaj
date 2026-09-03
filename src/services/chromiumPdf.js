let puppeteer;
let chromium;

async function launchBrowser() {
  if (!puppeteer) puppeteer = require('puppeteer-core');
  if (!chromium) chromium = require('@sparticuz/chromium');

  const executablePath = await chromium.executablePath();
  return puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 1240, height: 1754, deviceScaleFactor: 1 },
    executablePath,
    headless: 'shell'
  });
}

async function htmlToPdf(html) {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.evaluate(async () => {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      const images = Array.from(document.images || []);
      await Promise.all(images.map(img => img.complete ? Promise.resolve() : new Promise(resolve => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      })));
      const started = Date.now();
      while (!window.__DIVYA_REPORT_READY__ && Date.now() - started < 10000) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    });
    await page.emulateMediaType('print');
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      tagged: true
    });
  } finally {
    await browser.close();
  }
}

module.exports = { htmlToPdf };
