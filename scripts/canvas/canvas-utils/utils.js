import { promises as promises } from "fs";
import fs from "fs";
import path from "path";
import chalk from "chalk";
import logger from "./logger.js";
import setLinkStyles from "./setLinkStyles.js";
import makeNotClickable from "./makeNotClickable.js";
import updateLineHeight from "./updateLineHeight.js";
import updateGlobalCss from "./updateGlobalCss.js";
import replaceInHTML from "./replaceInHTML.js";
import updateVeevaTokens from "./updateVeevaTokens.js";
import updatePadding from "./updatePadding.js";
import minifyEmailHTML from "./minifyEmailHTML.js";
import convertRgbToHex from "./convertRgbToHex.js";
import { fixOutlookButtons } from "./fixOutlookButtons.js";
import { processPreheader } from "./formatPreheader.js";
import { injectLangAttribute } from "./injectLangAttribute.js";
import { convertCharsToEntities } from "./charsToEntities.js";
import { imgGmailFix } from "./imgGmailFix.js";
import browser from "./browser.js";
import { CANVAS_AUTOMATIONS } from "../../automations_control/canvasAutomationsSwitch.js";
import readline from "readline";
import { archiveFolder } from "../../utils/fileUtils.js";

const FULLVERSION_DIR = "full_version";

/**
 * Reads the HTML file from the specified folder.
 * @param {string} folderPath - Path to the folder containing the HTML file.
 * @returns {Promise<string>} - Returns the HTML content as a string.
 */
async function getHTML(folderPath = "") {
  try {
    // Read the files from the src directory
    const files = await promises.readdir("./" + folderPath + "src");
    const htmlFile = files.find((el) => el.endsWith(".html"));

    // Check if HTML file exists
    if (!htmlFile) {
      logger.log("No HTML file found in the SRC folder.", "error");
      logger.printLogs();
      process.exit(1);
    }

    // Log the found HTML file and read its content
    logger.log(`File: ${chalk.red.bold(htmlFile)}.`, "info");
    let data = await promises.readFile("./" + folderPath + "src/" + htmlFile, "utf8");

    return data; // Return the HTML file content
  } catch (error) {
    logger.log(error.message, "fatal");
    logger.printLogs();
    process.exit(1);
  }
}

/**
 * Deletes a folder and its contents recursively if it exists.
 * @param {string} folderPath - Path to the folder to delete.
 */
async function deleteFolder(folderPath) {
  try {
    await promises.access(folderPath); // Check if the folder exists
    await promises.rm(folderPath, { recursive: true, force: true }); // Delete the folder recursively
  } catch (error) {
    // Fail silently if folder does not exist
  }
}

/**
 * Replaces image filenames in the HTML with sequential names in the format prefix-n.ext.
 * @param {string} html - The HTML content.
 * @returns {Object} - Returns the updated HTML and a mapping of old to new image names.
 */
