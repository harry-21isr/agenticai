/**
 * Logs messages with timestamp and color by level.
 * @param {string} message
 * @param {string} level - info, warn, error, success
 */
export function log(message, level = "info") {
  const timestamp = new Date().toISOString();
  const colors = {
    info: "\x1b[36m",    // Cyan
    warn: "\x1b[33m",    // Yellow
    error: "\x1b[31m",   // Red
    success: "\x1b[32m", // Green
    reset: "\x1b[0m"     // Reset
  };
  const color = colors[level] || colors.info;
  console.log(`${color}[${timestamp}] ${level.toUpperCase()}:${colors.reset} ${message}`);
} 