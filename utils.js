// =============================================================================
// SHARED UTILITY FUNCTIONS & STORE CONFIGURATION
// Used by both script.js (main search) and deck-evaluator.js (deck evaluator)
// =============================================================================

/**
 * API Base URL
 */
const API_BASE = "http://localhost:3000/api";

// =============================================================================
// PROMO CARD DETECTION
// =============================================================================

/**
 * Check if a card is a promo card based on Scryfall data
 * @param {Object} card - Scryfall card object
 * @returns {boolean} - True if the card is a promo
 */
function isPromoCard(card) {
  if (!card) return false;

  // Check if the card has promo flag or promo_types
  const hasPromoFlag = card.promo === true;
  const hasPromoTypes = card.promo_types && card.promo_types.length > 0;
  const isPromoSet = card.set_type === "promo";

  return hasPromoFlag || hasPromoTypes || isPromoSet;
}

/**
 * Store Configuration
 * Centralized configuration for all three Canadian MTG stores
 */
const STORE_CONFIG = {
  f2f: {
    name: "Face to Face Games",
    key: "f2f",
    buildStoreUrl: (
      cardSlug,
      collectorNumber,
      setSlug,
      frameEffect = null,
      isPromo = false,
    ) => {
      const effectPart = frameEffect ? `${frameEffect}-` : "";
      const promoPart = isPromo ? "promo-pack-" : "";
      return `https://facetofacegames.com/products/${cardSlug}-${collectorNumber}-${promoPart}${effectPart}${setSlug}-non-foil`;
    },
  },
  hoc: {
    name: "House of Cards",
    key: "hoc",
    buildStoreUrl: (cardSlug, setSlug, frameEffect = null, isPromo = false) => {
      const effectPart = frameEffect ? `${frameEffect}-` : "";
      const promoPart = isPromo ? "promo-pack-" : "";
      return `https://houseofcards.ca/products/${cardSlug}-${promoPart}${effectPart}${setSlug}`;
    },
  },
  "401games": {
    name: "401 Games",
    key: "401games",
    buildStoreUrl: (cardSlug, setCode, frameEffect = null, isPromo = false) => {
      const effectPart = frameEffect ? `${frameEffect}-` : "";
      const promoPart = isPromo ? "promo-pack-" : "";
      return `https://store.401games.ca/products/${cardSlug}-${promoPart}${effectPart}${setCode}`;
    },
  },
};

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
 * Handles double-faced cards by taking only the first part
 * @param {string} str - The string to convert
 * @returns {string} - Kebab-cased string
 * @example toKebabCase("Lightning Bolt") => "lightning-bolt"
 * @example toKebabCase("Delver // Insectile Aberration") => "delver"
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
 * Store key mappings for consistent naming
 */
const STORE_KEY_MAP = {
  f2f: "face-to-face",
  hoc: "house-of-cards",
  "401games": "401games",
  // Reverse mappings
  "face-to-face": "Face to Face Games",
  "house-of-cards": "House of Cards",
};

/**
 * Format store name for display
 * @param {string} store - The store key (f2f, hoc, 401games, face-to-face, house-of-cards)
 * @returns {string} - Formatted store name
 */
function formatStoreName(store) {
  const names = {
    f2f: "Face to Face Games",
    hoc: "House of Cards",
    "401games": "401 Games",
    "face-to-face": "Face to Face Games",
    "house-of-cards": "House of Cards",
  };
  return names[store] || store;
}

/**
 * Build API URL for a specific store
 * @param {string} storeKey - The store key (f2f, hoc, 401games)
 * @param {Object} card - Scryfall card object
 * @returns {string|null} - API URL for fetching price
 */
function buildStoreApiUrl(storeKey, card) {
  const cardSlug = toKebabCase(card.name);
  const setSlug = toKebabCase(card.set_name);
  const collectorNumber = card.collector_number;
  const setCode = card.set;
  const frameEffect = detectFrameEffect(card);
  const isPromo = isPromoCard(card);

  if (storeKey === "f2f") {
    const normalizedEffect = frameEffect
      ? normalizeFrameEffect(frameEffect, "f2f")
      : null;
    const effectPart = normalizedEffect ? `${normalizedEffect}/` : "";
    const promoPart = isPromo ? "promo-pack/" : "";
    return `${API_BASE}/price/f2f/${cardSlug}/${collectorNumber}/${promoPart}${effectPart}${setSlug}`;
  } else if (storeKey === "hoc") {
    const effectPart = frameEffect ? `${frameEffect}/` : "";
    const promoPart = isPromo ? "promo-pack/" : "";
    return `${API_BASE}/price/hoc/${cardSlug}/${promoPart}${effectPart}${setSlug}`;
  } else if (storeKey === "401games") {
    const normalizedEffect = frameEffect
      ? normalizeFrameEffect(frameEffect, "401games")
      : null;
    const effectPart = normalizedEffect ? `${normalizedEffect}/` : "";
    const promoPart = isPromo ? "promo-pack/" : "";
    return `${API_BASE}/price/401games/${cardSlug}/${promoPart}${effectPart}${setCode}`;
  }
  return null;
}

/**
 * Build direct store URL for a card
 * @param {string} storeKey - The store key (f2f, hoc, 401games)
 * @param {Object} card - Scryfall card object
 * @returns {string|null} - Direct URL to product page on store website
 */
function buildDirectStoreUrl(storeKey, card) {
  const store = STORE_CONFIG[storeKey];
  if (!store) return null;

  const cardSlug = toKebabCase(card.name);
  const setSlug = toKebabCase(card.set_name);
  const collectorNumber = card.collector_number;
  const setCode = card.set;
  const frameEffect = detectFrameEffect(card);
  const isPromo = isPromoCard(card);

  if (storeKey === "f2f") {
    const normalizedEffect = frameEffect
      ? normalizeFrameEffect(frameEffect, "f2f")
      : null;
    return store.buildStoreUrl(
      cardSlug,
      collectorNumber,
      setSlug,
      normalizedEffect,
      isPromo,
    );
  } else if (storeKey === "hoc") {
    return store.buildStoreUrl(cardSlug, setSlug, frameEffect, isPromo);
  } else if (storeKey === "401games") {
    const normalizedEffect = frameEffect
      ? normalizeFrameEffect(frameEffect, "401games")
      : null;
    return store.buildStoreUrl(cardSlug, setCode, normalizedEffect, isPromo);
  }
  return null;
}

/**
 * Fetch price from a specific store for a card
 * @param {string} storeKey - The store key (f2f, hoc, 401games)
 * @param {Object} card - Scryfall card object
 * @returns {Promise<Object|null>} - Price data {price, url} or null if unavailable
 */
async function fetchStorePrice(storeKey, card) {
  const url = buildStoreApiUrl(storeKey, card);
  if (!url) {
    console.error(`Invalid store key: ${storeKey}`);
    return null;
  }

  try {
    const response = await fetch(url);

    // Handle error responses
    if (!response.ok) {
      if (response.status === 404) {
        console.log(`${storeKey}: Card not found at store`);
      } else if (response.status === 429) {
        console.warn(`${storeKey}: Rate limited by store`);
      } else {
        console.error(`${storeKey}: HTTP ${response.status}`);
      }
      return null;
    }

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
    console.error(`Error fetching ${storeKey} price:`, error.message);
  }
  return null;
}
