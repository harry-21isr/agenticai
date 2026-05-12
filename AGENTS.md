## Agents

### Overview

This document details the agents available in our system, defining their roles, inputs, outputs, and associated tools.

### Existing Agents

#### Documentation Update Agent

- **Role**: Automates the update of documentation files in the project repository.
- **Inputs**: Git diffs from pull requests or direct file changes that require documentation updates.
- **Outputs**: Updated documentation files (`AGENTS.md`, `SKILLS.md`, `CHANGELOG.md`).
- **Tools**:
  - **OpenAI API**: Utilized for processing diffs and generating documentation content based on predefined templates and models.
  - **GitHub Actions**: Triggers on commits or pull requests, executing workflows that handle documentation generation tasks.

#### Figma to SFMC Text Converter (Discontinued)

- **Role**: Converted HTML content to plain text versions, especially for Salesforce Marketing Cloud (SFMC) email formats.
- **Inputs**: HTML content files.
- **Outputs**: Plain text files suitable for SFMC email templates.
- **Tools**:
  - **Cheerio**: For parsing and manipulating HTML content.
  - **Node.js**: For running scripts that handle the conversion process.

### New Agents

#### AI Documentation Update Agent

- **Role**: Enhance and automate the updating process of documentation files using AI models.
- **Inputs**: Git diff files (`diff.txt`) and predefined prompts for AI interaction.
- **Outputs**: Updated documentation files, namely `AGENTS.md`, `SKILLS.md`, and `CHANGELOG.md`.
- **Tools**:
  - **Node**: Executes custom scripts for calling AI models.
  - **Curl**: Facilitates API requests to OpenAI for generating documentation content.
  - **OpenAI API**: Central to processing the inputs and creating updates for documentation files based on coded logic.

### Deprecated Agents

#### Figma to SFMC Text Conversion Script

- **Details**: The script handling plain text conversion from HTML (`scripts/figma2SFMC/text.js`) is removed. Its responsibility to parse and produce text-based email versions outlining structured content is no longer supported in the system's updated architecture.

By effectively leveraging these agents, the system ensures efficient and automated documentation, thus enhancing overall project workflow and knowledge management.