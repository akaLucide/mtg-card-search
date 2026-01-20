const express = require("express");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("."));

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Common price selectors used across different stores
 */
const COMMON_PRICE_SELECTORS = [
  ".price",
  ".product-price",
  "[data-product-price]",
  ".money",
  "span.money",
  ".product__price",
];

/**
 * Extract price from text using regex
 */
function extractPrice(text) {
  if (!text) return null;
  const match = text.match(/[\d,]+\.?\d*/);
  return match ? parseFloat(match[0].replace(",", "")) : null;
}

/**
 * Fetch HTML page with standard headers
 */
async function fetchPage(url) {
  return await axios.get(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      Connection: "keep-alive",
    },
    timeout: 15000,
  });
}

/**
 * Try to find price using common selectors
 */
function findPriceInHTML($) {
  for (const selector of COMMON_PRICE_SELECTORS) {
    const priceText = $(selector).first().text().trim();
    const price = extractPrice(priceText);
    if (price) return price;
  }
  return null;
}

// =============================================================================
// STORE SCRAPERS
// =============================================================================

/**
 * Face to Face Games price scraper - with frame effect
 */
app.get(
  "/api/price/f2f/:cardSlug/:collectorNumber/:frameEffect/:setSlug",
  async (req, res) => {
    try {
      const { cardSlug, collectorNumber, frameEffect, setSlug } = req.params;

      // Build URL with frame effect
      const url = `https://facetofacegames.com/products/${cardSlug}-${collectorNumber}-${frameEffect}-${setSlug}-non-foil`;

      console.log("Fetching F2F (with effect):", url);

      const response = await fetchPage(url);
      const $ = cheerio.load(response.data);
      const price = findPriceInHTML($);

      if (price) {
        res.json({ price, currency: "CAD", store: "Face to Face Games", url });
      } else {
        res.json({ error: "Price not found", url });
      }
    } catch (error) {
      console.error("F2F Error:", error.message);
      res
        .status(500)
        .json({ error: "Failed to fetch price", message: error.message });
    }
  },
);

/**
 * Face to Face Games price scraper - standard (no frame effect)
 */
app.get(
  "/api/price/f2f/:cardSlug/:collectorNumber/:setSlug",
  async (req, res) => {
    try {
      const { cardSlug, collectorNumber, setSlug } = req.params;
      const url = `https://facetofacegames.com/products/${cardSlug}-${collectorNumber}-${setSlug}-non-foil`;

      console.log("Fetching F2F (standard):", url);

      const response = await fetchPage(url);
      const $ = cheerio.load(response.data);
      const price = findPriceInHTML($);

      if (price) {
        res.json({ price, currency: "CAD", store: "Face to Face Games", url });
      } else {
        res.json({ error: "Price not found", url });
      }
    } catch (error) {
      console.error("F2F Error:", error.message);
      res
        .status(500)
        .json({ error: "Failed to fetch price", message: error.message });
    }
  },
);

/**
 * House of Cards price scraper
 */
app.get("/api/price/hoc/:cardSlug/:setSlug", async (req, res) => {
  try {
    const { cardSlug, setSlug } = req.params;
    const url = `https://houseofcards.ca/products/${cardSlug}-${setSlug}`;

    console.log("Fetching HOC:", url);

    const response = await fetchPage(url);
    const $ = cheerio.load(response.data);
    const price = findPriceInHTML($);

    if (price) {
      res.json({ price, currency: "CAD", store: "House of Cards", url });
    } else {
      res.json({ error: "Price not found", url });
    }
  } catch (error) {
    console.error("HOC Error:", error.message);
    res
      .status(500)
      .json({ error: "Failed to fetch price", message: error.message });
  }
});

/**
 * 401 Games price scraper - Searches for Near Mint variant specifically
 */
app.get("/api/price/401games/:cardSlug/:setCode", async (req, res) => {
  try {
    const { cardSlug, setCode } = req.params;
    const url = `https://store.401games.ca/products/${cardSlug}-${setCode}`;

    console.log("Fetching 401Games:", url);

    const response = await fetchPage(url);
    const $ = cheerio.load(response.data);

    let price = null;

    console.log("Searching for Near Mint variant in product data...");

    // Search JSON in script tags for variant data
    const scriptTags = $('script[type="application/json"]').toArray();

    for (const script of scriptTags) {
      try {
        const scriptContent = $(script).html();
        if (scriptContent && scriptContent.includes("variants")) {
          const jsonData = JSON.parse(scriptContent);
          const variants = jsonData.variants || jsonData.product?.variants;

          if (variants) {
            console.log(`Found ${variants.length} variants in JSON`);

            for (const variant of variants) {
              const variantTitle = (
                variant.title ||
                variant.option1 ||
                variant.name ||
                ""
              ).toLowerCase();
              console.log(
                `  Variant: "${variant.title || variant.option1}" - Price: ${variant.price}`,
              );

              if (
                variantTitle.includes("near mint") ||
                variantTitle.includes("nm")
              ) {
                price = parseFloat(variant.price) / 100;
                console.log(`✓ Found Near Mint variant price: $${price}`);
                break;
              }
            }

            if (price) break;
          }
        }
      } catch (e) {
        // Continue to next script tag
      }
    }

    // Try inline script variables if JSON tags didn't work
    if (!price) {
      const scriptContents = $("script:not([src])").toArray();

      for (const script of scriptContents) {
        const content = $(script).html();
        if (
          content &&
          (content.includes("variants") || content.includes("product"))
        ) {
          const patterns = [
            /var\s+product\s*=\s*({[\s\S]*?});/,
            /window\.__PRODUCT__\s*=\s*({[\s\S]*?});/,
            /"product"\s*:\s*({[\s\S]*?"variants"[\s\S]*?})/,
          ];

          for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match) {
              try {
                const jsonData = JSON.parse(match[1]);
                const variants = jsonData.variants || [];

                console.log(
                  `Found ${variants.length} variants in script variable`,
                );

                for (const variant of variants) {
                  const variantTitle = (
                    variant.title ||
                    variant.option1 ||
                    ""
                  ).toLowerCase();
                  console.log(
                    `  Variant: "${variant.title || variant.option1}" - Price: ${variant.price}`,
                  );

                  if (
                    variantTitle.includes("near mint") ||
                    variantTitle.includes("nm")
                  ) {
                    const rawPrice = parseFloat(variant.price);
                    price = rawPrice > 1000 ? rawPrice / 100 : rawPrice;
                    console.log(`✓ Found Near Mint variant price: $${price}`);
                    break;
                  }
                }

                if (price) break;
              } catch (e) {
                // Continue to next pattern
              }
            }
          }

          if (price) break;
        }
      }
    }

    // Final fallback: meta tag price
    if (!price) {
      console.log("No Near Mint specific price found, trying fallback...");
      const metaPrice = $('meta[property="og:price:amount"]').attr("content");
      if (metaPrice) {
        price = parseFloat(metaPrice);
        console.log(`✓ Found fallback price from meta: $${price}`);
      }
    }

    if (price) {
      res.json({ price, currency: "CAD", store: "401 Games", url });
    } else {
      console.log("❌ No price found on page");
      res.json({ error: "Price not found", url });
    }
  } catch (error) {
    console.error("401Games Error:", error.message);
    res
      .status(500)
      .json({ error: "Failed to fetch price", message: error.message });
  }
});

// =============================================================================
// TEST & SERVER START
// =============================================================================

app.get("/api/test", (req, res) => {
  res.json({ message: "Server is running!", timestamp: new Date() });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📊 API available at http://localhost:${PORT}/api/`);
});
