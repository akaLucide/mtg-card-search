/**
 * Converts a string to kebab-case for use in store product URLs.
 * Double-faced card names (joined by "//") are each converted and joined.
 * @param {string} str
 * @returns {string}
 * @example toKebabCase("Lightning Bolt") => "lightning-bolt"
 * @example toKebabCase("Ajani // Avenger") => "ajani-avenger"
 */
function toKebabCase(str) {
  const toSlug = (s) =>
    s
      .toLowerCase()
      .replace(/'/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  if (str.includes("//")) {
    return str
      .split("//")
      .map((part) => toSlug(part.trim()))
      .join("-");
  }

  return toSlug(str);
}

/**
 * Extracts and normalizes the URL-relevant properties from a Scryfall card object.
 * Centralizes the repeated card-to-slug transformations used by both URL builders.
 * @param {Object} card - Scryfall card object
 * @returns {{ cardSlug, collectorNumber, setSlug, setCode, frameEffect, isPromo }}
 */
function prepareCardParams(card) {
  return {
    cardSlug: toKebabCase(card.name),
    collectorNumber: card.collector_number,
    setSlug: toKebabCase(card.set_name),
    setCode: card.set,
    frameEffect: detectFrameEffect(card),
    isPromo: isPromoCard(card),
  };
}

/**
 * Builds the internal API proxy URL for fetching a card's scraped price from a given store.
 * Delegates to each store's own buildApiUrl — no branching on store keys needed here.
 * @param {string} storeKey
 * @param {Object} card - Scryfall card object
 * @returns {string|null}
 */
function buildStoreApiUrl(storeKey, card) {
  const store = STORE_CONFIG[storeKey];
  if (!store) {
    console.error(`buildStoreApiUrl: unknown store key "${storeKey}"`);
    return null;
  }
  return store.buildApiUrl(prepareCardParams(card));
}

/**
 * Builds the direct product page URL for a card on a given store's website.
 * Delegates to each store's own buildDirectUrl — no branching on store keys needed here.
 * @param {string} storeKey
 * @param {Object} card - Scryfall card object
 * @returns {string|null}
 */
function buildDirectStoreUrl(storeKey, card) {
  const store = STORE_CONFIG[storeKey];
  if (!store) return null;
  return store.buildDirectUrl(prepareCardParams(card));
}
