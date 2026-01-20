// =============================================================================
// SHARED UTILITY FUNCTIONS
// Used by both script.js (main search) and deck-evaluator.js (deck evaluator)
// =============================================================================

/**
 * API Base URL
 */
const API_BASE = "http://localhost:3000/api";

/**
 * Detect frame effect from Scryfall card data
 * @param {Object} card - Scryfall card object
 * @returns {string|null} - Frame effect string or null
 */
function detectFrameEffect(card) {
  if (!card) return null;

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
 * Normalize frame effect for specific stores
 * F2F and 401 Games use "retro-frame" instead of "retro"
 * @param {string} frameEffect - The frame effect to normalize
 * @param {string} storeKey - The store key (f2f, hoc, 401games)
 * @returns {string} - Normalized frame effect
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

/**
 * Convert string to kebab-case for URLs
 * @param {string} str - The string to convert
 * @returns {string} - Kebab-cased string
 */
function toKebabCase(str) {
  // Handle double-faced cards (e.g., "Card // Card") - take only first part
  const firstPart = str.split("//")[0].trim();

  return firstPart
    .toLowerCase()
    .replace(/'/g, "") // Remove apostrophes first
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Create a URL-friendly slug from a card name
 * @param {string} cardName - The card name to convert
 * @returns {string} - URL-friendly card slug
 */
function createCardSlug(cardName) {
  // Handle double-faced cards (e.g., "Card // Card") - take only first part
  const firstPart = cardName.split("//")[0].trim();

  return firstPart
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Format store name for display
 * @param {string} store - The store key (face-to-face, house-of-cards, 401games)
 * @returns {string} - Formatted store name
 */
function formatStoreName(store) {
  const names = {
    "face-to-face": "Face to Face Games",
    "house-of-cards": "House of Cards",
    "401games": "401 Games",
  };
  return names[store] || store;
}

/**
 * Build API URL for a specific store
 * @param {string} storeKey - The store key (f2f, hoc, 401games)
 * @param {Object} card - Scryfall card object
 * @returns {string} - API URL for fetching price
 */
function buildStoreApiUrl(storeKey, card) {
  const cardSlug = toKebabCase(card.name);
  const setSlug = toKebabCase(card.set_name);
  const collectorNumber = card.collector_number;
  const setCode = card.set;
  const frameEffect = detectFrameEffect(card);

  if (storeKey === "f2f") {
    const normalizedEffect = frameEffect
      ? normalizeFrameEffect(frameEffect, "f2f")
      : null;
    const effectPart = normalizedEffect ? `${normalizedEffect}/` : "";
    return `${API_BASE}/price/f2f/${cardSlug}/${collectorNumber}/${effectPart}${setSlug}`;
  } else if (storeKey === "hoc") {
    const effectPart = frameEffect ? `${frameEffect}/` : "";
    return `${API_BASE}/price/hoc/${cardSlug}/${effectPart}${setSlug}`;
  } else if (storeKey === "401games") {
    const normalizedEffect = frameEffect
      ? normalizeFrameEffect(frameEffect, "401games")
      : null;
    const effectPart = normalizedEffect ? `${normalizedEffect}/` : "";
    return `${API_BASE}/price/401games/${cardSlug}/${effectPart}${setCode}`;
  }
  return null;
}

/**
 * Fetch price from a specific store for a card
 * @param {string} storeKey - The store key (f2f, hoc, 401games)
 * @param {Object} card - Scryfall card object
 * @returns {Promise<Object|null>} - Price data or null
 */
async function fetchStorePrice(storeKey, card) {
  const url = buildStoreApiUrl(storeKey, card);
  if (!url) return null;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.price && data.price !== "N/A") {
      // Handle both string ("$18") and number (18) formats
      const price =
        typeof data.price === "string"
          ? parseFloat(data.price.replace("$", ""))
          : parseFloat(data.price);

      return {
        price: price,
        url: data.url,
      };
    }
  } catch (error) {
    console.error(`Error fetching ${storeKey} price:`, error);
  }
  return null;
}
