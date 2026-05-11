import fs from "fs";
import path from "path";
import archiver from "archiver";
import { log } from "../utils/logUtils.js";

export async function ensureDirectoryExists(dir) {
  try {
    // Check if directory exists using async operation
    await fs.promises.access(dir);    
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Directory doesn't exist, create it
      try {
        await fs.promises.mkdir(dir, { recursive: true });        
        return true;
      } catch (mkdirError) {  
        log(`[ERROR] Failed to create directory ${dir}: ${mkdirError.message}`, "error");
        throw mkdirError;
      }
    } else {
      // Other error occurred      
      log(`[ERROR] reading file ${dir}:`, "error");
      throw error;
    }
  }
}

export async function copyImages(sourceDir, destDir, imagePaths) {  
  const results = [];
  
  for (const imagePath of imagePaths) {
    try {
      const source = path.join(sourceDir, imagePath);
      const destination = path.join(destDir, imagePath);
      
      // Ensure destination directory exists
      await ensureDirectoryExists(path.dirname(destination));
      
      // Copy file using promises for better async handling
      await fs.promises.copyFile(source, destination);
      
      results.push({
        path: imagePath,
        success: true,
        source,
        destination
      });      
      
    } catch (error) {      
      log(`[ERROR] Copying image ${imagePath}:`, "error");
      results.push({
        path: imagePath,
        success: false,
        error: error.message,
        source: path.join(sourceDir, imagePath),
        destination: path.join(destDir, imagePath)
      });
    }
  }
  
  return results;
}

export async function validateFile(filePath) {
  try {
    await fs.promises.access(filePath, fs.constants.R_OK);
    return true;
  } catch (error) {
    return false;
  }
}

export async function validateImage(imagePath, baseDir) {
  const fullPath = path.join(baseDir, imagePath);
  try {
    const stats = await fs.promises.stat(fullPath);
    return {
      path: imagePath,
      fullPath,
      size: stats.size,
      exists: true
    };
  } catch (error) {
    return {
      path: imagePath,
      fullPath,
      size: 0,
      exists: false
    };
  }
}

export function formatFileSize(bytes) {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

export async function readFile(filePath, encoding = "utf8") {
  return fs.promises.readFile(filePath, encoding);
}

export async function writeFile(filePath, data, encoding = "utf8") {
  return fs.promises.writeFile(filePath, data, encoding);
}

/**
 * Removes a directory and all its contents recursively.
 * @param {string} dirPath - Directory path to remove.
 * @returns {Promise<boolean>} - True if directory was removed, false if it didn't exist.
 */
export async function removeDirectoryRecursively(dirPath) {
  try {
    // Check if directory exists
    await fs.promises.access(dirPath);
    
    const files = await fs.promises.readdir(dirPath);
    
    // Process all files and subdirectories
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = await fs.promises.stat(filePath);
      
      if (stats.isDirectory()) {
        // Recursively remove subdirectory
        await removeDirectoryRecursively(filePath);
      } else {
        // Remove file
        await fs.promises.unlink(filePath);
      }
    }
    
    // Remove the empty directory
    await fs.promises.rmdir(dirPath);   
    return true;
    
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Directory doesn't exist
   
      //log(`[INFO] Directory doesn't exist: ${dirPath}`, "info");
      return false;
    } else {
      // Other error occurred
      log(`[ERROR] Failed to remove directory ${dirPath}: ${error.message}`, "error");
      throw error;
    }
  }
}

/**
 * Archives a folder into a zip file.
 * @param {string} inputFolder - Input folder path.
 * @param {string} outputFile - Output zip file path.
 * @param {string|boolean} folderName - Folder name in zip, or false for root.
 * @returns {Promise<void>}
 */
export function archiveFolder(inputFolder, outputFile, folderName) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(inputFolder) || fs.readdirSync(inputFolder).length === 0) {
      return resolve();
    }
    const archiverInstance = archiver("zip", { zlib: { level: 9 } });
    const outputStream = fs.createWriteStream(outputFile);

  
    //wait for stream content to be written in disk before finalize
    outputStream.on('close', () => {
      resolve();
    });
    outputStream.on('error', reject);
    archiverInstance.on('error', reject);

    archiverInstance.pipe(outputStream);
    archiverInstance.directory(inputFolder, folderName);
    archiverInstance.finalize()
  });
}

/**
 * Copies images from one directory to another, filtering by supported extensions.
 * @param {string} from - Source directory.
 * @param {string} to - Destination directory.
 * @param {RegExp} [supportedExtensions] - Optional regex to filter image files.
 * @returns {boolean} - True if images were copied, false otherwise.
 */
export function copyImagesFromTo(from, to, supportedExtensions = /\.(jpg|jpeg|png|gif|bmp|tiff|webp)$/) {
  if (!fs.existsSync(from)) {
    return false;
  }
  if (!fs.existsSync(to)) {
    fs.mkdirSync(to, { recursive: true });
  }
  const files = fs.readdirSync(from);
  const images = files.filter((file) => supportedExtensions.test(file));
  images.forEach((image) => {
    const fromImage = path.join(from, image);
    const toImage = path.join(to, image);
    fs.copyFileSync(fromImage, toImage);
  });
  return images.length > 0;
}