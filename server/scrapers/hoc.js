const { scrapeStorePrice } = require("../scraper-utils");

/**
 * Scrapes a House of Cards product page for the card price.
 * HOC uses standard HTML price selectors, so the generic scraper works directly.
 * @param {string} url - Full product page URL
 * @returns {Promise<Object>} Price result or error object
 */
async function scrapeHOCPrice(url) {
  return scrapeStorePrice("House of Cards", url);
}

module.exports = { scrapeHOCPrice };
