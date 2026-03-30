const axios = require("axios");
const cheerio = require("cheerio");
const SERVER_CONFIG = require("./config");

/** Common CSS price selectors tried across generic store pages */
const COMMON_PRICE_SELECTORS = [
  ".price",
  ".product-price",
  "[data-product-price]",
  ".money",
  "span.money",
  ".product__price",
];

/**
 * Extracts the first numeric price found in a text string.
 * @param {string} text
 * @returns {number|null}
 */
function extractPrice(text) {
  if (!text) return null;
  const match = text.match(/[\d,]+\.?\d*/);
  return match ? parseFloat(match[0].replace(",", "")) : null;
}

/**
 * Fetches a page with standard browser-like headers to avoid basic bot detection.
 * @param {string} url
 * @returns {Promise<Object>} Axios response
 */
async function fetchPage(url) {
  return axios.get(url, {
    headers: {
      "User-Agent": SERVER_CONFIG.USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      Connection: "keep-alive",
    },
    timeout: SERVER_CONFIG.REQUEST_TIMEOUT_MS,
  });
}

/**
 * Scans a Cheerio document for a price using the common selector list.
 * @param {Object} $ - Cheerio instance
 * @returns {number|null}
 */
function findPriceInHTML($) {
  for (const selector of COMMON_PRICE_SELECTORS) {
    const price = extractPrice($(selector).first().text().trim());
    if (price) return price;
  }
  return null;
}

/**
 * Generic scraper for stores whose price is accessible via common HTML selectors.
 * @param {string} storeName - Display name used in response payloads
 * @param {string} url
 * @returns {Promise<Object>} Price result or error object
 */
async function scrapeStorePrice(storeName, url) {
  const response = await fetchPage(url);
  const $ = cheerio.load(response.data);
  const price = findPriceInHTML($);

  return price
    ? { price, currency: "CAD", store: storeName, url }
    : { error: "Price not found", url };
}

module.exports = { extractPrice, fetchPage, findPriceInHTML, scrapeStorePrice };
