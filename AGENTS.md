```plaintext
# AGENTS.md

## New and Updated Agents

### Agent 1: Documentation Updater

- **Role**: This agent automates the process of updating documentation files based on code changes.
- **Inputs**: 
  - Git diff file
  - Prompt for each specific documentation update
  - API Key for OpenAI
- **Outputs**: Updated content for:
  - `AGENTS.md`
  - `SKILLS.md`
  - `CHANGELOG.md`
- **Tools**:
  - Node.js for script execution and file manipulation
  - OpenAI API for generating content updates
  - cURL for making HTTP requests to the OpenAI API

### Agent 2: Commit Handler

- **Role**: Automates the process of committing and pushing changes to documentation files.
- **Inputs**:
  - Updated documentation files staged for commit
- **Outputs**: 
  - Committed changes to the branch
  - Pushed changes to the origin
- **Tools**: 
  - Git CLI for managing commits and pushes
  - GitHub Actions for workflow automation

These agents are designed to streamline the documentation update process by leveraging automated tools and scripts to assess code changes, generate necessary documentation revisions, and commit them directly to the repository.
```