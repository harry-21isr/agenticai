import { crush } from "html-crush";
import fs from "fs";
import path from "path";


// MInify options
export const MINIFYOPTIONS = {
    //minifying the html with crush-html
    removeIndentations: true,
    removeLineBreaks: true,
    lineLengthLimit: 1000,
    breakToTheLeftOf: ["<table", "<body", "<!--[if", "<head", "<html"],
    removeHTMLComments: false,
    removeCSSComments: false,
  }

/**
 * Minifies HTML using html-crush.
 * @param {string} html - HTML content.
 * @param {object} options - Minification options.
 * @returns {Promise<string>} - Minified HTML.
 */
export async function minifyHtml(html, options) {
  return crush(html, options).result;
}

/**
 * Extracts image paths from a PostHTML tree.
 * @param {Object} tree - PostHTML tree.
 * @returns {string[]} - Array of image paths.
 */
export function extractImagePaths(tree) {
  const imagePaths = [];
  tree.walk((node) => {
    if (node.tag === "img" && node.attrs && node.attrs.src) {
      const src = node.attrs.src;
      if (!src.startsWith("data:") && !src.startsWith("http")) {
        imagePaths.push(src);
      }
    }
    return node;
  });
  return [...new Set(imagePaths)];
}

/**
 * Replaces tokens and fragments in the Veeva HTML.
 * @param {string} filePath - Path to HTML file
 * @param {Array} queryParams - Query parameters (optional)
 * @param {Object} VeevaConfig - Veeva configuration object
 * @returns {Promise<string>} - Processed HTML
 */
export async function replaceVeevaHtml(filePath, queryParams = [], VeevaConfig) {
  // manageEmailHtmlTemplate, manageHtmlFragments, replaceConfiguredVeevaTokens, replaceVeevaCustomText, replaceVeevaEmailFragments
  function manageHtmlFragments(queryParams, VeevaConfig) {
    if (queryParams && queryParams.fragments) {
      const fragmentsFolder = VeevaConfig.fragmentsFolder || "fragments";
      const fragmentsList = queryParams.fragments.split(",");
      return fragmentsList.map((fragment) => {
        const fragmentPath = path.join(path.dirname(filePath), fragmentsFolder, fragment);
        if (fs.existsSync(fragmentPath)) {
          let fragmentHtml = fs.readFileSync(fragmentPath, "utf8");
          return {
            html: replaceConfiguredVeevaTokens(fragmentHtml, VeevaConfig.tokens),
          };
        } else {
          console.error(
            "Error",
            `The given fragment '${fragment}' doesn't exist.`
          );
        }
      });
    }
    return [];
  }
  function replaceConfiguredVeevaTokens(html, tokens) {
    if (!tokens || typeof tokens !== "object") return html;
    Object.keys(tokens).forEach((token) => {
      html = html.replaceAll(`{{${token}}}`, tokens[token]);
    });
    return html;
  }
  function replaceVeevaEmailFragments(html, fragments) {
    const emailFragmentsRegExp = new RegExp("{{insertEmailFragments(\\[.*\\])?}}", "g");
    if (emailFragmentsRegExp.test(html)) {
      html = html.replace(
        emailFragmentsRegExp,
        fragments.map((fragment) => fragment.html).join("")
      );
    }
    return html;
  }
  function replaceVeevaCustomText(html) {
    const customTextRegExp = new RegExp("{{customText\\[.*\\|(.*)\\]}}", "g");
    let replacedHtml = html;
    let regexResult;
    while (customTextRegExp.test(replacedHtml)) {
      regexResult = customTextRegExp.exec(replacedHtml);
      if (regexResult && regexResult.length >= 2) {
        replacedHtml = replacedHtml.replace(customTextRegExp, regexResult[1]);
      }
    }
    return replacedHtml;
  }
  function manageEmailHtmlTemplate(filePath, queryParams, VeevaConfig) {
    let htmlFilePath = filePath;
    let html;
    const fragments = manageHtmlFragments(queryParams, VeevaConfig);
    html = fs.readFileSync(htmlFilePath, "utf8");
    if (fragments && fragments.length > 0) {
      html = replaceVeevaEmailFragments(html, fragments);
    }
    html = replaceConfiguredVeevaTokens(html, VeevaConfig.tokens);
    return html;
  }
  if (filePath) {
    const html = manageEmailHtmlTemplate(filePath, queryParams, VeevaConfig);
    if (html && VeevaConfig && VeevaConfig.tokens) {
      let replacedHtml = replaceConfiguredVeevaTokens(html, VeevaConfig.tokens);
      replacedHtml = replaceVeevaCustomText(replacedHtml);
      return replacedHtml;
    }
    return html;
  }
  return null;
}

/**
 * Minifies the HTML and saves it in the output file.
 * @param {string} pathToInputHtml - Path to input HTML file.
 * @param {string} pathToOutputHtml - Path to output HTML file.
 * @param {string} pathToVersionFolder - Folder where veeva.config.json may exist.
 * @param {object} [config] - Optional config object with veevaConfigFileName (default: 'veeva.config.json').
 * @param {function} [replaceVeevaHtml] - Optional function to process Veeva HTML if needed.
 */
export async function createMinifiedHtml(
  pathToInputHtml,
  pathToOutputHtml,
  pathToVersionFolder,
  config = { veevaConfigFileName: "veeva.config.json" }  
) {  
  const veevaConfigFileName = config.veevaConfigFileName || "veeva.config.json";
  const VeevaConfigPath = path.join(pathToVersionFolder, veevaConfigFileName);
  let inputHtml;
  if (fs.existsSync(VeevaConfigPath)) {
    const veevaConfig = JSON.parse(fs.readFileSync(VeevaConfigPath, "utf8"));
    inputHtml = await replaceVeevaHtml(pathToInputHtml, [], veevaConfig);
    if (!inputHtml)
      throw new Error(
        `Error while replacing tokens in HTML from file: ${pathToInputHtml}`
      );
  } else {
    inputHtml = fs.readFileSync(pathToInputHtml, "utf8");
    if (!inputHtml)
      throw new Error(`Error while reading HTML from file: ${pathToInputHtml}`);
  }
  const outputHtmlContent = inputHtml.replace(/ {2}/g, "");
  fs.writeFileSync(pathToOutputHtml, outputHtmlContent, "utf8");
  console.log(
    `HTML minified successfully, changes written to: ${pathToOutputHtml}`
  );
} 


/**
 * Replaces lang and xml:lang attributes in an HTML string
 * with the value from CONFIG.LANG
 *
 * @param {string} html - The HTML string
 * @returns {string} - Updated HTML string
 */
export function replaceLangAttributes(html, lang) {
  if (!lang) return html;

  // Regex to match lang="xx" or xml:lang="xx"
  return html.replace(/\b(xml:)?lang="[^"]*"/gi, (match, p1) => {
    return (p1 ? "xml:lang" : "lang") + `="${lang}"`;
  });
}
