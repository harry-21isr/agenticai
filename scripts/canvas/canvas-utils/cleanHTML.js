import chalk from 'chalk';
import logger from './logger.js';
import { JSDOM } from "jsdom";

/**
 * Cleans HTML.
 * 
 * @param {string} input - The input string.
 * @returns {string} - The processed string.
 */
export default function cleanHTML(html) {
  //html = removeHTMLElements(html);
  logger.log(
    `HTML for ${chalk.yellow.bold('build.html')} cleaned.`,
    'info'
  );
  return html;
}

/**
 * Removes specific HTML elements from the string.
 *
 * @param {string} htmlString - The HTML string to clean.
 * @returns {string} The cleaned HTML string.
 */
function removeHTMLElements(htmlString) {
  // Create a new JSDOM instance
  const dom = new JSDOM(htmlString);
  const document = dom.window.document;
  const bodyContent = document.body.innerHTML;

  // Regex pattern
  let pattern = /<div\s+style="([a-zA-Z_$][a-zA-Z0-9_$\s:;!%-]*)"\s+id="([a-zA-Z_$][a-zA-Z0-9_$\s:;!%-]*)"\s+uuid="([a-zA-Z_$][a-zA-Z0-9_$\s:;!%-]*)">\s*\n<table\s+align="center"\s+border="0"\s+cellpadding="0"\s+cellspacing="0"\s+role="presentation"\s+style="([a-zA-Z_$][a-zA-Z0-9_$\s:;!%-]*)">\s*\n<tbody>\s*\n<tr>\s*\n<td\s+style="([a-zA-Z_$][a-zA-Z0-9_$\s:;!%-]*)">\s*\n<!--\[if mso \| IE\]><table\s+role="presentation"\s+border="0"\s+cellpadding="0"\s+cellspacing="0"><tr><td\s+style="([a-zA-Z_$][a-zA-Z0-9_$\s:;!%-]*)"\s*><!\[endif\]-->\s*\n<div\s+class="([a-zA-Z_$][a-zA-Z0-9_$\s:;!%-]*)"\s+style="([a-zA-Z_$][a-zA-Z0-9_$\s:;!%-]*)">\s*\n<table\s+border="0"\s+cellpadding="0"\s+cellspacing="0"\s+role="presentation"\s+style="([a-zA-Z_$][a-zA-Z0-9_$\s:;!%-]*)"\s+width="100%">\s*<tbody>\s*\n<\/tbody>\s*\n<\/table>\s*\n<\/div>\s*\n<!--\[if mso \| IE\]><\/td><\/tr><\/table><!\[endif\]-->\s*\n<\/td>\s*\n<\/tr>\s*\n<\/tbody>\s*\n<\/table>\s*\n<\/div>/g;

  // Remove elements matching the pattern
  bodyContent = bodyContent.replace(pattern, '');

  // Regex pattern
  pattern = /<div\s+style="([a-zA-Z_$][a-zA-Z0-9_$\s:;!%-]*)"\s+id="([a-zA-Z_$][a-zA-Z0-9_$\s:;!%-]*)"\s+uuid="([a-zA-Z_$][a-zA-Z0-9_$\s:;!%-]*)">\s*\n<table\s+align="center"\s+border="0"\s+cellpadding="0"\s+cellspacing="0"\s+role="presentation"\s+style="([a-zA-Z_$][a-zA-Z0-9_$\s:;!%-]*)">\s*\n<tbody>\s*\n<tr>\s*\n<td\s+style="([a-zA-Z_$][a-zA-Z0-9_$\s:;!%-]*)">\s*\n<!--\[if mso \| IE\]><table\s+role="presentation"\s+border="0"\s+cellpadding="0"\s+cellspacing="0"><tr><td\s+style="([a-zA-Z_$][a-zA-Z0-9_$\s:;!%-]*)"\s*><!\[endif\]-->\s*\n<div\s+class="([a-zA-Z_$][a-zA-Z0-9_$\s:;!%-]*)"\s+style="([a-zA-Z_$][a-zA-Z0-9_$\s:;!%-]*)">\s*\n<table\s+border="0"\s+cellpadding="0"\s+cellspacing="0"\s+role="presentation"\s+style="([a-zA-Z_$][a-zA-Z0-9_$\s:;!%-]*)"\s+width="100%">\s*<tbody>\s*\n<\/tbody>\s*\n<\/table>\s*\n<\/div>\s*\n<!--\[if mso \| IE\]><\/td><\/tr><\/table><!\[endif\]-->\s*\n<\/td>\s*\n<\/tr>\s*\n<\/tbody>\s*\n<\/table>\s*\n<\/div>/g;

  // Remove elements matching the pattern
  bodyContent = bodyContent.replace(pattern, '');

  document.body.innerHTML = cleanedBodyContent;

  // Return the full HTML string, preserving the HEAD
  return dom.serialize();
}