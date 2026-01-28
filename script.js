// =============================================================================
// MTG CARD SEARCH - MAIN SCRIPT
// Uses utilities from utils.js and card-utils.js
// =============================================================================

/**
 * Configuration constants
 */
const CONFIG = {
  AUTOCOMPLETE_DELAY_MS: 25,
};

/**
 * Exchange rate (updated on page load)
 */
let USD_TO_CAD = CARD_CONFIG.DEFAULT_USD_TO_CAD;

// =============================================================================
// EXCHANGE RATE
// =============================================================================

/**
 * Fetch live USD to CAD exchange rate from API
 * Falls back to default rate if fetch fails
 */
async function fetchExchangeRate() {
  try {
    const response = await fetch(EXCHANGE_RATE_API);
    const data = await response.json();
    if (data.rates && data.rates.CAD) {
      USD_TO_CAD = data.rates.CAD;
      console.log(`Updated USD to CAD rate: ${USD_TO_CAD}`);
    }
  } catch (error) {
    console.warn(
      `Failed to fetch exchange rate, using default ${CARD_CONFIG.DEFAULT_USD_TO_CAD}:`,
      error,
    );
  }
}

// Initialize on page load
fetchExchangeRate();

// =============================================================================
// DOM ELEMENT REFERENCES
// =============================================================================

const cardInput = document.getElementById("cardInput");
const searchBtn = document.getElementById("searchBtn");
const cardImage = document.getElementById("cardImage");
const errorMessage = document.getElementById("errorMessage");
const loading = document.getElementById("loading");
const cardInfo = document.getElementById("cardInfo");
const cardName = document.getElementById("cardName");
const cardSet = document.getElementById("cardSet");
const cardPrice = document.getElementById("cardPrice");
const autocompleteList = document.getElementById("autocomplete-list");
const printingsSidebar = document.getElementById("printingsSidebar");
const printingsList = document.getElementById("printingsList");
const storeLinks = document.getElementById("storeLinks");

/**
 * DOM store element references
 * Links to STORE_CONFIG from utils.js for metadata
 */
const STORES = {
  f2f: {
    name: STORE_CONFIG.f2f.name,
    link: document.getElementById("faceToFaceLink"),
    priceElement: document.getElementById("f2fPrice"),
  },
  hoc: {
    name: STORE_CONFIG.hoc.name,
    link: document.getElementById("houseOfCardsLink"),
    priceElement: document.getElementById("hocPrice"),
  },
  "401games": {
    name: STORE_CONFIG["401games"].name,
    link: document.getElementById("games401Link"),
    priceElement: document.getElementById("games401Price"),
  },
};

// =============================================================================
// STATE
// =============================================================================

let debounceTimer;
let currentFocus = -1;
let allPrintings = [];

// =============================================================================
// AUTOCOMPLETE
// =============================================================================

// Input listener for autocomplete
cardInput.addEventListener("input", handleAutocomplete);

// Keyboard navigation for autocomplete
cardInput.addEventListener("keydown", (e) => {
  const items = autocompleteList.getElementsByClassName("autocomplete-item");

  if (e.key === "ArrowDown") {
    e.preventDefault();
    currentFocus++;
    setActive(items);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    currentFocus--;
    setActive(items);
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (currentFocus > -1 && items[currentFocus]) {
      items[currentFocus].click();
    } else {
      searchCard();
    }
  } else if (e.key === "Escape") {
    closeAutocomplete();
  }
});

// Close autocomplete when clicking outside
document.addEventListener("click", (e) => {
  if (e.target !== cardInput) {
    closeAutocomplete();
  }
});

/**
 * Handle autocomplete input with debouncing
 * Fetches suggestions from Scryfall API after delay
 */
async function handleAutocomplete() {
  const query = cardInput.value.trim();

  clearTimeout(debounceTimer);

  if (query.length < 2) {
    closeAutocomplete();
    return;
  }

  debounceTimer = setTimeout(async () => {
    const suggestions = await getAutocompleteSuggestions(query);
    displayAutocomplete(suggestions);
  }, CONFIG.AUTOCOMPLETE_DELAY_MS);
}

/**
 * Display autocomplete suggestions in dropdown
 * Highlights matching text in suggestions
 * @param {Array} suggestions - Array of card name suggestions
 */
