import browser from './browser.js';

/**
 * Calculates the width and height of a given HTML link element when rendered.
 * 
 * @param {string} linkHTML - The HTML string containing the link element to be evaluated.
 * 
 * @returns {Promise<number>} - A promise that resolves to the width and height of the link element in pixels.
 */
export async function calculateLinkWidthHeight(linkHTML) {
  // Initialize the browser instance (headless browser)
  await browser.initBrowser();
  const browserInstance = browser.getBrowserInstance(); // Get an instance of the initialized browser
  const page = await browserInstance.newPage(); // Create a new page for rendering the HTML content

  try {
    // HTML structure with the link element inserted into a container
    const html = `
      <html>
        <body>
          <div id="container">
            ${linkHTML}
          </div>
        </body>
      </html>
    `;

    // Set the content of the page to the generated HTML
    await page.setContent(html);

    // Evaluate the width and height of the link element using JavaScript on the page
    const widthHeight = await page.evaluate(() => {
      const link = document.querySelector('a'); // Select the link element from the DOM
      return [link.offsetWidth, link.offsetHeight]; // Return the width and height of the link element
    });

    // Return the calculated width and height of the link element
    return widthHeight;
  } catch (error) {
    // Log any error that occurs during the width and height calculation process
    console.error("Error calculating link width and height:", error);
    throw error; // Rethrow the error for external handling
  } finally {
    // Close the page to free up resources
    await page.close();
  }
}