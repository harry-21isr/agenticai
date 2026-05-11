// Importing the Puppeteer library, which provides an API to control headless Chrome or Chromium
import puppeteer from 'puppeteer';

// Defining a Browser class to manage the lifecycle of a Puppeteer browser instance
class Browser {
  constructor() {
    // Initialize the browser instance as null. It will hold the Puppeteer browser object.
    this.browserInstance = null;
  }

  // Asynchronously initializes the browser instance if it's not already initialized.
  async initBrowser() {
    // Check if the browser instance is null or not. If null, launch a new Puppeteer browser.
    if (!this.browserInstance) {
      this.browserInstance = await puppeteer.launch();  // Launches a new browser instance in headless mode.
    }
  }

  // Asynchronously closes the browser instance if it exists.
  async closeBrowser() {
    // Check if the browser instance is already initialized (i.e., not null).
    if (this.browserInstance) {
      await this.browserInstance.close();  // Close the Puppeteer browser instance.
      this.browserInstance = null;  // Reset the browserInstance to null after closing.
    }
  }

  // Returns the current browser instance. If the browser is not initialized, it returns null.
  getBrowserInstance() {
    return this.browserInstance;
  }
}

// Create a singleton instance of the Browser class to ensure only one browser is active at a time.
const instance = new Browser();

// Exporting the singleton instance to be used in other parts of the application.
export default instance;