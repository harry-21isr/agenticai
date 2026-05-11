import chalk from 'chalk';
import logger from './logger.js';
import { JSDOM } from 'jsdom';

/**
 * Sets inline CSS color to #0000ee and text decoration to underline for <a> elements
 * that do not contain <img> elements. Logs the number of updates made for color and text-decoration.
 * 
 * @param {string} htmlString - The input HTML content as a string.
 * @returns {string} - The modified HTML string with inline CSS applied to text links.
 */
export default function setLinkStyles(html) {
    // Parse the HTML using JSDOM
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Select all <a> elements in the document
    const links = document.querySelectorAll('a');

    // Counters for tracking the number of updates made
    let colorUpdates = 0;
    let textDecorationUpdates = 0;
    let borderBottomUpdates = 0;

    // Iterate over each link
    for (let link of links) {
        // Check if the link contains an <img> element
        const img = link.querySelector('img');

        // If the link does not contain an <img> element, update its styles
        if (!img) {
            const styleAttr = link.getAttribute('style');

            // Set color to #0000ee if not already set
            if (!link.style.color && !(styleAttr && styleAttr.includes('color:inherit'))) {
                link.style.color = '#0000ee';
                colorUpdates++;
            }

            // Check if the link contains a <sub> or <sup> element
            const hasSubOrSup = link.querySelector('sub') || link.querySelector('sup');

            // If it contains <sub> or <sup>, add border-bottom: 1px solid;
            if (hasSubOrSup) {
                link.style.borderBottom = '1px solid';
                link.style.textDecoration = 'none';
                link.className = 'underline';
                borderBottomUpdates++;
            } else {
                // Set text-decoration to underline if not already set
                if (!link.style.textDecoration) {
                    link.style.textDecoration = 'underline';
                    textDecorationUpdates++;
                }
            }
        }
    }

    // Serialize the updated DOM back to an HTML string
    let serializedHTML = dom.serialize();

    // Ensure all rgb(0, 0, 238) colors are replaced with #0000ee
    serializedHTML = serializedHTML.replaceAll('rgb(0, 0, 238)', '#0000ee');

    // Log the number of color updates made
    if (colorUpdates) {
        logger.log(
            `Fix inline CSS link color: ${chalk.red.bold(colorUpdates)} ${chalk.yellow.bold('#0000ee')}.`,
            'info'
        );
    }

    // Log the number of text-decoration updates made
    if (textDecorationUpdates) {
        logger.log(
            `Fix inline CSS link text-decoration: ${chalk.red.bold(textDecorationUpdates)} ${chalk.yellow.bold('underline')}.`,
            'info'
        );
    }

    // Log the number of border-bottom updates made
    if (borderBottomUpdates) {
        logger.log(
            `Fix inline CSS link with sup or sub border-bottom: ${chalk.red.bold(borderBottomUpdates)} ${chalk.yellow.bold('1px solid')}.`,
            'info'
        );
    }

    // Return the modified HTML
    return serializedHTML;
}