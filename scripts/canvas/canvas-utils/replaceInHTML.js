import chalk from 'chalk';
import logger from './logger.js';

const replaceConfig = [
  {
    searchValue: 'div style=""',
    replacer: 'div style="background-color:#ffffff;"',
    searchValueRegex: ''
  },
  {
    searchValue: '%7B%7B',
    replacer: '{{',
    searchValueRegex: ''
  },
  {
    searchValue: '%7D%7D',
    replacer: '}}',
    searchValueRegex: ''
  },
  {
    searchValue: '%5B',
    replacer: '[',
    searchValueRegex: ''
  },
  {
    searchValue: '%5D',
    replacer: ']',
    searchValueRegex: ''
  },
  {
    searchValue: '0px',
    replacer: '0',
    searchValueRegex: /\b0px\b/
  },
  {
    searchValue: 'width="600px"',
    replacer: 'width="600"',
    searchValueRegex: /width\s*=\s*"\s*600px\s*"/
  },
  {
    searchValue: '10px 10px 10px 10px',
    replacer: '10px',
    searchValueRegex: /10px\s+10px\s+10px\s+10px\s*/
  },
  {
    searchValue: ':0 0 0 0',
    replacer: ':0',
    searchValueRegex: /:\s*0\s+0\s+0\s+0\s*/
  },

  {
    searchValue: 'border-collapse:separate;line-height:100%;',
    replacer: 'border-collapse:separate;',
    searchValueRegex: ''
  },
  {
    searchValue: '<v:textbox style="mso-fit-shape-to-text:true">',
    replacer: '<w:anchorlock/>',
    searchValueRegex: ''
  },
  {
    searchValue: '</center></v:textbox>',
    replacer: '</center>',
    searchValueRegex: ''
  },
  {
    searchValue: '{{custom Rich text token}}',
    replacer: '{{customRichText}}',
    searchValueRegex: ''
  },
  {
    searchValue: '{{customer Rich Text token}}',
    replacer: '{{customRichText}}',
    searchValueRegex: ''
  },
  {
    searchValue: 'custom Text',
    replacer: 'customText',
    searchValueRegex: /custom\s+Text\s*/
  },
  {
    searchValue: '>{customText',
    replacer: '>{{customText',
    searchValueRegex: />\{customText/
  },
  {
    searchValue: '{{customText(max.length)}}',
    replacer: '{{customText}}',
    searchValueRegex: /\{\{customText\(max\.length\)\}\}/
  },
  {
    searchValue: '{{customText(max.length)}}',
    replacer: '{{customText}}',
    searchValueRegex: /\{\{customText\(max\.length\)\}\}/
  },
  {
    searchValue: '{{customRichText(max.length)}}',
    replacer: '{{customRichText}}',
    searchValueRegex: /\{\{customRichText\(max\.length\)\}\}/
  },
  {
    searchValue: ']}',
    replacer: ']}}',
    searchValueRegex: /\]\}(?!\})/
  },
  {
    searchValue: '<b>',
    replacer: '<strong>',
    searchValueRegex: ''
  },
  {
    searchValue: '</b>',
    replacer: '</strong>',
    searchValueRegex: ''
  },
  {
    searchValue: '<i>',
    replacer: '<em>',
    searchValueRegex: ''
  },
  {
    searchValue: '</i>',
    replacer: '</em>',
    searchValueRegex: ''
  },
  {
    searchValue: '<li>2x(<span style="color:#000000;"><span style="font-size:14px;">)',
    replacer: '<li><span style="color:#000000;font-size:14px;">',
    searchValueRegex: /<li><span style="color:#000000;"><span style="font-size:14px;"><span style="color:#000000;"><span style="font-size:14px;">/g
  },
  {
    searchValue: '</span></span></span></span></li>',
    replacer: '</span></li>',
    searchValueRegex: ''
  },
  {
    searchValue: '<li><span style="color:#000000;"><span style="font-size:14px;">',
    replacer: '<li><span style="color:#000000;font-size:14px;">',
    searchValueRegex: ''
  },
  {
    searchValue: '</span></span></li>',
    replacer: '</span></li>',
    searchValueRegex: ''
  },
  {
    searchValue: 'style="width:600px;" width="600"',
    replacer: 'style="width:600px;"',
    searchValueRegex: /\s*style="width:600px;"\s+width="600"\s*/
  },
  {
    searchValue: '<head>',
    replacer: '<head>\n<meta name="x-apple-disable-message-reformatting">\n<meta name="ProgId" content="Word.Document">',
    searchValueRegex: ''
  },
  {
    searchValue: '//ww.',
    replacer: '//www.',
    searchValueRegex: /\/\/ww\./
  },
  {
    searchValue: '<span style="color:#0000c9;">',
    replacer: '<span style="color:#0000ee;">',
    searchValueRegex: /<span\s+style="color:#0000c9;">/
  }
];

