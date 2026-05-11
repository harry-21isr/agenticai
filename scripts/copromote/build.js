import readline from "node:readline/promises";
import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import archiver from "archiver";
import { fileURLToPath } from 'url';
import { archiveFolder, copyImagesFromTo, removeDirectoryRecursively } from "../utils/fileUtils.js";
import { createMinifiedHtml } from "../utils/htmlUtils.js";

// =====================
// CONFIGURACIÓN GLOBAL
// =====================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG = {
  rootFolder: path.join(__dirname, "..", ".."),
  distFolder: path.join(__dirname, "..", "..", "dist"),
  html: {
    index: "index.html",
    build: "build.html",
    fragmentsFolder: "fragments",
    veevaConfig: "veeva.config.json"
  },
  images: {
    folder: "images",
    archive: "images.zip"
  },
  fragments: {
    archive: "fragments.zip"
  },
  cli: {
    yes: ["y", "yes"],
    no: ["n", "no"]
  }
};

/**
 * Creates a readline interface for CLI. 
 */
const createReadlineInterface = () => {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
};


/**
 * Creates the build configuration from the input HTML.
 */
const createBuildConfig = (pathToInputHtml, fragmentsLimitiations) => {
  console.log(
    `Determining whether ${pathToInputHtml} contains fragments. Creating build config...`
  );
  const inputHtmlContent = fs.readFileSync(pathToInputHtml, "utf8");
  const fragmentRegex =
    /<!--\s*?fragment\s?([\s\S]*?)\s?start\s*?-->([\s\S]*?)<!--\s?fragment\s?\1\s?end\s*?-->/g;
  const imageRegex = /<img[^>]+src=["']?([^"'{}]+)["']?[^>]*>/g;
  const fragmentsTokenRegex = /"{{insertEmailFragments(\\[.*\\])?}}"/;
  // Finds all fragments in the HTML
  let fragmentMatch;
  let fragmentsWithoutImages = [];
  let i = 0;
  while ((fragmentMatch = fragmentRegex.exec(inputHtmlContent)) !== null) {
    i++;
    const fragmentIdentifier = fragmentMatch[1];
    const fragmentContent = fragmentMatch[2];
    fragmentsWithoutImages.push({
      name: fragmentIdentifier ? `${fragmentIdentifier}` : `fragment${i}`,
      content: fragmentContent,
    });
  }
  const tokenReplacingFragments = fragmentsLimitiations
    ? `{{insertEmailFragments[${fragmentsLimitiations.toString()}]}}`
    : "{{insertEmailFragments}}";
  // Finds images in each fragment
  const fragments = fragmentsWithoutImages.map((fragmentWithoutImage) => {
    let fragmentImageMatch;
    let images = [];
    while (
      (fragmentImageMatch = imageRegex.exec(fragmentWithoutImage.content)) !==
      null
    ) {
      const imageUrl = fragmentImageMatch[1];
      images.push(imageUrl);
    }
    return { ...fragmentWithoutImage, images };
  });
  // Creates the layout with fragments
  const inputHtmlContentSplitByFragmentsWithWhiteSpaces =
    inputHtmlContent.split(fragmentRegex);
  const inputHtmlContentSplitByFragments =
    inputHtmlContentSplitByFragmentsWithWhiteSpaces.filter(
      (content) => content.trim() !== ""
    );
  const alreadyHasFragmentsToken = fragmentsTokenRegex.test(inputHtmlContent);
  const layoutContent = `${inputHtmlContentSplitByFragments[0]}${
    alreadyHasFragmentsToken ? "" : tokenReplacingFragments
  }${
    inputHtmlContentSplitByFragments[
      inputHtmlContentSplitByFragments.length - 1
    ]
  }`;
  let layoutContentImageMatch;
  const layoutContentImages = [];
  while ((layoutContentImageMatch = imageRegex.exec(layoutContent)) !== null) {
    const imageUrl = layoutContentImageMatch[1];
    layoutContentImages.push(imageUrl);
  }
  const layout = { content: layoutContent, images: layoutContentImages };
  // Does the HTML have fragments?
  const isFragmented = fragments.length > 0;
  console.log(
    `${
      isFragmented
        ? `Found ${fragments.length} fragments.`
        : "No fragments found."
    } Build config ready.`
  );
  return {
    isFragmented,
    fragments,
    layout,
  };
};


