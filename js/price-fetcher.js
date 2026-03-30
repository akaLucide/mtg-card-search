/**
 * Fetches the scraped price for a card from a specific store via the proxy server.
 * Retries automatically on HTTP 429 (rate limited) with exponential backoff.
 * @param {string} storeKey
 * @param {Object} card - Scryfall card object
 * @param {number} retryCount - Current retry attempt
 * @param {number} maxRetries - Maximum retry attempts
 * @returns {Promise<{price: number, url: string}|null>}
 */
async function fetchStorePrice(storeKey, card, retryCount = 0, maxRetries = 3) {
  const url = buildStoreApiUrl(storeKey, card);
  if (!url) return null;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`${storeKey}: Card not found at store`);
        return null;
      }

      if (response.status === 429) {
        if (retryCount < maxRetries) {
          const delayMs = Math.pow(2, retryCount) * 1000;
          console.warn(
            `${storeKey}: Rate limited, retrying in ${delayMs}ms (attempt ${retryCount + 1}/${maxRetries})`
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          return fetchStorePrice(storeKey, card, retryCount + 1, maxRetries);
        }
        console.warn(`${storeKey}: Rate limited, max retries exceeded`);
        return null;
      }

      console.error(`${storeKey}: HTTP ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data.price && data.price !== "N/A") {
      const price =
        typeof data.price === "string"
          ? parseFloat(data.price.replace("$", ""))
          : parseFloat(data.price);
      return { price, url: data.url };
    }
  } catch (error) {
    console.error(`Error fetching ${storeKey} price:`, error.message);
  }

  return null;
}

/**
 * Fetches prices from all configured stores for a single card printing in parallel.
 * @param {Object} card - Scryfall card object
 * @returns {Promise<Object>} Map of store key → { price, url }
 */
async function fetchAllStorePrices(card) {
  const storeKeys = getStoreKeys();
  const results = await Promise.all(
    storeKeys.map((key) => fetchStorePrice(key, card))
  );

  const prices = {};
  storeKeys.forEach((key, index) => {
    if (results[index]) {
      prices[key] = results[index];
    }
  });

  return prices;
}
