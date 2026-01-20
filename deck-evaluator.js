// Deck Evaluator JavaScript

// Parse deck list from textarea
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
      // If no quantity prefix, default to 1
      cards.push({ quantity: 1, name: trimmed });
    }
  }

  return cards;
}

// Get all printings for a card
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

// Get prices from all stores for a specific printing
async function getPricesForPrinting(printing) {
  const prices = {};

  // Fetch from all stores using shared utility function
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

// Find cheapest printing across all stores
async function findCheapestPrinting(cardName) {
  const printings = await getCardPrintings(cardName);
  if (printings.length === 0) {
    return { error: "Card not found" };
  }

  // Find the cheapest printing by Scryfall USD price (same logic as main search)
  let cheapestCard = null;
  let lowestPrice = Infinity;

  for (const card of printings) {
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
    cheapestCard = printings[0];
  }

  // Now check all 3 stores for this one printing
  const prices = await getPricesForPrinting(cheapestCard);
  console.log(
    `${cheapestCard.set_name}: Found ${Object.keys(prices).length} prices`,
    prices,
  );

  // Find the cheapest store for this printing
  let cheapestStore = null;
  let cheapestPrice = Infinity;

  for (const [store, priceData] of Object.entries(prices)) {
    if (priceData.price < cheapestPrice) {
      cheapestPrice = priceData.price;
      cheapestStore = store;
    }
  }

  if (!cheapestStore) {
    return { error: "No prices found" };
  }

  const result = {
    price: prices[cheapestStore].price,
    store: cheapestStore,
    url: prices[cheapestStore].url,
    printing: `${cheapestCard.set_name} (${cheapestCard.set.toUpperCase()})`,
    cardName: cheapestCard.name,
    setCode: cheapestCard.set,
    collectorNumber: cheapestCard.collector_number,
    allStorePrices: prices,
  };

  console.log("Cheapest overall:", result);
  return result;
}

// Evaluate entire deck
async function evaluateDeck() {
  const deckText = document.getElementById("deckList").value;
  const cards = parseDeckList(deckText);

  if (cards.length === 0) {
    showError("Please enter a valid deck list");
    return;
  }

  showLoading(true);
  hideError();
  document.getElementById("resultsSection").style.display = "none";

  const results = [];

  for (const card of cards) {
    const result = await findCheapestPrinting(card.name);
    results.push({
      ...card,
      ...result,
    });

    // Update progress
    updateProgress(results.length, cards.length);

    // Add delay between cards to avoid overwhelming the server
    // This prevents rate limiting from stores (500ms delay)
    if (results.length < cards.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  showLoading(false);
  displayResults(results);
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
  let html = '<div class="card-list">';

  for (const result of results) {
    if (result.error) {
      html += `
        <div class="card-result error">
          <div class="card-result-header">
            <span class="card-quantity">${result.quantity}x</span>
            <span class="card-name">${result.name}</span>
          </div>
          <div class="card-result-error">${result.error}</div>
        </div>
      `;
      continue;
    }

    const storeName = formatStoreName(result.store);

    html += `
      <div class="card-result">
        <div class="card-result-header">
          <span class="card-quantity">${result.quantity}x</span>
          <span class="card-name">${result.cardName}</span>
        </div>
        <div class="card-result-details">
          <div class="printing-info">${result.printing}</div>
          <div class="price-info">
            <span class="price">$${result.price.toFixed(2)}</span>
            <span class="store-badge">${storeName}</span>
          </div>
          <a href="${result.url}" target="_blank" class="buy-link">View on ${storeName}</a>
        </div>
      </div>
    `;

    // Add to store totals
    if (result.allStorePrices) {
      for (const [store, priceData] of Object.entries(result.allStorePrices)) {
        totals[store] += priceData.price * result.quantity;
      }
    }
  }

  html += "</div>";
  cardResults.innerHTML = html;

  // Display totals
  let totalsHtml = '<div class="totals-grid">';

  for (const [store, total] of Object.entries(totals)) {
    if (total > 0) {
      totalsHtml += `
        <div class="total-item">
          <span class="total-store">${formatStoreName(store)}</span>
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
