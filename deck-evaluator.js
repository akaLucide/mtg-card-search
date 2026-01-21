// =============================================================================
// DECK EVALUATOR
// Evaluates entire deck lists by finding cheapest printing for each card
// =============================================================================

/**
 * Configuration constants
 */
const DECK_EVAL_CONFIG = {
  DELAY_BETWEEN_CARDS_MS: 100, // Delay to prevent rate limiting
  DEFAULT_QUANTITY: 1,
};

/**
 * Basic lands to ignore in deck evaluation
 */
const BASIC_LANDS = ["mountain", "island", "plains", "swamp", "forest"];

/**
 * Frame effects that are considered "special" printings
 */
const SPECIAL_FRAME_EFFECTS = [
  "borderless",
  "extendedart",
  "showcase",
  "inverted",
];

/**
 * Check if a card name is a basic land
 * @param {string} cardName - The card name to check
 * @returns {boolean} - True if the card is a basic land
 */
function isBasicLand(cardName) {
  const normalized = cardName.toLowerCase().trim();
  return BASIC_LANDS.includes(normalized);
}

/**
 * Check if a card has special frame effects or is a promo card
 * @param {Object} card - Scryfall card object
 * @returns {boolean} - True if the card has special frame effects or is a promo
 */
function hasSpecialFrameEffect(card) {
  // Check for special frame effects
  const hasSpecialFrame =
    card.frame_effects &&
    card.frame_effects.length > 0 &&
    card.frame_effects.some((effect) => SPECIAL_FRAME_EFFECTS.includes(effect));

  // Check if it's a promo card (using same logic as utils.js isPromoCard)
  const isPromo =
    card.promo_types &&
    Array.isArray(card.promo_types) &&
    card.promo_types.some((type) => type.toLowerCase().includes("promopack"));

  return hasSpecialFrame || isPromo;
}

/**
 * Parse deck list from textarea
 * Supports formats: "4x Lightning Bolt", "4 Lightning Bolt", "Lightning Bolt"
 * @param {string} deckText - Raw deck list text
 * @returns {Array<{quantity: number, name: string}>} - Parsed cards with quantities
 */
function parseDeckList(deckText) {
  const lines = deckText.trim().split("\n");
  const cards = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Match pattern like "1x Card Name" or "1 Card Name"
    const match = trimmed.match(/^(\d+)x?\s+(.+)$/i);
    if (match) {
      const quantity = parseInt(match[1]);
      const cardName = match[2].trim();
      cards.push({ quantity, name: cardName });
    } else {
      // If no quantity prefix, use default
      cards.push({
        quantity: DECK_EVAL_CONFIG.DEFAULT_QUANTITY,
        name: trimmed,
      });
    }
  }

  return cards;
}

/**
 * Fetch all printings of a card from Scryfall API
 * @param {string} cardName - The card name to search for
 * @returns {Promise<Array>} - Array of card objects from Scryfall
 */
async function getCardPrintings(cardName) {
  try {
    const response = await fetch(
      `https://api.scryfall.com/cards/search?q=!"${encodeURIComponent(cardName)}"&unique=prints`,
    );
    if (!response.ok) return [];
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error(`Error fetching printings for ${cardName}:`, error);
    return [];
  }
}

/**
 * Fetch prices from all three stores for a specific card printing
 * @param {Object} printing - Scryfall card object
 * @returns {Promise<Object>} - Object with store keys and price data
 */
async function getPricesForPrinting(printing) {
  const prices = {};

  // Fetch from all stores in parallel using shared utility function
  const [f2fPrice, hocPrice, games401Price] = await Promise.all([
    fetchStorePrice("f2f", printing),
    fetchStorePrice("hoc", printing),
    fetchStorePrice("401games", printing),
  ]);

  if (f2fPrice) prices["face-to-face"] = f2fPrice;
  if (hocPrice) prices["house-of-cards"] = hocPrice;
  if (games401Price) prices["401games"] = games401Price;

  return prices;
}

/**
 * Find the cheapest printing of a card across all stores
 * Prioritizes cards with USD prices, falls back to first printing
 * @param {string} cardName - The card name to search for
 * @param {boolean} excludeSpecial - Whether to exclude special frame effects
 * @returns {Promise<Object>} - Result object with price, store, URL, and printing info
 */
