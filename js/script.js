/** Live USD to CAD exchange rate, initialised to the config default */
let USD_TO_CAD = CARD_CONFIG.DEFAULT_USD_TO_CAD;

/**
 * Fetches the live USD to CAD exchange rate.
 * Falls back to CARD_CONFIG.DEFAULT_USD_TO_CAD if the request fails.
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
      error
    );
  }
}

fetchExchangeRate();

// DOM element references
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
 * DOM references for the three store link elements, keyed by store key.
 * Names come from STORE_CONFIG to keep a single source of truth.
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

/** All printings of the currently displayed card */
let allPrintings = [];

AutocompleteController.init(cardInput, autocompleteList, () => searchCard());
searchBtn.addEventListener("click", searchCard);

/**
 * Searches for a card and displays the cheapest printing with all store prices.
 */
async function searchCard() {
  const cardNameValue = cardInput.value.trim();

  if (!cardNameValue) {
    showError("Please enter a card name");
    return;
  }

  hideAll();
  loading.classList.add("show");
  searchBtn.disabled = true;

  try {
    const cardData = await searchCardByName(cardNameValue);

    if (!cardData) {
      throw new Error("Card not found. Please check the spelling and try again.");
    }

    allPrintings = await getCardPrintings(cardData.name);

    if (allPrintings.length === 0) {
      throw new Error("Could not fetch card printings.");
    }

    const cheapestCard = findCheapestPrinting(allPrintings) || cardData;
    displayCard(cheapestCard);
    displayPrintings(allPrintings, cheapestCard.id);
  } catch (error) {
    showError(error.message);
  } finally {
    loading.classList.remove("show");
    searchBtn.disabled = false;
  }
}

/**
 * Displays a card's image, name, set, Scryfall price, and triggers store price loading.
 * @param {Object} card - Scryfall card object
 */
function displayCard(card) {
  const imageUrl = getCardImageUrl(card);

  if (!imageUrl) {
    showError("No image available for this card.");
    return;
  }

  cardImage.src = imageUrl;
  cardImage.alt = card.name;
  cardImage.classList.add("show");

  cardName.textContent = card.name;
  cardSet.textContent = card.set_name;

  displayPrice(card.prices);
  setStoreLinks(card);

  cardInfo.classList.add("show");
}

/**
 * Renders the Scryfall price line (normal and foil in CAD).
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

/**
 * Sets the href for each store link and kicks off parallel price scraping.
 * @param {Object} card - Scryfall card object
 */
function setStoreLinks(card) {
  const storePrices = initializeStorePriceTracking();

  Object.entries(STORES).forEach(([key, store]) => {
    store.link.href = buildDirectStoreUrl(key, card);
  });

  storeLinks.classList.add("show");

  fetchAllStorePrices(card).then((priceData) => {
    updateStorePriceDisplays(storePrices, priceData);
    sortStoresByPrice(storePrices);
  });
}

/**
 * Resets all store price elements to "loading" state.
 * @returns {Object} Store price tracking object
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
 * Applies fetched price data to the store price display elements.
 * @param {Object} storePrices - Tracking object from initializeStorePriceTracking
 * @param {Object} priceData - Fetched price map from fetchAllStorePrices
 */
function updateStorePriceDisplays(storePrices, priceData) {
  getStoreKeys().forEach((key) => {
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
 * Updates a single store price element's text and CSS class.
 * @param {HTMLElement} priceElement
 * @param {"success"|"unavailable"|"error"|"loading"} status
 * @param {number|null} price
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
 * Re-orders store link elements in the DOM by price (cheapest first)
 * and applies the "cheapest-store" highlight to the lowest-priced store.
 * @param {Object} storePrices - Tracking object after prices have been populated
 */
function sortStoresByPrice(storePrices) {
  const sorted = Object.entries(storePrices)
    .map(([key, value]) => ({ key, ...value }))
    .sort((a, b) => a.price - b.price);

  sorted.forEach((store, index) => {
    storeLinks.appendChild(store.element);
    store.element.classList.remove("cheapest-store");
    if (index === 0 && store.price !== Infinity) {
      store.element.classList.add("cheapest-store");
    }
  });
}

/**
 * Renders all printings into the sidebar, sorted by price.
 * @param {Array} printings - Array of Scryfall card objects
 * @param {string} currentCardId - ID of the currently displayed card
 */
function displayPrintings(printings, currentCardId) {
  printingsList.innerHTML = "";

  sortPrintingsByPrice(printings).forEach((card) => {
    const item = document.createElement("div");
    item.className = "printing-item";
    if (card.id === currentCardId) item.classList.add("active");

    const setInfo = document.createElement("div");
    setInfo.className = "printing-set";
    setInfo.textContent = `${card.set_name} (${card.set.toUpperCase()})`;

    const priceInfo = document.createElement("div");
    priceInfo.className = "printing-price";
    const formattedPrice = formatPriceCAD(card.prices?.usd, USD_TO_CAD);
    if (formattedPrice) {
      priceInfo.textContent = formattedPrice;
    } else {
      priceInfo.textContent = "N/A";
      priceInfo.classList.add("unavailable");
    }

    item.appendChild(setInfo);
    item.appendChild(priceInfo);

    item.addEventListener("click", () => {
      displayCard(card);
      document.querySelectorAll(".printing-item").forEach((el) => {
        el.classList.remove("active");
      });
      item.classList.add("active");
    });

    printingsList.appendChild(item);
  });

  printingsSidebar.classList.add("show");
}

/**
 * Hides all result UI elements in preparation for a new search.
 */
function hideAll() {
  cardImage.classList.remove("show");
  errorMessage.classList.remove("show");
  cardInfo.classList.remove("show");
  printingsSidebar.classList.remove("show");
  printingsList.innerHTML = "";
  storeLinks.classList.remove("show");
}

/**
 * Displays an error message to the user.
 * @param {string} message
 */
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.add("show");
}
