const cheerio = require("cheerio");
const { fetchPage } = require("../scraper-utils");

/** Script tag patterns used to locate variant data embedded in the page */
const INLINE_SCRIPT_PATTERNS = [
  /var\s+product\s*=\s*({[\s\S]*?});/,
  /window\.__PRODUCT__\s*=\s*({[\s\S]*?});/,
  /"product"\s*:\s*({[\s\S]*?"variants"[\s\S]*?})/,
];

/**
 * Searches a parsed page for the Near Mint variant price in 401 Games product JSON.
 * 401 Games embeds variant data in script tags, so standard CSS selectors are not enough.
 * @param {Object} $ - Cheerio instance
 * @returns {number|null} Near Mint price in CAD, or null if not found
 */
function find401GamesNearMintPrice($) {
  const price = _searchJsonScriptTags($) ?? _searchInlineScriptVars($) ?? _fallbackMetaPrice($);
  return price;
}

/**
 * @param {Object} $
 * @returns {number|null}
 */
function _searchJsonScriptTags($) {
  for (const script of $('script[type="application/json"]').toArray()) {
    try {
      const data = JSON.parse($(script).html());
      const variants = data.variants || data.product?.variants;
      if (!variants) continue;

      const price = _findNearMintVariantPrice(variants);
      if (price) return price;
    } catch {
      // malformed JSON — move to next tag
    }
  }
  return null;
}

/**
 * @param {Object} $
 * @returns {number|null}
 */
function _searchInlineScriptVars($) {
  for (const script of $("script:not([src])").toArray()) {
    const content = $(script).html();
    if (!content || (!content.includes("variants") && !content.includes("product"))) continue;

    for (const pattern of INLINE_SCRIPT_PATTERNS) {
      const match = content.match(pattern);
      if (!match) continue;

      try {
        const data = JSON.parse(match[1]);
        const variants = data.variants || [];
        const price = _findNearMintVariantPrice(variants);
        if (price) return price;
      } catch {
        // unparseable match — try next pattern
      }
    }
  }
  return null;
}

/**
 * @param {Object} $
 * @returns {number|null}
 */
function _fallbackMetaPrice($) {
  const metaPrice = $('meta[property="og:price:amount"]').attr("content");
  return metaPrice ? parseFloat(metaPrice) : null;
}

/**
 * Finds the Near Mint variant within a variants array and returns its price in dollars.
 * @param {Array} variants
 * @returns {number|null}
 */
function _findNearMintVariantPrice(variants) {
  for (const variant of variants) {
    const title = (variant.title || variant.option1 || variant.name || "").toLowerCase();
    if (title.includes("near mint") || title.includes("nm")) {
      const raw = parseFloat(variant.price);

      return raw / 100;
    }
  }
  return null;
}

/**
 * Scrapes the Near Mint price from a 401 Games product page.
 * @param {string} url
 * @returns {Promise<Object>} Price result or error object
 */
async function scrape401GamesPrice(url) {
  const response = await fetchPage(url);
  const $ = cheerio.load(response.data);
  const price = find401GamesNearMintPrice($);

  return price
    ? { price, currency: "CAD", store: "401 Games", url }
    : { error: "Price not found", url };
}

module.exports = { scrape401GamesPrice };
