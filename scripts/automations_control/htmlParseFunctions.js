import { AUTOMATIONS } from "./automationsSwitch.js";

/**
 * Map of special characters to their corresponding HTML entities.
 * @type {Record<string, string>}
 */
const charToEntityMap = {
  "≤": "&le;",
  "≥": "&ge;",
  "©": "&copy;",
  "®": "&reg;",
  "†": "&dagger;",
  "‡": "&Dagger;",
  "§": "&sect;"
};

/**
 * List of tags to be excluded from processing.
 * @type {string[]}
 */
const EXCLUDED_TAGS = ["style", "script", "code", "pre"];

/**
 * Determines whether a given node should be processed.
 * @param {object} node - Node object to check.
 * @returns {boolean} True if the node should be processed.
 */
function shouldProcessNode(node) {
  return (
    typeof node === "object" &&
    typeof node.tag === "string" &&
    !EXCLUDED_TAGS.includes(node.tag) &&
    !node.tag.includes(":")
  );
}

/**
 * Applies a transformation function to all string content within a node.
 * Ignores HTML comments.
 * @param {object} node - Node containing content to process.
 * @param {(text: string) => string} fn - Transformation function.
 */
function mapTextContent(node, fn) {
  if (Array.isArray(node.content)) {
    node.content = node.content.map((child) => {
      if (typeof child === "string") {
        if (child.trim().startsWith("<!--")) return child;
        return fn(child);
      }
      return child;
    });
  }
}

/**
 * Adds invisible zero-width characters inside percentages (e.g. (45%)) to improve rendering.
 * @param {object} tree - The root node to walk through.
 */
function fixPercentages(tree) {
  tree.walk((node) => {
    if (shouldProcessNode(node)) {
      mapTextContent(node, (text) => {
        return text.replace(/\((\d+%)\)/g, (_, group) => {
          return `(&zwj;${group.replace(/(\d+)%/, "$1&zwj;%")}&zwj;)`;
        });
      });
    }
    return node;
  });
}

/**
 * Inserts zero-width spaces between digits of long numbers to avoid line breaking issues.
 * @param {object} tree - The root node to walk through.
 */
function fixLongNumbers(tree) {
  tree.walk((node) => {
    if (shouldProcessNode(node)) {
      mapTextContent(node, (text) => {
        const parts = text.split(/({{.*?}}|\[.*?\]|&[^;]*;)/);
        return parts
          .map((part) => {
            if (!/{{.*?}}|\[.*?\]|&[^;]*;/.test(part)) {
              return part.replace(/(\b\d{3,}\b)/g, (match) =>
                match.split("").join("&#xFEFF;")
              );
            }
            return part;
          })
          .join("");
      });
    }
    return node;
  });
}

/**
 * Replaces hyphens between words with non-breaking hyphens.
 * @param {object} tree - The root node to walk through.
 */
function fixHyphens(tree) {
   tree.walk((node) => {
    if (shouldProcessNode(node)) {
      mapTextContent(node, (text) => {
        // Extract all {{...}} sections and replace them with placeholders
        const placeholders = [];
        const protectedText = text.replace(/{{[\s\S]*?}}/g, (match) => {
          const id = `\uE000${placeholders.length}\uE001`; // unique marker
          placeholders.push(match);
          return id;
        });

        //Apply your hyphen replacement to the rest of the text
        const processed = protectedText.replace(
          /(\w)-(\w)/g,
          "$1&zwj;-&zwj;$2"
        );

        // Restore all {{...}} sections in their original places
        const restored = processed.replace(/\uE000(\d+)\uE001/g, (_, i) => placeholders[i]);

        return restored;
      });
    }
    return node;
  });
}

/**
 * Escapes standalone ampersands (&) unless inside an anchor tag.
 * @param {object} tree - The root node to walk through.
 */
function fixAmpersands(tree) {
  tree.walk((node) => {
    if (shouldProcessNode(node) && node.tag !== "a") {
      mapTextContent(node, (text) =>
        text.replace(/(?<=\s|^)&(?=\s|$)/g, "&amp;")
      );
    }
    return node;
  });
}

