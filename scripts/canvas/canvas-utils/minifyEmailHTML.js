import chalk from "chalk";
import logger from "./logger.js";
import { crush } from "html-crush";
import { MINIFYOPTIONS } from "../../utils/htmlUtils.js";

/**
 * Strips whitespace from the beginning and end of each line and removes empty lines.
 *
 * @param {string} input - The input string.
 * @returns {string} - The processed string.
 */
export default function minifyEmailHTML(html) {
  html = html.replace(/(?<=<br>)([^\S\n]*)\n+([^\S\n]*)(?=<\/span>)/g, "$1$2");
  html = html.replace(/(?<=<br>)([^\S\n]*)\n+([^\S\n]*)(?=<\/div>)/g, "$1$2");
  html = html.replace(/(?<=<br>)([^\S\n]*)\n+([^\S\n]*)(?=<\/li>)/g, "$1$2");
  html = html.split("\n"); // Split the string into lines
  html = html.map((line) => line.trim()); // Trim whitespace from each line
  html = html.filter((line) => line.length); // Remove empty lines
  html = html.join("\n"); // Join the lines back into a single string
  html = html.replace(/\{\s+/g, "{");
  html = html.replace(/\s+\}/g, "}");
  //html = html.replace(/;\s+/g, ';'); only from style
  //html = html.replace(/:\s+/g, ':'); only from style

  html = html.replace(/  /g, " ");
  html = html.replace(/ >/g, ">");

  const { result: minifiedHtml } = crush(html, MINIFYOPTIONS);

  logger.log(`HTML for ${chalk.yellow.bold("build.html")} minified.`, "info");

  return minifiedHtml;
}
