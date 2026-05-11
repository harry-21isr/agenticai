import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "node:path";
import fetch from "node-fetch";
import "dotenv/config";
import { getCleanLayerName } from "../figma2SFMC/utils/layerNameNoIdentifiers.js";
import { renderSegmentForButton } from "../figma2SFMC/utils/renderRichTextCta.js";
import { normalizedEncodedID } from "../figma2SFMC/utils/normalizedEncodedID.js";
import { variablesReplacementHandler } from "../utils/variablesReplacement.js";

// --- CONFIGURATION ---
const FIGMA_FILE_ID = process.env.FIGMA_FILE_ID;
const FIGMA_PERSONAL_ACCESS_TOKEN = process.env.FIGMA_PERSONAL_ACCESS_TOKEN;
const ID_FRAME_TO_RENDER = process.env.ID_FRAME_TO_RENDER;
const __dirname = dirname(fileURLToPath(import.meta.url));

const OUTPUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "src");
const IMAGES_DIR = path.join(OUTPUT_DIR, "images");
const imagePathMap = {};

// --- UTILITY FUNCTIONS ---

function figmaColorToHex(color) {
  if (!color) return "";
  const toHex = (c) => ("0" + Math.round(c * 255).toString(16)).slice(-2);
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}

function getFontWeight(weight) {
  if (!weight) return "normal";
  return weight > 500 ? "bold" : "normal";
}

function findFrameByName(document, frameName) {
  if (!document || !frameName) {
    console.warn("Advertencia: El documento o el nombre del frame no se proporcionaron.");
    return null;
  }

  const stack = [...document.children];

  while (stack.length > 0) {
    const node = stack.pop();

    if (node.name === frameName && (node.type === "FRAME" || node.type === "CANVAS")) {
      return node;
    }

    if (node.children && node.children.length > 0) {
      stack.push(...node.children);
    }
  }

  console.warn(`Advertencia: No se encontró ningún Frame/Canvas con el nombre: "${frameName}"`);
  return null;
}

// --- CORE PARSING LOGIC ---
function findFirstNodeByType(startNode, type) {
  if (startNode.type === type) return startNode;
  if (!startNode.children) return null;
  for (const child of startNode.children) {
    const found = findFirstNodeByType(child, type);
    if (found) return found;
  }
  return null;
}

function parseRichText(textNode) {
  const segments = [];
  const baseStyle = textNode.style;

  const createSegment = (text, styleId) => {
    if (!text) return;

    const override = textNode.styleOverrideTable[styleId] || {};
    const fill = (override.fills && override.fills[0]) || textNode.fills[0];
    const finalStyle = { ...baseStyle, ...override };

    const segmentData = {
      characters: text,
    };

    const segmentColorHex = figmaColorToHex(fill?.color).toUpperCase();

    const styleProperties = {
      fontWeight: getFontWeight(finalStyle.fontWeight),
      fontSize: finalStyle.fontSize || 16,
      fontStyle: (finalStyle.fontStyle || "").toLowerCase().includes("italic") ? "italic" : "normal",
      textDecoration: finalStyle.textDecoration === "UNDERLINE" ? "underline" : "none",
    };

    if (segmentColorHex === "#FF0000") {
      segmentData.verticalAlign = "superscript";
    } else if (segmentColorHex === "#00B7DC") {
      segmentData.verticalAlign = "subscript";
    } else {
      segmentData.verticalAlign = "normal";
      styleProperties.color = segmentColorHex;
    }
    segmentData.style = styleProperties;

    if (finalStyle.hyperlink?.url) {
      segmentData.link = finalStyle.hyperlink.url;
    }
    segments.push(segmentData);
  };

  if (textNode.characterStyleOverrides && textNode.characterStyleOverrides.length > 0) {
    let currentText = "";
    let lastStyleId = textNode.characterStyleOverrides[0] || 0;

    for (let i = 0; i < textNode.characters.length; i++) {
      const styleId = textNode.characterStyleOverrides[i] || 0;
      if (styleId !== lastStyleId) {
        createSegment(currentText, lastStyleId);
        currentText = "";
        lastStyleId = styleId;
      }
      currentText += textNode.characters[i];
    }
    createSegment(currentText, lastStyleId);
  } else {
    createSegment(textNode.characters, 0);
  }
  return segments;
}

