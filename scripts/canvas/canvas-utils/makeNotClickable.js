import chalk from "chalk";
import logger from "./logger.js";
import { JSDOM } from "jsdom";
import { CANVAS_AUTOMATIONS } from "../../automations_control/canvasAutomationsSwitch.js";

/**
 * Processes the provided HTML data to make it less clickable and obfuscates certain elements.
 * - Adds zero-width joiners (ZWJ) to digit sequences.
 * - Replaces email addresses and URLs not within <a> tags.
 * - Wraps certain Veeva tokens with <a> tags to style them as plain text.
 * - Ensures link colors inherit from ancestors (default #000000).
 * - Recursively processes text content within elements.
 *
 * @param {string} data - The HTML data to be processed.
 * @returns {string} - The modified HTML string.
 */
export default function makeNotClickable(data) {
  const dom = new JSDOM(data);
  const document = dom.window.document;

  // Recursively obfuscate digit sequences with ZWJ
  const processTextContent = (element) => {
    element.childNodes.forEach((node) => {
      if (node.nodeType === node.TEXT_NODE) {
        let regex = /\d{2,}/g;
        //node.textContent = node.textContent.replace(regex, (match) => match.replace(/\d{2,}/g, "$&\u200D"));
        node.textContent = node.textContent.replace(regex, (match) => {
          return match.replace(/(\d{3})(?=\d)/g, "$1\u200D");
        });
      } else if (node.nodeType === node.ELEMENT_NODE) {
        processTextContent(node);
      }
    });
  };

  const body = document.querySelector("body");
  if (body) {
    let data = body.innerHTML;

    // Email addresses not inside <a>
    let regex = /(?<!<a\s+(?:[^>]*?\s+)?href=["'][^"']*)\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b(?!<\/a>)/g;
    data = data.replace(regex, (match) => {
      let replaced = match.replace(/\./g, "\u200D.\u200D");
      return replaced.replace("@", '<span style="display:none;mso-hide:all;">&nbsp;</span>@');
    });

    // URLs not inside <a>, {{}} or <v:roundrect>
    regex = /(?<!<a\s+(?:[^>]*?\s+)?href=["'][^"']*|\{\{|<v:roundrect\s+(?:[^>]*?\s+)?href=["'][^"']*)\b(https?:\/\/)?(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}([^\s\/<]*)?(?![^<]*<\/a>)/g;
    data = data.replace(regex, (match) => {
      let replaced = match.replace(/\./g, "\u200D.\u200D");
      if (replaced.startsWith("www")) replaced = replaced.replace("www", "w\u200Dww");
      if (replaced.startsWith("http")) replaced = replaced.replace("http", "h\u200Dttp");
      return replaced;
    });

    // === Wrap Veeva tokens if not already in a link ===
    function wrapTokenNotInLink(data, token, indicative) {
      const dom = new JSDOM(data);
      const document = dom.window.document;

      const regex = new RegExp(`(?<!<(?:a|v:roundrect)[^>]*?href=["'][^"']*?)\\{\\{${token}\\}\\}(?![^<]*<\\/(?:a|v:roundrect)>)`, "g");

      let html = document.body.innerHTML;
      html = html.replace(regex, (match) => {
        // Create a temporary span so we can find it later
        return `<span data-token="${token}">${match}</span>`;
      });
      document.body.innerHTML = html;

      // Process all inserted spans
      document.querySelectorAll(`span[data-token="${token}"]`).forEach((span) => {
        let ancestorColor = "#000000"; // default
        let current = span.parentElement;

        while (current && current.tagName) {
          let foundColor = null;

          // Case 1: inline style
          const style = current.getAttribute("style") || "";
          const styleMatch = style.match(/color\s*:\s*([^;]+);?/i);
          if (styleMatch && styleMatch[1]) {
            foundColor = styleMatch[1].trim();
          }

          // Case 2: <font color="...">
          if (!foundColor && current.tagName.toLowerCase() === "font" && current.hasAttribute("color")) {
            foundColor = current.getAttribute("color");
          }

          if (foundColor) {
            ancestorColor = /^rgb/i.test(foundColor) ? rgbToHex(foundColor) : foundColor;
            break;
          }

          current = current.parentElement;
        }

        // Replace the span with an <a> using ancestor color
        const tokenMarkup = `<a href="${indicative}{{${token}}}" style="color:${ancestorColor};text-decoration:none;pointer-events:none;">{{${token}}}</a>`;
        span.outerHTML = tokenMarkup;
      });

      return document.body.innerHTML;
    }

    data = wrapTokenNotInLink(data, "userEmailAddress", "mailto:");
    data = wrapTokenNotInLink(data, "User.Phone", "tel:");
    data = wrapTokenNotInLink(data, "User.MobilePhone", "tel:");

    // Convert rgb() → hex
    function rgbToHex(rgb) {
      if (!rgb) return "#000000";
      const rgbValues = rgb.match(/\d+/g);
      if (!rgbValues || rgbValues.length < 3) return "#000000";
      const hex = rgbValues.map((value) => {
        const hexValue = parseInt(value).toString(16);
        return hexValue.length === 1 ? "0" + hexValue : hexValue;
      });
      return `#${hex.join("")}`;
    }

    // Ensure <a href="#"> inherits ancestor color (default #000000)
    function setLinkColorToAncestorColor(html) {
      const dom = new JSDOM(html);
      const document = dom.window.document;
      const links = document.querySelectorAll('a[href="#"]');

      links.forEach((link) => {
        let ancestorColorHex = "#000000"; // default
        let current = link.parentElement;

        while (current && current.tagName) {
          let foundColor = null;

          // Case 1: inline style
          const style = current.getAttribute("style") || "";
          const styleMatch = style.match(/color\s*:\s*([^;]+);?/i);
          if (styleMatch && styleMatch[1]) {
            foundColor = styleMatch[1].trim();
          }

          // Case 2: <font color="...">
          if (!foundColor && current.tagName.toLowerCase() === "font" && current.hasAttribute("color")) {
            foundColor = current.getAttribute("color");
          }

          if (foundColor) {
            if (/^rgb/i.test(foundColor)) {
              ancestorColorHex = rgbToHex(foundColor);
            } else {
              ancestorColorHex = foundColor;
            }
            break;
          }

          current = current.parentElement;
        }

        const existingStyle = (link.getAttribute("style") || "").trim();

        // keep only non-empty, non-conflicting styles
        const filteredStyles = existingStyle
          .split(";")
          .map((s) => s.trim())
          .filter((s) => s && !s.toLowerCase().startsWith("color") && !s.toLowerCase().startsWith("text-decoration") && !s.toLowerCase().startsWith("pointer-events"));

        // build final style cleanly
        let newStyle = [`color:${ancestorColorHex}`, `text-decoration:none`, `pointer-events:none`, ...filteredStyles].join(";");

        link.setAttribute("style", newStyle);
      });

      return dom.serialize();
    }

    data = setLinkColorToAncestorColor(data);

    // Remove ZWJ from <img src>
    regex = /<img\s+[^>]*?src\s*=\s*["'][^"']*["'][^>]*>/g;
    data = data.replace(regex, (match) => match.replace(/\u200D/g, ""));

    body.innerHTML = data;
    CANVAS_AUTOMATIONS.BREAK_CONSECUTIVE_NUMBERS && processTextContent(body);
    data = body.innerHTML;

    // Cleanup: remove ZWJ from tokens
    regex = /\{\{[^\}]+\}\}/g;
    data = data.replace(regex, (match) => match.replace(/\u200D/g, ""));
    body.innerHTML = data;
  }

  logger.log(`Fix not clickable links ${chalk.yellow.bold("zero-width joiner (‍&zwj;)")}.`, "info");

  return dom.serialize();
}
