# AGENTS.md

## Stack

- **Next.js**: 16
- **React**: 19
- **Tailwind CSS**: v4

## Architecture

The project is structured as a monorepo using Yarn workspaces. The architecture includes a frontend and several microservices. Key components include:

- **Frontend**: Built with Next.js 16 and React 19, styled using Tailwind CSS v4.
- **Backend**: Various microservices that handle different aspects of the application.

## Breaking Changes

Recent updates have included changes in the AI documentation workflow automation:

- The workflow now writes prompt content to a file to avoid special-character escaping issues.
- Output handling has been improved with better error reporting and JSON response management from the OpenAI API.

## Commands

To run the automated AI documentation updates, use the following command:

```bash
gh workflow run ai-docs.yml
```

This command triggers the GitHub Actions workflow to update documentation files based on the recent git diffs.