function displayAutocomplete(suggestions) {
  closeAutocomplete();

  if (!suggestions || suggestions.length === 0) return;

  currentFocus = -1;

  suggestions.forEach((suggestion) => {
    const item = document.createElement("div");
    item.className = "autocomplete-item";

    // Highlight matching text
    const query = cardInput.value.trim();
    const index = suggestion.toLowerCase().indexOf(query.toLowerCase());

    if (index !== -1) {
      item.innerHTML =
        suggestion.substr(0, index) +
        "<strong>" +
        suggestion.substr(index, query.length) +
        "</strong>" +
        suggestion.substr(index + query.length);
    } else {
      item.textContent = suggestion;
    }

    item.addEventListener("click", () => {
      cardInput.value = suggestion;
      closeAutocomplete();
      searchCard();
    });

    autocompleteList.appendChild(item);
  });

  autocompleteList.classList.add("show");
}

/**
 * Set active autocomplete item for keyboard navigation
 * @param {HTMLCollection} items - Collection of autocomplete items
 */
function setActive(items) {
  if (!items || items.length === 0) return;

  Array.from(items).forEach((item) => item.classList.remove("active"));

  // Wrap around
  if (currentFocus >= items.length) currentFocus = 0;
  if (currentFocus < 0) currentFocus = items.length - 1;

  items[currentFocus].classList.add("active");
  items[currentFocus].scrollIntoView({ block: "nearest" });
}

/**
 * Close and clear autocomplete dropdown
 */
function closeAutocomplete() {
  autocompleteList.innerHTML = "";
  autocompleteList.classList.remove("show");
  currentFocus = -1;
}

// =============================================================================
// EVENT LISTENERS
// =============================================================================

searchBtn.addEventListener("click", searchCard);

// =============================================================================
// CARD SEARCH
// =============================================================================

/**
 * Search for a card and display the cheapest printing
 * Fetches all printings from Scryfall and finds lowest USD price
 */
async function searchCard() {
  const cardNameValue = cardInput.value.trim();

  if (!cardNameValue) {
    showError("Please enter a card name");
    return;
  }

  // Reset UI
  hideAll();
  loading.classList.add("show");
  searchBtn.disabled = true;

  try {
    // First, get the card name to ensure we have the correct spelling
    const cardData = await searchCardByName(cardNameValue);

    if (!cardData) {
      throw new Error(
        "Card not found. Please check the spelling and try again.",
      );
    }

    const exactCardName = cardData.name;

    // Now search for all printings of this card
    allPrintings = await getCardPrintings(exactCardName);

    if (allPrintings.length === 0) {
      throw new Error("Could not fetch card printings.");
    }

    // Find the cheapest printing with a valid price
    const cheapestCard = findCheapestPrinting(allPrintings) || cardData;

    // Display the cheapest card
    displayCard(cheapestCard);

    // Display all printings in the sidebar
    displayPrintings(allPrintings, cheapestCard.id);
  } catch (error) {
    showError(error.message);
  } finally {
    loading.classList.remove("show");
    searchBtn.disabled = false;
  }
}

/**
 * Show error message to user
 * @param {string} message - Error message to display
 */
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.add("show");
}

// =============================================================================
// CARD DISPLAY
// =============================================================================

/**
 * Display card information and set up store links
 * @param {Object} card - Scryfall card object
 */
function displayCard(card) {
  const imageUrl = getCardImageUrl(card);

  if (!imageUrl) {
    showError("No image available for this card.");
    return;
  }

  // Display the card
  cardImage.src = imageUrl;
  cardImage.alt = card.name;
  cardImage.classList.add("show");

  // Display card info
  cardName.textContent = card.name;
  cardSet.textContent = card.set_name;

  // Display price information
  displayPrice(card.prices);

  // Set up store links
  setStoreLinks(card);

  cardInfo.classList.add("show");
}

/**
 * Display Scryfall price information
 * @param {Object} prices - Scryfall prices object
 */
function displayPrice(prices) {
  if (!prices) {
    cardPrice.textContent = "Price: Not available";
    return;
  }

  const priceInfo = [];

  const normalPrice = formatPriceCAD(prices.usd, USD_TO_CAD);
  if (normalPrice) priceInfo.push(normalPrice);

  const foilPrice = formatPriceCAD(prices.usd_foil, USD_TO_CAD);
  if (foilPrice) priceInfo.push(`${foilPrice} (Foil)`);

  cardPrice.textContent =
    priceInfo.length > 0
      ? `Price: ${priceInfo.join(" | ")}`
      : "Price: Not available";
}

// =============================================================================
// STORE LINKS AND PRICES
// =============================================================================

/**
 * Initialize store price tracking state
 * @returns {Object} - Store prices object for tracking
 */
function initializeStorePriceTracking() {
  const storePrices = {};

  Object.entries(STORES).forEach(([key, store]) => {
    store.link.href = "#";
    updatePriceDisplay(store.priceElement, "loading");
    storePrices[key] = {
      price: null,
      element: store.link,
      priceElement: store.priceElement,
    };
  });

  return storePrices;
}

