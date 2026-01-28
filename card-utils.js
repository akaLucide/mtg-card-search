// =============================================================================
// CARD UTILITIES
// Shared card-related logic used by both script.js and deck-evaluator.js
// =============================================================================

/**
 * Configuration constants for card processing
 */
const CARD_CONFIG = {
    DEFAULT_USD_TO_CAD: 1.35,
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

// =============================================================================
// BASIC LAND DETECTION
// =============================================================================

/**
 * Check if a card name is a basic land
 * @param {string} cardName - The card name to check
 * @returns {boolean} - True if the card is a basic land
 */
function isBasicLand(cardName) {
    const normalized = cardName.toLowerCase().trim();
    return BASIC_LANDS.includes(normalized);
}

// =============================================================================
// SPECIAL PRINTING DETECTION
// =============================================================================

/**
 * Check if a card has special frame effects or is a promo card
 * Uses isPromoCard from utils.js for promo detection
 * @param {Object} card - Scryfall card object
 * @returns {boolean} - True if the card has special frame effects or is a promo
 */
function hasSpecialFrameEffect(card) {
    // Check for special frame effects
    const hasSpecialFrame =
        card.frame_effects &&
        card.frame_effects.length > 0 &&
        card.frame_effects.some((effect) => SPECIAL_FRAME_EFFECTS.includes(effect));

    // Check if it's a promo card (using shared isPromoCard from utils.js)
    const isPromo = isPromoCard(card);

    return hasSpecialFrame || isPromo;
}

// =============================================================================
// CHEAPEST PRINTING FINDER
// =============================================================================

/**
 * Find the cheapest printing from an array of Scryfall card printings
 * Filters by USD price and optionally excludes special printings
 * @param {Array} printings - Array of Scryfall card objects
 * @param {boolean} excludeSpecial - Whether to exclude special frame effects/promos
 * @returns {Object|null} - Cheapest card object or null if none found
 */
function findCheapestPrinting(printings, excludeSpecial = false) {
    if (!printings || printings.length === 0) {
        return null;
    }

    // Filter out special printings if requested
    const filteredPrintings = excludeSpecial
        ? printings.filter((card) => !hasSpecialFrameEffect(card))
        : printings;

    if (filteredPrintings.length === 0) {
        return null;
    }

    // Find the cheapest printing by USD price
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

    // If no card with USD price found, fall back to the first result
    if (!cheapestCard) {
        cheapestCard = filteredPrintings[0];
    }

    return cheapestCard;
}

/**
 * Sort printings by USD price (lowest first)
 * Cards without prices are placed at the end
 * @param {Array} printings - Array of Scryfall card objects
 * @returns {Array} - Sorted array of card objects
 */
function sortPrintingsByPrice(printings) {
    return [...printings].sort((a, b) => {
        const priceA = a.prices?.usd ? parseFloat(a.prices.usd) : Infinity;
        const priceB = b.prices?.usd ? parseFloat(b.prices.usd) : Infinity;
        return priceA - priceB;
    });
}

// =============================================================================
// PRICE FORMATTING
// =============================================================================

/**
 * Format price in CAD from USD
 * @param {number|string} usdPrice - USD price (number or string)
 * @param {number} exchangeRate - USD to CAD exchange rate
 * @returns {string|null} - Formatted CAD price string or null if invalid
 */
function formatPriceCAD(usdPrice, exchangeRate = CARD_CONFIG.DEFAULT_USD_TO_CAD) {
    if (!usdPrice || parseFloat(usdPrice) <= 0) return null;
    const cadPrice = (parseFloat(usdPrice) * exchangeRate).toFixed(2);
    return `$${cadPrice} CAD`;
}

// =============================================================================
// SCRYFALL API HELPERS
// =============================================================================

/**
 * Fetch all printings of a card from Scryfall API
 * @param {string} cardName - The card name to search for
 * @returns {Promise<Array>} - Array of card objects from Scryfall
 */
async function getCardPrintings(cardName) {
    try {
        const response = await fetch(
            `${SCRYFALL_API_BASE}/cards/search?q=!"${encodeURIComponent(cardName)}"&unique=prints`,
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
 * Search for a card by name using Scryfall fuzzy search
 * @param {string} cardName - The card name to search for
 * @returns {Promise<Object|null>} - Card object or null if not found
 */
async function searchCardByName(cardName) {
    try {
        const response = await fetch(
            `${SCRYFALL_API_BASE}/cards/named?fuzzy=${encodeURIComponent(cardName)}`,
        );
        if (!response.ok) {
            if (response.status === 404) {
                return null;
            }
            throw new Error("Failed to search for card");
        }
        return await response.json();
    } catch (error) {
        console.error(`Error searching for card ${cardName}:`, error);
        return null;
    }
}

/**
 * Get autocomplete suggestions from Scryfall
 * @param {string} query - Partial card name query
 * @returns {Promise<Array>} - Array of card name suggestions
 */
async function getAutocompleteSuggestions(query) {
    try {
        const response = await fetch(
            `${SCRYFALL_API_BASE}/cards/autocomplete?q=${encodeURIComponent(query)}`,
        );
        if (!response.ok) return [];
        const data = await response.json();
        return data.data || [];
    } catch (error) {
        console.error("Autocomplete error:", error);
        return [];
    }
}

// =============================================================================
// DECK PARSING
// =============================================================================

/**
 * Parse deck list text into structured card data
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
            // If no quantity prefix, assume 1
            cards.push({ quantity: 1, name: trimmed });
        }
    }

    return cards;
}

// =============================================================================
// IMAGE UTILITIES
// =============================================================================

/**
 * Get the best available image URL from a Scryfall card object
 * Handles both single-faced and double-faced cards
 * @param {Object} card - Scryfall card object
 * @returns {string|null} - Image URL or null if not available
 */
function getCardImageUrl(card) {
    if (!card) return null;

    return (
        card.image_uris?.normal ||
        card.image_uris?.large ||
        card.image_uris?.png ||
        card.card_faces?.[0]?.image_uris?.normal ||
        null
    );
}
