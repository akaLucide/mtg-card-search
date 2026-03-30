const { scrapeF2FPrice } = require("./scrapers/f2f");
const { scrapeHOCPrice } = require("./scrapers/hoc");
const { scrape401GamesPrice } = require("./scrapers/games401");

/**
 * Wraps an async route handler with standardised HTTP error responses.
 * Handles timeouts (504), 404s, rate limits (429), and generic errors (500).
 * @param {string} storeName - Used in log messages
 * @param {Function} handler - Async function receiving (req) and returning a result object
 * @returns {Function} Express route handler
 */
function asyncRouteHandler(storeName, handler) {
  return async (req, res) => {
    try {
      const result = await handler(req);
      res.json(result);
    } catch (error) {
      if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
        console.error(`${storeName} Timeout:`, req.url);
        res.status(504).json({ error: "Request timeout", message: "Store took too long to respond" });
      } else if (error.response?.status === 404) {
        console.error(`${storeName} Not Found: ${req.url}`);
        res.status(404).json({ error: "Card not found", message: "Card not available at this store", url: req.url });
      } else if (error.response?.status === 429) {
        console.error(`${storeName} Rate Limited: ${req.url}`);
        res.status(429).json({ error: "Rate limited", message: "Too many requests to store" });
      } else {
        console.error(`${storeName} Error:`, error.message);
        res.status(500).json({ error: "Failed to fetch price", message: error.message, url: req.url });
      }
    }
  };
}

/**
 * Registers all store price scraping routes on the Express app.
 * @param {import("express").Application} app
 */
function registerRoutes(app) {
  // Face to Face Games — with frame effect
  app.get(
    "/api/price/f2f/:cardSlug/:collectorNumber/:frameEffect/:setSlug",
    asyncRouteHandler("F2F", async (req) => {
      const { cardSlug, collectorNumber, frameEffect, setSlug } = req.params;
      const url = `https://facetofacegames.com/products/${cardSlug}-${collectorNumber}-${frameEffect}-${setSlug}-non-foil`;
      console.log("Fetching F2F (with effect):", url);
      return scrapeF2FPrice(url);
    })
  );

  // Face to Face Games — standard
  app.get(
    "/api/price/f2f/:cardSlug/:collectorNumber/:setSlug",
    asyncRouteHandler("F2F", async (req) => {
      const { cardSlug, collectorNumber, setSlug } = req.params;
      const url = `https://facetofacegames.com/products/${cardSlug}-${collectorNumber}-${setSlug}-non-foil`;
      console.log("Fetching F2F (standard):", url);
      return scrapeF2FPrice(url);
    })
  );

  // House of Cards — with frame effect
  app.get(
    "/api/price/hoc/:cardSlug/:frameEffect/:setSlug",
    asyncRouteHandler("HOC", async (req) => {
      const { cardSlug, frameEffect, setSlug } = req.params;
      const url = `https://houseofcards.ca/products/${cardSlug}-${frameEffect}-${setSlug}`;
      console.log("Fetching HOC (with effect):", url);
      return scrapeHOCPrice(url);
    })
  );

  // House of Cards — standard
  app.get(
    "/api/price/hoc/:cardSlug/:setSlug",
    asyncRouteHandler("HOC", async (req) => {
      const { cardSlug, setSlug } = req.params;
      const url = `https://houseofcards.ca/products/${cardSlug}-${setSlug}`;
      console.log("Fetching HOC (standard):", url);
      return scrapeHOCPrice(url);
    })
  );

  // 401 Games — with frame effect (must be declared before the standard route)
  app.get(
    "/api/price/401games/:cardSlug/:frameEffect/:setCode",
    asyncRouteHandler("401Games", async (req) => {
      const { cardSlug, frameEffect, setCode } = req.params;
      const url = `https://store.401games.ca/products/${cardSlug}-${frameEffect}-${setCode}`;
      console.log("Fetching 401Games (with frame effect):", url);
      return scrape401GamesPrice(url);
    })
  );

  // 401 Games — standard
  app.get(
    "/api/price/401games/:cardSlug/:setCode",
    asyncRouteHandler("401Games", async (req) => {
      const { cardSlug, setCode } = req.params;
      const url = `https://store.401games.ca/products/${cardSlug}-${setCode}`;
      console.log("Fetching 401Games:", url);
      return scrape401GamesPrice(url);
    })
  );

  // Health check
  app.get("/api/test", (_req, res) => {
    res.json({ message: "Server is running!", timestamp: new Date() });
  });
}

module.exports = { registerRoutes };