function findChildElements(nodes) {
  const elements = [];
  if (!nodes) return elements;

  for (const node of nodes) {
    if (node.type === "FRAME" && (node.name.toLowerCase().includes("button") || node.name.toLowerCase() === "cta" || node.name.toLowerCase() === "cta-frame")) {
      const rectNode = findFirstNodeByType(node, "RECTANGLE");
      const textNode = findFirstNodeByType(node, "TEXT");
      if (rectNode && textNode) {
        const dimensions = rectNode.absoluteBoundingBox;
        const link = textNode.style?.hyperlink?.url || node.style?.hyperlink?.url;
        const textColor = figmaColorToHex(textNode.fills?.[0]?.color);
        const hasBorder = rectNode.strokes && rectNode.strokes.length > 0 && rectNode.strokes[0].type === "SOLID";
        const borderWidth = hasBorder ? rectNode.strokeWeight || 0 : 0;
        const borderColor = hasBorder ? figmaColorToHex(rectNode.strokes[0].color) : null;
        const segments = parseRichText(textNode); //added support for cta richText styles
        elements.push({
          type: "BUTTON",
          name: node.name,
          id: node.id,
          text: textNode.characters,
          fontWeight: getFontWeight(textNode.style.fontWeight),
          fontSize: textNode.style.fontSize || 16,
          link: link || null,
          backgroundColor: figmaColorToHex(rectNode.fills?.[0]?.color),
          textColor: textColor || "#000000",
          segments,
          width: dimensions?.width || 0,
          height: dimensions?.height || 0,
          cornerRadius: rectNode.cornerRadius || 0,
          textDecoration: textNode.style.textDecoration === "UNDERLINE" ? "underline" : "none",
          borderWidth: borderWidth,
          borderColor: borderColor,
        });
        continue;
      }
    }

    if (node.type === "FRAME") {
      const dimensions = node.absoluteBoundingBox;
      const hasBorder = node.strokes && node.strokes.length > 0 && node.strokes[0].type === "SOLID";
      const borderColor = hasBorder ? figmaColorToHex(node.strokes[0].color) : null;
      let borderWidth = 0;
      if (hasBorder) {
        if (node.individualStrokeWeights) {
          borderWidth = {
            top: node.individualStrokeWeights.top || 0,
            right: node.individualStrokeWeights.right || 0,
            bottom: node.individualStrokeWeights.bottom || 0,
            left: node.individualStrokeWeights.left || 0,
          };
        } else {
          borderWidth = node.strokeWeight || 0;
        }
      }
      elements.push({
        type: "FRAME",
        name: node.name,
        id: node.id,
        layoutMode: node.layoutMode || "NONE",
        itemSpacing: node.itemSpacing || 0,
        primaryAxisAlignItems: node.primaryAxisAlignItems || "MIN",
        counterAxisAlignItems: node.counterAxisAlignItems || "MIN",
        backgroundColor: figmaColorToHex(node.fills?.[0]?.color),
        width: dimensions?.width || 0,
        height: dimensions?.height || 0,
        padding: { top: node.paddingTop || 0, right: node.paddingRight || 0, bottom: node.paddingBottom || 0, left: node.paddingLeft || 0 },
        borderColor: borderColor,
        borderWidth: borderWidth,
        elements: findChildElements(node.children),
      });
      continue;
    }

    if (node.type === "TEXT" && node.lineTypes?.some((type) => type !== "NONE")) {
      const baseStyle = {
        fontWeight: getFontWeight(node.style.fontWeight),
        fontSize: node.style.fontSize || 16,
        fontStyle: (node.style.fontStyle || "").toLowerCase().includes("italic") ? "italic" : "normal",
        color: figmaColorToHex(node.fills?.[0]?.color),
        textDecoration: node.style.textDecoration === "UNDERLINE" ? "underline" : "none",
        paragraphSpacing: node.style.paragraphSpacing || 0
      };

      const listData = {
        type: "LIST",
        name: node.name,
        id: node.id,
        textAlign: node.style.textAlignHorizontal || "LEFT",
        listSpacing: node.style.listSpacing || 0,
        items: [],
        baseStyle: baseStyle,
      };

      const lines = node.characters.split("\n");
      let charIndex = 0;
      lines.forEach((lineText, i) => {
        const lineStyleOverrides = node.characterStyleOverrides.slice(charIndex, charIndex + lineText.length);
        const virtualTextNode = {
          ...node,
          characters: lineText,
          characterStyleOverrides: lineStyleOverrides,
        };
        listData.items.push({
          listType: node.lineTypes[i] || "NONE",
          level: node.lineIndentations[i] || 0,
          segments: parseRichText(virtualTextNode),
        });
        charIndex += lineText.length + 1;
      });
      elements.push(listData);
      continue;
    }

    if (node.type === "TEXT") {
      const baseStyle = {
        fontWeight: getFontWeight(node.style.fontWeight),
        fontSize: node.style.fontSize || 16,
        fontStyle: (node.style.fontStyle || "").toLowerCase().includes("italic") ? "italic" : "normal",
        color: figmaColorToHex(node.fills?.[0]?.color),
        textAlign: node.style.textAlignHorizontal || "LEFT",
        textDecoration: node.style.textDecoration === "UNDERLINE" ? "underline" : "none",
        paragraphSpacing: node.style.paragraphSpacing || 0
      };
      elements.push({
        type: "TEXT",
        name: node.name,
        id: node.id,
        baseStyle: baseStyle,
        segments: parseRichText(node),
      });
      continue;
    }

    // --- NEW: DIVIDER PARSING ---
    if (node.type === "RECTANGLE" && !node.fills?.some((f) => f.type === "IMAGE") && /divider|line|separator/.test(node.name.toLowerCase())) {
      elements.push({
        type: "DIVIDER",
        name: node.name,
        id: node.id,
        height: node.absoluteBoundingBox?.height || 1,
        backgroundColor: figmaColorToHex(node.fills?.[0]?.color) || "#000000",
      });
      continue;
    }

    if (node.type === "RECTANGLE" && node.fills?.some((f) => f.type === "IMAGE")) {
      const imageFill = node.fills.find((f) => f.type === "IMAGE");
      const dimensions = node.absoluteBoundingBox;
      elements.push({
        type: "IMAGE",
        name: node.name,
        id: node.id,
        imageRef: imageFill.imageRef,
        width: dimensions?.width || 0,
        height: dimensions?.height || 0,
      });
    }
  }
  return elements;
}

function parseFigmaByFrames(figmaResponse) {
  const frameOutputs = [];
  const canvas = figmaResponse.document?.children[0];
  console.log(canvas);
  if (!canvas || !canvas.children) return [];

  for (const node of canvas.children) {
    if (node.type === "FRAME") {
      const frameData = {
        type: "FRAME",
        name: node.name,
        id: node.id,
        layoutMode: node.layoutMode || "NONE",
        itemSpacing: node.itemSpacing || 0,
        primaryAxisAlignItems: node.primaryAxisAlignItems || "MIN",
        counterAxisAlignItems: node.counterAxisAlignItems || "MIN",
        backgroundColor: figmaColorToHex(node.fills?.[0]?.color),
        padding: {
          top: node.paddingTop || 0,
          right: node.paddingRight || 0,
          bottom: node.paddingBottom || 0,
          left: node.paddingLeft || 0,
        },
        elements: findChildElements(node.children),
      };
      frameOutputs.push(frameData);
    }
  }
  return frameOutputs;
}

function collectImageRefs(elements) {
  let imageRefs = [];
  for (const element of elements) {
    if (element.type === "IMAGE") {
      imageRefs.push({ id: element.id, name: element.name });
    }
    if (element.elements) {
      imageRefs = imageRefs.concat(collectImageRefs(element.elements));
    }
  }
  return imageRefs;
}