/**
 * Update store links with fetched prices
 * @param {Object} storePrices - Store price tracking object
 * @param {Object} priceData - Fetched price data by store key
 */
function updateStorePriceDisplays(storePrices, priceData) {
  const storeKeys = getStoreKeys();

  storeKeys.forEach((key) => {
    const data = priceData[key];
    if (data && data.price) {
      storePrices[key].price = data.price;
      updatePriceDisplay(STORES[key].priceElement, "success", data.price);
    } else {
      updatePriceDisplay(STORES[key].priceElement, "unavailable");
      storePrices[key].price = Infinity;
    }
  });
}

/**
 * Set up store links and fetch prices from all three stores
 * Uses centralized functions from utils.js for URL building and price fetching
 * @param {Object} card - Scryfall card object
 */
function setStoreLinks(card) {
  const storePrices = initializeStorePriceTracking();

  // Set up store URLs
  Object.entries(STORES).forEach(([key, store]) => {
    store.link.href = buildDirectStoreUrl(key, card);
  });

  // Show the links section
  storeLinks.classList.add("show");

  // Fetch all prices in parallel
  fetchAllStorePrices(card).then((priceData) => {
    updateStorePriceDisplays(storePrices, priceData);
    sortStoresByPrice(storePrices);
  });
}

/**
 * Update price element display
 * @param {HTMLElement} priceElement - Price display element
 * @param {string} status - Status: "success", "unavailable", "error", "loading"
 * @param {number} price - Price value (for success status)
 */
function updatePriceDisplay(priceElement, status, price = null) {
  if (status === "success" && price) {
    priceElement.textContent = `$${price.toFixed(2)} CAD`;
    priceElement.className = "store-price success";
  } else if (status === "unavailable") {
    priceElement.textContent = "N/A";
    priceElement.className = "store-price unavailable";
  } else if (status === "error") {
    priceElement.textContent = "Error";
    priceElement.className = "store-price error";
  } else {
    priceElement.textContent = "Loading...";
    priceElement.className = "store-price loading";
  }
}

/**
 * Sort and reorder store links by price (lowest first)
 * Highlights the cheapest store
 * @param {Object} storePrices - Object with store keys and price data
 */
function sortStoresByPrice(storePrices) {
  const storesArray = Object.entries(storePrices).map(([key, value]) => ({
    key,
    price: value.price,
    element: value.element,
    priceElement: value.priceElement,
  }));

  storesArray.sort((a, b) => a.price - b.price);

  storesArray.forEach((store, index) => {
    storeLinks.appendChild(store.element);
    store.element.classList.remove("cheapest-store");

    if (index === 0 && store.price !== Infinity) {
      store.element.classList.add("cheapest-store");
    }
  });
}

// =============================================================================
// PRINTINGS SIDEBAR
// =============================================================================

/**
 * Display all available printings in the sidebar
 * @param {Array} printings - Array of Scryfall card objects
 * @param {string} currentCardId - ID of currently selected card
 */
function displayPrintings(printings, currentCardId) {
  printingsList.innerHTML = "";

  const sortedPrintings = sortPrintingsByPrice(printings);

  sortedPrintings.forEach((card) => {
    const printingItem = document.createElement("div");
    printingItem.className = "printing-item";

    if (card.id === currentCardId) {
      printingItem.classList.add("active");
    }

    // Set name and code
    const setInfo = document.createElement("div");
    setInfo.className = "printing-set";
    setInfo.textContent = `${card.set_name} (${card.set.toUpperCase()})`;

    // Price info
    const priceInfo = document.createElement("div");
    priceInfo.className = "printing-price";

    const formattedPrice = formatPriceCAD(card.prices?.usd, USD_TO_CAD);
    if (formattedPrice) {
      priceInfo.textContent = formattedPrice;
    } else {
      priceInfo.textContent = "N/A";
      priceInfo.classList.add("unavailable");
    }

    printingItem.appendChild(setInfo);
    printingItem.appendChild(priceInfo);

    // Click handler to switch to this printing
    printingItem.addEventListener("click", () => {
      displayCard(card);
      document.querySelectorAll(".printing-item").forEach((item) => {
        item.classList.remove("active");
      });
      printingItem.classList.add("active");
    });

    printingsList.appendChild(printingItem);
  });
  printingsSidebar.classList.add("show");
}

// =============================================================================
// UI HELPERS
// =============================================================================

/**
 * Hide all UI elements (for resetting before new search)
 */
function hideAll() {
  cardImage.classList.remove("show");
  errorMessage.classList.remove("show");
  cardInfo.classList.remove("show");
  printingsSidebar.classList.remove("show");
  printingsList.innerHTML = "";
  storeLinks.classList.remove("show");
}
