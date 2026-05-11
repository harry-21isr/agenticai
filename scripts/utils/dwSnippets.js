import fs from "fs";
import path from "path";
import stripJsonComments from "strip-json-comments";

const vscodeFolder = path.join(process.cwd(), ".vscode");
const outputFolder = path.join(process.cwd(), "dw_snippets");

if (!fs.existsSync(outputFolder)) {
  fs.mkdirSync(outputFolder); //create new empty folder
}
fs.rmSync(outputFolder, { recursive: true, force: true }); //delete folder if exists
fs.mkdirSync(outputFolder); //create new empty folder

function snippetToDW(name, snippet) {
  const body = Array.isArray(snippet.body) ? snippet.body.join("\n") : snippet.body;

  return `<?xml version="1.0" encoding="utf-8"?>
<snippet name="${name}" description="${snippet.description || ""}" preview="code" type="block">
<insertText location="beforeSelection">
<![CDATA[
${body}
]]>
</insertText>
<insertText location="afterSelection"><![CDATA[]]>
</insertText>
</snippet>`;
}

fs.readdirSync(vscodeFolder).forEach((file) => {
  // ❌ skip this file
  if (file === "veeva-tokens.code-snippets") {
    console.log(`⏭️ Skipped: ${file}`);
    return;
  }

  const filePath = path.join(vscodeFolder, file);

  if (fs.statSync(filePath).isFile() && file.endsWith(".code-snippets")) {
    const content = fs.readFileSync(filePath, "utf-8");

    try {
      // Remove comments / fix JSONC
      const cleaned = stripJsonComments(content);
      const snippets = JSON.parse(cleaned);

      Object.entries(snippets).forEach(([name, snippet]) => {
        if (snippet.body) {
          const dwSnippet = snippetToDW(name, snippet);
          const safeName = name.replace(/[\\/:"*?<>|]+/g, "_");
          const outPath = path.join(outputFolder, `${safeName}.csn`);
          fs.writeFileSync(outPath, dwSnippet, "utf-8");
          console.log(`✅ Created: ${outPath}`);
        }
      });
    } catch (err) {
      console.error(`❌ Error parsing ${file}:`, err.message);
    }
  }
});
