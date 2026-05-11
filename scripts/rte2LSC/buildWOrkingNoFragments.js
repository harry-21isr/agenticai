import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(__dirname, "../../src");

const INPUT_FILE = path.join(SRC_DIR, "index.html");
const OUTPUT_FILE = path.join(SRC_DIR, "email_lsc.html");
const FRAGMENTS_DIR = path.join(SRC_DIR, "fragments");



const TOKEN_MAP = {
  //⚠️ Email tokens for static content
  // #Recipient
  "{{accFname}}": "{{recipient.firstname}}",
  "{{accLname}}": "{{recipient.lastname}}",
  "{{accTitle}}": "{{recipient.title}}",

  // #Sender
  "{{User.FirstName}}": "{{sender.firstname}}",
  "{{User.LastName}}": "{{sender.lastname}}",
  "{{userName}}": "{{sender.name}}",
  "{{userEmailAddress}}": "{{sender.email}}",
  "{{User.Phone}}": "{{sender.phone}}",
  "{{User.MobilePhone}}": "{{sender.mobilePhone}}",
  "{{User.Title}}": "{{sender.title}}",

  // #Content / links
  "{{PieceLink}}": "{{Content.Asset_URL}}",
  "{{surveyLink}}": "{{Survey.Link}}",
  "{{parentCallDatetime}}": "{{visit.PlannedVisitStartTime}}",

  // #UI components
  //"{{customText}}": `<span class="LSC_DropDownInput"></span>`,
  "{{customText:Required}}": `<div class="LSC_RichTextInput" required="true"> </div>`,
  "{{customText}}": `<div class="LSC_RichTextInput"> </div>`,



  //"{{customText[opt1|##accName##]}}": replaceCustomTextTokens, // handled separately since it has dynamic content
  "{{customRichText}}": `<div class="LSC_RichTextInput"> </div>`,

  "{{userPhoto}}": `
    {{#sender.useradditionalinfo.userpictureurl}}
      <img src="{{{sender.useradditionalinfo.userpictureurl}}}" alt="" height="auto" width="160" />
    {{/sender.useradditionalinfo.userpictureurl}}`,

    //Fragments
    //{\{insertEmailFragments(?:\[(\d+),(\d+)\])?\}\} is handled separately due to context sensitivity

  //⚠️ Nested tokens for dynamic content (e.g. dropdown options)
  "##accFname##": "{{recipient.firstname}}",
  "##accLname##": "{{recipient.lastname}}",
  "##accTitle##": "{{recipient.title}}",
  "##User.FirstName##": "{{sender.firstname}}",
  "##User.LastName##": "{{sender.lastname}}",
  "##userName##": "{{sender.name}}",
  "##userEmailAddress##": "{{sender.email}}",
  "##User.Phone##": "{{sender.phone}}",
  "##User.MobilePhone##": "{{sender.mobilePhone}}",
  "##User.Title##": "{{sender.title}}",
};

// Constants

const CUSTOM_TEXT_RE = /\{\{customText\[(.*?)\]\}\}/g;
const CUSTOM_TEXT_MAXLEN_RE = /\{\{customText\[(\d+)\|([^|\]]+)\]\}\}/g;
const CUSTOM_TEXT_NUMBER_RE = /\{\{customText\((\d+)\)\}\}/g;
const DROPDOWN_CLASS = "LSC_DropDownInput";
const INSERT_FRAGMENTS_RE = /\{\{\s*insertEmailFragments(?:\[(\d+)\s*,\s*(\d+)\])?\s*\}\}/g;

//  Utilities

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildTokenRegex(map) {
  const keys = Object.keys(map).sort((a, b) => b.length - a.length); // longest first → no partial shadowing
  return new RegExp(keys.map(escapeRegExp).join("|"), "g");
}

/**
 * Replace all static Veeva tokens in `html` using `map`.
 * Returns the transformed string and per-token hit counts.
 */
function replaceStaticTokens(html, map) {
  const regex = buildTokenRegex(map);
  const stats = Object.fromEntries(Object.keys(map).map((k) => [k, 0]));

  const out = html.replace(regex, (match) => {
    stats[match] = (stats[match] || 0) + 1;
    return map[match] ?? match;
  });

  return { out, stats };
}