async function findCheapestPrinting(cardName, excludeSpecial = false) {
  const printings = await getCardPrintings(cardName);
  if (printings.length === 0) {
    return { error: "Card not found" };
  }

  // Filter out special printings if requested
  const filteredPrintings = excludeSpecial
    ? printings.filter((card) => !hasSpecialFrameEffect(card))
    : printings;

  if (filteredPrintings.length === 0) {
    return { error: "No standard printings found" };
  }

  // Find the cheapest printing by Scryfall USD price (same logic as main search)
  let cheapestCard = null;
  let lowestPrice = Infinity;

  for (const card of filteredPrintings) {
    if (card.prices && card.prices.usd) {
      const price = parseFloat(card.prices.usd);
      if (price > 0 && price < lowestPrice) {
        lowestPrice = price;
        cheapestCard = card;
      }
    }
  }

  // If no card with USD price found, use the first printing
  if (!cheapestCard) {
    cheapestCard = filteredPrintings[0];
  }

  // Now check all 3 stores for this one printing
  const prices = await getPricesForPrinting(cheapestCard);

  // Track all store prices including errors
  const allStorePrices = {
    "face-to-face": prices["face-to-face"] || { error: "Not available" },
    "house-of-cards": prices["house-of-cards"] || { error: "Not available" },
    "401games": prices["401games"] || { error: "Not available" },
  };

  // Find the cheapest store for this printing
  let cheapestStore = null;
  let cheapestPrice = Infinity;

  for (const [store, priceData] of Object.entries(prices)) {
    if (priceData.price && priceData.price < cheapestPrice) {
      cheapestPrice = priceData.price;
      cheapestStore = store;
    }
  }

  if (!cheapestStore) {
    return { error: "No prices found", allStorePrices };
  }

  const result = {
    price: prices[cheapestStore].price,
    store: cheapestStore,
    url: prices[cheapestStore].url,
    printing: `${cheapestCard.set_name} (${cheapestCard.set.toUpperCase()})`,
    cardName: cheapestCard.name,
    setCode: cheapestCard.set,
    collectorNumber: cheapestCard.collector_number,
    allStorePrices: allStorePrices,
  };

  return result;
}

// Evaluate entire deck
async function evaluateDeck() {
  const deckText = document.getElementById("deckList").value;
  const cards = parseDeckList(deckText);
  const evaluateBtn = document.getElementById("evaluateBtn");

  if (cards.length === 0) {
    showError("Please enter a valid deck list");
    return;
  }

  // Get filter options
  const excludeBasicLands =
    document.getElementById("excludeBasicLands").checked;
  const excludeSpecial = document.getElementById(
    "excludeSpecialPrintings",
  ).checked;

  // Filter out basic lands if option is checked
  const filteredCards = excludeBasicLands
    ? cards.filter((card) => !isBasicLand(card.name))
    : cards;

  if (filteredCards.length === 0) {
    showError("No cards to evaluate");
    return;
  }

  // Disable button to prevent multiple clicks
  evaluateBtn.disabled = true;
  showLoading(true);
  hideError();
  document.getElementById("resultsSection").style.display = "none";

  const results = [];

  for (const card of filteredCards) {
    const result = await findCheapestPrinting(card.name, excludeSpecial);
    results.push({
      ...card,
      ...result,
    });

    // Update progress
    updateProgress(results.length, filteredCards.length);

    // Add delay between cards to prevent rate limiting
    if (results.length < filteredCards.length) {
      await new Promise((resolve) =>
        setTimeout(resolve, DECK_EVAL_CONFIG.DELAY_BETWEEN_CARDS_MS),
      );
    }
  }

  showLoading(false);
  displayResults(results);

  // Re-enable button after evaluation completes
  evaluateBtn.disabled = false;
}

function updateProgress(current, total) {
  const loading = document.getElementById("loadingDeck");
  loading.textContent = `Evaluating deck... ${current}/${total} cards processed`;
}

function showLoading(show) {
  const loading = document.getElementById("loadingDeck");
  loading.classList.toggle("show", show);
}

function showError(message) {
  const error = document.getElementById("errorDeck");
  error.textContent = message;
  error.classList.add("show");
}

function hideError() {
  const error = document.getElementById("errorDeck");
  error.classList.remove("show");
}