/**
 * Escapes < and > characters unless inside an anchor tag.
 * @param {object} tree - The root node to walk through.
 */
function fixAngleBrackets(tree) {
  tree.walk((node) => {
    if (shouldProcessNode(node) && node.tag !== "a") {
      mapTextContent(node, (text) =>
        text.replace(/</g, "&lt;").replace(/>/g, "&gt;")
      );
    }
    return node;
  });
}

/**
 * Replaces special characters with corresponding HTML entities.
 * @param {object} tree - The root node to walk through.
 */
function fixSpecialCharacters(tree) {
  const pattern = new RegExp(`[${Object.keys(charToEntityMap).join("")}]`, "g");

  tree.walk((node) => {
    if (typeof node === "object" && node.content) {
      mapTextContent(node, (text) => {
        // Split text by {{ ... }} blocks
        return text.replace(/{{[^}]*}}|./gs, (segment) => {
          // If segment starts with {{, it's a mustache block - skip it
          if (segment.startsWith("{{")) {
            return segment;
          }
          // Otherwise, replace special characters normally
          return segment.replace(pattern, (match) => charToEntityMap[match]);
        });
      });
    }
    return node;
  });
}

/**
 * Ensures the #preheader content has minimum length and clean output.
 * Replaces variables with the shortest text option and pads text with invisible characters.
 * @param {object} tree - The root node to walk through.
 */
/* function fixPreheader(tree) {
  function countWords(text) {
    return text.split(/\s+/).filter(Boolean).length;
  }

  function findShortestOption(text) {
    const match = text.match(/{{customText\$\$([^$$]+)\]}}/);
    if (!match) return text;
    const options = match[1].split("|").map((s) => s.trim());
    const shortest = options.reduce((a, b) =>
      countWords(a) < countWords(b) ? a : b
    );
    return text.replace(match[0], shortest);
  }

  function padTo216Words(text) {
    let wordCount = countWords(text);
    while (wordCount < 216) {
      text += " &nbsp; &zwnj; &nbsp; &zwnj;";
      wordCount += 4;
    }
    return text;
  }

  tree.walk((node) => {
    if (
      typeof node === "object" &&
      node.tag === "div" &&
      node.attrs?.id === "preheader" &&
      Array.isArray(node.content)
    ) {
      let text = typeof node.content[0] === "string" ? node.content[0] : "";
      text = findShortestOption(text);
      text = padTo216Words(text);
      node.content[0] = text;
    }
    return node;
  });
} */

  function fixPreheader(tree) {
  function countWords(text) {
    return text.split(/\s+/).filter(Boolean).length;
  }

  function findShortestOption(text) {
    const match = text.match(/{{customText\$\$([^$$]+)\]}}/);
    if (!match) return text;
    const options = match[1].split("|").map((s) => s.trim());
    const shortest = options.reduce((a, b) =>
      countWords(a) < countWords(b) ? a : b
    );
    return text.replace(match[0], shortest);
  }

  function padTo200chars(node) {
    // Flatten text content (ignore tags)
    const textContent = node.content
      .map((c) => (typeof c === "string" ? c : ""))
      .join(" ");

    let wordCount = countWords(textContent);

    let filler = "";
    while (wordCount < 200) {
      filler += " &nbsp; &zwnj;";
      wordCount += 2; // two "words" added each time
    }

    // Append filler as a new text node at the very end
    node.content.push(filler);
  }

  tree.walk((node) => {
    if (
      typeof node === "object" &&
      node.tag === "div" &&
      node.attrs?.id === "preheader" &&
      Array.isArray(node.content)
    ) {
      // Replace only text nodes (don’t disturb tags like <sup>)
      node.content = node.content.map((c) =>
        typeof c === "string" ? findShortestOption(c) : c
      );

      padTo200chars(node);
    }
    return node;
  });
}


/**
 * Ensures all <img> tags include an alt attribute (empty if missing).
 * @param {object} tree - The root node to walk through.
 */
