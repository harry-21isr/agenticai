import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";
import puppeteer from "puppeteer";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_TXT_PATH = path.join(__dirname, "..", "..", "src", "index.txt");

const PX_PER_IN = 96;
const MAX_PAGE_IN = 199;
const MAX_PAGE_PX = MAX_PAGE_IN * PX_PER_IN;

const iPhone13 = {
  name: "iPhone 13",
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) " + "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
  viewport: {
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    isLandscape: false,
  },
};

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans);
    })
  );
}

// --- Text Processing Helpers (New) ---

function escapeHtml(text) {
  // Prevents XSS or broken HTML by converting special characters to safe entities.
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function linkify(text) {
  // Regex to find URLs (http/https) and replace them with blue HTML anchor tags.
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRegex, (url) => {
    return `<a href="${url}" style="color: blue; text-decoration: underline; word-break: break-all;" target="_blank">${url}</a>`;
  });
}

// --- Puppeteer Helpers ---

async function getPageHeight(page) {
  return await page.evaluate(() => {
    const body = document.body;
    const html = document.documentElement;
    const height = Math.max(body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight);
    return Math.ceil(height) + 1;
  });
}

async function preparePageForPrint(page) {
  await page.addStyleTag({
    content: `
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
        min-height: 100vh !important;
      }
      ::-webkit-scrollbar {
        display: none;
      }
    `,
  });
}

async function waitForRenderSettled(page, options = {}) {
  const timeoutMs = options.timeoutMs ?? 5000;
  try { await page.waitForFunction('document.readyState === "complete"', { timeout: timeoutMs }); } catch {}
  try { await page.evaluate(() => (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve())); } catch {}
  try { await page.waitForFunction(() => Array.from(document.images || []).every((img) => img.complete), { timeout: timeoutMs }); } catch {}
  try {
    let lastHeight = await page.evaluate(() => (document.body ? document.body.scrollHeight : 0));
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      const current = await page.evaluate(() => (document.body ? document.body.scrollHeight : 0));
      if (current === lastHeight) break;
      lastHeight = current;
    }
  } catch {}
}

async function loadContent(page, target, isHtml) {
  if (isHtml) {
    console.log(`   ...loading local text content`);
    
    // 1. Sanitize the raw text (escape < and >)
    const safeText = escapeHtml(target);
    // 2. Convert URL patterns to HTML <a> tags
    const linkedText = linkify(safeText);

    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          #txt-container {
            white-space: pre-wrap;
            word-wrap: break-word;
            font-family: Arial, sans-serif;
            font-size: 12px;
            line-height: 16px;
            color: #333;
            padding: 20px;
            width: 100%;
            box-sizing: border-box;
          }
          /* Ensures links are blue and clickable */
          a { color: blue !important; text-decoration: underline !important; }
        </style>
      </head>
      <body>
        <pre id="txt-container"></pre>
      </body>
      </html>
    `);

    // Inject the processed HTML safely
    await page.evaluate((htmlContent) => {
      document.getElementById('txt-container').innerHTML = htmlContent;
    }, linkedText);

  } else {
    console.log(`   ...navigating to URL: ${target}`);
    await page.goto(target, { waitUntil: "networkidle0" });
  }
}

async function generateDesktopPDF(browser, target, isHtml, outputPath) {
  const page = await browser.newPage();
  await page.setViewport({ width: 640, height: 800 });
  await page.emulateMediaType("screen");

  await loadContent(page, target, isHtml);
  await preparePageForPrint(page);
  await waitForRenderSettled(page);

  const fullHeight = await getPageHeight(page);

  await page.pdf({
    path: outputPath,
    printBackground: true,
    width: "640px",
    height: `${fullHeight}px`,
    preferCSSPageSize: false,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  await page.close();
}

async function generateMobilePDF(browser, target, isHtml, outputPath) {
  const page = await browser.newPage();
  await page.emulate(iPhone13);
  await page.emulateMediaType("screen");

  await loadContent(page, target, isHtml);
  await preparePageForPrint(page);
  await waitForRenderSettled(page);

  const fullHeight = await getPageHeight(page);
  const cssWidth = page.viewport().width;
  const needsScale = fullHeight > MAX_PAGE_PX;
  const scale = needsScale ? MAX_PAGE_PX / fullHeight : 1;
  const outHeight = needsScale ? MAX_PAGE_PX : fullHeight;

  await page.pdf({
    path: outputPath,
    printBackground: true,
    width: `${cssWidth}px`,
    height: `${outHeight}px`,
    scale: scale / 1.05,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    preferCSSPageSize: false,
  });

  await page.close();
}

// --- Main Execution ---

(async () => {
  try {
    // 1. Prepare Inputs
    let urlInput = await askQuestion("Please enter the HTTP URL: ");
    if (!urlInput.startsWith("http")) {
      urlInput = "https://" + urlInput;
    }

    const txtAbsolutePath = path.resolve(LOCAL_TXT_PATH);
    console.log(`🔎 Checking for local file at: ${txtAbsolutePath}`);
    
    let txtFileContent;
    try {
      txtFileContent = await fs.readFile(txtAbsolutePath, "utf8");
    } catch (e) {
      throw new Error(`Could not find index.txt at ${txtAbsolutePath}. Script aborted.`);
    }

    // 2. Prepare Output
    const outputDir = path.resolve("./url_pdfs");
    await fs.mkdir(outputDir, { recursive: true });
    console.log(`📂 Output folder ready: ${outputDir}`);

    // 3. Launch Browser
    const browser = await puppeteer.launch({
      channel: "chrome",
      headless: "new",
      timeout: 120000,
    });

    try {
      console.log(`--- processing URL ---`);
      const webDesktopPath = path.join(outputDir, "web_desktop.pdf");
      const webMobilePath = path.join(outputDir, "web_mobile.pdf");
      
      await generateDesktopPDF(browser, urlInput, false, webDesktopPath);
      await generateMobilePDF(browser, urlInput, false, webMobilePath);
      console.log(`✅ URL PDFs generated.`);

      console.log(`--- processing TEXT FILE ---`);
      const txtDesktopPath = path.join(outputDir, "text_desktop.pdf");

      await generateDesktopPDF(browser, txtFileContent, true, txtDesktopPath);
      console.log(`✅ Text File PDFs generated.`);

    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exitCode = 1;
  }
})();