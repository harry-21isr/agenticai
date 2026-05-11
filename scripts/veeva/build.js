import readline from "node:readline/promises";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { log } from "../utils/logUtils.js";
import { ensureDirectoryExists, removeDirectoryRecursively, copyImagesFromTo, archiveFolder } from "../utils/fileUtils.js";

/**
 * Veeva Build System - Enhanced Version
 * 
 * This module handles the complete build process for Veeva email templates:
 * - HTML template processing with tokens and fragments
 * - Fragment detection and management
 * - Image processing and archiving
 * - Production file generation
 * - Interactive CLI for fragment configuration
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG = {
  paths: {
    root: path.join(__dirname, "..", ".."),
    fullVersion: path.join(__dirname, "..", "..", "dist", "full_version"),
    fragmentedVersion: path.join(__dirname, "..", "..", "dist", "fragmented_version"),
    src: path.join(__dirname, "..", "..", "src")
  },
  files: {
    indexHtml: "index.html",
    buildHtml: "build.html",
    imagesFolder: "images",
    imagesZip: "images.zip",
    fragmentsFolder: "fragments",
    fragmentsZip: "fragments.zip",
    veevaConfig: "veeva.config.json"
  },
  processing: {
    compressionLevel: 9,
    supportedImageFormats: /\.(jpg|jpeg|png|gif|bmp|tiff|webp)$/,
    fragmentRegex: /<!--\s*?fragment\s?([\s\S]*?)\s?start\s*?-->([\s\S]*?)<!--\s?fragment\s?\1\s?end\s*?-->/g,
    imageRegex: /<img[^>]+src=["']?([^"'{}]+)["']?[^>]*>/g,
    fragmentsTokenRegex: /"{{insertEmailFragments(\\[.*\\])?}}"/,
    customTextRegex: /{{customText\\[.*\\|(.*)\\]}}/,
    emailFragmentsRegex: /{{insertEmailFragments(\\[.*\\])?}}/,
    tokenRegex: /{{([^}]+)}}/g
  },
  cli: {
    yesAnswers: ["y", "yes"],
    noAnswers: ["n", "no"]
  }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create readline interface for CLI
 * @returns {Object} - Readline interface
 */
function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}


// ============================================================================
// HTML PROCESSING
// ============================================================================

/**
 * Replace configured Veeva tokens in HTML
 * @param {string} html - HTML content
 * @param {Object} tokens - Token mapping
 * @returns {string} - HTML with replaced tokens
 */
function replaceConfiguredVeevaTokens(html, tokens) {
  if (!tokens || typeof tokens !== "object") {
    return html;
  }
  
  Object.keys(tokens).forEach((token) => {
    const regex = new RegExp(`{{${token}}}`, "g");
    html = html.replace(regex, tokens[token]);
  });
  
  return html;
}

/**
 * Replace custom text patterns in HTML
 * @param {string} html - HTML content
 * @returns {string} - HTML with replaced custom text
 */
function replaceVeevaCustomText(html) {
  let replacedHtml = html;
  let regexResult;
  
  while (CONFIG.processing.customTextRegex.test(replacedHtml)) {
    regexResult = CONFIG.processing.customTextRegex.exec(replacedHtml);
    if (regexResult && regexResult.length >= 2) {
      replacedHtml = replacedHtml.replace(CONFIG.processing.customTextRegex, regexResult[1]);
    }
  }
  
  return replacedHtml;
}

/**
 * Replace email fragments in HTML
 * @param {string} html - HTML content
 * @param {Array} fragments - Array of fragment objects
 * @returns {string} - HTML with replaced fragments
 */
function replaceVeevaEmailFragments(html, fragments) {
  if (!fragments || fragments.length === 0) {
    return html;
  }
  
  const fragmentsHtml = fragments.map(fragment => fragment.html).join("");
  return html.replace(CONFIG.processing.emailFragmentsRegex, fragmentsHtml);
}

