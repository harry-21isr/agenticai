import { join } from "path";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import liveServer from "live-server";
import chalk from "chalk";
import { TICKET_INFO } from "../../src/ticket-info.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const localDir = join(__dirname, "index.html");
const baseDir = join(__dirname, "index_base.html");
const fragmentsPath = path.join(
  __dirname,
  "../../dist/fragmented_version/fragments"
);

// Returns a list of Copromote projects detected under /dist
// Each project has its own subfolder: /dist/<project>/{full_version,fragmented_version}
const findCopromoteProjects = async () => {
  const distRoot = path.join(__dirname, "../../dist");
  try {
    const entries = await fs.promises.readdir(distRoot, { withFileTypes: true });
    const projects = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const name = entry.name;
      // Skip root build folders (veeva flow)
      if (name === "full_version" || name === "fragmented_version") continue;
      const projectRoot = path.join(distRoot, name);
      const fullBuildPath = path.join(projectRoot, "full_version", "build.html");
      if (!(await fileExists(fullBuildPath))) continue;
      const fragsDir = path.join(projectRoot, "fragmented_version", "fragments");
      let fragments = [];
      if (await dirExists(fragsDir)) {
        const fragEntries = await fs.promises.readdir(fragsDir, { withFileTypes: true });
        fragments = fragEntries.filter((e) => e.isDirectory()).map((e) => e.name);
      }
      projects.push({ name, fragments });
    }
    return projects;
  } catch {
    return [];
  }
};

