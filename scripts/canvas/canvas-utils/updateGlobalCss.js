import chalk from "chalk";
import logger from "./logger.js";
import { JSDOM } from "jsdom";

// Configuration array for global CSS rules
const GlobalCssConfig = [{ css: "p { margin: 0 0 0 0; }" }, { css: "img + div { display: none !important; }" }, { css: "table select { max-width: 300px; }" }, { css: "a { color: inherit; text-decoration: inherit; }" }, { css: "a[x-apple-data-detectors] { color: inherit !important; text-decoration: inherit !important; }" }, { css: "body { margin: 0; }" }, { css: "table, td { border-collapse: collapse; }" }, { css: "img { border: 0; }" }];

/**
 * Appends global CSS rules to the provided CSS string and logs the additions.
 *
 * @param {string} data - The CSS string to append the global rules to.
 * @returns {string} - The updated CSS string with global rules appended.
 */
function addGlobalCSS(data) {
  GlobalCssConfig.forEach(({ css }) => {
    data += `\n${css}`;
    logger.log(`Global CSS: ${chalk.yellow.bold(css)}.`, "info");
  });
  return data;
}

/**
 * Updates the HTML document by adding global CSS rules to the last <style> tag
 * in the <head> section, or creating a new <style> tag if none exist. Also removes
 * any empty <style> tags.
 *
 * @param {string} data - The input HTML string to process.
 * @returns {string} - The processed HTML string with updated global CSS rules.
 */
export default function updateGlobalCss(data) {
  // Parse the HTML data using JSDOM
  const dom = new JSDOM(data);
  const document = dom.window.document;

  // Find all <style> tags in the <head> section
  const head = document.querySelector("head");
  const styleTags = head.querySelectorAll("style");

  // Remove empty <style> tags
  styleTags.forEach((styleTag) => {
    if (styleTag.textContent.trim() === "") {
      styleTag.remove();
    }
  });

  // Re-query the <style> tags after removing empty ones
  const updatedStyleTags = head.querySelectorAll("style");

  // If there are existing <style> tags, append to the last one, otherwise create a new one
  if (updatedStyleTags.length > 0) {
    const lastStyleTag = updatedStyleTags[updatedStyleTags.length - 1];
    lastStyleTag.textContent = addGlobalCSS(lastStyleTag.textContent);
    lastStyleTag.textContent += "\n";
  } else {
    const newStyleTag = document.createElement("style");
    newStyleTag.textContent = addGlobalCSS("");
    newStyleTag.textContent += "\n";
    head.appendChild(newStyleTag);
  }

  // Remove any remaining inline styles if necessary
  removeStyles(document);

  // Return the modified HTML
  //return dom.serialize();

  let finalHtml = dom.serialize();

  // Replace all &amp; with & inside href attributes only
  finalHtml = finalHtml.replace(/href="([^"]*?)"/g, (match, url) => {
    const decodedUrl = url.replace(/&amp;/g, "&");
    return `href="${decodedUrl}"`;
  });
  //takes &#xFEFF; and dont auto convert it by serializing it
  finalHtml = finalHtml.replace(/\uFEFF/g, "&#xFEFF;");

  return finalHtml;
}

/**
 * Placeholder function to remove inline styles from elements in the document.
 * Currently, it only selects elements with inline styles, but can be expanded
 * to remove or modify those styles if needed.
 *
 * @param {Document} document - The HTML document object to process.
 * @returns {Document} - The processed document object.
 */
function removeStyles(document) {
  // Select all elements with inline styles
  const elements = document.querySelectorAll("[style]");

  // Functionality for removing styles can be added here if needed

  return document;
}