function changePhotosNames(html = "") {
  const srcRegex = /src=(["'])(.+?)(["'])/g;
  const mapper = {}; // Stores old-to-new filename mapping
  const prefix = "hwe7384zyzto5vgxifdp"; // Fixed prefix for filenames
  const counters = {}; // Counter for each file type

  // Replace image file names in the HTML and build the mapper
  const newHTML = html.replace(srcRegex, (match, quote, path) => {
    // Extract filename and extension
    const parts = path.split("images/");
    if (parts.length < 2) return match; // Skip if not in the "images/" folder

    const [filename, ext] = parts[1].split(".");
    if (!ext) return match; // Skip if no extension

    const decodedFilename = decodeURI(filename);

    // If we've already assigned this filename a new name, reuse it
    if (mapper[decodedFilename]) {
      return `src=${quote}images/${mapper[decodedFilename]}${quote}`;
    }

    // Increment the counter for this extension
    if (!counters[ext]) counters[ext] = 0;
    counters[ext]++;

    // Pad the counter with leading zeros if less than 10
    const paddedCounter = counters[ext] < 10 ? `0${counters[ext]}` : counters[ext];

    // Generate the new name
    const newName = `${prefix}-${paddedCounter}.${ext}`;

    // Map old filename to new filename
    mapper[decodeURI(filename)] = newName;

    // Return updated src attribute
    return `src=${quote}images/${newName}${quote}`;
  });

  return { newHTML, mapper };
}

/**
 * Copies renamed images from the source folder to a new folder, updating image names in the HTML.
 * @param {Object} mapper - Mapping of original image names to new names.
 * @param {string} html - The updated HTML content.
 * @param {string} folderPath - Base folder path.
 */
async function copyImageToNewFolder(mapper, html, folderPath = "") {
  await deleteFolder(folderPath + "dist"); // Delete the previous folder if it exists
  await promises.mkdir(folderPath + "dist/"); // Create new folder for the build
  await promises.mkdir(folderPath + "dist/" + FULLVERSION_DIR); // Create new folder for the build
  await promises.writeFile(path.join(folderPath + "dist/" + FULLVERSION_DIR, "build.html"), html); // Save the updated HTML

  if (Object.keys(mapper).length !== 0) {
    // Copy images from the source folder to the new folder
    const photosInFolder = await promises.readdir(folderPath + "src/images");
    for (const el of photosInFolder) {
      const imageName = el.split(".")[0];
      if (!imageName) continue;
      try {
        await promises.cp(path.join(folderPath + "src/images", el), path.join(folderPath + "dist/" + FULLVERSION_DIR, "images", mapper[imageName]));
      } catch (err) {
        logger.log("Error copying image: " + el + ". Image might not be in use.", "error");
      }
    }
  }
}

/**
 * Executes the full build script, processing the HTML and images, then zipping the images.
 */
async function runBuildScript() {
  await buildScript(); // Run the build script
  browser.closeBrowser(); // Close the browser if open
  logger.printLogs(); // Print log output
  process.exit(); // Exit the process
}


/**
 * Prompt the user for input in the CLI
 * @param {string} question - The question to show the user
 * @returns {Promise<string>} - The user input
 */
function askUser(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

//Generates the correct split proccess to each file in canvas structure for production
async function exportFragments(originalHtml, folderPath = "", mapper = {}) {
  const fragmentRegex = /<!--\s*fragment\s+(.+?)\s+start\s*-->([\s\S]*?)<!--\s*fragment\s+\1\s+end\s*-->/gi;

  let cleanedHTML = originalHtml;
  const fragmentNumbers = [];
  let firstFragmentMatch = null;
  let fragmentIndex = 0;

  // Collect all fragments
  const allMatches = [];
  let match;
  while ((match = fragmentRegex.exec(originalHtml)) !== null) {
    allMatches.push(match);
  }

  if (allMatches.length === 0) {
    logger.log("No fragments found. Skipping export.", "info");
    return originalHtml;
  }

  // Process fragments
  for (const match of allMatches) {
    const fragmentName = match[1].trim();
    fragmentIndex++;
    fragmentNumbers.push(fragmentIndex);

    if (!firstFragmentMatch) firstFragmentMatch = match[0];

    const fragmentContent = match[2].trim();
    cleanedHTML = cleanedHTML.replace(match[0], ""); // remove fragment from cleaned

    const fragmentDir = path.join(folderPath, "dist", "fragmented_version", "fragments", fragmentName);
    await promises.mkdir(fragmentDir, { recursive: true });

    // Save fragment HTML
    const fragmentHtmlPath = path.join(fragmentDir, `${fragmentName}.html`);
    await promises.writeFile(fragmentHtmlPath, fragmentContent, "utf8");

    // Copy images only if found
    const imgSrcRegex = /<img[^>]+src=["']([^"']+)["']/g;
    let imgMatch;
    let hasImages = false;
    let imagesDir = path.join(fragmentDir, "images");

    while ((imgMatch = imgSrcRegex.exec(fragmentContent)) !== null) {
      const imgSrc = imgMatch[1];
      if (imgSrc.startsWith("images/")) {
        if (!hasImages) {
          await promises.mkdir(imagesDir, { recursive: true });
          hasImages = true;
        }

        const renamedFile = imgSrc.replace("images/", "");
        const origFile = Object.keys(mapper).find((key) => mapper[key] === renamedFile);

        if (!origFile) {
          logger.log(`Could not resolve original for ${renamedFile}`, "error");
          continue;
        }

        const ext = path.extname(renamedFile);
        const sourcePath = path.join(folderPath, "src", "images", origFile + ext);
        const destPath = path.join(imagesDir, renamedFile);

        try {
          await promises.copyFile(sourcePath, destPath);
          logger.log(`Copied image for fragment "${fragmentName}": ${renamedFile}`, "info");
        } catch {
          logger.log(`Image not found for fragment "${fragmentName}": ${origFile}${ext}`, "error");
        }
      }
    }

    // Compress fragment images folder (if created)
    if (hasImages) {
      await archiveFolder(imagesDir, `${imagesDir}.zip`, "images")
    }

    // Compress the entire fragments folder if it exists
    const fragmentsDir = path.join(folderPath, "dist", "fragmented_version", "fragments");
    try {
      const stats = await promises.stat(fragmentsDir);
      if (stats.isDirectory()) {
        await archiveFolder(fragmentsDir, `${fragmentsDir}.zip`, false)
        logger.log(`Compressed entire fragments folder → ${fragmentsDir}.zip`, "info");
      }
    } catch (err) {
      console.log(err)
    }

    logger.log(`Exported fragment #${fragmentIndex} (${fragmentName}) → ${fragmentHtmlPath}`, "info");
  }

  // CLI prompt for fragment tokens
  if (fragmentNumbers.length > 0 && firstFragmentMatch) {
    const minNum = Math.min(...fragmentNumbers);
    const maxNum = Math.max(...fragmentNumbers);

    let addFragmentToken = await askUser(`Fragments detected. Do you want to define min/max fragments value in RTE? (y/n)`);
    let token;

    if (addFragmentToken.toLowerCase() === "y") {
      let min = (await askUser(`Enter MIN fragment number [default ${minNum}]: `)) || minNum;
      let max = (await askUser(`Enter MAX fragment number [default ${maxNum}]: `)) || maxNum;

      token = `{{insertEmailFragments[${min},${max}]}}`;
    } else {
      token = `{{insertEmailFragments}}`;
    }

    cleanedHTML = originalHtml.replace(firstFragmentMatch, token);
    cleanedHTML = cleanedHTML.replace(fragmentRegex, "");
  }

  // Save cleaned build.html
  const cleanedBuildPath = path.join(folderPath, "dist", "fragmented_version", "build.html");
  await promises.mkdir(path.dirname(cleanedBuildPath), { recursive: true });
  await promises.writeFile(cleanedBuildPath, cleanedHTML, "utf8");

  // Copy images for cleaned build.html
  const imgSrcRegex = /<img[^>]+src=["']([^"']+)["']/g;
  let hasGlobalImages = false;
  let globalImagesDir = path.join(folderPath, "dist", "fragmented_version", "images");
  //const fragmentsDir = path.join(folderPath, "dist", "fragmented_version", "fragments");

  while ((match = imgSrcRegex.exec(cleanedHTML)) !== null) {
    const imgSrc = match[1];
    if (imgSrc.startsWith("images/")) {
      if (!hasGlobalImages) {
        await promises.mkdir(globalImagesDir, { recursive: true });
        hasGlobalImages = true;
      }

      const renamedFile = imgSrc.replace("images/", "");
      const origFile = Object.keys(mapper).find((key) => mapper[key] === renamedFile);

      if (!origFile) {
        logger.log(`Could not resolve original for ${renamedFile}`, "error");
        continue;
      }

      const ext = path.extname(renamedFile);
      const sourcePath = path.join(folderPath, "src", "images", origFile + ext);
      const destPath = path.join(globalImagesDir, renamedFile);

      try {
        await promises.copyFile(sourcePath, destPath);
        logger.log(`Copied build.html image: ${renamedFile}`, "info");
      } catch {
        logger.log(`Image not found for build.html: ${origFile}${ext}`, "error");
      }
    }
  }

  // Compress global images folder (if created)
  if (hasGlobalImages) {
    console.log(globalImagesDir.toString())
    await archiveFolder(globalImagesDir, `${globalImagesDir}.zip`, "images")
  }

  logger.log(`Saved cleaned build.html with token → ${cleanedBuildPath}`, "info");

  return cleanedHTML;
}

/**
 * Builds the email HTML by running a series of transformations, minifying, fixing styles, and handling images.
 * @param {string} folderPath - The folder path to the source files (optional).
 */
async function buildScript(folderPath = "") {
  try {
    let html = await getHTML(folderPath); // Load the HTML

     CANVAS_AUTOMATIONS.UPDATE_LINEHEIGHTS && (html = updateLineHeight(html));

    CANVAS_AUTOMATIONS.SET_LINK_TYLES && (html = setLinkStyles(html));

    CANVAS_AUTOMATIONS.SET_LINKS_UNCLICKABLE && (html = makeNotClickable(html));

    CANVAS_AUTOMATIONS.UPDATE_HTMLTAGS && (html = replaceInHTML(html));

    CANVAS_AUTOMATIONS.UPDATE_VEEVATOKENS && (html = updateVeevaTokens(html));

    CANVAS_AUTOMATIONS.UPDATE_PADDINGS && (html = updatePadding(html));

    CANVAS_AUTOMATIONS.UPDATE_OUTLOOK_BUTTONS && (html = await fixOutlookButtons(html)); // Fix Outlook-specific button issues

    CANVAS_AUTOMATIONS.CONVERT_RGB_HEX && (html = convertRgbToHex(html)); // Convert RGB color codes to Hex

    CANVAS_AUTOMATIONS.ADD_IMG_GMAILFIX && (html = imgGmailFix(html)); //appply latam gmail fix to all images

    CANVAS_AUTOMATIONS.UPDATE_GLOBALCSS && (html = updateGlobalCss(html)); // Apply global CSS changes & take &amp; code into & for al href

    CANVAS_AUTOMATIONS.ADD_LANG && (html = injectLangAttribute(html));

    CANVAS_AUTOMATIONS.CONVERT_CHARS_ASCII && (html = await convertCharsToEntities(html)); //takes chars into ascci codes (ex: "®": by "&reg;",) 

    CANVAS_AUTOMATIONS.MINIFY && (html = minifyEmailHTML(html));

    CANVAS_AUTOMATIONS.UPDATE_PREHEADER && (html = await processPreheader(html));


    
    //this group should be the last to call in order to work the corresponding replacements.
    CANVAS_AUTOMATIONS.ENCODED_ZWJ_TO_ASCII && (html = html.replaceAll("\u200D", "&zwj;")); // Replace Zero-Width Joiner with HTML entity
    html = html.replaceAll("<tbody>", "");
    html = html.replaceAll("</tbody>", "");
    html = html.replaceAll("^s*\n", "");

    // Rename images and update the HTML
    const { newHTML, mapper } = changePhotosNames(html);

    // Copy the renamed images to a new folder
    await copyImageToNewFolder(mapper, newHTML, folderPath);

    // Zip the images if any were processed
    if (Object.keys(mapper).length !== 0) {
      let fullversion_imgpath = path.join(folderPath, "dist", "full_version", "images");
      await archiveFolder(fullversion_imgpath, `${fullversion_imgpath}.zip`, "images")
    }

    //fragments spliting proccess
    await exportFragments(newHTML, folderPath, mapper);
  } catch (err) {
    logger.log(`Error in processing: ${err}`, "fatal");
  }
}

export default {
  runBuildScript,
  /* processTestFolder, */
  buildScript,
};

// For CommonJS compatibility
if (typeof module !== "undefined" && module.exports) {
  module.exports = { runBuildScript, /* processTestFolder, */ buildScript };
}