/**
 * Manage HTML fragments from query parameters
 * @param {Object} queryParams - Query parameters
 * @param {Object} veevaConfig - Veeva configuration
 * @returns {Array} - Array of fragment objects
 */
function manageHtmlFragments(queryParams, veevaConfig) {
  if (!queryParams || !queryParams.fragments) {
    return [];
  }
  
  const fragmentsFolder = veevaConfig.fragmentsFolder || "fragments";
  const fragmentsList = queryParams.fragments.split(",");
  
  return fragmentsList.map((fragment) => {
    const fragmentPath = path.join(CONFIG.paths.src, fragmentsFolder, fragment);
    
    if (fsSync.existsSync(fragmentPath)) {
      let fragmentHtml = fsSync.readFileSync(fragmentPath, "utf8");
      return {
        html: replaceConfiguredVeevaTokens(fragmentHtml, veevaConfig.tokens),
      };
    } else {
      log(`Fragment not found: ${fragment}`, "warn");
      return null;
    }
  }).filter(Boolean);
}

/**
 * Manage email HTML template with fragments and tokens
 * @param {string} filePath - Path to HTML file
 * @param {Object} queryParams - Query parameters
 * @param {Object} veevaConfig - Veeva configuration
 * @returns {string} - Processed HTML
 */
function manageEmailHtmlTemplate(filePath, queryParams, veevaConfig) {
  let html = fsSync.readFileSync(filePath, "utf8");
  const fragments = manageHtmlFragments(queryParams, veevaConfig);
  
  if (fragments && fragments.length > 0) {
    html = replaceVeevaEmailFragments(html, fragments);
  }
  
  html = replaceConfiguredVeevaTokens(html, veevaConfig.tokens);
  return html;
}

/**
 * Replace Veeva HTML with tokens and custom text
 * @param {string} filePath - Path to HTML file
 * @param {Object} queryParams - Query parameters
 * @param {Object} veevaConfig - Veeva configuration
 * @returns {Promise<string>} - Processed HTML
 */
async function replaceVeevaHtml(filePath, queryParams, veevaConfig) {
  if (!filePath) {
    return null;
  }
  
  const html = manageEmailHtmlTemplate(filePath, queryParams, veevaConfig);
  
  if (html && veevaConfig && veevaConfig.tokens) {
    let replacedHtml = replaceConfiguredVeevaTokens(html, veevaConfig.tokens);
    replacedHtml = replaceVeevaCustomText(replacedHtml);
    return replacedHtml;
  }
  
  return html;
}

/**
 * Create minified HTML file
 * @param {string} inputPath - Input HTML file path
 * @param {string} outputPath - Output HTML file path
 * @param {string} versionFolder - Version folder path
 */
async function createMinifiedHtml(inputPath, outputPath, versionFolder) {
  log(`Minifying HTML ...`, "info");
  
  const veevaConfigPath = path.join(versionFolder, CONFIG.files.veevaConfig);
  let inputHtml;
  
  if (fsSync.existsSync(veevaConfigPath)) {
    const veevaConfig = JSON.parse(fsSync.readFileSync(veevaConfigPath, "utf8"));
    inputHtml = await replaceVeevaHtml(inputPath, [], veevaConfig);
    
    if (!inputHtml) {
      throw new Error(`Error replacing tokens in HTML: ${inputPath}`);
    }
  } else {
    inputHtml = fsSync.readFileSync(inputPath, "utf8");
    
    if (!inputHtml) {
      throw new Error(`Error reading HTML file: ${inputPath}`);
    }
  }
  
  const outputHtmlContent = inputHtml.replace(/ {2}/g, "");
  await fs.writeFile(outputPath, outputHtmlContent, "utf8");
  
  log(`HTML minified successfully`, "success");
}

