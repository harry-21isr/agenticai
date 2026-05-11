import fs from "fs";
import path from "path";
import posthtml from "posthtml";
import { processRTE } from "../automations_control/htmlParseFunctions.js";
import { ensureDirectoryExists, copyImages } from "../utils/fileUtils.js";
import { minifyHtml, extractImagePaths } from "../utils/htmlUtils.js";
import { log } from "../utils/logUtils.js";

// =====================
// CONFIGURATION
// =====================
const CONFIG = {
  srcDir: "./src",
  baseOutputDir: "./dist",
  html: {
    inputFile: "index.html",
    outputSubfolder: "full_version",
    outputFile: "index.html",
    minify: true,
    minifyOptions: {
      removeIndentations: true,
      removeLineBreaks: true,
      lineLengthLimit: 3000,
    }
  },
  logging: {
    verbose: true
  }
};

/**
 * Processes an input directory: minifies the HTML and copies images.
 * @param {string} inputDir - Input directory path.
 * @param {string} subfolderName - Subfolder name.
 */
async function processDirectory(inputDir, subfolderName) {
  const outputDir = path.join(CONFIG.baseOutputDir, subfolderName, CONFIG.html.outputSubfolder);
  await ensureDirectoryExists(outputDir);

  const inputFile = path.join(inputDir, CONFIG.html.inputFile);
  const outputFile = path.join(outputDir, CONFIG.html.outputFile);

  if (!fs.existsSync(inputFile)) {
    console.warn(`[WARN] No se encontró ${CONFIG.html.inputFile} en ${inputDir}`);
    return;
  }

  fs.readFile(inputFile, "utf8", (err, html) => {
    if (err) {
      console.error(`[ERROR] Al leer ${inputFile}:`, err);
      return;
    }

    posthtml(processRTE())
      .process(html)
      .then(async (result) => {
        let finalHtml = result.html;
        if (CONFIG.html.minify) {
          finalHtml = await minifyHtml(result.html, CONFIG.html.minifyOptions);
        }

        fs.writeFile(outputFile, finalHtml, (err) => {
          if (err) {
            console.error(`[ERROR] writting ${outputFile}:`, err);
            return;
          }
          if (CONFIG.logging.verbose) {
            console.log(`[OK] processed HTML: ${outputFile}`);
          }
        });

        // Copy referenced images
        const imagePaths = extractImagePaths(result.tree);
        copyImages(inputDir, outputDir, imagePaths);
      })
      .catch((err) => console.error("[ERROR] PostHTML:", err));
  });
}

// Create base output directory
await ensureDirectoryExists(CONFIG.baseOutputDir);

// Process all subfolders in src
fs.readdir(CONFIG.srcDir, { withFileTypes: true }, (err, files) => {
  if (err) {
    console.error("[ERROR] Reading src/:", err);
    return;
  }

  const dirs = files.filter((file) => file.isDirectory());
  if (dirs.length === 0) {
    console.warn("[WARN] There are no subfolders in src/");
  }

  dirs.forEach((file) => {
    const inputDir = path.join(CONFIG.srcDir, file.name);
    processDirectory(inputDir, file.name);
  });
});