// =====================
// MAIN BUILD LOGIC
// =====================

/**
 * Main build function for each subfolder of dist.
 */
const build = async ({
  pathToFullVersionFolder,
  pathToIndexHtml = path.join(pathToFullVersionFolder, CONFIG.html.index),
  pathToBuildHtml = path.join(pathToFullVersionFolder, CONFIG.html.build),
  pathToImages = path.join(pathToFullVersionFolder, CONFIG.images.folder),
  pathToArchivedImages = path.join(pathToFullVersionFolder, CONFIG.images.archive),
  pathToFragmentedVersionFolder = path.join(
    pathToFullVersionFolder,
    "..",
    "fragmented_version"  
  ),
  pathToFragmentedIndexHtml = path.join(
    pathToFragmentedVersionFolder,
    CONFIG.html.index
  ),
  pathToFragmentedBuildHtml = path.join(
    pathToFragmentedVersionFolder,
    CONFIG.html.build
  ),
  pathToFragmentedLayoutImages = path.join(
    pathToFragmentedVersionFolder,
    CONFIG.images.folder
  ),
  pathToFragmentedLayoutArchivedImages = path.join(
    pathToFragmentedVersionFolder,
    CONFIG.images.archive
  ),
  fragmentNumberLimitations,
}) => {
  // Creates the build config
  const { isFragmented, fragments, layout } = createBuildConfig(
    pathToIndexHtml,
    fragmentNumberLimitations
  );
  // Cleans the fragmented_version folder
  await removeDirectoryRecursively(pathToFragmentedVersionFolder);
  // If there are fragments, creates the fragmented version
  if (isFragmented) {
    fs.mkdirSync(pathToFragmentedVersionFolder);
    const pathToFragments = path.join(
      pathToFragmentedVersionFolder,
      CONFIG.html.fragmentsFolder
    );
    fs.mkdirSync(pathToFragments);
    fs.mkdirSync(pathToFragmentedLayoutImages);
    // Layout HTML and assets
    fs.writeFileSync(pathToFragmentedIndexHtml, layout.content, "utf8");
    await createMinifiedHtml(
      pathToFragmentedIndexHtml,
      pathToFragmentedBuildHtml,
      pathToFragmentedVersionFolder      
    );
    fs.unlinkSync(pathToFragmentedIndexHtml);
    layout.images.forEach((imageUrl) => {
      const pathToFullVersionImage = path.join(
        pathToFullVersionFolder,
        imageUrl
      );
      const imageName = path.basename(pathToFullVersionImage);
      const pathToFragmentedVersionImage = path.join(
        pathToFragmentedLayoutImages,
        imageName
      );
      fs.copyFileSync(pathToFullVersionImage, pathToFragmentedVersionImage);
    });
    await archiveFolder(
      pathToFragmentedLayoutImages,
      pathToFragmentedLayoutArchivedImages,
      "images"
    );
      // Creates folders of fragments and assets
    await Promise.all(
      fragments.map(async (fragment) => {
        const pathToFragmentFolder = path.join(
          pathToFragmentedVersionFolder,
          CONFIG.html.fragmentsFolder,
          fragment.name
        );
        const pathToFragmentIndexHtml = path.join(
          pathToFragmentFolder,
          CONFIG.html.index
        );
        const pathToFragmentBuildHtml = path.join(
          pathToFragmentFolder,
          CONFIG.html.build
        );
        const pathToFragmentFolderImages = path.join(
          pathToFragmentFolder,
          CONFIG.images.folder
        );
        const pathToFragmentFolderArchivedImages = path.join(
          pathToFragmentFolder,
          CONFIG.images.archive
        );
        fs.mkdirSync(pathToFragmentFolder);
        fs.writeFileSync(pathToFragmentIndexHtml, fragment.content, "utf8");
        await createMinifiedHtml(
          pathToFragmentIndexHtml,
          pathToFragmentBuildHtml,
          pathToFragmentedVersionFolder
        );
        fs.unlinkSync(pathToFragmentIndexHtml);
        const hasImages = fragment.images.length > 0;
        if (hasImages) {
          fs.mkdirSync(pathToFragmentFolderImages);
          fragment.images.forEach((imageUrl) => {
            const pathToFullVersionImage = path.join(
              pathToFullVersionFolder,
              imageUrl
            );
            const imageName = path.basename(pathToFullVersionImage);
            const pathToFragmentedVersionImage = path.join(
              pathToFragmentFolderImages,
              imageName
            );
            fs.copyFileSync(
              pathToFullVersionImage,
              pathToFragmentedVersionImage
            );
          });
          await archiveFolder(
            pathToFragmentFolderImages,
            pathToFragmentFolderArchivedImages,
            "images"
          );
        }
      })
    );
    await archiveFolder(
      path.join(pathToFragmentedVersionFolder, CONFIG.html.fragmentsFolder),
      path.join(pathToFragmentedVersionFolder, CONFIG.fragments.archive),
      false
    );
  }
  // Rest of the build
  const pathToImagesOnlyFolder = path.join(
    pathToFullVersionFolder,
    "imagesOnly"
  );
  fs.mkdirSync(pathToImagesOnlyFolder);
  copyImagesFromTo(pathToImages, pathToImagesOnlyFolder);
  await archiveFolder(pathToImagesOnlyFolder, pathToArchivedImages, "images");
  await removeDirectoryRecursively(pathToImagesOnlyFolder);
  await createMinifiedHtml(
    pathToIndexHtml,
    pathToBuildHtml,
    pathToFullVersionFolder
  );
  fs.unlinkSync(pathToIndexHtml);
};

