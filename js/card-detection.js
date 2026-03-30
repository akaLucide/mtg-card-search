/** Basic land names used to filter cards from deck evaluation */
const BASIC_LANDS = ["mountain", "island", "plains", "swamp", "forest"];

/** Frame effects considered non-standard printings */
const SPECIAL_FRAME_EFFECTS = ["borderless", "extendedart", "showcase", "inverted"];

/**
 * @param {string} cardName
 * @returns {boolean} True if the card is a basic land
 */
function isBasicLand(cardName) {
  return BASIC_LANDS.includes(cardName.toLowerCase().trim());
}

/**
 * Checks if a card is a promo pack card based on its Scryfall promo_types.
 * Only "promopack" triggers promo-pack URL segments; other types like
 * "beginnerbox" or "universesbeyond" do not.
 * @param {Object} card - Scryfall card object
 * @returns {boolean}
 */
function isPromoCard(card) {
  if (!card) return false;
  return !!(card.promo_types && card.promo_types.includes("promopack"));
}

/**
 * Detects the frame effect for a card from its Scryfall data.
 * @param {Object} card - Scryfall card object
 * @returns {string|null} Frame effect identifier or null
 */
function detectFrameEffect(card) {
  if (!card) return null;

  if (card.frame === "future") return "future-frame";

  if (card.frame_effects && card.frame_effects.length > 0) {
    const effect = card.frame_effects[0];
    if (effect === "extendedart") return "extended-art";
    if (effect === "showcase") return "showcase";
    if (effect === "borderless") return "borderless";
  }

  if (card.border_color === "borderless") return "borderless";
  if (card.border_color === "white") return "white-border";

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
 * Normalizes a frame effect string for a specific store's URL format.
 * Different stores use different naming conventions for the same effects.
 * @param {string} frameEffect
 * @param {string} storeKey
 * @returns {string|null} Normalized frame effect or null if not applicable for this store
 */
function normalizeFrameEffect(frameEffect, storeKey) {
  if (frameEffect === "retro" && (storeKey === "f2f" || storeKey === "401games")) {
    return "retro-frame";
  }

  if (frameEffect === "future-frame") {
    if (storeKey === "hoc") return "future-sight";
    if (storeKey === "f2f") return "future-frame";
    if (storeKey === "401games") return null;
  }

  if (frameEffect === "white-border") {
    if (storeKey === "401games") return null;
    return "white-border";
  }

  return frameEffect;
}

/**
 * Returns true if the card has a special frame effect or is a promo pack card.
 * Used to filter non-standard printings from cheapest-price searches.
 * @param {Object} card - Scryfall card object
 * @returns {boolean}
 */
function hasSpecialFrameEffect(card) {
  const hasSpecialFrame =
    card.frame_effects &&
    card.frame_effects.length > 0 &&
    card.frame_effects.some((effect) => SPECIAL_FRAME_EFFECTS.includes(effect));

  return hasSpecialFrame || isPromoCard(card);
}
