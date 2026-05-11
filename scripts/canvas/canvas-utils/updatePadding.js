import chalk from "chalk";
import logger from "./logger.js";
import { JSDOM } from "jsdom";

/**
 * Updates inline padding styles in the provided HTML string by parsing it with jsdom,
 * and converting longhand padding properties to shorthand where applicable.
 *
 * @param {string} html - The HTML string to modify.
 * @returns {string} - The modified HTML string with updated padding styles.
 */
export default function updatePadding(html) {
  // Create a new JSDOM instance with the provided HTML
  const dom = new JSDOM(html);
  const document = dom.window.document;

  /**
   * Parses a CSS padding shorthand string into an array of individual padding values.
   *
   * @param {string} padding - The padding shorthand string.
   * @returns {string[]} - An array of individual padding values [top, right, bottom, left].
   */
  const parsePadding = (padding) => {
    const parts = padding.split(" ").map((p) => p.trim());
    switch (parts.length) {
      case 1:
        return [parts[0], parts[0], parts[0], parts[0]];
      case 2:
        return [parts[0], parts[1], parts[0], parts[1]];
      case 3:
        return [parts[0], parts[1], parts[2], parts[1]];
      case 4:
        return parts;
      default:
        return ["0", "0", "0", "0"];
    }
  };

  /**
   * Converts an array of individual padding values into the shortest possible
   * padding shorthand string.
   *
   * @param {string[]} paddings - An array of individual padding values [top, right, bottom, left].
   * @returns {string} - The shortest possible padding shorthand string.
   */
  const shortenPadding = (paddings) => {
    const [top, right, bottom, left] = paddings;
    if (top === bottom && right === left) {
      if (top === right) {
        return top; // padding: 10px;
      }
      return `${top} ${right}`; // padding: 10px 20px;
    }
    if (right === left) {
      return `${top} ${right} ${bottom}`; // padding: 10px 20px 10px;
    }
    return paddings.join(" "); // padding: 10px 20px 30px 40px;
  };

  /**
   * Updates the padding values in a CSS style string by converting longhand
   * padding properties to shorthand where applicable.
   *
   * @param {string} style - The CSS style string.
   * @returns {string} - The updated CSS style string with shortened padding.
   */
  const updatePadding = (style) => {
    const styles = style
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s);
    const styleObj = {};
    let paddingShorthand = null;

    styles.forEach((s) => {
      const [property, value] = s.split(":").map((p) => p.trim());
      if (property === "padding") {
        paddingShorthand = parsePadding(value);
      }
      styleObj[property] = value;
    });

    if (paddingShorthand) {
      const paddings = [styleObj["padding-top"] || paddingShorthand[0], styleObj["padding-right"] || paddingShorthand[1], styleObj["padding-bottom"] || paddingShorthand[2], styleObj["padding-left"] || paddingShorthand[3]];

      styleObj["padding"] = shortenPadding(paddings);

      delete styleObj["padding-top"];
      delete styleObj["padding-right"];
      delete styleObj["padding-bottom"];
      delete styleObj["padding-left"];
    }

    return Object.entries(styleObj)
      .map(([k, v]) => `${k}: ${v}`)
      .join("; ");
  };

  // Select elements with inline styles
  const elements = document.querySelectorAll("[style]");
  elements.forEach((el) => {
    const style = el.getAttribute("style");
    if (style && style.includes("padding:")) {
      const newStyle = updatePadding(style);
      el.setAttribute("style", newStyle);
    }
  });

  logger.log(`Fix inline CSS padding styles ${chalk.yellow.bold("shortened")}.`, "info");

  // Return the modified HTML
  return dom.serialize();
}
