// =============================================================================
// SHARED UTILITY FUNCTIONS & STORE CONFIGURATION
// Used by both script.js (main search) and deck-evaluator.js (deck evaluator)
// =============================================================================

/**
 * API Constants
 */
const API_BASE = "http://localhost:3000/api";
const SCRYFALL_API_BASE = "https://api.scryfall.com";
const EXCHANGE_RATE_API = "https://api.exchangerate-api.com/v4/latest/USD";

// =============================================================================
// STORE CONFIGURATION - Single source of truth for all store data
// =============================================================================

/**
 * Centralized store configuration
 * Contains all metadata for the three Canadian MTG stores
 */
const STORE_CONFIG = {
  f2f: {
    name: "Face to Face Games",
    key: "f2f",
    emoji: "🛡️",
    shortName: "F2F",
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
    emoji: "🃏",
    shortName: "HOC",
    buildStoreUrl: (cardSlug, setSlug, frameEffect = null, isPromo = false) => {
      const effectPart = frameEffect ? `${frameEffect}-` : "";
      const promoPart = isPromo ? "promo-pack-" : "";
      return `https://houseofcards.ca/products/${cardSlug}-${promoPart}${effectPart}${setSlug}`;
    },
  },
  "401games": {
    name: "401 Games",
    key: "401games",
    emoji: "🎲",
    shortName: "401",
    buildStoreUrl: (cardSlug, setCode, frameEffect = null, isPromo = false) => {
      const effectPart = frameEffect ? `${frameEffect}-` : "";
      const promoPart = isPromo ? "promo-pack-" : "";
      return `https://store.401games.ca/products/${cardSlug}-${promoPart}${effectPart}${setCode}`;
    },
  },
};

/**
 * Get all store keys
 * @returns {string[]} - Array of store keys ["f2f", "hoc", "401games"]
 */
function getStoreKeys() {
  return Object.keys(STORE_CONFIG);
}

/**
 * Format store name for display
 * Uses STORE_CONFIG as the canonical source
 * @param {string} storeKey - The store key (f2f, hoc, 401games)
 * @returns {string} - Formatted store name
 */
function formatStoreName(storeKey) {
  const config = STORE_CONFIG[storeKey];
  return config ? config.name : storeKey;
}

/**
 * Get store emoji
 * @param {string} storeKey - The store key (f2f, hoc, 401games)
 * @returns {string} - Store emoji
 */
function getStoreEmoji(storeKey) {
  const config = STORE_CONFIG[storeKey];
  return config ? config.emoji : "";
}

/**
 * Get store short name
 * @param {string} storeKey - The store key (f2f, hoc, 401games)
 * @returns {string} - Store short name (F2F, HOC, 401)
 */
function getStoreShortName(storeKey) {
  const config = STORE_CONFIG[storeKey];
  return config ? config.shortName : storeKey;
}

// =============================================================================
// PROMO CARD DETECTION
// =============================================================================

/**
 * Check if a card is a promo pack card based on Scryfall data
 * Only cards with "promopack" in promo_types should use promo-pack URLs
 * @param {Object} card - Scryfall card object
 * @returns {boolean} - True if the card is a promo pack card
 */
function isPromoCard(card) {
  if (!card) return false;

  // Check if the card specifically has "promopack" in promo_types
  // Other promo_types like "beginnerbox", "universesbeyond", etc. don't use promo-pack URLs
  const hasPromoPackType =
    card.promo_types && card.promo_types.includes("promopack");

  return hasPromoPackType;
}

// =============================================================================
// FRAME EFFECT DETECTION
// =============================================================================

/**
 * Detect frame effect from Scryfall card data
 * @param {Object} card - Scryfall card object
 * @returns {string|null} - Frame effect string or null
 */
