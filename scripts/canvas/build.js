import logger from './canvas-utils/logger.js';
import utils from './canvas-utils/utils.js';
import browser from './canvas-utils/browser.js';

try {
  // Execute the main build script to run tasks related to the project
  await utils.runBuildScript();

  // Alternative examples (commented out) to run the build script for specific test folders
  // await utils.processTestFolder(); 
  // await utils.runBuildScript('test/96128/');
} catch (err) {
  // Log any error that occurs during processing and label it as 'fatal'
  logger.log(
    `Error in processing: ${err}`,
    'fatal'
  );
} finally {
  // Ensure the browser instance is properly closed even if there is an error
  await browser.closeBrowser();
}

// Print all accumulated logs when the process exits
process.on('exit', () => {
  logger.printLogs();
});

// Error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
  // Log the error and label it as 'fatal'
  logger.log(`Uncaught Exception: ${error.message}`, 'fatal');
  // Print logs before exiting the process
  logger.printLogs();
  process.exit(0);
});

// Error handling for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  // Log the rejection reason and associated promise, label as 'fatal'
  logger.log(`Unhandled Rejection at: ${promise}\nReason: ${reason}`, 'fatal');
  // Print logs before exiting the process
  logger.printLogs();
  process.exit(0);
});
