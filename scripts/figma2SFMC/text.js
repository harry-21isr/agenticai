import fs from "fs";
import path from "path";
import * as cheerio from "cheerio";
import { fileURLToPath } from "url";

// Define the output directory path for the generated text file.
const OUTPUT_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "src",
  "text_version.txt"
);
// Define the input directory path for the HTML file to be processed.
const INPUT_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "src",
  "index.html"
);

// Define a string of URL parameters for link tracking.
const ANCHOR_PARAMS =
  "cmp=%%=v(@TrackingCode)=%%&tpn=%%=v(@PfizerCustomerId)=%%&ttype=EM";
// Define the footer block string, which includes placeholders for mailing address information.
const FOOTER_BLOCK = `%%[ /* Fake profile center and mailing address Update Profile %%profile_center_url%% %%Member_Busname%%, %%Member_Addr%%, %%Member_City%%, %%Member_State%%, %%Member_PostalCode%% */ ]%%`;

/**
 * Extracts only the content within the <body> tag.
 * @param {string} fullHtml - The complete HTML content.
 * @returns {string} - The HTML content inside the <body> tag.
 */
function getBodyContent(fullHtml) {
  // Use a regex to find and capture the content between the <body> tags.
  const bodyRegex = /<body[^>]*>([\s\S]*)<\/body>/i;
  const match = fullHtml.match(bodyRegex);
  // If a match is found, return the captured content; otherwise, return the full HTML.
  return match ? match[1] : fullHtml;
}

