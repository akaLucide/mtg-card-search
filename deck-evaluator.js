// =============================================================================
// DECK EVALUATOR
// Evaluates entire deck lists by finding cheapest printing for each card
// Uses utilities from utils.js and card-utils.js
// =============================================================================

/**
 * Configuration constants
 */
const DECK_EVAL_CONFIG = {
  DELAY_BETWEEN_CARDS_MS: 100, // Delay to prevent rate limiting
};

// =============================================================================
// DECK EVALUATION CORE
// =============================================================================

/**
 * Find the cheapest printing of a card across all stores
 * Prioritizes cards with USD prices, falls back to first printing
 * @param {string} cardName - The card name to search for
 * @param {boolean} excludeSpecial - Whether to exclude special frame effects
 * @returns {Promise<Object>} - Result object with price, store, URL, and printing info
 */
async function findCheapestPrintingForDeck(cardName, excludeSpecial = false) {
  const printings = await getCardPrintings(cardName);
  if (printings.length === 0) {
    return { error: "Card not found" };
  }

  // Find the cheapest printing using shared utility
  const cheapestCard = findCheapestPrinting(printings, excludeSpecial);

  if (!cheapestCard) {
    return { error: "No standard printings found" };
  }

  // Now check all stores for this one printing
  const prices = await fetchAllStorePrices(cheapestCard);

  // Track all store prices including errors
  const storeKeys = getStoreKeys();
  const allStorePrices = {};
  storeKeys.forEach((key) => {
    allStorePrices[key] = prices[key] || { error: "Not available" };
  });

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

  return {
    price: prices[cheapestStore].price,
    store: cheapestStore,
    url: prices[cheapestStore].url,
    printing: `${cheapestCard.set_name} (${cheapestCard.set.toUpperCase()})`,
    cardName: cheapestCard.name,
    setCode: cheapestCard.set,
    collectorNumber: cheapestCard.collector_number,
    allStorePrices: allStorePrices,
  };
}

/**
 * Evaluate entire deck list
 * Processes each card sequentially with delay to prevent rate limiting
 */
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
    const result = await findCheapestPrintingForDeck(card.name, excludeSpecial);
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

// =============================================================================
// UI HELPERS
// =============================================================================

/**
 * Update progress indicator during deck evaluation
 * @param {number} current - Current card number
 * @param {number} total - Total number of cards
 */
function updateProgress(current, total) {
  const loading = document.getElementById("loadingDeck");
  loading.textContent = `Evaluating deck... ${current}/${total} cards processed`;
}

/**
 * Show or hide loading indicator
 * @param {boolean} show - Whether to show loading
 */
function showLoading(show) {
  const loading = document.getElementById("loadingDeck");
  loading.classList.toggle("show", show);
}

/**
 * Show error message
 * @param {string} message - Error message to display
 */
function showError(message) {
  const error = document.getElementById("errorDeck");
  error.textContent = message;
  error.classList.add("show");
}

/**
 * Hide error message
 */
function hideError() {
  const error = document.getElementById("errorDeck");
  error.classList.remove("show");
}

// =============================================================================
// RESULTS DISPLAY
// =============================================================================

/**
 * Render a single card result row
 * @param {Object} result - Card evaluation result
 * @returns {string} - HTML string for the card row
 */
function renderCardResult(result) {
  if (result.error && !result.allStorePrices) {
    return `
      <div class="card-result-line error">
        <div class="card-info-section">
          <span class="card-quantity">${result.quantity}x</span>
          <span class="card-name">${result.name}</span>
        </div>
        <div class="card-error-message">${result.error}</div>
      </div>
    `;
  }

  const storeKeys = getStoreKeys();
  const storePricesHtml = renderStorePricesForCard(result, storeKeys);

  return `
    <div class="card-result-line">
      <div class="card-info-section">
        <span class="card-quantity">${result.quantity}x</span>
        <span class="card-name">${result.cardName || result.name}</span>
        <span class="printing-info">${result.printing || ""}</span>
      </div>
      <div class="card-prices-section">
        ${storePricesHtml}
      </div>
      ${result.url ? `<a href="${result.url}" target="_blank" class="view-link">View</a>` : ""}
    </div>
  `;
}

