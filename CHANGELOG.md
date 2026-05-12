```markdown
## [2026-05-12]

### Changed
- Updated the `.github/workflows/ai-docs.yml` file to replace the GitHub Action step utilizing `actions/github-script` with a custom script that uses `node` and `curl`. This script calls the OpenAI API for processing diffs and updating documentation files (`AGENTS.md`, `SKILLS.md`, and `CHANGELOG.md`). The process now:
  - Saves the git diff to `diff.txt`.
  - Defines a function `call_ai` to interact with the OpenAI API and update documentation files based on prompts.
  - Automates the updates of `AGENTS.md`, `SKILLS.md`, and `CHANGELOG.md` using this new function.
  - Commits these changes with a clearer message: "AI: update AGENTS.md, SKILLS.md, CHANGELOG.md".

- Removed `scripts/figma2SFMC/text.js`, effectively ceasing the generation of plain text versions from HTML content using this script. This file included logic for processing HTML content and generating text output, including significant content processing steps such as cleanup and DOM manipulations with Cheerio.
```