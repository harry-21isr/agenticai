import fs from 'fs';
import { join } from 'path';
import archiver from 'archiver';
import chalk from 'chalk';
import logger from './logger.js';

/**
 * Archives images from a source directory into a zip file in the target directory.
 * 
 * @param {string} sourceDir - The directory containing images to be zipped.
 * @param {string} targetDir - The directory where the zip file will be saved.
 * @param {string} [path=""] - An optional base path to prepend to source and target directories.
 * @returns {Promise<void>} - A promise that resolves when the zip file is successfully created, or rejects with an error.
 */
export default function imagesToZip(sourceDir, targetDir, path = "") {
    // Prepend base path to source and target directories
    sourceDir = path + sourceDir;
    targetDir = path + targetDir;

    return new Promise(async (resolve, reject) => {
        // Check if the source directory exists
        if (!fs.existsSync(sourceDir)) {
            reject(`Source directory '${sourceDir}' does not exist. Check if the folder is correctly named.`);
            return;
        }

        // Create a write stream for the zip file in the target directory
        const output = fs.createWriteStream(join(targetDir, 'images.zip'));

        // Initialize archiver for creating a zip file with maximum compression
        const archive = archiver('zip', {
            zlib: { level: 9 }
        });

        // Set up event listener for when the zip file is successfully created
        output.on('close', () => {
            logger.log(
                `Zip file created: ${chalk.yellow.bold(archive.pointer())} total bytes.`,
                'info'
            );
            resolve();
        });

        // Set up event listener for non-blocking warnings
        archive.on('warning', err => {
            if (err.code === 'ENOENT') {
                console.warn(err);
            } else {
                reject(err);
            }
        });

        // Set up event listener for errors during the archiving process
        archive.on('error', err => {
            reject(err);
        });

        // Pipe archive data to the file
        archive.pipe(output);

        // Read all files from the source directory and sort them to ensure consistent order in ZIP
        const files = fs.readdirSync(sourceDir).sort(); // Ensures files are added in a consistent order

        // Add each file to the archive in a sequential manner to maintain order
        for (const file of files) {
            const filePath = join(sourceDir, file);

            // Ensures that each file is fully added before the next one starts
            await new Promise((resolve, reject) => {
                archive.file(filePath, { name: `images/${file}`, date: new Date(0) }); // Sets a fixed timestamp to avoid binary differences
                archive.once('entry', resolve); // Ensures sequential processing
            });
        }

        // Finalize the archive (complete the process)
        archive.finalize();
    });
}