function detectFrameEffect(card) {
  if (!card) return null;

  // Check for future frame (similar to retro frame detection)
  if (card.frame === "future") {
    return "future-frame";
  }

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

  // Check for white border (Mystery Booster 2, etc.)
  if (card.border_color === "white") {
    return "white-border";
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
 * @returns {string|null} - Normalized frame effect
 */
function normalizeFrameEffect(frameEffect, storeKey) {
  if (
    frameEffect === "retro" &&
    (storeKey === "f2f" || storeKey === "401games")
  ) {
    return "retro-frame";
  }

  // Handle future-frame for different stores
  if (frameEffect === "future-frame") {
    if (storeKey === "hoc") {
      return "future-sight";
    }
    if (storeKey === "f2f") {
      return "future-frame";
    }
    if (storeKey === "401games") {
      return null; // 401 Games doesn't need frame effect in URL for future frames
    }
  }

  // Handle white-border for different stores
  if (frameEffect === "white-border") {
    if (storeKey === "401games") {
      return null; // 401 Games doesn't need white-border in URL
    }
    return "white-border"; // F2F and HOC use white-border
  }

  return frameEffect;
}

// =============================================================================
// STRING UTILITIES
// =============================================================================

/**
 * Convert string to kebab-case for URLs
 * Handles double-faced cards by converting both faces
 * @param {string} str - The string to convert
 * @returns {string} - Kebab-cased string
 * @example toKebabCase("Lightning Bolt") => "lightning-bolt"
 * @example toKebabCase("Ajani, Nacatl Pariah // Ajani, Nacatl Avenger") => "ajani-nacatl-pariah-ajani-nacatl-avenger"
 */
function toKebabCase(str) {
  // Handle double-faced cards (e.g., "Card // Card") - convert both parts
  if (str.includes("//")) {
    const parts = str.split("//").map((part) => part.trim());
    return parts
      .map((part) =>
        part
          .toLowerCase()
          .replace(/'/g, "") // Remove apostrophes first
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, ""),
      )
      .join("-");
  }

  // Single-faced cards
  return str
    .toLowerCase()
    .replace(/'/g, "") // Remove apostrophes first
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// =============================================================================
// URL BUILDING
// =============================================================================

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
    const normalizedEffect = frameEffect
      ? normalizeFrameEffect(frameEffect, "hoc")
      : null;
    const effectPart = normalizedEffect ? `${normalizedEffect}/` : "";
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
    const normalizedEffect = frameEffect
      ? normalizeFrameEffect(frameEffect, "hoc")
      : null;
    return store.buildStoreUrl(cardSlug, setSlug, normalizedEffect, isPromo);
  } else if (storeKey === "401games") {
    const normalizedEffect = frameEffect
      ? normalizeFrameEffect(frameEffect, "401games")
      : null;
    return store.buildStoreUrl(cardSlug, setCode, normalizedEffect, isPromo);
  }
  return null;
}

// =============================================================================
// PRICE FETCHING
// =============================================================================

/**
 * Fetch price from a specific store for a card
 * @param {string} storeKey - The store key (f2f, hoc, 401games)
 * @param {Object} card - Scryfall card object
 * @param {number} retryCount - Current retry attempt (default 0)
 * @param {number} maxRetries - Maximum number of retries (default 3)
 * @returns {Promise<Object|null>} - Price data {price, url} or null if unavailable
 */
async function fetchStorePrice(storeKey, card, retryCount = 0, maxRetries = 3) {
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
        return null;
      } else if (response.status === 429) {
        // Rate limited - retry with exponential backoff
        if (retryCount < maxRetries) {
          const delayMs = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
          console.warn(
            `${storeKey}: Rate limited, retrying in ${delayMs}ms (attempt ${retryCount + 1}/${maxRetries})`,
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          return fetchStorePrice(storeKey, card, retryCount + 1, maxRetries);
        } else {
          console.warn(`${storeKey}: Rate limited, max retries exceeded`);
          return null;
        }
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

/**
 * Fetch prices from all stores for a specific card printing
 * @param {Object} card - Scryfall card object
 * @returns {Promise<Object>} - Object with store keys and price data
 */
async function fetchAllStorePrices(card) {
  const storeKeys = getStoreKeys();
  const results = await Promise.all(
    storeKeys.map((key) => fetchStorePrice(key, card)),
  );

  const prices = {};
  storeKeys.forEach((key, index) => {
    if (results[index]) {
      prices[key] = results[index];
    }
  });

  return prices;
}
