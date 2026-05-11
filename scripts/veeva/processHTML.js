import fs from "fs/promises";
import { fileURLToPath } from "url";
import posthtml from "posthtml";
import { processRTE } from "../automations_control/htmlParseFunctions.js";
import { ensureDirectoryExists, copyImages, validateFile, validateImage, formatFileSize } from "../utils/fileUtils.js";
import { minifyHtml, extractImagePaths, replaceLangAttributes, MINIFYOPTIONS } from "../utils/htmlUtils.js";
import { log } from "../utils/logUtils.js";
import { TICKET_INFO } from "../../src/ticket-info.js";

// ============================================================================
// CONFIGURATION
// ============================================================================

const __filename = fileURLToPath(import.meta.url);

const CONFIG = {
  input: {
    html: "./src/index.html",
    images: "./src/"
  },
  output: {
    html: "./dist/full_version/index.html",
    directory: "./dist/full_version"
  },
  processing: {
    minify: true,
    removeIndentations: true,
    removeLineBreaks: true,
    lineLengthLimit: 3000,
    copyImages: true,
    validateImages: true
  },
  logging: {
    verbose: true,
    showProgress: true
  }
};


/**
 * Process all images from HTML
 * @param {Array} imagePaths - Array of image paths
 * @param {string} outputDir - Output directory
 */
async function processImages(imagePaths) {
  if (!CONFIG.processing.copyImages || imagePaths.length === 0) {
    log("No images to process", "info");
    return;
  }
    
  const imageInfos = await Promise.all(
    imagePaths.map(path => validateImage(path, CONFIG.input.images))
  );
  
  const validImages = imageInfos.filter(info => info.exists);
  const missingImages = imageInfos.filter(info => !info.exists);
  
  if (missingImages.length > 0) {
    log(`Found ${missingImages.length} missing images`, "warn");
  }
    
  if (validImages.length > 0) {
    const imagesPaths = validImages.map(image => image.path)    
    await copyImages(CONFIG.input.images, CONFIG.output.directory,imagesPaths)     
  }
}


/**
 * Process HTML with PostHTML
 * @param {string} html - Input HTML
 * @returns {Promise<Object>} - Processed result
 */
async function processHtml(html) {
  try {    
    const result = await posthtml(processRTE()).process(html);
    
    // Debug: Check if percentages were processed
    if (result.html.includes("(95%)")) {
      log("WARNING: Percentages not processed correctly!", "warn");
    } else if (result.html.includes("&zwj;95&zwj;%&zwj;")) {
      log("SUCCESS: Percentages processed correctly!", "success");
    }
    
    return result;
  } catch (error) {
    log(`PostHTML processing failed: ${error.message}`, "error");
    throw error;
  }
}

// ============================================================================
// MAIN PROCESSING FUNCTION
// ============================================================================

/**
 * Main processing function
 */
async function processVeevaHtml() {
  const startTime = Date.now();
  
  try {   
    
    // Validate input file
    if (!(await validateFile(CONFIG.input.html))) {
      throw new Error(`Input file not found: ${CONFIG.input.html}`);
    }
    
    // Ensure output directory exists
    await ensureDirectoryExists(CONFIG.output.directory);
    
    // Read input HTML    
    const html = await fs.readFile(CONFIG.input.html, "utf8");
    
    if (!html || html.trim().length === 0) {
      throw new Error("Input HTML file is empty");
    }
    
    const originalSize = Buffer.byteLength(html, "utf8");  
    
    // Process HTML with PostHTML    
    const result = await processHtml(html);

    // Save html intermediate before minification for debug
    /*const debugPath = path.join(CONFIG.output.directory, "debug_posthtml.html");
    await fs.writeFile(debugPath, result.html, "utf8");
    log(`DEBUG: HTML intermediate saved in: ${debugPath}`, "info");*/
    
    // Extract images before minification
    const imagePaths = extractImagePaths(result.tree);
    // log(`Found ${imagePaths.length} images in HTML`, "info");

    //Replace LANG attribute:
    let finalHtml = result.html;
  
    const htmllang = replaceLangAttributes(finalHtml, TICKET_INFO.LANG)
    finalHtml = htmllang;
    // Minify HTML if enabled
    
    if (CONFIG.processing.minify) {      
      finalHtml = await minifyHtml(finalHtml, MINIFYOPTIONS);
    }
    
    // Write processed HTML
    await fs.writeFile(CONFIG.output.html, finalHtml, "utf8");
    
    const finalSize = Buffer.byteLength(finalHtml, "utf8");
    // const compressionRatio = ((originalSize - finalSize) / originalSize * 100).toFixed(2);    
    // log(`Final HTML size: ${formatFileSize(finalSize)} (${compressionRatio}% reduction)`, "success");
    
    // Process images
    await processImages(imagePaths);
    
    const totalTime = Date.now() - startTime;

    
  } catch (error) {
    log(`Processing failed: ${error.message}`, "error");
    process.exit(1);
  }
}

// ============================================================================
// EXECUTION
// ============================================================================

// Run the processor
processVeevaHtml();