import posthtml from "posthtml";

export async function processPreheader(html) {
  const result = await posthtml([
    (tree) => {
      let headInjected = false;

      tree.walk((node) => {
        if (!headInjected && node.tag === "head") {
          headInjected = true;
          node.content = node.content || [];
          node.content.push({
            tag: "style",
            attrs: { type: "text/css" },
            content: [`
              .pre-header_cT_span:has(.AE_customText) {
                display: block !important;
                opacity: 1 !important;
                visibility: visible !important;
                overflow: unset !important;
              }
              .preheader {
                display: none !important;
                max-height: 0;
                max-width: 0;
                opacity: 0;
                visibility: hidden;
                mso-hide: all;
                overflow: hidden;
                font-size: 0;
                line-height: 1px;
              }
              .pre-header_cT_span > select {
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                font-size: 16px !important;
              }`.trim()],
          });
        }

        if (typeof node !== "object" || !node.attrs) return node;
        if (node.attrs.id?.trim() !== "preheader") return node;

        // Count words only from plain text, ignoring sup/sub tags
        const textOnly = getPlainText(node).trim();
        const tokenMatch = textOnly.match(/\{\{customText\[(.*?)\]\}\}/);

        let filler = "";
        const entity = "&nbsp; &zwnj;";

        if (tokenMatch) {
          const options = tokenMatch[1].split("|");
          const longest = options.reduce((a, b) => (a.length > b.length ? a : b), "");
          const wordCount = longest.trim().split(/\s+/).length;
          const remaining = Math.max(0, 200 - wordCount);
          const fillerPairs = Math.ceil(remaining / 2);
          filler = Array(fillerPairs).fill(entity).join(" ");
        } else {
          const wordCount = textOnly.split(/\s+/).length;
          const remaining = Math.max(0, 200 - wordCount);
          const fillerPairs = Math.ceil(remaining / 2);
          filler = Array(fillerPairs).fill(entity).join(" ");
        }

        // ✅ Important: preserve original node.content and just append filler
        node.content = node.content || [];
        node.content.push(" " + filler);

        node.attrs.class = "pre-header_cT_span";
        node.attrs.style =
          "mso-hide: all; font-size: 0px; line-height: 0px; font-family: Arial, Helvetica, sans-serif; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; display: none;";

        return node;
      });

      return tree;
    },
  ]).process(html);

  return result.html;
}

// Extract only text nodes for counting words
// but skip <sup> and <sub> so their text doesn't count
function getPlainText(node) {
  if (typeof node === "string") return node;
  if (!node || !node.content) return "";

  if (node.tag === "sup" || node.tag === "sub") {
    return ""; // ignore content for counting
  }

  return node.content.map(getPlainText).join("");
}
