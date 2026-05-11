import { JSDOM } from 'jsdom';

/**
 * Modifies HTML:
 * - Wraps valid <img src="..."> in <a> with title from alt
 * - Adds alt="" if missing
 * - Skips <img> if src is missing or empty
 * - Updates first <td> above <a> with required styles
 * 
 * @param {string} html - The HTML string to modify.
 * @returns {string} - The modified HTML string.
 */
export function imgGmailFix(html) {
  // Extract original doctype (if any)
  const doctypeMatch = html.match(/<!DOCTYPE [^>]+>/i);
  const originalDoctype = doctypeMatch ? doctypeMatch[0] + '\n' : '';

  const dom = new JSDOM(html);
  const document = dom.window.document;

  function updateTdStyles(td) {
    if (!td) return;
    const style = td.getAttribute('style') || '';
    const styleObj = Object.fromEntries(
      style
        .split(';')
        .map(s => s.trim())
        .filter(Boolean)
        .map(s => s.split(':').map(x => x.trim()))
    );

    styleObj['font-size'] = '10px';
    styleObj['line-height'] = '12px';
    styleObj['mso-line-height-rule'] = 'at-least';

    const updatedStyle = Object.entries(styleObj)
      .map(([k, v]) => `${k}: ${v}`)
      .join('; ') + ';';

    td.setAttribute('style', updatedStyle);
  }

  const imgs = [...document.querySelectorAll('img')];

  imgs.forEach(img => {
    const rawSrc = img.getAttribute('src');
     // 🚫 Skip if src is missing or empty/whitespace
    if (!rawSrc || rawSrc.trim() === '') return;

    // ✅ Ensure alt exists 
    if (!img.hasAttribute('alt')) {
      img.setAttribute('alt', '');
    }
    const alt = img.getAttribute('alt');

    const parent = img.parentElement;

    
    if (parent?.tagName?.toLowerCase() === 'a' && parent.hasAttribute('href')) {

      const href = parent.getAttribute('href') || '';
      parent.setAttribute('title', alt);
      parent.setAttribute('target', '_blank');

      if(href.includes("#") || href.toLowerCase().includes('#tbd')) { //if # or #tbd set anchor to none clickable
        parent.setAttribute(
        'style',
        'border: none; text-decoration: none; outline: none !important; pointer-events: none; cursor: default; display: block;'
      );
      }
      else {
        // Case: Already wrapped in <a>
        parent.setAttribute( // set anchor to be clickable
          'style',
          'border: none; text-decoration: none; outline: none !important; pointer-events: cursor; display: block;'
        );
      }

      const td = parent.closest('td');
      updateTdStyles(td);
    } else {
      // Case: Needs to be wrapped 
      const a = document.createElement('a');
      a.setAttribute('href', '#');
      a.setAttribute('title', alt);
      a.setAttribute(
        'style',
        'border: none; text-decoration: none; outline: none !important; pointer-events: none; cursor: default; display: block;'
      );

      img.replaceWith(a);
      a.appendChild(img);

      const td = a.closest('td');
      updateTdStyles(td);
    }
  });

  return originalDoctype + document.documentElement.outerHTML;
}
//if img hasnt a alt="" atomatically add empty one // if image has a alt text define will automatically populated into title for the ancestor <a> //imgaes with none src defined or empty are dissmised from the gmail fix