import chalk from 'chalk';
import logger from './logger.js';
import { calculateLinkWidthHeight } from './puppeteer.js';

/**
 * This function fixes the width and height and styling of Outlook buttons (specifically <v:roundrect> buttons)
 * by recalculating the width and height and adjusting font-related styles inside the button's <a> tag.
 *
 * @param {string} inputString - The HTML string that contains Outlook buttons.
 * @returns {Promise<string>} - The updated HTML string with fixed button widths and heights and styles.
 */
export async function fixOutlookButtons(inputString) {
  // Regular expression to match <v:roundrect> buttons with nested <a> tags.
  const regex = /<v:roundrect[^>]*>.*?<\/a>/gs;
  
  // Regular expression to match an <a> tag inside <v:roundrect>
  const aTagRegex = /<a[^>]*>.*?<\/a>/s;
  
  // Regular expression to match and extract the 'style' attribute from the <a> tag
  const styleRegex = /<a[^>]*style="([^"]*)"/;
  
  // Regular expression to match the 'height' style property within inline styles
  const heightRegex = /style="height:\d+px;/;
  
  // Regular expression to match the 'width' style property within inline styles
  const widthRegex = /width:(\d+)px/;

  // Finds all matches of the <v:roundrect> buttons in the input HTML string
  const matches = [...inputString.matchAll(regex)];

  // Process each match of <v:roundrect> asynchronously
  const promises = matches.map(async match => {
    // Extract the <a> tag within the <v:roundrect> button
    const aTagMatch = match[0].match(aTagRegex)[0];
    
    if (aTagMatch) {
      // Extract inline styles from the <a> tag
      const styleMatch = match[0].match(styleRegex);
      
      if (styleMatch) {
        // Parse the inline style string into an object of key-value pairs (style properties)
        const styles = styleMatch[1].split(';').reduce((acc, style) => {
          const [key, value] = style.split(':').map(s => s.trim());
          if (key && value) acc[key] = value;
          return acc;
        }, {});

        // Fallbacks for font-family and font-size in case they are not specified in styles
        const fontFamily = styles['font-family'] || 'sans-serif';
        const fontSize = styles['font-size'] || 'inherit';

        // Extract or fallback the line-height value (default to 0 if not found)
        const lineHeight = parseInt(styles['line-height'], 10) || 0;

        // Calculate the link width, height dynamically using the external function calculateLinkWidthHeight
        const linkWidthHeight = await calculateLinkWidthHeight(aTagMatch);

        // Update the font-family, font-size, and line-height properties in the match
        let updatedMatch = match[0].replace(
          /font-family:[^;]+;/,
          `font-family:${fontFamily};font-size:${fontSize};line-height:${lineHeight}px;`
        );

        // Remove unnecessary <br> tags used in certain Outlook versions for spacing
        const brRegex = /<br\s+data-highlightable="1"\s+uuid="[a-z0-9\-]+\"\/>/g;
        updatedMatch = updatedMatch.replace(brRegex, '');

        // Log the updated information with chalk for styling
        logger.log(
          `Fix Outlook ${chalk.yellow.bold('<v:roundrect')} button width ${chalk.red.bold(linkWidthHeight[0] + 'px')}, height ${chalk.red.bold(linkWidthHeight[1] + 'px')}, and font size ${chalk.red.bold(fontSize)}.`,
          'info'
        );

        // Update the width, height property in the style attribute to the recalculated linkWidth, linkHeight
        return updatedMatch.replace(
          heightRegex,
          `style="height:${linkWidthHeight[1]}px;`
        ).replace(
          widthRegex,
          `width:${linkWidthHeight[0]}px`
        );
      }
    }
    // Return the original match if no <a> tag or style is found
    return match[0];
  });

  // Wait for all promises to complete (asynchronous processing)
  const results = await Promise.all(promises);

  // Replace the original HTML with the updated HTML for each match
  let updatedHtml = inputString;
  matches.forEach((match, index) => {
    updatedHtml = updatedHtml.replace(match[0], results[index]);
  });

  // Return the final updated HTML string
  return updatedHtml;
}
