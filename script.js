// Constants
let USD_TO_CAD = 1.35; // Default fallback value

// Fetch live exchange rate
async function fetchExchangeRate() {
  try {
    const response = await fetch(
      "https://api.exchangerate-api.com/v4/latest/USD",
    );
    const data = await response.json();
    if (data.rates && data.rates.CAD) {
      USD_TO_CAD = data.rates.CAD;
      console.log(`Updated USD to CAD rate: ${USD_TO_CAD}`);
    }
  } catch (error) {
    console.warn("Failed to fetch exchange rate, using default 1.35:", error);
  }
}

// Fetch exchange rate on page load
fetchExchangeRate();

// DOM Elements
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

// Store Configuration
const STORES = {
  f2f: {
    name: "Face to Face Games",
    link: document.getElementById("faceToFaceLink"),
    priceElement: document.getElementById("f2fPrice"),
    buildUrl: (cardSlug, collectorNumber, setSlug, frameEffect = null) => {
      const effectPart = frameEffect ? `${frameEffect}-` : "";
      return `https://facetofacegames.com/products/${cardSlug}-${collectorNumber}-${effectPart}${setSlug}-non-foil`;
    },
    apiUrl: (cardSlug, collectorNumber, setSlug, frameEffect = null) => {
      const effectPart = frameEffect ? `${frameEffect}/` : "";
      return `http://localhost:3000/api/price/f2f/${cardSlug}/${collectorNumber}/${effectPart}${setSlug}`;
    },
  },
  hoc: {
    name: "House of Cards",
    link: document.getElementById("houseOfCardsLink"),
    priceElement: document.getElementById("hocPrice"),
    buildUrl: (cardSlug, setSlug, frameEffect = null) => {
      const effectPart = frameEffect ? `${frameEffect}-` : "";
      return `https://houseofcards.ca/products/${cardSlug}-${effectPart}${setSlug}`;
    },
    apiUrl: (cardSlug, setSlug, frameEffect = null) => {
      const effectPart = frameEffect ? `${frameEffect}/` : "";
      return `http://localhost:3000/api/price/hoc/${cardSlug}/${effectPart}${setSlug}`;
    },
  },
  "401games": {
    name: "401 Games",
    link: document.getElementById("games401Link"),
    priceElement: document.getElementById("games401Price"),
    buildUrl: (cardSlug, setCode, frameEffect = null) => {
      const effectPart = frameEffect ? `${frameEffect}-` : "";
      return `https://store.401games.ca/products/${cardSlug}-${effectPart}${setCode}`;
    },
    apiUrl: (cardSlug, setCode, frameEffect = null) => {
      const effectPart = frameEffect ? `${frameEffect}/` : "";
      return `http://localhost:3000/api/price/401games/${cardSlug}/${effectPart}${setCode}`;
    },
  },
};

// State
let debounceTimer;
let currentFocus = -1;
let allPrintings = [];

// Set URL hash for card search page
if (window.location.hash === "" || window.location.hash === "#deck-evaluator") {
  window.location.hash = "#card-search";
}

// Autocomplete functionality
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

async function handleAutocomplete() {
  const query = cardInput.value.trim();

  // Clear previous timer
  clearTimeout(debounceTimer);

  if (query.length < 2) {
    closeAutocomplete();
    return;
  }

  // Debounce API calls
  debounceTimer = setTimeout(async () => {
    try {
      const response = await fetch(
        `https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(query)}`,
      );

      if (!response.ok) return;

      const data = await response.json();
      displayAutocomplete(data.data);
    } catch (error) {
      console.error("Autocomplete error:", error);
    }
  }, 25);
}

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

function setActive(items) {
  if (!items || items.length === 0) return;

  // Remove active class from all items
  Array.from(items).forEach((item) => item.classList.remove("active"));

  // Wrap around
  if (currentFocus >= items.length) currentFocus = 0;
  if (currentFocus < 0) currentFocus = items.length - 1;

  // Add active class to current item
  items[currentFocus].classList.add("active");
  items[currentFocus].scrollIntoView({ block: "nearest" });
}

function closeAutocomplete() {
  autocompleteList.innerHTML = "";
  autocompleteList.classList.remove("show");
  currentFocus = -1;
}

