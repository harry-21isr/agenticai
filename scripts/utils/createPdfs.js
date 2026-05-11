import fs from 'fs/promises';
import path from 'path';
import http from 'http';
import puppeteer from 'puppeteer';

const PX_PER_IN = 96;
const MAX_PAGE_IN = 199;
const MAX_PAGE_PX = MAX_PAGE_IN * PX_PER_IN;
const iPhone13 = {
  name: 'iPhone 13',
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) ' +
    'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
  viewport: {
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    isLandscape: false,
  },
};


async function getPageHeight(page) {
  return await page.evaluate(() => {
    return Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.offsetHeight,
      document.body.clientHeight,
      document.documentElement.clientHeight
    );
  });
}

async function waitForRenderSettled(page, options = {}) {
  const timeoutMs = options.timeoutMs ?? 5000;
  try {
    await page.waitForFunction('document.readyState === "complete"', { timeout: timeoutMs });
  } catch {}
  try {
    await page.evaluate(() => (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve());
  } catch {}
  try {
    await page.waitForFunction(() => Array.from(document.images || []).every(img => img.complete), { timeout: timeoutMs });
  } catch {}
  try {
    let lastHeight = await page.evaluate(() => document.body ? document.body.scrollHeight : 0);
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(200);
      const current = await page.evaluate(() => document.body ? document.body.scrollHeight : 0);
      if (current === lastHeight) break;
      lastHeight = current;
    }
  } catch {}
}


async function generateDesktopPDF(browser, targetUrl, outputPath) {
  const page = await browser.newPage();
  await page.setViewport({ width: 640, height: 800 });
  await page.emulateMediaType('screen');
  await page.goto(targetUrl, { waitUntil: 'networkidle0' });
  await waitForRenderSettled(page);

  const fullHeight = await getPageHeight(page);

  await page.pdf({
    path: outputPath,
    printBackground: true,
    width: '640px',
    height: `${fullHeight}px`,
    preferCSSPageSize: false,
  });


  await page.close();
}


async function generateMobilePDF(browser, targetUrl, outputPath) {
  const page = await browser.newPage();
  await page.emulate(iPhone13);
  await page.emulateMediaType('screen');
  await page.goto(targetUrl, { waitUntil: 'networkidle0' });
  await waitForRenderSettled(page);
  const fullHeight = await getPageHeight(page);
  const cssWidth = page.viewport().width;
  const needsScale = fullHeight > MAX_PAGE_PX;
  const scale = needsScale ? (MAX_PAGE_PX / fullHeight) : 1;
  const outHeight = needsScale ? MAX_PAGE_PX : fullHeight;

  await page.pdf({
    path: outputPath,
    printBackground: true,
    width: `${cssWidth}px`,
    height: `${outHeight}px`,
    scale: scale / 1.05,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    preferCSSPageSize: false
  });

  await page.close();
}

async function findBuildHtmlFiles(startDir) {
  // Recursively find all dist/**/full_version/build.html files
  const results = [];
  async function recurse(currentDir) {
    let entries;
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dirPath = path.join(currentDir, entry.name);
      if (entry.name === 'full_version') {
        const buildHtmlPath = path.join(dirPath, 'build.html');
        try {
          await fs.access(buildHtmlPath);
          results.push(buildHtmlPath);
        } catch {
          // ignore if not present
        }
      }
      await recurse(dirPath);
    }
  }
  await recurse(startDir);
  return results;
}

function getMimeType(ext) {
  const map = {
    '.html': 'text/html; charset=utf-8',
    '.htm': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.eot': 'application/vnd.ms-fontobject'
  };
  return map[ext.toLowerCase()] || 'application/octet-stream';
}


async function createStaticServer(rootDir, defaultFileName = 'build.html') {
  const absoluteRoot = path.resolve(rootDir);
  const server = http.createServer(async (req, res) => {
    try {
      const urlPath = decodeURI(new URL(req.url, 'http://localhost').pathname);
      const normalized = path.normalize(urlPath);
      const withoutLeading = normalized.replace(/^\/+/, '');
      const filePathRel = withoutLeading === '' ? defaultFileName : withoutLeading;
      const filePath = path.join(absoluteRoot, filePathRel);
      const resolved = path.resolve(filePath);
      if (!resolved.startsWith(absoluteRoot)) {
        res.writeHead(403); res.end('Forbidden'); return;
      }
      const data = await fs.readFile(resolved);
      res.writeHead(200, { 'Content-Type': getMimeType(path.extname(resolved)) });
      res.end(data);
    } catch {
      res.writeHead(404); res.end('Not found');
    }
  });


  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  return { server, port };
}

// Scan dist and generate PDFs next to each build.html
const distRoot = path.resolve('./dist');
try {
  const browser = await puppeteer.launch({
    channel: 'chrome',
    timeout : 120000
  });
  try {
    const buildFiles = await findBuildHtmlFiles(distRoot);
    if (buildFiles.length === 0) {
      console.log('ℹ️ No build.html files found under dist/**/full_version');
    }
    for (const buildHtmlPath of buildFiles) {
      const folder = path.dirname(buildHtmlPath);
      const desktopPdfPath = path.join(folder, 'desktop.pdf');
      const mobilePdfPath = path.join(folder, 'mobile.pdf');


      console.log(`Generating PDFs for: ${buildHtmlPath}`);
      // Create a temporary HTML - normalize media queries
      const originalHtml = await fs.readFile(buildHtmlPath, 'utf8');
      const tempFileName = '__build_pdf_temp.html';
      const tempHtmlPath = path.join(folder, tempFileName);
      await fs.writeFile(tempHtmlPath, originalHtml, 'utf8');


      const { server, port } = await createStaticServer(folder, tempFileName);
      try {
        const buildUrl = `http://127.0.0.1:${port}/${encodeURIComponent(tempFileName)}`;
        await generateDesktopPDF(browser, buildUrl, desktopPdfPath);
        console.log(`✅ Desktop PDF: ${desktopPdfPath}`);
        await generateMobilePDF(browser, buildUrl, mobilePdfPath);
        console.log(`✅ Mobile PDF: ${mobilePdfPath}`);
      } finally {
        /* await new Promise((resolve) => server.close(resolve)); 
        */
        server.close()
        // Remove the temporary normalized HTML
        try { await fs.unlink(tempHtmlPath); } catch {}
      }
    }
  } finally {
    await browser.close();
  }
} catch (err) {
  console.error('❌ Error generating PDFs:', err);
  process.exitCode = 1;
}