/**
 * Find any element with id="preheader" or class="preheader" and clear its inner content.
 * Returns the transformed string and the number of elements cleared.
 */
function clearPreheaderContent(html) {
  const PREHEADER_OPEN_RE = /<(\w+)\b[^>]*\b(?:id|class)="preheader"[^>]*>/gi;
  const ops = [];
  let count = 0;
  let match;

  while ((match = PREHEADER_OPEN_RE.exec(html)) !== null) {
    const tagName = match[1];
    const contentStart = match.index + match[0].length;
    const closeTag = `</${tagName}>`;
    const closePos = html.indexOf(closeTag, contentStart);

    if (closePos === -1) continue;

    const fullEnd = closePos + closeTag.length;
    ops.push({ position: match.index, deleteLength: fullEnd - match.index, insert: "" });
    count++;
  }

  if (ops.length === 0) return { out: html, count: 0 };

  ops.sort((a, b) => b.position - a.position);

  let result = html;
  for (const { position, deleteLength, insert } of ops) {
    result = result.substring(0, position) + insert + result.substring(position + deleteLength);
  }

  return { out: result, count };
}

/**
 * Replace all {{customText[N|defaulttext]}} tokens with an LSC rich text div containing the default text.
 * Must run before replaceCustomTextTokens to avoid being caught by the general dropdown regex.
 * Returns the transformed string and the number of replacements made.
 */
function replaceCustomTextMaxLenTokens(html) {
  let count = 0;

  const out = html.replace(CUSTOM_TEXT_MAXLEN_RE, (_, _maxLen, defaultText) => {
    count++;
    return `<div class="LSC_RichTextInput"> <span>${defaultText.trim()}</span></div>`;
  });

  return { out, count };
}

/**
 * Replace all {{customText[opt1|opt2|...]}} with an LSC dropdown span.
 * Returns the transformed string and the number of replacements made.
 */
function replaceCustomTextTokens(html) {
  let count = 0;

  const out = html.replace(CUSTOM_TEXT_RE, (_, optionsStr) => {
    count++;
    const options = optionsStr
      .split("|")
      .map((s) => (s.trim() === "" && s.length > 0 ? "&nbsp;" : s.trim()))
      .filter(Boolean);
    const children = options.map((opt) => `<span>${opt}</span>`).join("");
    return `<span class="${DROPDOWN_CLASS}">${children}</span>`;
  });

  return { out, count };
}

/**
 * Replace all {{customText(N)}} tokens with an LSC rich text div.
 * Returns the transformed string and the number of replacements made.
 */
function replaceCustomTextNumberTokens(html) {
  let count = 0;

  const out = html.replace(CUSTOM_TEXT_NUMBER_RE, () => {
    count++;
    return `<div class="LSC_RichTextInput"> </div>`;
  });

  return { out, count };
}

/**
 * Replace all img src="images/..." with src="attachments/...".
 * Returns the transformed string and the number of replacements made.
 */
function replaceImagePaths(html) {
  let count = 0;
  const out = html.replace(/(<img\b[^>]*?\ssrc=")images\//gi, (_, prefix) => {
    count++;
    return `${prefix}attachments/`;
  });
  return { out, count };
}

/**
 * Replace all {{insertEmailFragments[min,max]}} tokens with context awareness:
 */
