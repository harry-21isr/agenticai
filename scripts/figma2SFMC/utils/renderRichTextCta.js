export const renderSegmentForButton = (seg, baseStyle) => {
  let style = "";

  if (seg.style?.color) style += `color:${seg.style.color};`;
  if (seg.style?.fontSize) style += `font-size:${seg.style.fontSize}px;`;

  let text = seg.characters
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")

  if (seg.style?.fontWeight === "bold") {
    text = `<strong>${text}</strong>`;
  }
  if (seg.style?.fontStyle === "italic") {
    text = `<em>${text}</em>`;
  }
  if (seg.style?.textDecoration === "underline") {
    text = `<u>${text}</u>`;
  }

  return `<span style="${style}">${text}</span>`;
}