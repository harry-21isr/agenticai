# AGENTS.md

## Stack

- **Runtime**: Node.js 20 (ESM modules — `"type": "module"` in package.json)
- **HTML processing**: cheerio, posthtml, jsdom, html-crush
- **PDF generation**: puppeteer, jspdf
- **Other**: archiver, chalk, dotenv, node-fetch

## Architecture

This is a Node.js email template build toolchain. It has no frontend framework. All scripts live under `scripts/` and are run via npm scripts defined in `package.json`. The project converts Figma designs and HTML templates into various email/presentation formats.

### Pipelines

| Pipeline | npm script | Purpose |
|----------|-----------|---------|
| **figma2SFMC** | `build:figma2sfmc` | Converts Figma frames to Salesforce Marketing Cloud (SFMC) HTML email templates |
| **figma2RTE** | `build:figma2rte` | Converts Figma frames to Rich Text Email (RTE) format |
| **rte2LSC** | `build:rte2lsc` | Transforms RTE/HTML into Litmus Send Cloud format with token replacement |
| **veeva** | `build:veeva` | Builds Veeva email templates with fragmentation, image archiving, and PDF output |
| **sfmc:text** | `sfmc:text` | Generates plain-text version of an SFMC email from `src/index.html` |
| **imgtourl** | `build:imgtourl` | Applies hosted image URLs to SFMC HTML |
| **pdf** | `pdf` / `pdf:url` | Generates PDFs from built HTML using puppeteer |
| **dwsnippets** | `dwsnippets` | Generates DW-specific code snippets |

### Key Directories

```
scripts/
  figma2SFMC/       # SFMC conversion engine + utilities
    utils/          # layerNameNoIdentifiers, normalizedEncodedID, renderRichTextCta, smartlinks, wrapSupWithSpanFix
  figma2RTE/        # RTE conversion (reuses figma2SFMC utils)
  rte2LSC/          # Token replacement engine (60+ TOKEN_MAP entries)
  veeva/            # Veeva template builder with CLI fragment support
  automations_control/  # Automation state switches and HTML parsing helpers
  utils/            # Shared: fileUtils, htmlUtils, logUtils, variablesReplacement, cleanDist, createPdfs
src/                # Input HTML (index.html) and built output files
test/               # Local staging server for previewing templates
image-library/      # Shared image assets
```

### figma2SFMC Utilities (`scripts/figma2SFMC/utils/`)

- `smartlinks.js` — Wraps links with tracking parameters
- `layerNameNoIdentifiers.js` — Strips identifiers from Figma layer names
- `renderRichTextCta.js` — Renders button/CTA elements from rich text nodes
- `wrapSupWithSpanFix.js` — Fixes superscript wrapping for email clients
- `normalizedEncodedID.js` — Normalises and encodes element IDs

### rte2LSC Token Map

The `scripts/rte2LSC/build.js` TOKEN_MAP replaces SFMC-style tokens with LSC equivalents, e.g.:
- `{{accFname}}` → `{{recipient.firstname}}`
- `{{User.FirstName}}` → `{{sender.firstname}}`
- `{{customText}}`, `{{customRichText}}`, `{{userPhoto}}`, `{{insertEmailFragments}}`

### Veeva Fragments

Fragments are delimited in HTML with:
```html
<!--fragmentName start-->
  ...content...
<!--fragmentName end-->
```
Output goes to `dist/full_version/` and `dist/fragmented_version/`. Fragment filenames must be unique. Fragments must be inside `<td>` tags.

## Environment Variables

Only required for Figma pipelines (`figma2SFMC`, `figma2RTE`):

| Variable | Purpose |
|----------|---------|
| `FIGMA_FILE_ID` | Source Figma file ID |
| `FIGMA_PERSONAL_ACCESS_TOKEN` | Figma API auth token |
| `ID_FRAME_TO_RENDER` | Specific frame name/ID to process |

## Commands

```bash
# Figma → SFMC HTML
npm run build:figma2sfmc

# Figma → RTE HTML
npm run build:figma2rte

# RTE HTML → LSC format
npm run build:rte2lsc

# Veeva build (interactive CLI)
npm run build:veeva

# Generate plain-text email version
npm run sfmc:text

# Generate PDFs from built HTML
npm run pdf

# Clean dist/
npm run clean
```

## AI Documentation Workflow

The GitHub Actions workflow `.github/workflows/ai-docs.yml` runs on every PR and:
1. Diffs the PR against `main` (first 8000 chars)
2. Calls OpenAI GPT-4o to update `AGENTS.md` and `CHANGELOG.md`
3. Commits and pushes updates back to the PR branch
4. Posts an AI-generated PR summary as the PR description

Prompts are written to `prompt.txt` to avoid shell/JS escaping issues. API responses are saved to `response.json` before parsing.

```bash
# Trigger manually
gh workflow run ai-docs.yml
```