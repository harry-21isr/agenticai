import path from "path";
import { fileURLToPath } from "url";
import { removeDirectoryRecursively, ensureDirectoryExists } from "./fileUtils.js";

// Removes the dist directory and recreates it empty
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, "..", "..", "dist");

try {
  await removeDirectoryRecursively(distPath);
  await ensureDirectoryExists(distPath);
  console.log(`[CLEAN] dist cleared at: ${distPath}`);
} catch (err) {
  console.error("[CLEAN] Error while cleaning dist directory:", err);
  process.exitCode = 1;
}


