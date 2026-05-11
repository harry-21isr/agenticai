import chalk from 'chalk';
import logger from './logger.js';

/**
 * Updates the tokens in the HTML content by processing custom text patterns,
 * replacing specific placeholders, and processing user photo placeholders.
 * 
 * @param {string} html - The input HTML string.
 * @returns {string} - The processed HTML string.
 */
export default function updateTokens(html) {
    html = processCustomText(html);
    html = processUserPhoto(html);

    // Define the search pattern and replacement string
    const searchValue = /(^|[^ \t\n\r])(\{\{customText)/g;
    const replacer = '$1 $2';

    // Replace {{customText without whitespace before it with space and {{customText
    html = html.replace(searchValue, replacer);

    return html;
}

/**
 * Processes custom text patterns in the input string.
 * 
 * This function performs the following actions:
 * 1. Replaces specific placeholders within custom text patterns.
 * 2. Fixes the '| ]}}' pattern by replacing it with ']}}' and adding '| ' to '{{customText['.
 * 3. Strips HTML tags if found within the custom text patterns.
 * Logs the process using the logger.
 * 
 * @param {string} input - The input string containing the custom text patterns.
 * @returns {string} - The processed string with the replacements made if necessary.
 */
function processCustomText(input) {

    // Function to strip HTML tags
    function stripHtmlTags(str) {
        return str.replace(/<\/?[^>]+(>|$)/g, "");
    }

    input = replaceCustomTextPlaceholders(input);

    // Regular expression to match {{customText[...]}} patterns
    let regex = /\{\{customText\[[\s\S]*?\]\}\}/g;

    // Replace function to handle the replacements inside the matches
    return input.replace(regex, (match) => {
        let modifiedMatch = match;

        // Regular expression to check for '| ]}}'
        let replacementCheckRegex = /\|\s*\]\}\}/g;

        if (replacementCheckRegex.test(modifiedMatch)) {
            // Replace '| ]}}' with ']}}'
            modifiedMatch = modifiedMatch.replace(replacementCheckRegex, ']}}');
            // Replace '{{customText[' with '{{customText[ |'
            modifiedMatch = modifiedMatch.replace(/\{\{customText\[/g, '{{customText[|');
            logger.log(
                `Fix Veeva ${chalk.yellow.bold('{{customText[]}}')} token ${chalk.yellow.bold('blank option')} as first.`,
                'info'
            );
        }

        replacementCheckRegex = /<\/?[^>]+(>|$)/g;

        if (replacementCheckRegex.test(modifiedMatch)) {
            // Strip HTML tags from the modified match
            modifiedMatch = stripHtmlTags(modifiedMatch);
            logger.log(
                `Fix Veeva ${chalk.yellow.bold('{{customText[]}}')} strip ${chalk.yellow.bold('HTML tags')}.`,
                'info'
            );
        }
        return modifiedMatch;
    });
}

/**
 * Processes user photo placeholders in the input string.
 * 
 * This function searches for all occurrences of `<div style="...">{{userPhoto}}</div>`
 * and removes any `line-height:XXpx;` CSS properties from the style attribute.
 * Logs the process using the logger.
 * 
 * @param {string} input - The input string containing the HTML content.
 * @returns {string} - The processed string with the replacements made if necessary.
 */
function processUserPhoto(input) {
    // Regular expression to match <div style="...">{{userPhoto}}</div> patterns
    const regex = /<div style="[a-zA-Z0-9\-#:;,\s]*">(?:<span style="[a-zA-Z0-9\-#:;,\s]*">)?\{\{userPhoto\}\}/g;

    // Regular expression to check for line-height:XXpx;
    const replacementRegex = /line-height\s*:\s*\d+px\s*;/g;

    // Replace function to handle the replacements inside the matches
    return input.replace(regex, (match) => {
        let modifiedMatch = match;
        modifiedMatch = modifiedMatch.replace(replacementRegex, '');
        logger.log(
            `Fix Veeva ${chalk.yellow.bold('{{userPhoto}}')} token removed ${chalk.yellow.bold('line-height')}.`,
            'info'
        );
        return modifiedMatch;
    });
}

/**
 * Replaces specific placeholders within custom text patterns in a given string.
 * 
 * This function performs the following actions:
 * 1. Replaces `{{accLname}}` with `##accLname##`.
 * 2. Replaces `{{accFname}}` with `##accFname##`.
 * 3. Replaces `{{accLfirstname}}` with `##accFname##`.
 * Logs the process using the logger.
 * 
 * @param {string} input - The input string containing the text to be processed.
 * @returns {string} - The processed string with the replacements made.
 */
function replaceCustomTextPlaceholders(input) {
    // Regex to match the customText pattern containing placeholders
    const customTextRegex = /\{\{customText\[[\w\W\s\u00A0-\uFFFF]*?\]\}\}/g;

    // Replace function to handle the replacements inside the matches
    return input.replace(customTextRegex, (match) => {
        let modifiedMatch = match;

        let replacementCheckRegex = /\{\{accFname\}\}/g;

        if (replacementCheckRegex.test(modifiedMatch)) {
            // Replace {{accFname}} with ##accFname##
            modifiedMatch = modifiedMatch.replace(replacementCheckRegex, '##accFname##');
            logger.log(
                `Fix Veeva ${chalk.yellow.bold('{{accFname}}')} replaced with ${chalk.yellow.bold('##accFname##')}.`,
                'info'
            );
        }

        replacementCheckRegex = /\{\{accLname\}\}/g;

        if (replacementCheckRegex.test(modifiedMatch)) {
            // Replace {{accLname}} with ##accLname##
            modifiedMatch = modifiedMatch.replace(replacementCheckRegex, '##accLname##');
            logger.log(
                `Fix Veeva ${chalk.yellow.bold('{{accLname}}')} replaced with ${chalk.yellow.bold('##accLname##')}.`,
                'info'
            );
        }

        replacementCheckRegex = /\{\{accLfirstname\}\}/g;

        if (replacementCheckRegex.test(modifiedMatch)) {
            // Replace {{accLfirstname}} with ##accFname##
            modifiedMatch = modifiedMatch.replace(replacementCheckRegex, '##accFname##');
            logger.log(
                `Fix Veeva ${chalk.yellow.bold('{{accLfirstname}}')} replaced with ${chalk.yellow.bold('##accFname##')}.`,
                'info'
            );
        }
        return modifiedMatch;
    });
}