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
const faceToFaceLink = document.getElementById("faceToFaceLink");
const houseOfCardsLink = document.getElementById("houseOfCardsLink");

let debounceTimer;
let currentFocus = -1;
let allPrintings = [];

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
  }, 300);
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

// Search for card when button is clicked
searchBtn.addEventListener("click", searchCard);

// Also search when Enter key is pressed (handled in keydown above)

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
  setStoreLinks(card.name, card.set_name, card.collector_number);

  cardInfo.classList.add("show");
}

function setStoreLinks(cardName, setName, collectorNumber) {
  // Convert to kebab-case (lowercase with hyphens)
  const toKebabCase = (str) => {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const cardSlug = toKebabCase(cardName);
  const setSlug = toKebabCase(setName);

  // Face to Face Games - direct product page
  faceToFaceLink.href = `https://facetofacegames.com/products/${cardSlug}-${collectorNumber}-${setSlug}-non-foil`;

  // House of Cards - direct product page
  houseOfCardsLink.href = `https://houseofcards.ca/products/${cardSlug}-${setSlug}`;

  // Show the links section
  storeLinks.classList.add("show");
}

function displayPrice(prices) {
  if (!prices) {
    cardPrice.textContent = "Price: Not available";
    return;
  }

  const priceInfo = [];

  // Convert USD to CAD (approximate rate: 1 USD = 1.35 CAD)
  const USD_TO_CAD = 1.35;

  if (prices.usd) {
    const cadPrice = (parseFloat(prices.usd) * USD_TO_CAD).toFixed(2);
    priceInfo.push(`$${cadPrice} CAD`);
  }

  if (prices.usd_foil) {
    const cadPriceFoil = (parseFloat(prices.usd_foil) * USD_TO_CAD).toFixed(2);
    priceInfo.push(`$${cadPriceFoil} CAD (Foil)`);
  }

  if (priceInfo.length > 0) {
    cardPrice.textContent = `Price: ${priceInfo.join(" | ")}`;
  } else {
    cardPrice.textContent = "Price: Not available";
  }
}

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

    // Highlight the currently displayed card
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

    const USD_TO_CAD = 1.35;
    if (card.prices?.usd && parseFloat(card.prices.usd) > 0) {
      const cadPrice = (parseFloat(card.prices.usd) * USD_TO_CAD).toFixed(2);
      priceInfo.textContent = `$${cadPrice} CAD`;
    } else {
      priceInfo.textContent = "N/A";
      priceInfo.classList.add("unavailable");
    }

    printingItem.appendChild(setInfo);
    printingItem.appendChild(priceInfo);

    // Add click handler to switch to this printing
    printingItem.addEventListener("click", () => {
      displayCard(card);

      // Update active state
      document.querySelectorAll(".printing-item").forEach((item) => {
        item.classList.remove("active");
      });
      printingItem.classList.add("active");
    });

    printingsList.appendChild(printingItem);
  });

  // Show the sidebar
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