function fixImageAlts(tree) {
  tree.walk((node) => {
    if (
      typeof node === "object" &&
      node.tag === "img"
    ) {
      if (!node.attrs) {
        node.attrs = {};
      }
      if (!('alt' in node.attrs)) {
        node.attrs.alt = "";
      }
    }
    return node;
  });
}

/**
 * Always copies the alt attribute from an <img> into the title attribute of the wrapping <a> tag,
 * even if the alt is an empty string.
 * @param {object} tree - The root node to walk through.
 */
function syncAnchorTitleWithImageAlt(tree) {
  tree.walk((node) => {
    if (
      typeof node === "object" &&
      node.tag === "a" &&
      Array.isArray(node.content)
    ) {
      const imgChild = node.content.find(
        (child) => typeof child === "object" && child.tag === "img" && child.attrs?.alt !== undefined
      );

      if (imgChild) {
        if (!node.attrs) node.attrs = {};
        node.attrs.title = imgChild.attrs.alt;
      }
    }

    return node;
  });
}


/**
 * Adds or updates font-size:10px and line-height:12px styles
 * on <td> elements that directly wrap an <a><img></a> structure.
 * Handles whitespace-only strings in td content.
 * @param {object} tree - The root node to walk through.
 */
function fixImageWrapperTDStyles(tree) {
  tree.walk((node) => {
    if (
      typeof node === "object" &&
      node.tag === "td" &&
      Array.isArray(node.content)
    ) {
      // Filtrar espacios, saltos de línea, etc.
      const meaningfulChildren = node.content.filter(
        (child) =>
          typeof child === "object" ||
          (typeof child === "string" && child.trim() !== "")
      );

      if (
        meaningfulChildren.length === 1 &&
        meaningfulChildren[0].tag === "a"
      ) {
        const anchor = meaningfulChildren[0];

        const anchorContent = Array.isArray(anchor.content)
          ? anchor.content.filter(
              (c) =>
                typeof c === "object" ||
                (typeof c === "string" && c.trim() !== "")
            )
          : [];

        if (
          anchorContent.length === 1 &&
          anchorContent[0].tag === "img"
        ) {
          if (!node.attrs) node.attrs = {};

          const style = node.attrs.style || "";

          const styleMap = Object.fromEntries(
            style
              .split(";")
              .map((s) => s.trim())
              .filter(Boolean)
              .map((rule) => {
                const [key, value] = rule.split(":").map((s) => s.trim());
                return [key, value];
              })
          );

          styleMap["font-size"] = "10px";
          styleMap["line-height"] = "12px";

          node.attrs.style = Object.entries(styleMap)
            .map(([key, value]) => `${key}: ${value}`)
            .join("; ") + ";";
        }
      }
    }

    return node;
  });
}


/**
 * Returns an array of active processing functions depending on the automation switches.
 * @returns {Function[]} List of processing functions to be applied to the tree.
 */
function processRTE() {
  const processors = [];

  if (AUTOMATIONS.AUTOMATION_FIX_1) processors.push(fixPercentages);
  if (AUTOMATIONS.AUTOMATION_FIX_2) processors.push(fixLongNumbers);
  if (AUTOMATIONS.AUTOMATION_FIX_3) processors.push(fixHyphens);
  if (AUTOMATIONS.AUTOMATION_FIX_4) processors.push(fixAmpersands);
  if (AUTOMATIONS.AUTOMATION_FIX_6) processors.push(fixSpecialCharacters);
  if (AUTOMATIONS.AUTOMATION_FIX_5) processors.push(fixAngleBrackets);
  if (AUTOMATIONS.AUTOMATION_FIX_7) processors.push(fixPreheader);
  if (AUTOMATIONS.AUTOMATION_FIX_8) processors.push(fixImageAlts);
  if (AUTOMATIONS.AUTOMATION_FIX_9) processors.push(fixImageWrapperTDStyles);
  if (AUTOMATIONS.AUTOMATION_FIX_10) processors.push(syncAnchorTitleWithImageAlt);

  return processors;
}

export { processRTE };
