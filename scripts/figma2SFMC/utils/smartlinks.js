export function wrapSmartLinksInText(text, color) {
 const smartLinkRegex =
    /\b\d{4};\d+:\d+\b|\b\d+\(\d+\):?|\b\d{4,}\b|\b\d+(?:[-:;]\d+)+\b|\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b|\b(https?:\/\/\S+|www\.\S+|\S+\.(com|net|co|org|io|edu|gov))\b/gi;

  const wholeWordSmartLink = /\d[\d;:()\[\].,-]+\d/; // detects number-punctuation-number combos

  const linkStyle = `font-family: Arial, Helvetica, sans-serif; color: ${color}; font-size: inherit; line-height: inherit; text-decoration: none; pointer-events: none; cursor: none; -webkit-text-size-adjust: none; mso-line-height-rule:exactly;`;

  // Split preserving whitespace tokens
  const tokens = text.split(/(\s+)/);

  return tokens.map(token => {
    // Pass whitespace through untouched
    if (/^\s+$/.test(token)) return token;

    // If the whole token looks like a complex number pattern (no spaces),
    // wrap the entire token as one <a>
    if (wholeWordSmartLink.test(token)) {
      // Strip trailing punctuation like . , ) for the wrap, keep it outside
      const trailingMatch = token.match(/^(.*?)([.,;]?)$/);
      const word = trailingMatch[1];
      const trailing = trailingMatch[2];
      return `<a href="#" style="${linkStyle}">${word}</a>${trailing}`;
    }

    // Otherwise apply normal per-match regex replacement
    smartLinkRegex.lastIndex = 0;
    return token.replace(smartLinkRegex, (match) => {
      return `<a href="#" style="${linkStyle}">${match}</a>`;
    });
  }).join("");
}