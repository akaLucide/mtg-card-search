const { scrapeStorePrice } = require("../scraper-utils");

/**
 * Scrapes a Face to Face Games product page for the card price.
 * F2F uses standard HTML price selectors, so the generic scraper works directly.
 * @param {string} url - Full product page URL
 * @returns {Promise<Object>} Price result or error object
 */
async function scrapeF2FPrice(url) {
  return scrapeStorePrice("Face to Face Games", url);
}

module.exports = { scrapeF2FPrice };
