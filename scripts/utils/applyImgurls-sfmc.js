import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "node:path";

const OUTPUT_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "src"
);

const TICKETINFO_FILE = path.join(OUTPUT_DIR, "ticket-info.js");
const HTML_FILE = path.join(OUTPUT_DIR, "index.html");

/* --- helpers --- */

function parseImagesSourceURL(fileContent) {
  const match = fileContent.match(
    /export const imagesSourceURL\s*=\s*\{([\s\S]*?)\}/m
  );
  if (!match) return {};

  const objectBody = `{${match[1]}}`;
  // safe controlled eval (local file only)
  return Function(`"use strict"; return (${objectBody});`)();
}

async function loadImagesSourceURL(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return parseImagesSourceURL(content);
  } catch {
    return {};
  }
}

/* --- main logic --- */

async function replaceImageSrc() {
  const [html, imagesSourceURL] = await Promise.all([
    fs.readFile(HTML_FILE, "utf8"),
    loadImagesSourceURL(TICKETINFO_FILE),
  ]);

  let updatedHtml = html;
  let replacements = 0;

  for (const [localPath, remoteUrl] of Object.entries(imagesSourceURL)) {
    if (!remoteUrl) continue; // 👈 critical rule

    const escapedPath = localPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const srcRegex = new RegExp(
      `(<img[^>]+src=["'])${escapedPath}(["'])`,
      "g"
    );

    updatedHtml = updatedHtml.replace(srcRegex, (_, before, after) => {
      replacements++;
      return `${before}${remoteUrl}${after}`;
    });
  }

  if (replacements > 0) {
    await fs.writeFile(HTML_FILE, updatedHtml, "utf8");
    console.log(`✅ Replaced ${replacements} image src URLs`);
  } else {
    console.log("ℹ️ No image URLs to replace");
  }
}

replaceImageSrc().catch(err => {
  console.error("❌ Image src replacement failed");
  console.error(err);
  process.exit(1);
});
