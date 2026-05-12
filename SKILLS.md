## Skills and Tools

### General Skills
- **Script Automation**: Skill in automating tasks with scripts, particularly with Node.js and `curl`, which are now integrated into the GitHub workflow for automating documentation updates via the OpenAI API.
  
### Tools

- **Cheerio**: Utilized for DOM manipulation to transform HTML content into plain text, particularly useful for processing and cleaning up HTML elements when generating text versions.
- **Node.js**: Used to run custom scripts within GitHub Actions, replacing former dependencies such as `actions/github-script`.
- **cURL**: Incorporated into scripts for HTTP requests, essential for interacting with APIs, such as the OpenAI API in this context.

### Automated Documentation Updates
- **OpenAI API Integration**: Documentation in files like `AGENTS.md`, `SKILLS.md`, and `CHANGELOG.md` can now be updated automatically with AI-driven script updates to reflect code diffs and changes.

### Discontinued Tools
- **HTML to Plain Text Conversion**: The previous approach using `scripts/figma2SFMC/text.js` has been removed, halting the generation of plain text from HTML content using that specific script.
