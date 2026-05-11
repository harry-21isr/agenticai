import posthtml from "posthtml";
import { CANVAS_AUTOMATIONS } from "../../automations_control/canvasAutomationsSwitch.js";
/**
 * Converts special characters to HTML entities inside text nodes of allowed tags only.
 * Skips attributes, tag names, comments, conditional comments, etc.
 * @param {string} html - HTML string to process.
 * @returns {Promise<string>} - Processed HTML.
 */
export async function convertCharsToEntities(html) {
  if (typeof html !== "string") throw new TypeError("HTML must be a string");

  const charToEntityMap = {
    "-": CANVAS_AUTOMATIONS.HYPHENATED_WORD ? "&zwj;-&zwj;" : "-",
    "≤": "&le;",
    "≥": "&ge;",
    "©": "&copy;",
    "®": "&reg;",
    "†": "&dagger;",
    "‡": "&Dagger;",
    "¢": "&cent;",
    "£": "&pound;",
    "¥": "&yen;",
    "€": "&euro;",
    "§": "&sect;",
    "¶": "&para;",
    "•": "&bull;",
    "™": "&trade;",
    "∞": "&infin;",
    "≈": "&asymp;",
    "≠": "&ne;",
    "µ": "&micro;",
    "°": "&deg;",
    "±": "&plusmn;",
    "÷": "&divide;",
    "⊕": "&oplus;",
    "⊗": "&otimes;",
  };

  const allowedTags = new Set([
    "p", "h1", "h2", "h3", "h4", "h5", "h6", "div", "section", "article",
    "span", "a", "strong", "em", "b", "i", "u", "sub", "sup",
    "ul", "ol", "li", "td", "th", "option", "button", "label"
  ]);

  const plugin = (tree) => {
    tree.walk((node) => {
      if (
        typeof node === "object" &&
        node.tag &&
        allowedTags.has(node.tag) &&
        Array.isArray(node.content)
      ) {
        node.content = node.content.map((child) => {
         if (typeof child === "string") {
            const trimmed = child.trim();
            if (
              trimmed.startsWith("<!--") ||
              trimmed.startsWith("<![") ||
              trimmed.startsWith("<xml") ||
              trimmed.startsWith("<v:")
            ) {
              return child;
            }

             // Handle {{ ... }} exclusion ---
            const placeholders = []; // NEW: store matches temporarily
            const protectedText = child.replace(/{{[\s\S]*?}}/g, (match) => { // NEW
              const id = `\uE000${placeholders.length}\uE001`; // NEW
              placeholders.push(match); // NEW
              return id; // NEW
            });

            // Convert characters outside of {{ ... }} ---
            const converted = protectedText // MODIFIED: now processes protected text
              .split("")
              .map((char) => charToEntityMap[char] || char)
              .join("");
              
              // Restore {{ ... }} placeholders ---
            const restored = converted.replace( //restore placeholders
              /\uE000(\d+)\uE001/g,
              (_, i) => placeholders[i]
            );
            

            return restored; // return restored instead of direct mapping
          }


          return child;
        });
      }
      return node;
    });
  };

  const result = await posthtml([plugin]).process(html);
  return result.html;
}