// ============================================================================
// IMAGE PROCESSING
// ============================================================================
/**
 * Extract image paths from HTML content
 * @param {string} htmlContent - HTML content
 * @returns {Array} - Array of image paths
 */
function extractImagePaths(htmlContent) {
  const images = [];
  let match;
  
  while ((match = CONFIG.processing.imageRegex.exec(htmlContent)) !== null) {
    const imageUrl = match[1];
    if (!imageUrl.startsWith("data:") && !imageUrl.startsWith("http")) {
      images.push(imageUrl);
    }
  }
  
  return [...new Set(images)]; // Remove duplicates
}


// ============================================================================
// FRAGMENT PROCESSING
// ============================================================================

/**
 * Create build configuration from HTML file
 * @param {string} inputHtmlPath - Input HTML file path
 * @param {Array} fragmentLimitations - Fragment limitations
 * @returns {Object} - Build configuration
 */
function createBuildConfig(inputHtmlPath, fragmentLimitations) {   
  const inputHtmlContent = fsSync.readFileSync(inputHtmlPath, "utf8");
  let fragmentMatch;
  let fragmentsWithoutImages = [];
  let i = 0;
  
  // Extract fragments
  while ((fragmentMatch = CONFIG.processing.fragmentRegex.exec(inputHtmlContent)) !== null) {
    i++;
    const fragmentIdentifier = fragmentMatch[1];
    const fragmentContent = fragmentMatch[2];
    
    fragmentsWithoutImages.push({
      name: fragmentIdentifier ? `${fragmentIdentifier}` : `fragment${i}`,
      content: fragmentContent,
    });
  }
  
  // Create fragments with images
  const fragments = fragmentsWithoutImages.map((fragmentWithoutImage) => {
    const images = extractImagePaths(fragmentWithoutImage.content);
    return { ...fragmentWithoutImage, images };
  });
  
  // Create layout
  const inputHtmlContentSplitByFragmentsWithWhiteSpaces = inputHtmlContent.split(CONFIG.processing.fragmentRegex);
  const inputHtmlContentSplitByFragments = inputHtmlContentSplitByFragmentsWithWhiteSpaces.filter(
    (content) => content.trim() !== ""
  );
  
  const alreadyHasFragmentsToken = CONFIG.processing.fragmentsTokenRegex.test(inputHtmlContent);
  const tokenReplacingFragments = fragmentLimitations
    ? `{{insertEmailFragments[${fragmentLimitations.toString()}]}}`
    : "{{insertEmailFragments}}";
  
  const layoutContent = `${inputHtmlContentSplitByFragments[0]}${
    alreadyHasFragmentsToken ? "" : tokenReplacingFragments
  }${
    inputHtmlContentSplitByFragments[inputHtmlContentSplitByFragments.length - 1]
  }`;
  
  const layoutImages = extractImagePaths(layoutContent);
  const layout = { content: layoutContent, images: layoutImages };
  
  const isFragmented = fragments.length > 0;
  
  log(`${isFragmented ? `Found ${fragments.length} fragments` : "No fragments found"}. Build config ready.`, "info");
  
  return {
    isFragmented,
    fragments,
    layout,
  };
}

/**
 * Count fragments in HTML file
 * @param {string} folderPath - Folder path containing index.html
 * @returns {Promise<number>} - Number of fragments
 */
async function countFragments(folderPath) {
  const fullFilePath = path.join(folderPath, CONFIG.files.indexHtml);
  
  try {
    const data = await fs.readFile(fullFilePath, "utf8");
    const fragments = data.match(CONFIG.processing.fragmentRegex) || [];
    return fragments.length;
  } catch (error) {
    log(`Error reading file: ${error.message}`, "error");
    return 0;
  }
}

// ============================================================================
// BUILD PROCESS
// ============================================================================

/**
 * Process fragments and create fragmented version
 * @param {Object} buildConfig - Build configuration
 * @param {Object} paths - Path configuration
 */
