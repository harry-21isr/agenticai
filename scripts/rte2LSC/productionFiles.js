import puppeteer from "puppeteer";
import archiver from "archiver";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(__dirname, "../../src");

const LSC_HTML        = path.join(SRC_DIR, "email_lsc.html");
const THUMBNAIL       = path.join(SRC_DIR, "thumbnail.jpg");
const IMAGES_DIR      = path.join(SRC_DIR, "images");
const FRAGMENTS_DIR   = path.join(SRC_DIR, "fragments");
const ARCHIVE         = path.join(SRC_DIR, "archive.zip");

const THUMBNAIL_WIDTH  = 600;
const THUMBNAIL_HEIGHT = 764; //keep aspect ration compared to  280 dimentions on y axis.
const THUMBNAIL_OUT_WIDTH  = 220;
const THUMBNAIL_OUT_HEIGHT = 280;

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".tif", ".tiff"]);

/**
 * Replace all img src="images/..." with src="attachments/..." in an HTML string.
 */
function replaceImagePaths(html) {
  return html.replace(/(<img\b[^>]*?\ssrc=")images\//gi, (_, prefix) => `${prefix}attachments/`);
}

/**
 * Recursively collect all image files under `dir`.
 * Returns an array of absolute file paths.
 */
function collectImagesFromDir(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectImagesFromDir(fullPath));
    } else if (IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Recursively walk a fragment subfolder.
 * - images/ folders → contents go to attachments/ (deduped with fragment name suffix).
 * - .html files → flattened into fragments/ (deduped with fragment name suffix).
 * - other files  → preserved relative to fragmentRoot under fragments/.
 * fragRenameMap tracks originalBasename → archiveBasename for this fragment's images.
 */
function walkFragment(currentDir, fragmentRoot, fragmentName, htmlEntries, imageEntries, otherEntries, seenHtmlNames, seenImageNames, fragRenameMap) {
  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    const fullPath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "images") {
        for (const imgPath of collectImagesFromDir(fullPath)) {
          const ext            = path.extname(imgPath);
          const basename       = path.basename(imgPath);
          const base           = path.basename(imgPath, ext);
          const archiveBasename = seenImageNames.has(basename)
            ? `${base}_${fragmentName}${ext}`
            : basename;
          const archiveName = `attachments/${archiveBasename}`;
          seenImageNames.add(basename);
          fragRenameMap.set(basename, archiveBasename);
          imageEntries.push({ absPath: imgPath, archiveName });
        }
      } else {
        walkFragment(fullPath, fragmentRoot, fragmentName, htmlEntries, imageEntries, otherEntries, seenHtmlNames, seenImageNames, fragRenameMap);
      }
    } else if (entry.isFile()) {
      if (path.extname(entry.name).toLowerCase() === ".html") {
        // Only include files built by build.js (ending in _lsc.html)
        if (!entry.name.endsWith("_lsc.html")) continue;
        const ext        = path.extname(entry.name);
        const base       = path.basename(entry.name, ext);
        // Strip the _lsc suffix for the archive name
        const cleanBase  = base.replace(/_lsc$/, "");
        const cleanName  = `${cleanBase}${ext}`;
        const archiveName = seenHtmlNames.has(cleanName)
          ? `fragments/${cleanBase}_${fragmentName}${ext}`
          : `fragments/${cleanName}`;
        seenHtmlNames.add(cleanName);
        htmlEntries.push({ absPath: fullPath, archiveName, fragRenameMap });
      } else if (!IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        const rel = path.relative(fragmentRoot, fullPath).replace(/\\/g, "/");
        otherEntries.push({ absPath: fullPath, archiveName: `fragments/${rel}` });
      }
    }
  }
}

/**
 * Walk each direct subfolder of `fragmentsDir` and collect all entries.
 * Returns { htmlEntries, imageEntries, otherEntries } — each entry is { absPath, archiveName }.
 */