function replaceInsertEmailFragments(html) {
  let count = 0;

  // Collect all matches with positions
  const matches = [];
  const regex = new RegExp(INSERT_FRAGMENTS_RE.source, "g");
  let match;
  while ((match = regex.exec(html)) !== null) {
    matches.push({ fullMatch: match[0], min: match[1] ?? "0", max: match[2] ?? "100", index: match.index });
  }

  if (matches.length === 0) return { out: html, count: 0 };

  // Build a flat list of string operations { position, deleteLength, insert }
  const ops = [];

  for (const { fullMatch, min, max, index } of matches) {
    const before = html.substring(0, index);

    const lastTd        = before.lastIndexOf("<td");
    const lastTable     = before.lastIndexOf("<table");
    const lastCloseTd   = before.lastIndexOf("</td");
    const lastCloseTable = before.lastIndexOf("</table");

    // Inside an open <td> and that <td> is closer than any open <table>
    const inTd    = lastTd !== -1 && lastTd > lastCloseTd && lastTd > lastTable;
    // Inside an open <table> but not directly inside a <td>
    const inTable = !inTd && lastTable !== -1 && lastTable > lastCloseTable;

    if (inTd) {
      // Inside a <td>: insert the fragments table directly
      ops.push({
        position: index,
        deleteLength: fullMatch.length,
        insert: `<table width="100%" border="0" cellspacing="0" cellpadding="0" class="LSC_EmailFragments" min="${min}" max="${max}"> </table>`,
      });
    } else {
      // Inside a <table> but not a <td>, or outside any table: wrap in a row + cell
      ops.push({
        position: index,
        deleteLength: fullMatch.length,
        insert: `<tr>\n    <td align="left" valign="top">\n     <table width="100%" border="0" cellspacing="0" cellpadding="0" class="LSC_EmailFragments" min="${min}" max="${max}"> </table>\n    </td>\n</tr>`,
      });
    }

    count++;
  }

  // Apply operations in descending position order to keep indices valid
  ops.sort((a, b) => b.position - a.position);

  let result = html;
  for (const { position, deleteLength, insert } of ops) {
    result = result.substring(0, position) + insert + result.substring(position + deleteLength);
  }

  return { out: result, count };
}

//  Logging

function logResults(stats, tokenMap, dropdownCount) {
  const total = Object.values(stats).reduce((a, b) => a + b, 0);
  const found = Object.entries(stats).filter(([, c]) => c > 0);

  console.log("\n-- Token replacement summary -");
  console.log(`Total replacements: ${total}`);

  if (found.length === 0) {
    console.warn("⚠️  No static Veeva tokens were found in the source file.");
  } else {
    for (const [key, count] of found) {
      console.log(`  ✅  ${key} -> ${tokenMap[key]}  (${count})`);
    }
  }

  if (dropdownCount > 0) {
    console.log(`  ✅  {{customText[OPTIONS| ]}} dropdowns replaced: (${dropdownCount})`);
  }

  console.log("-\n");
}

function logCustomTextNumberResults(count) {
  if (count > 0) {
    console.log(`  ✅  {{customText(NUMBER)}} replaced: (${count})`);
  }
}

function logCustomTextMaxLenResults(count) {
  if (count > 0) {
    console.log(`  ✅  {{customText[NUMBER|defaulttext]}} replaced: (${count})`);
  }
}

function logPreheaderResults(count) {
  if (count > 0) {
    console.log(`  ✅  Preheader elements cleared: (${count})`);
  }
}

function logFragmentResults(fragmentCount) {
  if (fragmentCount > 0) {
    console.log(`  ✅  {{insertEmailFragments[MIN,MAX | NULL]}} fragments replaced: (${fragmentCount})`);
  }
}

function logImagePathResults(count) {
  if (count > 0) {
    console.log(`  🖼  Image paths rewritten images/ -> attachments/: (${count})`);
  }
}

//  Entry point

async function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    throw new Error(`Input file not found: ${INPUT_FILE}`);
  }

  const html = fs.readFileSync(INPUT_FILE, "utf8");

  const { out: afterPreheader, count: preheaderCleared } = clearPreheaderContent(html);
  const { out: afterStatic, stats } = replaceStaticTokens(afterPreheader, TOKEN_MAP);
  const { out: afterMaxLen, count: maxLenTokens } = replaceCustomTextMaxLenTokens(afterStatic);
  const { out: afterDropdowns, count: dropdowns } = replaceCustomTextTokens(afterMaxLen);
  const { out: afterNumbers, count: customTextNumbers } = replaceCustomTextNumberTokens(afterDropdowns);
  const { out: afterFragments, count: fragments } = replaceInsertEmailFragments(afterNumbers);
  const { out: finalHtml, count: imagePaths } = replaceImagePaths(afterFragments);

  logResults(stats, TOKEN_MAP, dropdowns);
  logCustomTextMaxLenResults(maxLenTokens);
  logPreheaderResults(preheaderCleared);
  logCustomTextNumberResults(customTextNumbers);
  logFragmentResults(fragments);
  logImagePathResults(imagePaths);

  fs.writeFileSync(OUTPUT_FILE, finalHtml, "utf8");
  console.log(`Output written to: ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
})