async function processFragments(buildConfig, paths) {
  const { fragments, layout } = buildConfig;
  
  // Create fragmented version folder structure
  await ensureDirectoryExists(paths.fragmentedVersion);
  await ensureDirectoryExists(path.join(paths.fragmentedVersion, CONFIG.files.fragmentsFolder));
  await ensureDirectoryExists(paths.fragmentedLayoutImages);
  
  // Process layout
    await fs.writeFile(paths.fragmentedIndexHtml, layout.content, "utf8");
  await createMinifiedHtml(paths.fragmentedIndexHtml, paths.fragmentedBuildHtml, paths.fragmentedVersion);
  await fs.unlink(paths.fragmentedIndexHtml);
  
  // Copy layout images
  for (const imageUrl of layout.images) {
    const sourceImage = path.join(paths.fullVersion, imageUrl);
    const imageName = path.basename(sourceImage);
    const destImage = path.join(paths.fragmentedLayoutImages, imageName);
    await fs.copyFile(sourceImage, destImage);
  }
  
  await archiveFolder(paths.fragmentedLayoutImages, paths.fragmentedLayoutArchivedImages, "images");
  
  // Process individual fragments
  log(`Processing ${fragments.length} fragments...`, "info");
  
  await Promise.all(
    fragments.map(async (fragment) => {
      const fragmentFolder = path.join(paths.fragmentedVersion, CONFIG.files.fragmentsFolder, fragment.name);
      const fragmentIndexHtml = path.join(fragmentFolder, CONFIG.files.indexHtml);
      const fragmentBuildHtml = path.join(fragmentFolder, CONFIG.files.buildHtml);
      const fragmentImages = path.join(fragmentFolder, CONFIG.files.imagesFolder);
      const fragmentImagesZip = path.join(fragmentFolder, CONFIG.files.imagesZip);
      
      await ensureDirectoryExists(fragmentFolder);
      await fs.writeFile(fragmentIndexHtml, fragment.content, "utf8");
      await createMinifiedHtml(fragmentIndexHtml, fragmentBuildHtml, paths.fragmentedVersion);
      await fs.unlink(fragmentIndexHtml);
      
      if (fragment.images.length > 0) {
        await ensureDirectoryExists(fragmentImages);
        
        for (const imageUrl of fragment.images) {
          const sourceImage = path.join(paths.fullVersion, imageUrl);
          const imageName = path.basename(sourceImage);
          const destImage = path.join(fragmentImages, imageName);
          await fs.copyFile(sourceImage, destImage);
        }
        
        await archiveFolder(fragmentImages, fragmentImagesZip, "images");
      }
    })
  );
  
  // Archive fragments folder
  await archiveFolder(
    path.join(paths.fragmentedVersion, CONFIG.files.fragmentsFolder),
    path.join(paths.fragmentedVersion, CONFIG.files.fragmentsZip),
    false
  );
}

/**
 * Main build function
 * @param {Object} options - Build options
 */