const removeConfig = [
  {
    searchValue: 'sup { vertical-align:5px;line-height:0; }',
    searchValueRegex: /sup\s*\{\s*vertical-align:\s*5px\s*;\s*line-height:\s*0\s*;\s*\}/
  },
  {
    searchValue: 'p { display:block;margin:13px 0; }',
    searchValueRegex: /p\s*\{\s*display:\s*block\s*;\s*margin:\s*13px\s*0\s*;\s*\}/

  },
  {
    searchValue: '#outlook a { padding:0; }',
    searchValueRegex: /#outlook\s+a\s+{\s*padding:\s*0\s*;\s*}/
  },
  {
    searchValue: 'body {margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}',
    searchValueRegex: /body\s*\{\s*margin:\s*0;\s*padding:\s*0;\s*-webkit-text-size-adjust:\s*100%;\s*-ms-text-size-adjust:\s*100%;\s*\}/g
  },
  {
    searchValue: 'table, td {border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;}',
    searchValueRegex: /table,\s*td\s*\{\s*border-collapse:\s*collapse;\s*mso-table-lspace:\s*0pt;\s*mso-table-rspace\s*:0pt;\s*\}\s*/g
  },
  {
    searchValue: 'img {border:0;height:auto;line-height:100%;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;}',
    searchValueRegex: /img\s*\{\s*border:\s*0;height:\s*auto;\s*line-height:\s*100%;\s*outline:\s*none;\s*text-decoration:\s*none;\s*-ms-interpolation-mode:\s*bicubic;\s*\}/g
  },
  {
    searchValue: 'background-color:transparent;',
    searchValueRegex: /\s*background-color:\s*transparent\s*;/
  },
  {
    searchValue: 'background:transparent;',
    searchValueRegex: /\s*background:\s*transparent\s*;/
  },
  {
    searchValue: 'color:transparent;',
    searchValueRegex: /\s*color:\s*transparent\s*;/
  },
  {
    searchValue: 'bgcolor="transparent"',
    searchValueRegex: /bgcolor\s*=\s*"\s*transparent\s*"/
  },
  {
    searchValue: 'border:none;',
    searchValueRegex: /\s*border:\s*none\s*;/
  },
  {
    searchValue: 'cursor:auto;',
    searchValueRegex: /\s*cursor:\s*auto\s*;/
  },
  {
    searchValue: 'border-radius:0;',
    searchValueRegex: /\s*border-radius:\s*0\s*;/
  },
  {
    searchValue: 'border:0 solid black;',
    searchValueRegex: /\s*border\s*:\s*0\s+solid\s+black\s*;/
  },
  {
    searchValue: 'border:0 solid rgb(0, 0, 0);',
    searchValueRegex: /\s*border\s*:\s*0\s+solid\s+rgb\(0,\s+0,\s+0\)\s*;/
  },
  {
    searchValue: 'border:0;',
    searchValueRegex: /\s*border\s*:\s*0\s*;/
  },
  {
    searchValue: 'class="hide_on_mobile-outlook hide_on_desktop-outlook"',
    searchValueRegex: ''
  },
  {
    searchValue: 'class="hide_on_desktop-outlook hide_on_mobile-outlook"',
    searchValueRegex: ''
  },
  {
    searchValue: 'class="hide_on_desktop-outlook"',
    searchValueRegex: ''
  },
  {
    searchValue: 'class="hide_on_mobile-outlook"',
    searchValueRegex: ''
  },
  {
    searchValue: 'Please insert blank dropdown| ',
    searchValueRegex: /Please insert blank dropdown\|\s*/
  },
  {
    searchValue: 'class=""',
    searchValueRegex: /\s*class\s*=\s*\"\s*"/
  },
  {
    searchValue: 'style=""',
    searchValueRegex: /\s*style\s*=\s*\"\s*"/
  },
  {
    searchValue: '|#Account.CMS_Nick_Name__c##',
    searchValueRegex: ''
  },
  {
    searchValue: 'background:rgba(0,0,0,0);',
    searchValueRegex: /\s*background:\s*rgba\(0,0,0,0\);\s*/
  },
  {
    searchValue: 'padding:0;',
    searchValueRegex: /\s*padding:\s*0\s*;/
  },
  {
    searchValue: 'padding-right:XX%;',
    searchValueRegex: /padding-right:\d+\%;/
  },
  {
    searchValue: 'padding-left:XX%;',
    searchValueRegex: /padding-left:\d+\%;/
  },
  {
    searchValue: 'uuid="..."',
    searchValueRegex: /uuid="[a-z0-9\-]+"\s*/
  },

  {
    searchValue: 'component-type="..."',
    searchValueRegex: /component-type="[a-z0-9\-]+"\s*/
  },
  {
    searchValue: 'data-highlightable="1"',
    searchValueRegex: ''
  },
  {
    searchValue: 'protocol="https://"',
    searchValueRegex: '\s*protocol="[a-z0-9:/]+"'
  }
];

