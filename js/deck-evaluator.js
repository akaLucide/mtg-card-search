/**
 * Reads the deck evaluation form values from the DOM.
 * Centralises DOM access so the business logic functions receive plain values
 * instead of reading element IDs themselves.
 * @returns {{ deckText: string, excludeBasicLands: boolean, excludeSpecial: boolean }}
 */
function getDeckFormValues() {
  return {
    deckText: document.getElementById("deckList").value,
    excludeBasicLands: document.getElementById("excludeBasicLands").checked,
    excludeSpecial: document.getElementById("excludeSpecialPrintings").checked,
  };
}

/**
 * Finds the cheapest printing of a card across all configured stores.
 * Prioritises printings with a USD price; falls back to the first printing.
 * @param {string} cardName
 * @param {boolean} excludeSpecial - Whether to exclude special frame effects
 * @returns {Promise<Object>} Result with price/store/URL or an error field
 */
async function findCheapestPrintingForDeck(cardName, excludeSpecial = false) {
  const printings = await getCardPrintings(cardName);

  if (printings.length === 0) {
    return { error: "Card not found" };
  }

  const cheapestCard = findCheapestPrinting(printings, excludeSpecial);

  if (!cheapestCard) {
    return { error: "No standard printings found" };
  }

  const prices = await fetchAllStorePrices(cheapestCard);

  const storeKeys = getStoreKeys();
  const allStorePrices = {};
  storeKeys.forEach((key) => {
    allStorePrices[key] = prices[key] || { error: "Not available" };
  });

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
    allStorePrices,
  };
}

/**
 * Evaluates an entire deck list by finding the cheapest printing for each card.
 * Processes cards sequentially with a delay to avoid rate-limiting.
 */
async function evaluateDeck() {
  const { deckText, excludeBasicLands, excludeSpecial } = getDeckFormValues();
  const allCards = parseDeckList(deckText);
  const evaluateBtn = document.getElementById("evaluateBtn");

  if (allCards.length === 0) {
    showDeckError("Please enter a valid deck list");
    return;
  }

  const cards = excludeBasicLands
    ? allCards.filter((card) => !isBasicLand(card.name))
    : allCards;

  if (cards.length === 0) {
    showDeckError("No cards to evaluate");
    return;
  }

  evaluateBtn.disabled = true;
  showDeckLoading(true);
  hideDeckError();
  document.getElementById("resultsSection").style.display = "none";

  const results = [];

  for (const card of cards) {
    const result = await findCheapestPrintingForDeck(card.name, excludeSpecial);
    results.push({ ...card, ...result });

    updateProgress(results.length, cards.length);

    if (results.length < cards.length) {
      await new Promise((resolve) => setTimeout(resolve, DECK_EVAL_DELAY_MS));
    }
  }

  showDeckLoading(false);
  displayResults(results);
  evaluateBtn.disabled = false;
}

/**
 * Updates the loading indicator text with current progress.
 * @param {number} current
 * @param {number} total
 */
function updateProgress(current, total) {
  document.getElementById("loadingDeck").textContent =
    `Evaluating deck... ${current}/${total} cards processed`;
}

/**
 * Shows or hides the deck loading indicator.
 * @param {boolean} show
 */
function showDeckLoading(show) {
  document.getElementById("loadingDeck").classList.toggle("show", show);
}

/**
 * Displays a deck error message.
 * @param {string} message
 */
function showDeckError(message) {
  const el = document.getElementById("errorDeck");
  el.textContent = message;
  el.classList.add("show");
}

/** Hides the deck error message */
function hideDeckError() {
  document.getElementById("errorDeck").classList.remove("show");
}

/**
 * Renders the HTML for a single card result row.
 * @param {Object} result - Card evaluation result
 * @returns {string} HTML string
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
 * Renders the store price items for a single card, sorted cheapest first.
 * @param {Object} result - Card evaluation result
 * @param {string[]} storeKeys
 * @returns {string} HTML string
 */
function renderStorePricesForCard(result, storeKeys) {
  const sorted = storeKeys
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

  return sorted.map((store) => renderStorePriceItem(store, result.store)).join("");
}

/**
 * Renders a single store price badge.
 * @param {{ key, emoji, shortName, priceData }} store
 * @param {string} cheapestStoreKey
 * @returns {string} HTML string
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
  }

  return `
    <div class="store-price-item">
      <span class="store-icon">${emoji}</span>
      <span class="store-label">${shortName}</span>
      <span class="price-text error">${priceData?.error ? "Error" : "N/A"}</span>
    </div>
  `;
}

/**
 * Calculates the total cost per store across all card results.
 * @param {Array} results
 * @returns {Object} Map of store key → total CAD price
 */
function calculateStoreTotals(results) {
  const totals = {};
  getStoreKeys().forEach((key) => (totals[key] = 0));

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
 * Renders the store totals section HTML.
 * @param {Object} totals - Map of store key → total price
 * @returns {string} HTML string
 */
function renderTotals(totals) {
  let html = '<div class="totals-grid">';

  for (const key of getStoreKeys()) {
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
 * Renders all evaluation results and store totals into the results section.
 * @param {Array} results
 */
function displayResults(results) {
  const resultsSection = document.getElementById("resultsSection");
  const cardResults = document.getElementById("cardResults");
  const storeTotals = document.getElementById("storeTotals");

  resultsSection.style.display = "block";

  let html = '<div class="card-grid">';
  for (const result of results) {
    html += renderCardResult(result);
  }
  html += "</div>";
  cardResults.innerHTML = html;

  storeTotals.innerHTML = renderTotals(calculateStoreTotals(results));
}

document.getElementById("evaluateBtn").addEventListener("click", evaluateDeck);