// Main function to generate a plain text version from HTML content.
function generatePlainText(htmlContent) {
  if (!htmlContent || htmlContent.trim() === "") {
    return ""; // Don't process if input is empty
  }

  let cleanedHtml = htmlContent;

  // 1. Aggressive pre-cleaning of the HTML text string.

  // Remove Salesforce content blocks.
  const contentBlockRegex = /%%=contentBlockbyKey$".*?"$=%%/g;
  cleanedHtml = cleanedHtml.replace(contentBlockRegex, "");

  // Remove AMPScript comment blocks.
  const commentOnlyBlockRegex = /%%\[\s*\/\*.*?\*\/\s*\]%%/gs;
  cleanedHtml = cleanedHtml.replace(commentOnlyBlockRegex, "");

  // 2. Isolate and load the Body content.
  const bodyContent = getBodyContent(cleanedHtml);
  // Load the body content into Cheerio for DOM manipulation.
  const $ = cheerio.load(bodyContent);

  // 3. Removal of unwanted elements from the loaded DOM.
  $("style").remove();

  // Remove any div that CONTAINS 'display: none', regardless of other styles.
  $("div[style]").each(function () {
    const $div = $(this);
    const styleAttr = $div.attr("style") || "";
    if (styleAttr.toLowerCase().includes("display: none")) {
      $div.remove();
    }
  });

  // Remove specific elements from a template.
  $("#_two50, #_two50_img").remove();

  // 4. Content processing (links, images, etc.).
  // Iterate through all <a> tags to process links.
  $("a").each(function () {
    const $this = $(this);
    const href = $this.attr("href");
    // Skip links that are empty or just a hash.
    if (!href || href.trim() === "" || href.trim() === "#") return;

    const $img = $this.find("img");
    const anchorText = $this.text().trim();
    // Check for special link types.
    const isSpecialLink =
      href.toLowerCase().startsWith("mailto:") ||
      href.toLowerCase().startsWith("tel:");
    const isViewOnline = href.toLowerCase().startsWith("%%view_email_url%%");
    const isUnsubscribe = href
      .toLowerCase()
      .startsWith("https://my.pfizer.com/preferences/public");
    const isPdfLink = href.toLowerCase().endsWith(".pdf");

    // Replace the "view online" link with a placeholder.
    if (isViewOnline) {
      $this.replaceWith(`[ ${anchorText} ] %%view_email_url%%`);
      return;
    }
    let processedHref = href;
    // If the link contains an image, format it with image details and the link.
    if ($img.length > 0) {
      const altText = $img.attr("alt") || "";
      const imgSrc = $img.attr("src") || "";
      if (!isSpecialLink && !isPdfLink) {
        processedHref = processedHref.includes("?")
          ? `${processedHref}&${ANCHOR_PARAMS}`
          : `${processedHref}?${ANCHOR_PARAMS}`;
      }
      // Formatting matches React script: [ Image : AltText ] (ImageSrc ) (ProcessedHref )
      $this.replaceWith(
        `[ Image : ${altText} ] (${imgSrc} ) (${processedHref} )`
      );
    } else {
      // If it's a regular text link, format it with the text and the link.
      if (isUnsubscribe) {
        // Updated logic from React: only add ttype=EM if not present
        if (!processedHref.endsWith("&ttype=EM")) {
          processedHref = processedHref.includes("?")
            ? `${processedHref}&ttype=EM`
            : `${processedHref}?ttype=EM`;
        }
      } else if (!isSpecialLink && !isPdfLink) {
        processedHref = processedHref.includes("?")
          ? `${processedHref}&${ANCHOR_PARAMS}`
          : `${processedHref}?${ANCHOR_PARAMS}`;
      }
      // Formatting matches React script: [ AnchorText ] (ProcessedHref )
      $this.replaceWith(`[ ${anchorText} ] (${processedHref} )`);
    }
  });

  // Iterate through all <img> tags to format standalone images.
  $("img").each(function () {
    const $this = $(this);
    // Only process images that are NOT inside an <a> tag.
    if ($this.closest("a").length === 0) {
      const alt = $this.attr("alt") || "";
      const src = $this.attr("src") || "";
      // Formatting matches React script: [ Image: AltText ] (ImageSrc )
      $this.replaceWith(`[ Image: ${alt} ] (${src} )`);
    }
  });

  // 5. Final text formatting.
  // Replace <br> tags with newlines.
  $("br").replaceWith("\n");

  // Add newlines after block elements, as per the new script's logic
  $("div").each(function () {
    if ($(this).text().trim()) {
      $(this).append("\n");
    }
  });
  $("tr").each(function () {
    if ($(this).text().trim() && !$(this).html().includes("•")) {
      $(this).append("\n");
    }
  });

  // Extract the text content from the processed Cheerio object.
  let plainText = $.text();

  // Process bullet points in the extracted text
  // Replace bullet characters with hyphens for list formatting
  plainText = plainText.replace(/•/g, "-");
  plainText = plainText.replace(/&bull;/g, "-");

  // Replace non-breaking spaces with regular spaces.
  plainText = plainText.replace(/\u00A0/g, " ");
  // Trim each line and re-join to remove extra whitespace.
  plainText = plainText
    .split("\n")
    .map((line) => line.trim())
    .join("\n");

  // Fix bullet lists: merge hyphen lines with the following text line
  plainText = plainText.replace(/^-\s*\n+(.+)/gm, "- $1");

  // Fix numbered lists: merge number lines with the following text line
  plainText = plainText.replace(/^(\d+[\.\)])\s*\n+(.+)/gm, "$1 $2");

  // Replace multiple spaces or tabs with a single space.
  plainText = plainText.replace(/[ \t]+/g, " ");
  // Reduce multiple consecutive newlines to two.
  plainText = plainText.replace(/\n{3,}/g, "\n\n");
  // Add the footer block to the end of the text.
  plainText += `\n\n${FOOTER_BLOCK}`;

  // Return the final trimmed plain text.
  return plainText.trim();
}

// Read the HTML file from the specified input path.
fs.readFile(INPUT_DIR, "utf8", (err, htmlContent) => {
  // If an error occurs during file reading, log an error and exit.
  if (err) {
    console.error(`❌ Error: Could not find or read the file "${INPUT_DIR}".`);
    console.error("❌ Please ensure the file exists at the specified path.");
    process.exit(1);
  }

  htmlContent = htmlContent.trim();
  // Generate the plain text version of the HTML.
  const plainTextVersion = generatePlainText(htmlContent);

  // Write the generated plain text to the output file.
  fs.writeFile(OUTPUT_DIR, plainTextVersion, "utf8", (writeErr) => {
    // If an error occurs during file writing, log an error.
    if (writeErr) {
      console.error(`\nError saving the text file "${OUTPUT_DIR}":`, writeErr);
    } else {
      // Log a success message.
      console.log(
        `\n✅ Success! The plain text version has been saved to: ${OUTPUT_DIR}`
      );
    }
  });
});