const fileExists = async (p) => {
  try {
    await fs.promises.access(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

const dirExists = async (p) => {
  try {
    const stat = await fs.promises.stat(p);
    return stat.isDirectory();
  } catch {
    return false;
  }
};

// Detects a Veeva build directly under /dist (not copromote)
// Returns { hasFull: boolean, hasFragmented: boolean, fragments: string[] }
const detectVeevaBuild = async () => {
  const distRoot = path.join(__dirname, "../../dist");
  const fullBuild = path.join(distRoot, "full_version", "build.html");
  const fragmentedBuild = path.join(distRoot, "fragmented_version", "build.html");
  const fragsDir = path.join(distRoot, "fragmented_version", "fragments");
  const hasFull = await fileExists(fullBuild);
  const hasFragmented = await fileExists(fragmentedBuild);
  let fragments = [];
  if (await dirExists(fragsDir)) {
    const entries = await fs.promises.readdir(fragsDir, { withFileTypes: true });
    fragments = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  }
  return { hasFull, hasFragmented, fragments };
};

const getFormattedDate = () => {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0"); // Months are 0-based
  const day = String(today.getDate()).padStart(2, "0");
  const year = today.getFullYear();
  return `${month}/${day}/${year}`;
};

const resetIndex = async () => {
  try {
    const data = await fs.promises.readFile(baseDir, "utf8");
    await fs.promises.writeFile(localDir, data, "utf8");
    console.log(`${chalk.cyanBright('Test HTML File Reseted')}`);
  } catch (err) {
    console.error("Error", err);
  }
};

const updateIndex = async () => {
  try {
    let data = await fs.promises.readFile(localDir, "utf8");

    // Try Copromote first: /dist/<project>/*
    const copromoteProjects = await findCopromoteProjects();

    let updatedHtml;
    if (copromoteProjects.length > 0) {
      // Build a complete projects array combining full versions and (if present) fragments per project
      let projectsText = "";
      for (const project of copromoteProjects) {
        const mainHtml = project.fragments && project.fragments.length
          ? `../../dist/${project.name}/fragmented_version/build.html`
          : `../../dist/${project.name}/full_version/build.html`;
        projectsText += `\n          { title: "${project.name}", html: "${mainHtml}", litmus: "${TICKET_INFO.LITMUS_LINK}", links: true },`;
        if (project.fragments && project.fragments.length) {
          for (const frag of project.fragments) {
            projectsText += `\n          { title: "Fragment ${frag} - ${project.name}", html: "../../dist/${project.name}/fragmented_version/fragments/${frag}/build.html", litmus: "", links: true },`;
          }
        }
      }
      updatedHtml = data
        .replace(/date: "(.*?)"/, `date: "${getFormattedDate()}"`)
        .replace(
          /title: "(.*?)"/,
          `title: "${TICKET_INFO.PCF} R${TICKET_INFO.ROUND} - V${TICKET_INFO.VERSION}"`
        )
        .replace(
          /projects:\s*\[[\s\S]*?\],/,
          `projects: [${projectsText}\n        ],`
        );
    } else {
      // Veeva direct build under /dist
      const veeva = await detectVeevaBuild();
      if (veeva.hasFull || veeva.hasFragmented) {
        const mainHtml = veeva.hasFragmented && veeva.fragments.length
          ? `../../dist/fragmented_version/build.html`
          : `../../dist/full_version/build.html`;
        let projectsText = `\n          { title: "${TICKET_INFO.PROJECT_NAME}", html: "${mainHtml}", litmus: "${TICKET_INFO.LITMUS_LINK}", links: true },`;
        if (veeva.fragments.length) {
          for (const frag of veeva.fragments) {
            projectsText += `\n          { title: "Fragment ${frag}", html: "../../dist/fragmented_version/fragments/${frag}/build.html", litmus: "", links: true },`;
          }
        }
        updatedHtml = data
          .replace(/date: "(.*?)"/, `date: "${getFormattedDate()}"`)
          .replace(
            /title: "(.*?)"/,
            `title: "${TICKET_INFO.PCF} R${TICKET_INFO.ROUND} - V${TICKET_INFO.VERSION}"`
          )
          .replace(
            /projects:\s*\[[\s\S]*?\],/,
            `projects: [${projectsText}\n        ],`
          );
      } else {
      updatedHtml = data
        .replace(/html: "(.*?)"/, `html: "../../dist/full_version/build.html"`)
        .replace(
          /title: "(.*?)"/,
          `title: "${TICKET_INFO.PCF} R${TICKET_INFO.ROUND} - V${TICKET_INFO.VERSION}"`
        )
        .replace(/date: "(.*?)"/, `date: "${getFormattedDate()}"`)
        .replace(
          /projects: \[\s*\{\s*title: "(.*?)"/,
          `projects: [{ title: "${TICKET_INFO.PROJECT_NAME}"`
        )
        .replace(/litmus: "(.*?)"/, `litmus: "${TICKET_INFO.LITMUS_LINK}"`);
      }
    }

    await fs.promises.writeFile(localDir, updatedHtml, "utf8");
  } catch (err) {
    console.error("Error updating index.html:", err);
  }
};

var params = {
  port: 8181, 
  open: false,
  logLevel:0,
  // Map absolute '/images/*' requests to the built email assets
  // This allows <img src="/images/..."> inside build.html to resolve correctly
  mount: [["/images", "./dist/full_version/images"]],
  middleware: [
    async function mapImagesPerProject(req, res, next) {
      if (!req.url || !req.url.startsWith("/images/")) {
        return next();
      }
      const referer = req.headers.referer || "";
      const imageName = req.url.replace("/images/", "");

      // Helper to stream a file and end the response
      const streamFile = (absPath) => {
        const stream = fs.createReadStream(absPath);
        stream.on("open", () => {
          if (absPath.endsWith(".png")) res.setHeader("Content-Type", "image/png");
          else if (absPath.endsWith(".jpg") || absPath.endsWith(".jpeg")) res.setHeader("Content-Type", "image/jpeg");
          else if (absPath.endsWith(".gif")) res.setHeader("Content-Type", "image/gif");
          stream.pipe(res);
        });
        stream.on("error", () => next());
      };

      const candidates = [];

      // 1) Prefer path inferred from referer if it contains /dist/<project>/<version>/
      const refMatch = referer.match(/\/dist\/([^/]+)\/(full_version|fragmented_version)(?:\/fragments\/([^/]+))?\//);
      if (refMatch) {
        const [, project, version, fragment] = refMatch;
        if (fragment) {
          candidates.push(path.join(process.cwd(), "dist", project, "fragmented_version", "fragments", fragment, "images", imageName));
        }
        candidates.push(path.join(process.cwd(), "dist", project, version, "images", imageName));
        // Also check common fragmented layout images
        candidates.push(path.join(process.cwd(), "dist", project, "fragmented_version", "images", imageName));
      }

      // 2) Fallback to classic veeva output
      candidates.push(path.join(process.cwd(), "dist", "full_version", "images", imageName));
      candidates.push(path.join(process.cwd(), "dist", "fragmented_version", "images", imageName));

      // 3) Fallback: scan all copromote projects under /dist for a match
      try {
        const distRoot = path.join(process.cwd(), "dist");
        const entries = await fs.promises.readdir(distRoot, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const project = entry.name;
          if (project === "full_version" || project === "fragmented_version") continue;
          candidates.push(path.join(distRoot, project, "full_version", "images", imageName));
          candidates.push(path.join(distRoot, project, "fragmented_version", "images", imageName));
          // scan fragment subfolders shallowly
          const fragsRoot = path.join(distRoot, project, "fragmented_version", "fragments");
          try {
            const fragDirs = await fs.promises.readdir(fragsRoot, { withFileTypes: true });
            for (const f of fragDirs) {
              if (!f.isDirectory()) continue;
              candidates.push(path.join(fragsRoot, f.name, "images", imageName));
            }
          } catch {}
        }
      } catch {}

      // Resolve first existing candidate
      for (const candidate of candidates) {
        try {
          await fs.promises.access(candidate);
          return streamFile(candidate);
        } catch {}
      }
      return next();
    },
  ],
};

const start = async () => {
  try {
    await resetIndex();
    await updateIndex();
    liveServer.start(params);
    console.log(`${chalk.green.bold('Test Served: http://localhost:8181/test/regular_staging')}`);
  } catch (error) {
    console.error("Error al iniciar los procesos:", error);
  }
};

start();
