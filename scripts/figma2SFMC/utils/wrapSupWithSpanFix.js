export function wrapSupWithPrevWord(html) {
  return html.replace(
    /((?:<[^>]+>[^<]*<\/[^>]+>|\S+))(<sup style="[^"]*">[^<]*<\/sup>)/g,
    `<span style="word-spacing: -0.4ch;">$1$2</span>`
  );
}