async function downloadAndSaveImages(fileKey, token, imageRefs) {
  if (imageRefs.length === 0) {
    console.log("No images to download.");
    return {};
  }
  console.log(`Requesting URLs for ${imageRefs.length} images...`);

  const ids = imageRefs.map((ref) => ref.id);
  const response = await fetch(`https://api.figma.com/v1/images/${fileKey}?ids=${ids.join(",")}`, {
    headers: { "X-Figma-Token": token },
  });

  if (!response.ok) throw new Error(`Figma Image API Error: ${await response.text()}`);
  const imageData = await response.json();
  const imageUrls = imageData.images || {};

  await fs.mkdir(IMAGES_DIR, { recursive: true });

  for (const ref of imageRefs) {
    const url = imageUrls[ref.id];
    if (!url) {
      console.warn(`Warning: No URL found for image node ${ref.id} (${ref.name})`);
      continue;
    }

    try {
      console.log(`Downloading: ${ref.name}`);
      const imageResponse = await fetch(url);
      if (!imageResponse.ok) throw new Error(`Download failed for ${ref.name}`);
      const buffer = Buffer.from(await imageResponse.arrayBuffer());
      const sanitizedName =
        ref.name
          .toLowerCase()
          .replace(/[^a-z0-9\.]+/g, "-")
          .replace(/^-+|-+$/g, "") + ".png";
      const localPath = path.join(IMAGES_DIR, sanitizedName);
      const relativePath = path.relative(OUTPUT_DIR, localPath);

      await fs.writeFile(localPath, buffer);
      console.log(`Saved to ${localPath}`);
      imagePathMap[ref.id] = relativePath;
    } catch (error) {
      console.error(`Error processing image ${ref.name}:`, error);
    }
  }
  return imagePathMap;
}

// --- HTML GENERATION ---
function buildPreheader(preheader) {
  const content = preheader.trim().slice(1, -1).trim();
  const options = content.split("\\").map((option) => option.trim());
  if (options.length === 1) {
    return options[0];
  } else {
    const multipleOptions = options.join("|");
    return `{{customText[${multipleOptions}]}}`;
  }
}

function buildStyleAttribute(styles) {
  const styleString = Object.entries(styles)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => `${key}:${value};`)
    .join(" ");
  return styleString ? `style="${styleString}"` : "";
}

function renderSegment(segment, baseStyle) {
  //let html = segment.characters.replace(/\n/g, "<br />");
  let html = segment.characters
    .replace(/\n/g, "<br />")
    .replace(/\u00A0/g, " ")
    .replace(/\u2028/g, "<br />")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/ {2,}/g, (match) => " " + "&nbsp;".repeat(match.length - 1)); //transformed text for rest of transformations

    
  const style = segment.style;
  const inlineStyles = {};

  const isDefaultStyle = JSON.stringify(style) === JSON.stringify(baseStyle);
  if (isDefaultStyle && !segment.link && segment.verticalAlign === "normal") {
    return html;
  }

  if (style.color && style.color !== baseStyle.color) {
    inlineStyles.color = style.color;
  }
  if (style.fontSize && style.fontSize !== baseStyle.fontSize) {
    inlineStyles["font-size"] = `${style.fontSize}px`;
  }
  const finalDecoration = style.textDecoration || "none";
  const baseDecoration = baseStyle.textDecoration || "none";
  if (finalDecoration !== baseDecoration) {
    inlineStyles["text-decoration"] = finalDecoration;
  }

  const styleAttr = buildStyleAttribute(inlineStyles);

  const isBold = style.fontWeight === "bold" && baseStyle.fontWeight !== "bold";
  const isItalic = style.fontStyle === "italic" && baseStyle.fontStyle !== "italic";

  if (isBold && isItalic) {
    html = `<em ${styleAttr}><strong>${html}</strong></em>`;
  } else if (isBold) {
    html = `<strong ${styleAttr}>${html}</strong>`;
  } else if (isItalic) {
    html = `<em ${styleAttr}>${html}</em>`;
  } else if (styleAttr) {
    html = `<span ${styleAttr}>${html}</span>`;
  }

  let fontSize = Math.floor(style.fontSize * 0.7) //70% of parent element for sup

  if (segment.verticalAlign === "superscript") html = `<sup style="font-size: ${fontSize}px; line-height: ${fontSize + 1}px; vertical-align:text-top; mso-line-height-rule:exactly;">${html}</sup>`;
  if (segment.verticalAlign === "subscript") html = `<sub style="position:relative;vertical-align:bottom;font-size:60%;line-height:1.4;">${html}</sub>`;

  if (segment.link) {
    const normalizedLink = segment.link.toLowerCase();
    const linkStyles = {
      color: segment.style.color,
    };

    if (style.textDecoration !== "none") {
      linkStyles["text-decoration"] = "underline";
    } else {
      linkStyles["text-decoration"] = "none";
    }

     if (normalizedLink.startsWith("tel:") || normalizedLink.startsWith("mailto:")) { // Add no-wrap style for tel: and mailto
      linkStyles["white-space"] = "nowrap !important";  
    } 

    const linkText = segment.characters.replace(/[\u200B-\u200D\uFEFF]/g, "").trim();

    const linkStyleAttr = buildStyleAttribute(linkStyles);
    html = `<a title="${linkText}" href="${segment.link}" target="_blank" ${linkStyleAttr}>${html}</a>`;
  }

  return html;
}

