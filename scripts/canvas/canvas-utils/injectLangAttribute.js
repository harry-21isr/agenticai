import { TICKET_INFO } from '../../../src/ticket-info.js';

/**
 * Injects or updates lang and xml:lang attributes in the <html> tag.
 *
 * @param {string} html - HTML string to modify
 * @param {string} langCode - Language code (e.g. 'en', 'es')
 * @returns {string} - Updated HTML string
 */
function injectLangAttributes(html, langCode) {
  return html.replace(/<html([^>]*)>/i, (match, attrs) => {
    let updatedAttrs = attrs;

    // Replace or add lang=""
    if (/\blang\s*=\s*["'][^"']*["']/i.test(updatedAttrs)) {
      updatedAttrs = updatedAttrs.replace(/\blang\s*=\s*["'][^"']*["']/i, `lang="${langCode}"`);
    } else {
      updatedAttrs += ` lang="${langCode}"`;
    }

    // Replace or add xml:lang=""
    if (/\bxml:lang\s*=\s*["'][^"']*["']/i.test(updatedAttrs)) {
      updatedAttrs = updatedAttrs.replace(/\bxml:lang\s*=\s*["'][^"']*["']/i, `xml:lang="${langCode}"`);
    } else {
      updatedAttrs += ` xml:lang="${langCode}"`;
    }

    return `<html${updatedAttrs}>`;
  });
}

/**
 * Injects lang/xml:lang into HTML using imported lang variable.
 *
 * @param {string} html - Input HTML string
 * @returns {string} - Updated HTML
 */
export function injectLangAttribute(html) {
  if (!TICKET_INFO.LANG || typeof TICKET_INFO.LANG !== 'string') {
    throw new Error('Invalid or missing `lang` import.');
  }

  return injectLangAttributes(html, TICKET_INFO.LANG.trim());
}