async function build(options) {
  const {
    pathToFullVersionFolder,
    pathToIndexHtml = path.join(pathToFullVersionFolder, CONFIG.files.indexHtml),
    pathToBuildHtml = path.join(pathToFullVersionFolder, CONFIG.files.buildHtml),
    pathToImages = path.join(pathToFullVersionFolder, CONFIG.files.imagesFolder),
    pathToArchivedImages = path.join(pathToFullVersionFolder, CONFIG.files.imagesZip),
    pathToFragmentedVersionFolder = path.join(pathToFullVersionFolder, "..", "fragmented_version"),
    pathToFragmentedIndexHtml = path.join(pathToFragmentedVersionFolder, CONFIG.files.indexHtml),
    pathToFragmentedBuildHtml = path.join(pathToFragmentedVersionFolder, CONFIG.files.buildHtml),
    pathToFragmentedLayoutImages = path.join(pathToFragmentedVersionFolder, CONFIG.files.imagesFolder),
    pathToFragmentedLayoutArchivedImages = path.join(pathToFragmentedVersionFolder, CONFIG.files.imagesZip),
    fragmentNumberLimitations,
  } = options;
  
  const paths = {
    fullVersion: pathToFullVersionFolder,
    fragmentedVersion: pathToFragmentedVersionFolder,
    indexHtml: pathToIndexHtml,
    buildHtml: pathToBuildHtml,
    images: pathToImages,
    archivedImages: pathToArchivedImages,
    fragmentedIndexHtml: pathToFragmentedIndexHtml,
    fragmentedBuildHtml: pathToFragmentedBuildHtml,
    fragmentedLayoutImages: pathToFragmentedLayoutImages,
    fragmentedLayoutArchivedImages: pathToFragmentedLayoutArchivedImages,
  };
  
  try {  
    // Create build configuration
    const buildConfig = createBuildConfig(pathToIndexHtml, fragmentNumberLimitations);
    
    // Remove existing fragmented version
    await removeDirectoryRecursively(pathToFragmentedVersionFolder);
    
    // Process fragments if they exist
    if (buildConfig.isFragmented) {
      await processFragments(buildConfig, paths);
    }
    
    // Create full version build
    log("Creating full version build...", "info");
    const imagesOnlyFolder = path.join(pathToFullVersionFolder, "imagesOnly");
    await ensureDirectoryExists(imagesOnlyFolder);
    copyImagesFromTo(pathToImages, imagesOnlyFolder);
    await archiveFolder(imagesOnlyFolder, pathToArchivedImages, "images");
    await removeDirectoryRecursively(imagesOnlyFolder);    
    await createMinifiedHtml(pathToIndexHtml, pathToBuildHtml, pathToFullVersionFolder);
    await fs.unlink(pathToIndexHtml);
    
    log("Veeva build completed successfully!", "success");
    
  } catch (error) {
    log(`Build failed: ${error.message}`, "error");
    throw error;
  }
}

// ============================================================================
// CLI INTERFACE
// ============================================================================

/**
 * Ask user for production files configuration
 */
async function askForProductionFiles() {
  const rl = createReadlineInterface();
  
  try {
    const fragmentsNumber = await countFragments(CONFIG.paths.fullVersion);
    
    if (fragmentsNumber > 0) {
      log(`Found ${fragmentsNumber} fragments`, "info");
      
      const answer = await rl.question(
        "Fragments detected. Do you want to define min/max fragments value in RTE? (y/n): "
      );
      
      const normalizedAnswer = answer.toLowerCase();
      
      if (CONFIG.cli.yesAnswers.includes(normalizedAnswer)) {
        const minVal = await rl.question(
          "Enter minimum number of fragments (e.g., 1): "
        );
        const maxVal = await rl.question(
          `Enter maximum number of fragments (max: ${fragmentsNumber}): `
        );
        
        const fragmentsLimitations = [parseInt(minVal), parseInt(maxVal)];
        
        await build({
          pathToFullVersionFolder: CONFIG.paths.fullVersion,
          fragmentNumberLimitations: fragmentsLimitations,
        });
      } else if (CONFIG.cli.noAnswers.includes(normalizedAnswer)) {
        await build({
          pathToFullVersionFolder: CONFIG.paths.fullVersion,
        });
      } else {
        log("Invalid answer. Please type 'y' or 'n'.", "warn");
      }
    } else {      
      await build({
        pathToFullVersionFolder: CONFIG.paths.fullVersion,
      });
    }
  } catch (error) {
    log(`CLI error: ${error.message}`, "error");
  } finally {
    rl.close();
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

/**
 * Main execution function
 */
async function main() {
  try {
    await askForProductionFiles();
  } catch (error) {
    log(`Build process failed: ${error.message}`, "error");
    process.exit(1);
  }
}

// Run the build system
main();