function renderElement(element, forceAlign = null, finalClassesInnerTd) {
  if (!element) return "";

  const alignMap = { MIN: "left", CENTER: "center", MAX: "right" };
  const valignMap = { MIN: "top", CENTER: "middle", MAX: "bottom" };

  switch (element.type) {
    case "FRAME": {
      let childrenHtml;

      const frameHorizontalAlign = alignMap[element.primaryAxisAlignItems] || "left";
      const frameVerticalAlign = valignMap[element.counterAxisAlignItems] || "top";
      
      if (element.layoutMode === "VERTICAL") {
        const rows = [];
        element.elements.forEach((child, index) => {
          if (index > 0 && element.itemSpacing > 0) {
            rows.push(`<tr><td align="left" valign="top" height="${element.itemSpacing}" style="line-height:0px; font-size:0px;">&nbsp;</td></tr>`);
          }

          let cellStyle = {};
          let childAlign = alignMap[element.counterAxisAlignItems] || "left";

          if (child.type === "TEXT") {
            const baseStyle = child.baseStyle || {};
            childAlign = (baseStyle.textAlign || "LEFT").toLowerCase();
            cellStyle = {
              "font-size": `${baseStyle.fontSize || 16}px`,
              "line-height": `${Math.round((baseStyle.fontSize || 16) * 1.25)}px`,
              "font-family": "Arial, Helvetica, sans-serif",
              "font-weight": "normal",
              color: baseStyle.color || "#000000",
              "mso-line-height-rule": "exactly",
              "-webkit-text-size-adjust": "none",
            };
          }

          const cellStyleAttr = buildStyleAttribute(cellStyle);
          rows.push(`<tr><td align="${childAlign}" valign="top" ${cellStyleAttr}>${renderElement(child)}</td></tr>`);
        });
        childrenHtml = rows.join("");
      } else {
        const cells = [];
        const frameHorizontalAlign = alignMap[element.primaryAxisAlignItems] || "left";
        let keepinline_center;

        element.elements.forEach((child, index) => {
          const cellAlign = alignMap[element.primaryAxisAlignItems] || "left";
          const cellValign = valignMap[element.counterAxisAlignItems] || "top";


          /* const responsiveClasses = "textCenter fullwidth";
          const paddingTopClass = index > 0 ? " PT10" : "";
          const finalClasses = `${responsiveClasses}${paddingTopClass}`.trim(); */
          const keepinline_auto = element.name.toLowerCase().endsWith("(nostack_auto)");
          keepinline_center = element.name.toLowerCase().endsWith("(nostack_center)");
          const isLastChild = index === element.elements.length - 1;

          let finalClasses = "";
          let finalClassesInnerTd = "";
          let cellAlignFinal = cellAlign;

          // NORMAL stacking
          if (!keepinline_auto && !keepinline_center) {
            finalClasses = `textCenter fullwidth${index > 0 ? " PT10" : ""}`.trim();
            finalClassesInnerTd = `textCenter`.trim();
          }

          // nostack_auto
          if (keepinline_auto) {
            if (isLastChild) {
              finalClasses = "textRight";
              cellAlignFinal = "left";
            }
          }

          // nostack_center
          if (keepinline_center) {
            if (isLastChild) {
              finalClasses = "PL10";
            }
          }

          let cellStyle = {};

          if (child.type === "TEXT") {
            const baseStyle = child.baseStyle || {};
            cellStyle = {
              "font-size": `${baseStyle.fontSize || 16}px`,
              "line-height": `${Math.round((baseStyle.fontSize || 16) * 1.25)}px`,
              "font-family": "Arial, Helvetica, sans-serif",
              "font-weight": "normal",
              color: baseStyle.color || "#000000",
              "mso-line-height-rule": "exactly",
            };
          }

          const cellStyleAttr = buildStyleAttribute(cellStyle);

          //cells.push(`<td align="${cellAlign}" valign="${cellValign}" class="${finalClasses}" ${cellStyleAttr}>${renderElement(child)}</td>`);
           let tdWidthAttr = "";
          if (!isLastChild) {
            const fixedWidth = Math.round(
              child.widthAbsoluteRender || child.width || 0
            );
            if (fixedWidth > 0) {
              tdWidthAttr = `width="${fixedWidth}"`;
            }
          }

          const forceAlign = keepinline_auto && isLastChild ? "right" : null;

          cells.push(
            `<td align="${cellAlignFinal}" valign="${cellValign}" ${tdWidthAttr} class="${finalClasses}" ${cellStyleAttr}>
              ${renderElement(child, element, forceAlign, finalClassesInnerTd)}
            </td>`
          );


          if (index < element.elements.length - 1 && element.itemSpacing > 0) {
            cells.push(`<td align="left" valign="top" width="${element.itemSpacing}" class="hide" style="line-height:0px; font-size:0px;">&nbsp;</td>`);
          }
        });
        childrenHtml = `<tr>${cells.join("")}</tr>`;

        if (keepinline_center || frameHorizontalAlign === "center") { //nesting wrap for nostack_center
        childrenHtml = `
          <tr>
            <td align="center" valign="top">
              <table role="presentation" width="auto" cellpadding="0" cellspacing="0" border="0">
                ${childrenHtml}
              </table>
            </td>
          </tr>
        `;
      }
      }

      const hasBackground = element.backgroundColor && element.backgroundColor !== "transparent";
      const hasBorders = element.borderColor && element.borderWidth && (typeof element.borderWidth === "number" ? element.borderWidth > 0 : Object.values(element.borderWidth).some((w) => w > 0));
      const hasVerticalPadding = element.padding.top > 0 || element.padding.bottom > 0;

      const outerTdStyles = {};
      if (hasBackground) {
        outerTdStyles["background-color"] = element.backgroundColor;
      }
      if (hasBorders) {
        if (typeof element.borderWidth === "object") {
          outerTdStyles["border-color"] = element.borderColor;
          outerTdStyles["border-style"] = "solid";
          outerTdStyles["border-top-width"] = `${element.borderWidth.top || 0}px`;
          outerTdStyles["border-right-width"] = `${element.borderWidth.right || 0}px`;
          outerTdStyles["border-bottom-width"] = `${element.borderWidth.bottom || 0}px`;
          outerTdStyles["border-left-width"] = `${element.borderWidth.left || 0}px`;
        } else if (typeof element.borderWidth === "number" && element.borderWidth > 0) {
          outerTdStyles["border"] = `${element.borderWidth}px solid ${element.borderColor}`;
        }
      }
      const contentPaddingStyle = buildStyleAttribute({
        "padding": `0px ${element.padding.left || 0}px 0px ${element.padding.right || 0}px`,
      });

      const outerTdStyleAttr = buildStyleAttribute(outerTdStyles);
      if( !hasBorders && !hasBackground && !hasVerticalPadding ) {
              return `
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                 <tr>
                        <td align="${frameHorizontalAlign}" valign="${frameVerticalAlign}" ${contentPaddingStyle}>
                            <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                                ${childrenHtml}
                            </table>
                        </td>
                    </tr>
              </table>
              `;
      }
      else if (!hasBorders && !hasBackground && hasVerticalPadding) {
         return `
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                    ${element.padding.top > 0 ? `<tr><td align="left" valign="top" height="${element.padding.top}" style="line-height:0px; font-size:0px;">&nbsp;</td></tr>` : ""}
                    <tr>
                        <td align="${frameHorizontalAlign}" valign="${frameVerticalAlign}" ${contentPaddingStyle}>
                            <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                                ${childrenHtml}
                            </table>
                        </td>
                    </tr>
                    ${element.padding.bottom > 0 ? `<tr><td align="left" valign="top" height="${element.padding.bottom}" style="line-height:0px; font-size:0px;">&nbsp;</td></tr>` : ""}
                </table>
            `;
      }
      else {
              return `
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                    <tr>
                        <td align="${frameHorizontalAlign}" valign="${frameVerticalAlign}" ${outerTdStyleAttr}>
                            <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                                ${element.padding.top > 0 ? `<tr><td align="left" valign="top" height="${element.padding.top}" style="line-height:0px; font-size:0px;">&nbsp;</td></tr>` : ""}
                                <tr>
                                    <td align="${frameHorizontalAlign}" valign="${frameVerticalAlign}" ${contentPaddingStyle}>
                                        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                                            ${childrenHtml}
                                        </table>
                                    </td>
                                </tr>
                                ${element.padding.bottom > 0 ? `<tr><td align="left" valign="top" height="${element.padding.bottom}" style="line-height:0px; font-size:0px;">&nbsp;</td></tr>` : ""}
                            </table>
                        </td>
                    </tr>
                </table>
            `;
      }

    }

    case "TEXT": {
      const neutralBaseStyle = {...element.baseStyle,fontWeight: "normal"};
      const paragraphSpacing = element.baseStyle.paragraphSpacing || 0;

      if (paragraphSpacing > 0) { //logic when paragraphSpacing exist in a text paragraph
        const lines = [];
        let currentLineSegments = [];

        for (const segment of element.segments) {
          const parts = segment.characters.split("\n");
          parts.forEach((part, i) => {
            if (i > 0) {
              lines.push(currentLineSegments);
              currentLineSegments = [];
            }
            currentLineSegments.push({ ...segment, characters: part });
          });
        }
        lines.push(currentLineSegments);

        const fontSize = element.baseStyle.fontSize || 14;
        const lineHeight = Math.round(fontSize * 1.25);
        const color = element.baseStyle.color || "#000000";
        //const align = (element.baseStyle.textAlign || "LEFT").toLowerCase();
        const align = forceAlign ? forceAlign : (element.baseStyle.textAlign || "LEFT").toLowerCase();

        const innerRows = lines.map((lineSegments, index) => {
          const lineHtml = lineSegments
            .map(seg => renderSegment(seg, neutralBaseStyle))
            .join("");
          const spacerRow = index < lines.length - 1
            ? `<tr><td align="left" valign="top" height="${paragraphSpacing}" style="line-height:0px; font-size:0px;">&nbsp;</td></tr>`
            : "";
          return `<tr><td align="${align}" class="${finalClassesInnerTd}" valign="top" style="font-size:${fontSize}px; line-height:${lineHeight}px; font-family:Arial, Helvetica, sans-serif; font-weight:normal; color:${color}; mso-line-height-rule:exactly; -webkit-text-size-adjust:none;">${lineHtml}</td></tr>${spacerRow}`;
        }).join("");

        //  Return a nested table - fits inside the parent <tr><td> wrapper untouched
        return `<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">${innerRows}</table>`;
      }

         return element.segments.map((segment) => renderSegment(segment, neutralBaseStyle)).join("");
    }

    case "IMAGE": {
      const localSrc = imagePathMap[element.id];
      const width = Math.round(element.width);
      const height = Math.round(element.height);
      const altText = element.name.replace(/[\u200B-\u200D\uFEFF]/g, "")

      if (!localSrc) {
        console.warn(`Warning: Could not find local path for image ID ${element.id}`);
        return `<img src="https://placehold.co/${width}x${height}.png?text=MISSING" alt="${element.name}" width="${width}" style="display: inline-block; width: ${width}px; height: auto;" />`;
      }

      const imgClass = width > 120 ? 'class="imgFull"' : "";
      const imgStyle = buildStyleAttribute({
        display: "inline-block",
        width: `${width}px`,
        height: "auto",
      });
        
      return ` 
                <a href="#" target="_blank" title="${altText}" style="border: none; text-decoration: none; outline: none !important; pointer-events: none; cursor: default; display: inline-block;"><img src="${localSrc}" width="${width}" alt="${altText}" border="0" ${imgStyle} ${imgClass}/></a>
            `;
    }

    case "BUTTON": {
      const width = Math.round(element.width);
      const height = Math.round(element.height);
      let vmlStrokeProps = "";
      let anchorBorderProps = "";
      if (element.borderWidth > 0 && element.borderColor) {
        vmlStrokeProps = `stroke="t" strokecolor="${element.borderColor}" strokeweight="${element.borderWidth}px"`;
        anchorBorderProps = `border: ${element.borderWidth}px solid ${element.borderColor};`;
      } else {
        vmlStrokeProps = `stroke="f"`;
      }

      const buttonHtmlText = element.segments ? element.segments.map(seg =>
            renderSegmentForButton(seg, {
              fontWeight: element.fontWeight,
              fontSize: element.fontSize,
              color: element.textColor,
              textDecoration: element.textDecoration
            })).join("")
        : element.text.replace(/[\u200B-\u200D\uFEFF]/g, "");

        const elementTextNobadChars = element.text.replace(/[\u200B-\u200D\uFEFF]/g, "")


      if (element.cornerRadius > 0) {
        return `
              <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${element.link || '#'}" style="height:${height}px;v-text-anchor:middle;width:${width}px;" arcsize="${element.cornerRadius * 2}%"  fillcolor="${element.backgroundColor || 'transparent'}" ${vmlStrokeProps}">
              <w:anchorlock/>
              <center>
              <![endif]-->
              <a class="cta" target="_blank" href="${element.link || '#'}" title="${elementTextNobadChars}" style="background-color: ${element.backgroundColor || 'transparent'}; font-size: ${element.fontSize}px; line-height: ${element.fontSize + 4}px; font-family: Arial, Helvetica, sans-serif; font-weight: ${element.fontWeight}; text-decoration: none; padding: 11px 0; color: ${element.textColor || "#ffffff"}; border-radius: ${
          element.cornerRadius
        }px; ${anchorBorderProps} text-align: center; display: inline-block; mso-padding-alt: 0; -webkit-text-size-adjust:none; mso-line-height-rule:exactly; width: ${width}px;">
              ${buttonHtmlText}
              </a>
              <!--[if mso]>
              </center>
              </v:roundrect>
              <![endif]-->

            `;
      } else {
        return `

            <!--[if mso]>
            <v:rect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${element.link || '#'}" fill="true" style="height:${height}px;v-text-anchor:middle;width:${width}px;" fillcolor="${element.backgroundColor || 'transparent'}" ${vmlStrokeProps}">
            <w:anchorlock/>
            <v:textbox inset="0,0,0,0">
            <center >
            <![endif]-->
            <a class="cta" target="_blank" href="${element.link || '#'}" title="${elementTextNobadChars}" style="background-color: ${element.backgroundColor || 'transparent'}; font-size: ${element.fontSize}px; line-height: ${element.fontSize + 4}px; font-family: Arial, Helvetica, sans-serif; font-weight: ${element.fontWeight}; ${anchorBorderProps} text-decoration: none; padding: 11px 0; color: ${
          element.textColor || "#ffffff"
        }; text-align: center; display: inline-block; mso-padding-alt: 0; -webkit-text-size-adjust:none; mso-line-height-rule:exactly; width: ${width}px;">
            ${buttonHtmlText}
            </a>
            <!--[if mso]>
            </center>
            </v:textbox>
            </v:rect>
            <![endif]-->

            `;
      }
    }

    case "LIST": {
      const listTableStyle = buildStyleAttribute({
        "font-family": "Arial, Helvetica, sans-serif",
      });

      const counters = {};
      let lastLevel = 0;
      const listSpacing = element.listSpacing || 0;

      const itemsHtml = element.items
        .map((item, index) => {
          const fontSize = item.segments[0]?.style.fontSize || 16;
          const color = item.segments[0]?.style.color || "#000000";
          const level = item.level || 0;
           const INDENT_PER_LEVEL = fontSize + 8;
          const bulletPaddingLeft = level >= 2 ? (level - 1) * INDENT_PER_LEVEL : 0;

          let bullet;
          if (item.listType === "ORDERED") {
            if (level > lastLevel) {
              counters[level] = 1;
            } else if (level < lastLevel) {
              for (let i = level + 1; i <= lastLevel; i++) {
                delete counters[i];
              }
              counters[level] = (counters[level] || 0) + 1;
            } else {
              counters[level] = (counters[level] || 0) + 1;
            }
            lastLevel = level;

            const bulletParts = [];
            for (let i = 0; i <= level; i++) {
              if (counters[i]) bulletParts.push(counters[i]);
            }
            bullet = bulletParts.join(".") + ".";
          } else {
            bullet = "&bull;";
          }

          const neutralBaseStyle = {
            ...element.baseStyle,
            fontWeight: "normal",
          };

          const bulletFontWeight =
          item.segments?.[0]?.style?.fontWeight === "bold"
            ? "bold"
            : "normal";

          const segmentsHtml = item.segments.map((segment) => renderSegment(segment, neutralBaseStyle)).join("");

          return ` 
                        <tr>
                            <td align="left" valign="top" style="padding-left:${bulletPaddingLeft}px;">
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                    <tr>
                                        <td align="left" valign="top" style="color: ${color}; font-size: ${fontSize}px; line-height: ${fontSize + 4}px; font-family: Arial, Helvetica, sans-serif; font-weight: ${bulletFontWeight}; -webkit-text-size-adjust: none; mso-line-height-rule:exactly;text-align: center; width: ${fontSize + 8}px;">${bullet}</td>
                                        <td align="left" valign="top" style="color: ${color}; font-size: ${fontSize}px; line-height: ${fontSize + 4}px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; -webkit-text-size-adjust: none; mso-line-height-rule:exactly;">${segmentsHtml}</td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                         ${
                          (listSpacing > 0 && element.items.length > 1 && index < element.items.length - 1) ?
                          `<tr>
                            <td align="left" valign="top" height="${listSpacing}" style="line-height:0px; font-size:0px;">&nbsp;</td>
                          </tr>`
                          : ""
                        }
                    `;
        })
        .join("");

      return `<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" ${listTableStyle}>${itemsHtml}</table>`;
    }

    case "DIVIDER": {
      const dividerHeight = Math.round(element.height) || 1;
      const dividerColor = element.backgroundColor || "#000000";

      return ` 
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                    <tr>
                        <td align="left" valign="top"  height="${dividerHeight}" width="100%" style="border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; mso-line-height-rule: exactly; line-height:${dividerHeight}px; background-color: ${dividerColor};"></td>
                    </tr>
                </table>
            `;
    }

    default:
      return "";
  }
}

