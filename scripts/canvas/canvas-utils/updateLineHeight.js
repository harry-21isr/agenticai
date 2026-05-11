import logger from './logger.js';
import { JSDOM } from 'jsdom';
import css from 'css';

/**
 * Rounds to nearest even number.
 */
const roundToNearestDecimal = (num) => Math.round(num);

/**
 * Parse inline styles into an object.
 */
function parseInlineStyles(styleStr) {
    const styleMap = {};
    try {
        const parsed = css.parse(`* { ${styleStr} }`);
        const declarations = parsed.stylesheet.rules[0].declarations;
        declarations.forEach(({ property, value }) => {
            styleMap[property] = value;
        });
    } catch (e) {
        console.warn('Failed to parse style:', styleStr);
    }
    return styleMap;
}

/**
 * Convert style object to inline string.
 */
function styleObjToString(styleMap) {
    return Object.entries(styleMap)
        .map(([k, v]) => `${k}: ${v};`)
        .join(' ');
}

/**
 * Walks through children to find max font-size.
 */
function findMaxFontSize(element, inheritedFontSize = null) {
    let maxFontSize = inheritedFontSize;

    for (const child of element.children) {
        const styleStr = child.getAttribute?.('style') || '';
        const styles = parseInlineStyles(styleStr);
        const childFontSize = styles['font-size'] ? parseFloat(styles['font-size']) : inheritedFontSize;

        maxFontSize = Math.max(maxFontSize || 0, childFontSize || 0);

        const childMax = findMaxFontSize(child, childFontSize || inheritedFontSize);
        maxFontSize = Math.max(maxFontSize, childMax);
    }

    return maxFontSize || inheritedFontSize || 0;
}

/**
 * Wrap unstyled text nodes with span at original font-size.
 */
function wrapUnstyledTextNodes(element, originalFontSize) {
    const doc = element.ownerDocument;

    for (const node of Array.from(element.childNodes)) {
        if (node.nodeType === 3 && node.nodeValue.trim()) {
            const span = doc.createElement('span');
            span.textContent = node.nodeValue;
            span.setAttribute('style', `font-size: ${originalFontSize}px;`);
            element.replaceChild(span, node);
        }
    }
}

/**
 * Promote parent font-size and preserve smaller children.
 */
function promoteFontSize(element) {
    if (!element.hasAttribute?.('style')) return;

    const styleStr = element.getAttribute('style');
    const styleMap = parseInlineStyles(styleStr);

    const originalFontSize = styleMap['font-size'] ? parseFloat(styleMap['font-size']) : null;
    const lineHeight = styleMap['line-height'];
    const isPercentLineHeight = lineHeight?.includes('%');

    const maxFontSize = findMaxFontSize(element, originalFontSize);

    if (maxFontSize && originalFontSize && maxFontSize > originalFontSize) {
        // Promote parent font-size
        styleMap['font-size'] = `${maxFontSize}px`;

        // Convert line-height to px
        if (isPercentLineHeight) {
            const percent = parseFloat(lineHeight);
            const pixelLH = roundToNearestDecimal((maxFontSize * percent) / 100);
            styleMap['line-height'] = `${pixelLH}px`;
        }

        element.setAttribute('style', styleObjToString(styleMap));

        // Wrap unstyled text nodes at original font-size
        wrapUnstyledTextNodes(element, originalFontSize);

        // Fix children that inherited original font-size (excluding void elements)
const VOID_TAGS = new Set(['br', 'img', 'hr', 'meta', 'input', 'link']);

for (const child of element.children) {
    const tagName = child.tagName.toLowerCase();
    if (VOID_TAGS.has(tagName)) continue;

    const childStyleStr = child.getAttribute?.('style') || '';
    const childStyles = parseInlineStyles(childStyleStr);
    const childFontSize = childStyles['font-size'] ? parseFloat(childStyles['font-size']) : null;

    // If child didn't declare its own larger font-size
    if (!childFontSize || childFontSize === originalFontSize) {
        childStyles['font-size'] = `${originalFontSize}px`;
        child.setAttribute('style', styleObjToString(childStyles));
    }
}
    } else if (isPercentLineHeight && originalFontSize) {
        // Convert line-height to px without promoting
        const percent = parseFloat(lineHeight);
        const pixelLH = roundToNearestDecimal((originalFontSize * percent) / 100);
        styleMap['line-height'] = `${pixelLH}px`;
        element.setAttribute('style', styleObjToString(styleMap));
    }
}

/**
 * Main entry
 */
export default function updateLineHeight(html) {
    const dom = new JSDOM(html);
    const document = dom.window.document;

    document.querySelectorAll('[style]').forEach(promoteFontSize);

    logger.log(
        `✅ Promoted parent font-size to match child, converted line-height %, preserved smaller fonts.`,
        'info'
    );

    return dom.serialize();
}


/* *fixes applied to canvas code. Technical definitions*

* updateLineHeight.mjs

convert % to fixed pixels. also checks for malformatted styles like when paren component has smaller line-height than child components. example:
<td align="left" style="font-size:0px;padding:10px 25px;word-break:break-word;">
    <div style="font-family:Arial, Helvetica, sans-serif;font-size:12px;line-height:120%;text-align:left;color:#444444;">
        <div style="text-align: center;"><span style="font-size:18px;"><span style="color:#8bd3e6;">Estimado(a) Dr(a): <strong>[Name]</strong></span></span></div>
    </div>
</td>

will be transformed into this:
 <td align="left" style="font-size: 0; padding: 10px 20px; word-break: break-word">
    <div style="font-family: Arial,Helvetica,sans-serif; font-size: 18px; line-height: 22px; text-align: left; color: #444444;">
        <div style="text-align: center; font-size: 18px;"><span style="font-size:18px;"><span style="color:#8bd3e6;">Estimado(a) Dr(a): <b>[Name]</b></span></span></div> <br><span style="font-size: 12px;"> some smaller text goes here </span>
    </div>
</td> */