/**
 * Replaces all instances of a given pattern in a string and counts the number of replacements made.
 * 
 * @param {string} str - The input string to perform replacements on.
 * @param {RegExp|string} find - The pattern to find in the string. Can be a regular expression or a string.
 * @param {string} replace - The string to replace each match with.
 * @returns {Object} An object containing the modified string and the count of replacements.
 * @returns {string} result - The modified string with replacements made.
 * @returns {number} count - The number of replacements made.
 */
function replaceAndCount(str, find, replace) {
  let count = 0;
  const result = str.replace(find, (match) => {
    count++;
    return replace;
  });
  return { result, count };
}

/**
 * Replaces all instances of a given pattern in a string and logs the number of replacements made.
 * 
 * @param {string} str - The input string to perform replacements on.
 * @param {RegExp|string} find - The pattern to find in the string. Can be a regular expression or a string.
 * @param {string} replace - The string to replace each match with.
 * @param {string} message - The message to log.
 * @returns {string} - The modified string with replacements made.
 */
function replaceAndLog(str, find, replace, message) {
  const { result, count } = replaceAndCount(str, find, replace);
  let messageSufix = 'item';

  if (count > 1) {
    messageSufix = messageSufix + 's';
  }
  if (count) {
    logger.log(
      `${message}: ${chalk.red.bold(count)} ${messageSufix}.`,
      'info'
    );
  }
  return result;
}

/**
 * Encodes the subject parameter in all mailto links within the provided HTML string.
 *
 * @param {string} html - The input HTML string containing mailto links with subject parameters.
 * @return {string} - The updated HTML string with URL-encoded subject parameters in all mailto links.
 */