function generateHtmlFromContentMap(contentMap, imagePathMap, mainBgColor = "#ffffff") {
  if (!Array.isArray(contentMap)) {
    console.error("Input contentMap must be an array.");
    return "";
  }

  const mainRows = contentMap
    .map((element) => {
      let elementHtml = renderElement(element);

      const cleanLayerName = getCleanLayerName(element.name)

      return `          
        <!-- START: ${cleanLayerName}-->
        <tr><td align="left" valign="top">${elementHtml}</td></tr>
        <!-- END: ${cleanLayerName}-->`;
    })
    .join("");

  const rteTitle = "title";
  const rtePreheader = "preheader";

  return `
  <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
  <html xmlns="http://www.w3.org/1999/xhtml" lang="en" xml:lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
  <head>
    <meta name="x-apple-disable-message-reformatting" />
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
    <meta name="format-detection" content="telephone=no" />
    <meta name="format-detection" content="date=no" />
    <meta name="format-detection" content="address=no" />
    <meta name="format-detection" content="email=no" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <title>${rteTitle}</title>
    <!--[if mso]>
    <style type=text/css>sup,sub{font-size:100% !important;}body,table,td{font-family:Arial,Helvetica,sans-serif !important;}.ExternalClass *{line-height:100%;padding:0px;margin:0px;}v\:*{behavior:url(#default#VML);display:inline-block;}ul{padding-top:0px !important;padding-bottom:0px !important;margin-top:0px !important;margin-bottom:0px !important;}li{text-indent:-20em;}
    .cta {
      border: none !important;
      background-color: transparent !important;
    }
    </style>
    <![endif]-->
    <!--[if gte mso 16]>
      <style>
        .txt_white {
          mso-style-textfill-type: gradient;
          mso-style-textfill-fill-gradientfill-stoplist: "0 \#FFFFFF 0 100000\,100000 \#FFFFFF 0 100000";
          color: #000000 !important;
        }
        .outl_white {
          mso-style-textfill-type: gradient;
          mso-style-textfill-fill-gradientfill-stoplist: "0 \#FFFFFF 0 100000\,100000 \#FFFFFF 0 100000";
          color: #000000 !important;
        }
      </style>
    <![endif]-->
    <!--[if gte mso 9]>
        <xml>
        <w:WordDocument>
          <w:DontUseAdvancedTypographyReadingMail />
        </w:WordDocument> </xml>
    <![endif]-->
    <style type="text/css">
      body {
        font-family: Arial, Helvetica, sans-serif;
      }
      em {
        font-style: italic !important;
      }
      h1 {
        padding: 0px !important;
        margin: 0px !important;
        font-weight: normal !important;
        -webkit-text-size-adjust: none;
        mso-line-height-rule: exactly;
        /* ONLY modify the properties below */
        font-family: Arial, Helvetica, sans-serif !important;
        font-size: 30px !important;
        line-height: 34px !important;
        color: #000000 !important;
      }
      .ExternalClass * {
        line-height: 100%;
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
      u + .body .txt_white {
        background: #000;
        mix-blend-mode: screen;
      }
      u + .body .txt_white2 {
        background: #000;
        mix-blend-mode: difference;
      }
      u + .body a {
        color: inherit;
        text-decoration: none;
        font-size: inherit;
        font-weight: inherit;
        line-height: inherit;
      }
      Table,
      td {
        border-collapse: collapse;
        mso-table-lspace: 0pt;
        mso-table-rspace: 0pt;
        table-layout: fixed;
      }
      table table {
        table-layout: auto;
      }
      /* iOS Blue Links Fix for anchors */
      .blueLinks1 {
        mso-style-priority: 100 !important;
        color: #3498db !important;
        text-decoration: underline !important;
      }
      /* iOS Blue Links Fix for span */
      .smartLinks1 a {
        mso-style-priority: 100 !important;
        color: #444444 !important;
        text-decoration: none !important;
      }
      a[x-apple-data-detectors] {
        color: inherit !important;
        text-decoration: none !important;
        font-size: inherit !important;
        font-family: inherit !important;
        font-weight: inherit !important;
        line-height: inherit !important;
      }
      /* For displaying cutom text in preheader. Veeva will add .AE_customText class if we use customText token, so we check if it is added and rewrite with !important to show. It will disappear when sending */
      .pre-header_cT_span:has(.AE_customText) {
        display: block !important;
        opacity: 1 !important;
        visibility: visible !important;
        overflow: unset !important;
      }
      .pre-header_cT_span > select {
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        font-size: 16px !important;
      }
      /* Start Custom CSS */
      /* End Custom CSS */
      @media (max-width: 480px) {
        .mediaquery-fix {
          width: 100% !important;
          min-width: 100% !important;
          height: auto !important;
        }
        /* Mobile Structure */
        .content_320 {
          width: 320px !important;
          margin: 0 auto !important;
        }
        .content_280 {
          width: 280px !important;
          margin: 0 auto !important;
        }
        .fullwidth {
          width: 100% !important;
          display: block !important;
          margin: 0 auto !important;
        }
        .hide {
          display: none !important;
        }
        .showmobile {
          display: block !important;
          margin: auto !important;
          width: 100% !important;
          height: auto !important;
          max-height: inherit !important;
          overflow: visible !important;
        }
        /* CTA resize Mobile */
        .cta {
          width: 200px !important;
          margin: 0 auto !important;
        }
        /* paddings */
        .PB5 {
          padding-bottom: 5px !important;
        }
        .PT10 {
          padding-top: 10px !important;
        }
        .PL10 {
          padding-left: 10px !important;
        }
        .PX0 {
          padding-left: 0px !important;
          padding-right: 0px !important;
        }
        .PY0 {
          padding-top: 0px !important;
          padding-bottom: 0px !important;
        }
        .P0 {
          padding: 0px !important;
        }
        /* Image Resize */
        .imgFull {
          width: 100% !important;
          height: auto !important;
        }
        .imgSize120 {
          width: 120px !important;
          height: auto !important;
        }
        /* Fonts */
        .f10lh14 {
          font-size: 10px !important;
          line-height: 14px !important;
        }
        /* Align */
        .textLeft {
          text-align: left !important;
        }
        .textRight {
          text-align: right !important;
        }
        .textCenter {
          text-align: center !important;
        }
        /* height */
        .h10 {
          height: 10px !important;
        }
        /* Width */
        .w50 {
          width: 50px !important;
        }
      }
    </style>
    <!--[if gte mso 9]><xml><o:OfficeDocumentSettings><o:AllowPNG /><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
    <![endif]-->
  </head>
  <body style="width: 100% !important; -webkit-text-size-adjust: none; -ms-text-size-adjust: none; margin-top: 0; margin-right: 0; margin-bottom: 0; margin-left: 0; padding-top: 0; padding-right: 0; padding-bottom: 0; padding-left: 0; background: #ffffff; font-size: 12px !important">
    <div id="body-fix">
      <!--HIDDEN PREHEADER TEXT-->
        <div class="pre-header_cT_span" id="preheader" style="mso-hide: all; font-size: 0px; line-height: 0px; font-family: Arial, Helvetica, sans-serif; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; display: none;">
          ${rtePreheader}
        </div>
      <!-- END PREHEADER -->
      <!--[if (gte mso 9) | IE]>
        <table align="center" width="600" style="margin-left:auto;margin-right:auto;"><tr><td>
        <![endif]-->
      <table role="presentation" width="100%" border="0" class="mediaquery-fix" cellspacing="0" cellpadding="0" bgcolor="${mainBgColor}">
        <tr>
          <td align="center" valign="top" style="word-break: break-word;">
            <table role="presentation" width="600" border="0" cellspacing="0" cellpadding="0" class="content_320">
              <!--BEGIN BODY -->
               ${mainRows}
              <!--END BODY -->
            </table>
          </td>
        </tr>
      </table>
      <!--[if (gte mso 9) | IE]>
        </td></tr></table>
        <![endif]-->
    </div>
  </body>
</html>
    `;
}