/**
 * Render store price items for a single card
 * @param {Object} result - Card evaluation result
 * @param {Array} storeKeys - Array of store keys
 * @returns {string} - HTML string for store prices
 */
function renderStorePricesForCard(result, storeKeys) {
  // Sort stores by price (cheapest first)
  const sortedStores = storeKeys
    .map((key) => ({
      key,
      emoji: getStoreEmoji(key),
      shortName: getStoreShortName(key),
      priceData: result.allStorePrices?.[key],
    }))
    .sort((a, b) => {
      const priceA = a.priceData?.price || Infinity;
      const priceB = b.priceData?.price || Infinity;
      return priceA - priceB;
    });

  return sortedStores
    .map((store) => renderStorePriceItem(store, result.store))
    .join("");
}

/**
 * Render a single store price item
 * @param {Object} store - Store info with priceData
 * @param {string} cheapestStoreKey - Key of the cheapest store
 * @returns {string} - HTML string for the price item
 */
function renderStorePriceItem(store, cheapestStoreKey) {
  const { key, emoji, shortName, priceData } = store;
  const isCheapest = key === cheapestStoreKey;

  if (priceData?.price) {
    return `
      <div class="store-price-item ${isCheapest ? "cheapest" : ""}">
        <span class="store-icon">${emoji}</span>
        <span class="store-label">${shortName}</span>
        <span class="price-text">$${priceData.price.toFixed(2)}</span>
      </div>
    `;
  } else if (priceData?.error) {
    return `
      <div class="store-price-item">
        <span class="store-icon">${emoji}</span>
        <span class="store-label">${shortName}</span>
        <span class="price-text error">Error</span>
      </div>
    `;
  } else {
    return `
      <div class="store-price-item">
        <span class="store-icon">${emoji}</span>
        <span class="store-label">${shortName}</span>
        <span class="price-text error">N/A</span>
      </div>
    `;
  }
}

/**
 * Render totals section for all stores
 * @param {Object} totals - Totals object by store key
 * @returns {string} - HTML string for totals
 */
function renderTotals(totals) {
  const storeKeys = getStoreKeys();
  let html = '<div class="totals-grid">';

  for (const key of storeKeys) {
    const total = totals[key] || 0;
    if (total > 0) {
      html += `
        <div class="total-item">
          <div class="total-header">
            <span class="total-emoji">${getStoreEmoji(key)}</span>
            <span class="total-store">${formatStoreName(key)}</span>
          </div>
          <span class="total-price">$${total.toFixed(2)}</span>
        </div>
      `;
    }
  }

  html += "</div>";
  return html;
}

/**
 * Calculate store totals from results
 * @param {Array} results - Array of card evaluation results
 * @returns {Object} - Totals by store key
 */
function calculateStoreTotals(results) {
  const storeKeys = getStoreKeys();
  const totals = {};
  storeKeys.forEach((key) => (totals[key] = 0));

  for (const result of results) {
    if (result.allStorePrices) {
      for (const [store, priceData] of Object.entries(result.allStorePrices)) {
        if (priceData.price) {
          totals[store] += priceData.price * result.quantity;
        }
      }
    }
  }

  return totals;
}

/**
 * Display all evaluation results
 * @param {Array} results - Array of card evaluation results
 */
function displayResults(results) {
  const resultsSection = document.getElementById("resultsSection");
  const cardResults = document.getElementById("cardResults");
  const storeTotals = document.getElementById("storeTotals");

  resultsSection.style.display = "block";

  // Render card results
  let html = '<div class="card-grid">';
  for (const result of results) {
    html += renderCardResult(result);
  }
  html += "</div>";
  cardResults.innerHTML = html;

  // Calculate and display totals
  const totals = calculateStoreTotals(results);
  storeTotals.innerHTML = renderTotals(totals);
}

// =============================================================================
// EVENT LISTENERS
// =============================================================================

document.getElementById("evaluateBtn").addEventListener("click", evaluateDeck);