// =====================
// SUBFOLDER AND FRAGMENT UTILITIES
// =====================

/**
 * Counts the number of fragments in an HTML file.
 */
const countFragments = async (fileContent) => {
  const fullFilePath = path.join(fileContent, CONFIG.html.index);
  const fragmentRegex =
    /<!--\s*?fragment\s?([\s\S]*?)\s?start\s*?-->([\s\S]*?)<!--\s?fragment\s?\1\s?end\s*?-->/g;
  let fragmentsNumber = [];
  try {
    const data = await fsPromises.readFile(fullFilePath, "utf8");
    fragmentsNumber = data.match(fragmentRegex) || [];
  } catch (err) {
    console.error("Error reading file:", err);
  }
  return fragmentsNumber.length;
};

/**
 * Gets the subfolders of a directory.
 */
async function getSubfolders(dir) {
  try {
    const files = await fsPromises.readdir(dir, { withFileTypes: true });
    return files.filter(file => file.isDirectory()).map(folder => path.join(dir, folder.name));
  } catch (error) {
    console.error("Error reading directory:", error);
    return [];
  }
}

// =====================
// CLI INTERFACE AND EXECUTION
// =====================

/**
 * Processes each subfolder of dist and executes the interactive build.
 */
async function processEachFullVersionSubfolder() {
  const rl = createReadlineInterface();
  try {
    const projectSubfolders = await getSubfolders(CONFIG.distFolder);
    for (const projectFolder of projectSubfolders) {
      const fullVersionPath = path.join(projectFolder, "full_version");
      const fragmentsNumber = await countFragments(fullVersionPath);
      const subfolderName = path.basename(projectFolder);
      if (fragmentsNumber) {
        const fragmentsLimitations = [];
        const answer = await rl.question(
          `Fragments are detected for ${subfolderName} Project. Do you want to define min/max fragments value in RTE? (y/n) `
        );
        const normalizedAnswer = answer.toLowerCase();
        if (CONFIG.cli.yes.includes(normalizedAnswer)) {
          const minVal = await rl.question(
            "\nType value of minimal number of fragments in RTE: "
          );
          fragmentsLimitations.push(parseInt(minVal));
          const maxVal = await rl.question(
            `\nType value of maximum number of fragments in RTE (${fragmentsNumber}): `
          );
          fragmentsLimitations.push(parseInt(maxVal));
          await build({
            pathToFullVersionFolder: fullVersionPath,
            fragmentNumberLimitations: fragmentsLimitations,
          });
        } else if (CONFIG.cli.no.includes(normalizedAnswer)) {
          await build({ pathToFullVersionFolder: fullVersionPath });
        } else {
          console.log(
            "Please type y/yes or n/no letter then hit Enter/Return."
          );
        }
      } else {
        await build({ pathToFullVersionFolder: fullVersionPath });
      }
    }
  } catch (err) {
    console.error("Error during subfolder processing:", err);
  } finally {
    rl.close();
  }
}

/**
 * Main execution function.
 */
async function main() {
  try {
    await processEachFullVersionSubfolder();
  } catch (err) {
    console.error("An error occurred during execution:", err);
  }
}


main();