function displayResults(results) {
  const resultsSection = document.getElementById("resultsSection");
  const cardResults = document.getElementById("cardResults");
  const storeTotals = document.getElementById("storeTotals");

  resultsSection.style.display = "block";

  // Calculate totals per store
  const totals = {
    "face-to-face": 0,
    "house-of-cards": 0,
    "401games": 0,
  };

  // Display individual card results
  let html = '<div class="card-grid">';

  for (const result of results) {
    if (result.error && !result.allStorePrices) {
      html += `
        <div class="card-result-line error">
          <div class="card-info-section">
            <span class="card-quantity">${result.quantity}x</span>
            <span class="card-name">${result.name}</span>
          </div>
          <div class="card-error-message">${result.error}</div>
        </div>
      `;
      continue;
    }

    const storeName = formatStoreName(result.store);
    const allStores = [
      { key: "face-to-face", emoji: "🛡️", name: "F2F" },
      { key: "house-of-cards", emoji: "🃏", name: "HOC" },
      { key: "401games", emoji: "🎲", name: "401" },
    ];

    // Build price list with cheapest first, others smaller
    let pricesHtml = "";

    // Sort stores by price (cheapest first)
    const sortedStores = allStores
      .map((store) => ({
        ...store,
        priceData: result.allStorePrices?.[store.key],
      }))
      .sort((a, b) => {
        const priceA = a.priceData?.price || Infinity;
        const priceB = b.priceData?.price || Infinity;
        return priceA - priceB;
      });

    sortedStores.forEach((store, index) => {
      const priceData = store.priceData;

      if (index === 0 && priceData?.price) {
        // Cheapest store - full display with link
        pricesHtml += `
          <div class="price-main">
            <div class="price-value">$${priceData.price.toFixed(2)}</div>
            <div class="store-badge">${formatStoreName(store.key)}</div>
            <a href="${priceData.url}" target="_blank" class="buy-link">View on ${formatStoreName(store.key)}</a>
          </div>
        `;
      } else {
        // Other stores - compact display
        if (priceData?.error) {
          pricesHtml += `
            <div class="price-secondary">
              <span class="store-emoji">${store.emoji}</span>
              <span class="store-abbr">${store.name}</span>
              <span class="price-error">Error</span>
            </div>
          `;
        } else if (priceData?.price) {
          pricesHtml += `
            <div class="price-secondary">
              <span class="store-emoji">${store.emoji}</span>
              <span class="store-abbr">${store.name}</span>
              <span class="price-small">$${priceData.price.toFixed(2)}</span>
            </div>
          `;
        } else {
          pricesHtml += `
            <div class="price-secondary">
              <span class="store-emoji">${store.emoji}</span>
              <span class="store-abbr">${store.name}</span>
              <span class="price-error">N/A</span>
            </div>
          `;
        }
      }
    });

    // Separate main price from secondary prices
    const mainPriceMatch = pricesHtml.match(
      /<div class="price-main">.*?<\/div>/s,
    );
    const mainPriceHtml = mainPriceMatch ? mainPriceMatch[0] : "";

    // Build store prices in compact format
    let allPricesHtml = "";
    sortedStores.forEach((store) => {
      const priceData = store.priceData;
      if (priceData?.price) {
        allPricesHtml += `
          <div class="store-price-item ${store.key === result.store ? "cheapest" : ""}">
            <span class="store-icon">${store.emoji}</span>
            <span class="store-label">${store.name}</span>
            <span class="price-text">$${priceData.price.toFixed(2)}</span>
          </div>
        `;
      } else if (priceData?.error) {
        allPricesHtml += `
          <div class="store-price-item">
            <span class="store-icon">${store.emoji}</span>
            <span class="store-label">${store.name}</span>
            <span class="price-text error">Error</span>
          </div>
        `;
      } else {
        allPricesHtml += `
          <div class="store-price-item">
            <span class="store-icon">${store.emoji}</span>
            <span class="store-label">${store.name}</span>
            <span class="price-text error">N/A</span>
          </div>
        `;
      }
    });

    html += `
      <div class="card-result-line">
        <div class="card-info-section">
          <span class="card-quantity">${result.quantity}x</span>
          <span class="card-name">${result.cardName || result.name}</span>
          <span class="printing-info">${result.printing || ""}</span>
        </div>
        <div class="card-prices-section">
          ${allPricesHtml}
        </div>
        ${result.url ? `<a href="${result.url}" target="_blank" class="view-link">View</a>` : ""}
      </div>
    `;

    // Add to store totals
    if (result.allStorePrices) {
      for (const [store, priceData] of Object.entries(result.allStorePrices)) {
        if (priceData.price) {
          totals[store] += priceData.price * result.quantity;
        }
      }
    }
  }

  html += "</div>";
  cardResults.innerHTML = html;

  // Display totals
  const storeEmojis = {
    "face-to-face": "🛡️",
    "house-of-cards": "🃏",
    "401games": "🎲",
  };

  let totalsHtml = '<div class="totals-grid">';

  for (const [store, total] of Object.entries(totals)) {
    if (total > 0) {
      totalsHtml += `
        <div class="total-item">
          <div class="total-header">
            <span class="total-emoji">${storeEmojis[store]}</span>
            <span class="total-store">${formatStoreName(store)}</span>
          </div>
          <span class="total-price">$${total.toFixed(2)}</span>
        </div>
      `;
    }
  }

  totalsHtml += "</div>";
  storeTotals.innerHTML = totalsHtml;
}

// Event listeners
document.getElementById("evaluateBtn").addEventListener("click", evaluateDeck);