// Event Listeners
searchBtn.addEventListener("click", searchCard);

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Convert string to kebab-case for URLs
 */
function toKebabCase(str) {
  return str
    .toLowerCase()
    .replace(/'/g, "") // Remove apostrophes first
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Format price in CAD
 */
function formatPrice(usdPrice) {
  if (!usdPrice || parseFloat(usdPrice) <= 0) return null;
  const cadPrice = (parseFloat(usdPrice) * USD_TO_CAD).toFixed(2);
  return `$${cadPrice} CAD`;
}

/**
 * Detect frame effect from card data
 */
function detectFrameEffect(card) {
  // Check frame_effects array
  if (card.frame_effects && card.frame_effects.length > 0) {
    const effect = card.frame_effects[0];
    if (effect === "extendedart") return "extended-art";
    if (effect === "showcase") return "showcase";
    if (effect === "borderless") return "borderless";
  }

  // Check border_color for borderless cards
  if (card.border_color === "borderless") {
    return "borderless";
  }

  // Check for retro frame (1997 old-style frame from reprints)
  if (
    card.frame === "1997" &&
    card.promo_types &&
    card.promo_types.includes("boosterfun")
  ) {
    return "retro";
  }

  return null;
}

/**
 * Normalize frame effect for specific store (retro -> retro-frame for F2F/401)
 */
function normalizeFrameEffect(frameEffect, storeKey) {
  if (
    frameEffect === "retro" &&
    (storeKey === "f2f" || storeKey === "401games")
  ) {
    return "retro-frame";
  }
  return frameEffect;
}

// =============================================================================
// CARD SEARCH
// =============================================================================

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
    const nameResponse = await fetch(
      `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardNameValue)}`,
    );

    if (!nameResponse.ok) {
      if (nameResponse.status === 404) {
        throw new Error(
          "Card not found. Please check the spelling and try again.",
        );
      }
      throw new Error("An error occurred while searching for the card.");
    }

    const nameData = await nameResponse.json();
    const exactCardName = nameData.name;

    // Now search for all printings of this card
    const printsResponse = await fetch(
      `https://api.scryfall.com/cards/search?q=!"${encodeURIComponent(exactCardName)}"&unique=prints`,
    );

    if (!printsResponse.ok) {
      throw new Error("Could not fetch card printings.");
    }

    const printsData = await printsResponse.json();

    // Store all printings
    allPrintings = printsData.data;

    // Find the cheapest printing with a valid price
    let cheapestCard = null;
    let lowestPrice = Infinity;

    for (const card of printsData.data) {
      if (card.prices && card.prices.usd) {
        const price = parseFloat(card.prices.usd);
        if (price > 0 && price < lowestPrice) {
          lowestPrice = price;
          cheapestCard = card;
        }
      }
    }

    // If no card with USD price found, fall back to the first result
    if (!cheapestCard) {
      cheapestCard = nameData;
    }

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

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.add("show");
}

function displayCard(card) {
  // Get the card image URL (preferring normal size)
  const imageUrl =
    card.image_uris?.normal ||
    card.image_uris?.large ||
    card.image_uris?.png ||
    card.card_faces?.[0]?.image_uris?.normal;

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

// =============================================================================
// STORE LINKS AND PRICES
// =============================================================================

function setStoreLinks(card) {
  const cardSlug = toKebabCase(card.name);
  const setSlug = toKebabCase(card.set_name);
  const collectorNumber = card.collector_number;
  const setCode = card.set;
  const storePrices = {};

  // Detect frame effect variants
  const frameEffect = detectFrameEffect(card);

  // Build URLs for each store based on their requirements
  const storeParams = {
    f2f: [
      cardSlug,
      collectorNumber,
      setSlug,
      normalizeFrameEffect(frameEffect, "f2f"),
    ],
    hoc: [cardSlug, setSlug, frameEffect],
    "401games": [
      cardSlug,
      setCode,
      normalizeFrameEffect(frameEffect, "401games"),
    ],
  };

  // Set up each store
  Object.entries(STORES).forEach(([key, store]) => {
    // Set store URL using appropriate parameters
    store.link.href = store.buildUrl(...storeParams[key]);

    // Reset price display
    updatePriceDisplay(store.priceElement, "loading");

    // Track for sorting
    storePrices[key] = {
      price: null,
      element: store.link,
      priceElement: store.priceElement,
    };
  });

  // Show the links section
  storeLinks.classList.add("show");

  // Fetch all prices in parallel
  Promise.all([
    fetchStorePrice(
      "f2f",
      cardSlug,
      collectorNumber,
      setSlug,
      storePrices,
      normalizeFrameEffect(frameEffect, "f2f"),
    ),
    fetchStorePrice("hoc", cardSlug, null, setSlug, storePrices, frameEffect),
    fetchStorePrice(
      "401games",
      cardSlug,
      null,
      setCode,
      storePrices,
      normalizeFrameEffect(frameEffect, "401games"),
    ),
  ]).then(() => {
    sortStoresByPrice(storePrices);
  });
}

/**
 * Update price element display
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

async function fetchStorePrice(
  storeKey,
  cardSlug,
  collectorNumber,
  setSlug,
  storePrices,
  frameEffect = null,
) {
  const store = STORES[storeKey];
  const priceElement = store.priceElement;

  try {
    // Build API URL based on store
    let url;
    if (storeKey === "f2f") {
      url = store.apiUrl(cardSlug, collectorNumber, setSlug, frameEffect);
    } else if (storeKey === "hoc") {
      url = store.apiUrl(cardSlug, setSlug, frameEffect);
    } else if (storeKey === "401games") {
      url = store.apiUrl(cardSlug, setSlug, frameEffect); // setSlug is actually setCode here
    }

    const response = await fetch(url);
    const data = await response.json();

    if (data.price) {
      updatePriceDisplay(priceElement, "success", data.price);
      storePrices[storeKey].price = data.price;
    } else {
      updatePriceDisplay(priceElement, "unavailable");
      storePrices[storeKey].price = Infinity;
    }
  } catch (error) {
    console.error(`Error fetching ${store.name} price:`, error);
    updatePriceDisplay(priceElement, "error");
    storePrices[storeKey].price = Infinity;
  }
}

function sortStoresByPrice(storePrices) {
  // Create array of stores with their prices
  const storesArray = Object.entries(storePrices).map(([key, value]) => ({
    key,
    price: value.price,
    element: value.element,
    priceElement: value.priceElement,
  }));

  // Sort by price (lowest to highest)
  storesArray.sort((a, b) => a.price - b.price);

  // Reorder the DOM elements
  storesArray.forEach((store, index) => {
    storeLinks.appendChild(store.element);

    // Remove any existing cheapest class
    store.element.classList.remove("cheapest-store");

    // Add cheapest class to the first (lowest price) store
    if (index === 0 && store.price !== Infinity) {
      store.element.classList.add("cheapest-store");
    }
  });
}

function displayPrice(prices) {
  if (!prices) {
    cardPrice.textContent = "Price: Not available";
    return;
  }

  const priceInfo = [];

  const normalPrice = formatPrice(prices.usd);
  if (normalPrice) priceInfo.push(normalPrice);

  const foilPrice = formatPrice(prices.usd_foil);
  if (foilPrice) priceInfo.push(`${foilPrice} (Foil)`);

  cardPrice.textContent =
    priceInfo.length > 0
      ? `Price: ${priceInfo.join(" | ")}`
      : "Price: Not available";
}

// =============================================================================
// PRINTINGS SIDEBAR
// =============================================================================

function displayPrintings(printings, currentCardId) {
  printingsList.innerHTML = "";

  // Sort printings by price (lowest first)
  const sortedPrintings = [...printings].sort((a, b) => {
    const priceA = a.prices?.usd ? parseFloat(a.prices.usd) : Infinity;
    const priceB = b.prices?.usd ? parseFloat(b.prices.usd) : Infinity;
    return priceA - priceB;
  });

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

    const formattedPrice = formatPrice(card.prices?.usd);
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

function hideAll() {
  cardImage.classList.remove("show");
  errorMessage.classList.remove("show");
  cardInfo.classList.remove("show");
  printingsSidebar.classList.remove("show");
  printingsList.innerHTML = "";
  storeLinks.classList.remove("show");
}