function collectFragmentEntries(fragmentsDir) {
  const htmlEntries    = [];
  const imageEntries   = [];
  const otherEntries   = [];
  const seenHtmlNames  = new Set();
  const seenImageNames = new Set();

  for (const entry of fs.readdirSync(fragmentsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const fragmentPath  = path.join(fragmentsDir, entry.name);
    const fragRenameMap = new Map();
    walkFragment(fragmentPath, fragmentPath, entry.name, htmlEntries, imageEntries, otherEntries, seenHtmlNames, seenImageNames, fragRenameMap);
  }

  return { htmlEntries, imageEntries, otherEntries };
}

//  Generate thumbnail from email_lsc.html
async function generateThumbnail() {
  if (!fs.existsSync(LSC_HTML)) {
    throw new Error(`Input file not found: ${LSC_HTML}`);
  }

  // email_lsc.html may have attachments/ paths written by build.js.
  // puppeteer resolves images from disk (src/images/) first before taking screenshot.
  const rawHtml = fs.readFileSync(LSC_HTML, "utf8");
  const htmlForScreenshot = rawHtml.replace(
    /(<img\b[^>]*?\ssrc=")attachments\//gi,
    (_, prefix) => `${prefix}images/`
  );

  // Write a temp file next to email_lsc.html so relative paths resolve correctly
  const TEMP_HTML = path.join(SRC_DIR, "_thumbnail_tmp.html");
  fs.writeFileSync(TEMP_HTML, htmlForScreenshot, "utf8");

  const browser = await puppeteer.launch();
  const page    = await browser.newPage();

  try {
    await page.setViewport({ width: THUMBNAIL_WIDTH, height: THUMBNAIL_HEIGHT });
    await page.goto(pathToFileURL(TEMP_HTML).href, { waitUntil: "networkidle0" });

    // Scale the 600×600 viewport down to 200×300 output
    await page.evaluate((outW, outH, vpW, vpH) => {
      document.body.style.transformOrigin = "top left";
      document.body.style.transform = `scale(${outW / vpW}, ${outH / vpH})`;
      document.body.style.width  = vpW + "px";
      document.body.style.height = vpH + "px";
    }, THUMBNAIL_OUT_WIDTH, THUMBNAIL_OUT_HEIGHT, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);

    await page.screenshot({
      path: THUMBNAIL,
      clip: { x: 0, y: 0, width: THUMBNAIL_OUT_WIDTH, height: THUMBNAIL_OUT_HEIGHT },
      type: "jpeg",
      quality: 100,
    });

    console.log(`✅  Thumbnail saved to: ${THUMBNAIL}`);
  } finally {
    await browser.close();
    fs.unlinkSync(TEMP_HTML);
  }
}

// Bundle email_lsc.html (as index.html), images/ (as attachments/), fragments/ and thumbnail.png into archive.zip
function createArchive() {
  return new Promise((resolve, reject) => {
    const output  = fs.createWriteStream(ARCHIVE);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      console.log(`✅  Archive saved to: ${ARCHIVE} (${archive.pointer()} bytes)`);
      resolve();
    });
    archive.on("warning", (err) => {
      if (err.code === "ENOENT") console.warn("⚠️ ", err.message);
      else reject(err);
    });
    archive.on("error", reject);

    archive.pipe(output);

    // email_lsc.html -> archive as index.html (image paths rewritten images/ -> attachments/)
    const lscContent = replaceImagePaths(fs.readFileSync(LSC_HTML, "utf8"));
    archive.append(lscContent, { name: "index.html" });

    // thumbnail.png
    if (fs.existsSync(THUMBNAIL)) {
      archive.file(THUMBNAIL, { name: path.basename(THUMBNAIL) });
    } else {
      console.warn("⚠️  thumbnail.png not found, skipping.");
    }

    // images/ folder -> archived as attachments/
    if (fs.existsSync(IMAGES_DIR)) {
      archive.directory(IMAGES_DIR, "attachments");
    } else {
      console.warn("⚠️  images/ folder not found, skipping.");
    }

    // fragments/ subfolders:
    //   - HTML files flattened into fragments/
    //   - images/ subfolder contents moved into attachments/ (deduped with fragment name suffix)
    if (fs.existsSync(FRAGMENTS_DIR)) {
      const { htmlEntries, imageEntries, otherEntries } = collectFragmentEntries(FRAGMENTS_DIR);

      for (const { absPath, archiveName } of imageEntries) {
        archive.file(absPath, { name: archiveName });
      }
      if (imageEntries.length > 0) {
        console.log(`✅  Added ${imageEntries.length} image(s) from fragments/ into attachments/`);
      }

      for (const { absPath, archiveName, fragRenameMap } of htmlEntries) {
        // Rewrite src="images/X" → src="attachments/Y" using this fragment's rename map
        let content = fs.readFileSync(absPath, "utf8");
        content = content.replace(
          /(<img\b[^>]*?\ssrc=")images\/([^"]+)"/gi,
          (_, prefix, imgPath) => {
            const originalBasename = path.basename(imgPath);
            const newBasename      = fragRenameMap.get(originalBasename) ?? originalBasename;
            return `${prefix}attachments/${newBasename}"`;
          }
        );
        archive.append(content, { name: archiveName });
      }
      if (htmlEntries.length > 0) {
        console.log(`✅  Added ${htmlEntries.length} HTML file(s) into fragments/`);
      }

      for (const { absPath, archiveName } of otherEntries) {
        archive.file(absPath, { name: archiveName });
      }
    } else {
      console.warn("⚠️  fragments/ folder not found, skipping.");
    }

    archive.finalize();
  });
}

// Entry point
async function main() {
  await generateThumbnail();
  await createArchive();
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});