async function writeContentMap(contentMap, fileName = "contentMap.js", directory = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "src")) {
  try {
    if (typeof contentMap !== "object" || contentMap === null) {
      throw new TypeError('The "contentMap" argument must be a non-null object.');
    }
    const objectString = JSON.stringify(contentMap, null, 2);
    const fileContent = `export const contentMap = ${objectString};`;
    const fullPath = path.resolve(directory, fileName);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, fileContent, "utf8");
    console.log(`Successfully wrote content map to: ${fullPath}`);
  } catch (error) {
    console.error(`Error writing content map to file "${fileName}" in directory "${directory}":`, error);
    throw error;
  }
}

async function main() {
  if (!FIGMA_FILE_ID || !FIGMA_PERSONAL_ACCESS_TOKEN) {
    throw new Error("ERROR: FIGMA_FILE_ID and FIGMA_PERSONAL_ACCESS_TOKEN must be set in your .env file!");
  }
  try {
    console.log("Fetching Figma file data...");

  const normalizedEncodedId = normalizedEncodedID(ID_FRAME_TO_RENDER);
  let specificFrameNode = null;
  let figmaData;
  
      if (ID_FRAME_TO_RENDER) {
        console.log(`Fetching node by ID: "${ID_FRAME_TO_RENDER}"`);

        const response = await fetch(
          `https://api.figma.com/v1/files/${FIGMA_FILE_ID}/nodes?ids=${normalizedEncodedId}`,
          {
            headers: { "X-Figma-Token": FIGMA_PERSONAL_ACCESS_TOKEN },
          }
        );
  
        if (!response.ok) {
          throw new Error(`Figma Nodes API Error: ${normalizedEncodedId} ${await response.text()}`);
        }
  
        const data = await response.json();
        figmaData = data;
  
        specificFrameNode = data.nodes?.[normalizedEncodedId]?.document;
  
        if (!specificFrameNode) {
          throw new Error(`Node with ID "${normalizedEncodedId}" not found.`);
        }
      }

    console.log("\nParsing Figma structure...");

    let allFrames;

    if (normalizedEncodedId) {

      console.log(`\nIntentando renderizar el frame específico: "${normalizedEncodedId}"`);

      if (specificFrameNode) {

        const parsedFrame = {
          type: "FRAME",
          name: specificFrameNode.name,
          id: specificFrameNode.id,
          layoutMode: specificFrameNode.layoutMode || "NONE",
          itemSpacing: specificFrameNode.itemSpacing || 0,
          primaryAxisAlignItems: specificFrameNode.primaryAxisAlignItems || "MIN",
          counterAxisAlignItems: specificFrameNode.counterAxisAlignItems || "MIN",
          backgroundColor: figmaColorToHex(specificFrameNode.fills?.[0]?.color),
          padding: {
            top: specificFrameNode.paddingTop || 0,
            right: specificFrameNode.paddingRight || 0,
            bottom: specificFrameNode.paddingBottom || 0,
            left: specificFrameNode.paddingLeft || 0,
          },
          elements: findChildElements(specificFrameNode.children),
        };
        allFrames = [parsedFrame];
      } else {
        throw new Error(`El frame especificado "${normalizedEncodedId}" no se pudo encontrar en el documento.`);
      }
    } else {

      console.log("No se especificó normalizedEncodedId, parseando todos los frames del primer canvas.");
      allFrames = parseFigmaByFrames(figmaData); 
    }

    if (!allFrames || allFrames.length === 0) {
      throw new Error("No se encontraron frames para parsear (o el frame especificado estaba vacío).");
    }

    const mainEmailFrame = allFrames[0];

    console.log(`\nUsing main frame: ${mainEmailFrame.name} (ID: ${mainEmailFrame.id})`);
    const contentMap = mainEmailFrame.elements;
    writeContentMap(contentMap);

    console.log("\nCollecting image references...");
    const imageRefs = collectImageRefs(contentMap);
    const imagePathMap = await downloadAndSaveImages(FIGMA_FILE_ID, FIGMA_PERSONAL_ACCESS_TOKEN, imageRefs);

    console.log("\nGenerating final HTML...");

    let finalHtml = generateHtmlFromContentMap(contentMap, imagePathMap, mainEmailFrame.backgroundColor);
    const outputPath = path.join(OUTPUT_DIR, "index.html");

    finalHtml = variablesReplacementHandler(finalHtml);

    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    await fs.writeFile(outputPath, finalHtml, "utf8");

    console.log(`\n🎉 Success! Your email has been generated at: ${outputPath}`);
  } catch (error) {
    console.error("\n❌ An error occurred during the build process:");
    console.error(error.message);
    process.exit(1);
  }
}

main();