function encodeMailtoSubject(html) {
  // Regular expression to find mailto links with subject parameters
  const pattern = /mailto:([^?]+)\?subject=([^&"]+)/gi;

  // Array to keep track of all replacements
  const replacements = [];

  /**
   * Replacement function to URL-encode the subject text.
   *
   * @param {string} match - The entire matched string (e.g., 'mailto:test@example.com?subject=Hello World!').
   * @param {string} email - The captured email address (e.g., 'test@example.com').
   * @param {string} subject - The captured subject text (e.g., 'Hello World!').
   * @return {string} - The updated mailto link with the encoded subject text.
   */
  function replaceSubject(match, email, subject) {
    // Encode the subject text using encodeURIComponent to make it URL-safe
    subject = encodeIfNotUrlSafe(subject);
    if (!subject.toLowerCase().startsWith("re%3a")) {
      subject =  "RE%3A%20" + subject;
    }
    // Track the replacement
    replacements.push({ original: match, updated: `mailto:${email}?subject=${subject}` });
    // Return the updated mailto link with the encoded subject
    return `mailto:${email}?subject=${subject}`;
  }

  // Replace all occurrences of mailto links with subject parameters in the HTML string
  const updatedHtml = html.replace(pattern, replaceSubject);  

  // Log all replacements if any
  if (replacements.length > 0) {
    let messageSufix = 'item';

    if (replacements.length > 1) {
      messageSufix = messageSufix + 's';
    }
    logger.log(
      `Fix ${chalk.yellow.bold('mailto: subject')} encoded to URL ${chalk.yellow.bold('safe format')}: ${chalk.red.bold(replacements.length)} ${chalk.blue(messageSufix +   '.')}`,
      'info'
    );
  }

  return updatedHtml;
}

/**
 * Encodes a string to a URL-safe format only if it contains unsafe characters
 * and does not already contain URL-encoded sequences.
 *
 * This function first checks if the input string contains any characters that are
 * not safe for use in URLs. If such characters are found and the string does not
 * already contain URL-encoded sequences, it encodes the string using `encodeURIComponent()`.
 * If the string is already URL-safe or contains URL-encoded sequences, it returns
 * the original string without modification.
 *
 * @param {string} str - The string to be checked and potentially encoded.
 * @returns {string} - The URL-safe version of the string, or the original string if no encoding was necessary.
 */
function encodeIfNotUrlSafe(str) {
  // Regular expression to match characters that need to be encoded in URLs.
  // It matches any character that is not alphanumeric, a hyphen, underscore, period, or tilde.
  const unsafeCharacters = /[^a-zA-Z0-9\-_.~]/;
  
  // Regular expression to check if the string already contains URL-encoded sequences (e.g., %20).
  const alreadyEncoded = /%[0-9A-Fa-f]{2}/;

  // If the string contains unsafe characters and does not already contain URL-encoded sequences
  if (unsafeCharacters.test(str) && !alreadyEncoded.test(str)) {
      return encodeURIComponent(str);
  } else {
      // If the string is already URL safe or contains encoded sequences, return the original string
      return str;
  }
}


/**
 * Performs multiple replacements on the input HTML based on the provided replace configuration.
 * 
 * @param {string} html - The input HTML string.
 * @param {Array} replaceConfig - Array of replacement configurations.
 * @returns {string} The modified HTML string.
 */
export default function replaceInHTML(html) {

  html = encodeMailtoSubject(html);

  html = html.replace('xmlns:v="urn:schemas-microsoft-com:vml"', 'xmlns:w="urn:schemas-microsoft-com:office:word" xmlns:v="urn:schemas-microsoft-com:vml"');
  html = html.replace('<xml>', "<xml>\n<w:WordDocument>\n<w:DontUseAdvancedTypographyReadingMail/>\n</w:WordDocument>");

  html = html.replace('</noscript>', `</noscript>\n<style type="text/css">\na.underline {text-decoration:underline !important;}\n</style>`);

  logger.log(
    `Search and replace: ${chalk.red.bold(replaceConfig.length)} patterns to review.`,
    'info'
  );

  replaceConfig.forEach(({ searchValue, replacer, searchValueRegex }) => {
    let regex;
    if (searchValueRegex) {
      regex = new RegExp(searchValueRegex, 'gis');
    } else {
      regex = new RegExp(escapeRegExp(searchValue), 'gis');
    }
    html = replaceAndLog(html, regex, replacer, `Replaced ${chalk.yellow.bold(searchValue)} with ${chalk.yellow.bold(replacer.replace(/\n/g, ''))}`);
  });

  logger.log(
    `Search and remove: ${chalk.red.bold(removeConfig.length)} patterns to review.`,
    'info'
  );

  removeConfig.forEach(({ searchValue, searchValueRegex }) => {
    let regex;
    if (searchValueRegex) {
      regex = new RegExp(searchValueRegex, 'gis');
    } else {
      regex = new RegExp(escapeRegExp(searchValue), 'gis');
    }
    html = replaceAndLog(html, regex, '', `Removed ${chalk.yellow.bold(searchValue)}`);
  });

  const searchString = "//bit.ly";

  if (html.includes(searchString)) {
    logger.log(
      `${chalk.yellow.bold('Bit.ly')} is not one of Pfizer's approved tools.`,
      'Error'
    );
  }

  return html;
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}