## [2026-05-14]

### Added
- Added handling of prompt files to avoid special-character escaping issues in AI assistant scripts.
- Added detailed instructions for updating AGENTS.md and CHANGELOG.md based on git diff.
- files/folders affected: `.github/workflows/ai-docs.yml`

### Updated
- Updated the AI assistant script to improve error handling during API call.
- Improved console log messages for file update confirmations in AI assistant workflow.
- files/folders affected: `.github/workflows/ai-docs.yml`

---

## [2026-05-07]

### Added
- Introduced a new authentication system.
- files/folders affected: `pages/api/auth`, `utils/auth`

### Removed
- Deprecated old authentication middleware.
- files/folders affected: `middleware/oldAuth.js`

### Updated
- Enhanced the user profile page with additional settings.
- files/folders affected: `pages/profile.js`

---

## [2026-04-30]

### Updated
- Refactored database connection logic for improved performance.
- files/folders affected: `lib/db.js`

---

## [2026-04-20]

### Added
- New logging system for tracking user activities.
- files/folders affected: `lib/logger.js`, `middleware/logging.js`

---

## [2026-04-12]

### Updated
- Accessibility improvements on the homepage.
- files/folders affected: `pages/index.js`, `styles/home.css`

---

## [2026-03-08]

### Removed
- Old unused components.
- files/folders affected: `components/unusedComponent.js`