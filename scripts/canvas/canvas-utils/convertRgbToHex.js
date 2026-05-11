/**
 * Converts RGB color values in inline styles to HEX format in the provided HTML string.
 *
 * @param {string} html - The HTML string containing inline styles with RGB color values.
 * @returns {string} - The updated HTML string with RGB color values converted to HEX format.
 */
export default function convertRgbToHex(html) {
    /**
     * Converts an RGB color string to a HEX color string.
     *
     * @param {string} rgb - The RGB color string (e.g., "rgb(255, 0, 0)").
     * @returns {string} - The HEX color string (e.g., "#FF0000").
     */
    function rgbToHex(rgb) {
        const result = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
        return result
            ? "#" +
            ((1 << 24) + (parseInt(result[1]) << 16) + (parseInt(result[2]) << 8) + parseInt(result[3]))
                .toString(16)
                .slice(1)
                .toLocaleLowerCase()
            : rgb;
    }

    // Regular expression to find inline styles with RGB color values.
    const rgbRegex = /style="([^"]*?rgb\(\d+,\s*\d+,\s*\d+\)[^"]*?)"/g;

    return html.replace(rgbRegex, (match, p1) => {
        // Replace all RGB color values in the matched style attribute with HEX values.
        const updatedStyle = p1.replace(/rgb\(\d+,\s*\d+,\s*\d+\)/g, (rgbMatch) => rgbToHex(rgbMatch));
        return `style="${updatedStyle}"`;
    });
}